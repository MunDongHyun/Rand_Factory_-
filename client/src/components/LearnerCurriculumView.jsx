import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
import '../styles/LearnerCurriculum.css';
import '../styles/Curriculum.css';

// --- 유틸 함수 ---
const normalizeWeekPlan = (plan) => {
  if (Array.isArray(plan)) return plan;
  if (plan && typeof plan === 'object') return [plan];
  return [];
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const STATUS_LABEL = {
  submitted: '피드백 대기 중',
  feedback_given: '피드백 받음',
  resubmit_requested: '재제출 요청됨',
};

// --- 메인 컴포넌트 ---
function LearnerCurriculumView({ curriculumDetailRef }) {
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [submissions, setSubmissions] = useState([]);


  const [selectedId, setSelectedId] = useState(null);

  const [expandedWeek, setExpandedWeek] = useState(null);

  const [activeTask, setActiveTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [submitFiles, setSubmitFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [editorFullscreen, setEditorFullscreen] = useState(false);

  const submitEditorRef = useRef(null);

  const loadSubmissions = () => {
    return api.get('/task-submissions/my')
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch(() => { });
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/curricula')
        .then((res) => setCurriculums(Array.isArray(res.data) ? res.data : []))
        .catch((err) => setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.')),
      loadSubmissions(),
    ]).finally(() => setLoading(false));
  }, []);


  const selectedCurriculum = curriculums.find((c) => c.cur_id === selectedId) || null;



  const getLatestSubmission = (curId, week, assignmentIdx) => {
    const matches = submissions.filter((s) => {
      if (s.task_curriculum_id !== curId || s.task_week_number !== week) return false;
      if (s.task_submitted_content && typeof s.task_submitted_content === 'object') {
        return Number(s.task_submitted_content.assignmentIdx) === Number(assignmentIdx);
      }
      return false;
    });
    if (matches.length === 0) return null;
    return matches.reduce((latest, s) => {
      return new Date(s.task_submitted_at || 0) > new Date(latest.task_submitted_at || 0) ? s : latest;
    });
  };

  const submittedWeekCount = (curId) => {
    const set = new Set(submissions.filter((s) => s.task_curriculum_id === curId).map((s) => s.task_week_number));
    return set.size;
  };


  const weekPlan = normalizeWeekPlan(selectedCurriculum?.cur_week_plan);
  const totalWeeks = weekPlan.length || selectedCurriculum?.cur_duration_weeks || 0;
  const submittedCount = submittedWeekCount(selectedId);
  const overallProgress = totalWeeks > 0 ? Math.round((submittedCount / totalWeeks) * 100) : 0;
  const currentSubmission = activeTask
    ? getLatestSubmission(selectedId, activeTask.week, activeTask.assignmentIdx)
    : null;


  const toggleWeek = (week) => {
    setExpandedWeek((prev) => (prev === week ? null : week));
  };

  const taskDraftKey = (curId, week, idx) => `task_draft:${curId}:${week}:${idx}`;

  const handleAssignmentClick = (week, assignmentIdx, assignmentData) => {
    const sub = getLatestSubmission(selectedId, week, assignmentIdx);
    const willEdit = !sub || sub.task_status === 'resubmit_requested';

    let data = assignmentData;
    if (willEdit && selectedId != null) {
      if (sub?.task_submitted_content?.text) {
        data = { ...assignmentData, template_content: sub.task_submitted_content.text };
      } else {
        try {
          const draft = localStorage.getItem(taskDraftKey(selectedId, week, assignmentIdx));
          if (draft != null) {
            data = { ...assignmentData, template_content: draft };
            toast.info('임시저장본을 불러왔습니다.');
          }
        } catch { }
      }
    }

    setActiveTask({ week, assignmentIdx, assignmentData: data });
    setIsEditing(willEdit);
    setSubmitFiles([]);
    setSubmitError(null);
  };

  const saveTaskDraft = () => {
    if (!activeTask || !submitEditorRef.current || selectedId == null) return;
    try {
      const htmlCopy = submitEditorRef.current.cloneNode(true);
      htmlCopy.querySelectorAll('[contenteditable="true"]').forEach((el) => {
        if (el.querySelector('.placeholder-text')) el.innerHTML = '';
        el.removeAttribute('contenteditable');
        el.removeAttribute('style');
      });
      const key = taskDraftKey(selectedId, activeTask.week, activeTask.assignmentIdx);
      localStorage.setItem(key, htmlCopy.innerHTML);
      toast.success('임시저장 되었습니다.');
    } catch {
      toast.error('임시저장에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (!activeTask || !curriculumDetailRef) return;
    curriculumDetailRef.current = true;
    window.history.pushState({ taskOpen: true, t: Date.now() }, '');
    const onPop = () => {
      setActiveTask(null);
      setEditorFullscreen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      curriculumDetailRef.current = false;
    };
  }, [activeTask, curriculumDetailRef]);

  useEffect(() => {
    if (isEditing && activeTask && submitEditorRef.current) {
      const container = submitEditorRef.current;
      const templateHtml = activeTask.assignmentData.template_content || '';
      let injectedCount = 0;

      container.querySelectorAll('td').forEach((td) => {
        td.setAttribute('contenteditable', 'true');
        td.style.border = "2px dashed #90cdf4";
        td.style.padding = "10px";
        td.style.cursor = "text";
        td.style.minHeight = "40px";
        td.style.transition = "all 0.2s";

        if (td.textContent.trim() === '' && !td.querySelector('img')) {
          td.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">클릭하여 내용 입력</span>';
        }
        td.onfocus = function () {
          if (this.querySelector('.placeholder-text')) this.innerHTML = '';
          this.style.border = "2px solid #3182ce";
          this.style.outline = "none";
          this.style.backgroundColor = "#ebf8ff";
        };
        td.onblur = function () {
          if (this.textContent.trim() === '')
            this.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">클릭하여 내용 입력</span>';
          this.style.border = "2px dashed #90cdf4";
          this.style.backgroundColor = "transparent";
        };
        injectedCount++;
      });

      container.querySelectorAll('p').forEach((p) => {
        if (p.closest('td')) return;
        if (p.textContent.trim() === '' && !p.querySelector('img')) {
          p.setAttribute('contenteditable', 'true');
          p.style.border = "1px dashed #cbd5e0";
          p.style.padding = "12px";
          p.style.borderRadius = "6px";
          p.style.cursor = "text";
          p.style.minHeight = "40px";
          p.style.transition = "all 0.2s";

          p.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">답변을 입력해주세요...</span>';
          p.onfocus = function () {
            if (this.querySelector('.placeholder-text')) this.innerHTML = '';
            this.style.border = "1px solid #3182ce";
            this.style.outline = "none";
            this.style.backgroundColor = "#f7fafc";
          };
          p.onblur = function () {
            if (this.textContent.trim() === '')
              this.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">답변을 입력해주세요...</span>';
            this.style.border = "1px dashed #cbd5e0";
            this.style.backgroundColor = "transparent";
          };
          injectedCount++;
        }
      });

      if (injectedCount === 0 && templateHtml !== '') {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.style.marginTop = "24px";
        fallbackDiv.style.paddingTop = "24px";
        fallbackDiv.style.borderTop = "2px dashed #e2e8f0";
        fallbackDiv.innerHTML = '<h4 style="margin-top:0; font-size:16px; color:#2d3748; font-weight:700;">📝 답변 작성</h4>';

        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        editableDiv.style.border = "2px dashed #90cdf4";
        editableDiv.style.padding = "16px";
        editableDiv.style.borderRadius = "8px";
        editableDiv.style.minHeight = "150px";
        editableDiv.style.cursor = "text";
        editableDiv.style.transition = "all 0.2s";

        editableDiv.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">여기에 내용을 자유롭게 작성해주세요...</span>';
        editableDiv.onfocus = function () {
          if (this.querySelector('.placeholder-text')) this.innerHTML = '';
          this.style.border = "2px solid #3182ce";
          this.style.outline = "none";
          this.style.backgroundColor = "#ebf8ff";
        };
        editableDiv.onblur = function () {
          if (this.textContent.trim() === '')
            this.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">여기에 내용을 자유롭게 작성해주세요...</span>';
          this.style.border = "2px dashed #90cdf4";
          this.style.backgroundColor = "transparent";
        };
        fallbackDiv.appendChild(editableDiv);
        container.appendChild(fallbackDiv);
      }

      if (templateHtml === '') {
        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        editableDiv.style.border = "2px dashed #90cdf4";
        editableDiv.style.padding = "20px";
        editableDiv.style.borderRadius = "8px";
        editableDiv.style.minHeight = "200px";
        editableDiv.style.cursor = "text";
        editableDiv.style.transition = "all 0.2s";

        editableDiv.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">등록된 템플릿이 없습니다. 자유롭게 과제 내용을 작성해주세요.</span>';
        editableDiv.onfocus = function () {
          if (this.querySelector('.placeholder-text')) this.innerHTML = '';
          this.style.border = "2px solid #3182ce";
          this.style.outline = "none";
          this.style.backgroundColor = "#ebf8ff";
        };
        editableDiv.onblur = function () {
          if (this.textContent.trim() === '')
            this.innerHTML = '<span class="placeholder-text" style="color:#a0aec0;font-style:italic;pointer-events:none;">등록된 템플릿이 없습니다. 자유롭게 과제 내용을 작성해주세요.</span>';
          this.style.border = "2px dashed #90cdf4";
          this.style.backgroundColor = "transparent";
        };
        container.appendChild(editableDiv);
      }
    }
  }, [isEditing, activeTask]);

  const handleFileSelect = (e) => {
    setSubmitFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    e.target.value = '';
  };
  const handleFileRemove = (idx) => setSubmitFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try { await downloadAttachment(submissionId, attachment); }
    catch (err) { toast.error(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.'); }
  };

  const handleSubmit = async () => {
    if (!activeTask || !submitEditorRef.current) return;

    const htmlCopy = submitEditorRef.current.cloneNode(true);
    let hasContent = false;

    htmlCopy.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      if (el.querySelector('.placeholder-text')) el.innerHTML = '';
      if (el.textContent.trim() !== '') hasContent = true;
      el.removeAttribute('contenteditable');
      el.removeAttribute('style');
    });

    if (!hasContent && submitFiles.length === 0) {
      setSubmitError('작성 내용이나 첨부파일 중 하나는 있어야 합니다.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.post('/task-submissions', {
        task_curriculum_id: selectedId,
        task_week_number: activeTask.week,
        task_submitted_content: {
          text: htmlCopy.innerHTML.trim(),
          assignmentIdx: activeTask.assignmentIdx
        },
      });
      const submissionId = res.data?.task_submission_id;

      const failures = [];
      for (const file of submitFiles) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await api.post(`/task-submissions/${submissionId}/attachments`, formData);
        } catch (err) {
          failures.push(`${file.name}: ${err.response?.data?.detail || '업로드 실패'}`);
        }
      }

      await loadSubmissions();
      setIsEditing(false);
      try {
        localStorage.removeItem(taskDraftKey(selectedId, activeTask.week, activeTask.assignmentIdx));
      } catch { }
      if (failures.length > 0) toast.warn(`제출은 완료됐지만 일부 첨부 업로드에 실패했습니다:\n${failures.join('\n')}`);
      else toast.success("성공적으로 제출되었습니다.");

    } catch (err) {
      setSubmitError(err.response?.data?.detail || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };






  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">내 학습 커리큘럼</h2>
      {loading && <p className="curriculumStatusMsg">커리큘럼을 불러오는 중...</p>}
      {error && <p className="curriculumStatusMsg error">{error}</p>}
      {!loading && !error && curriculums.length === 0 && (
        <p className="curriculumStatusMsg">배정된 커리큘럼이 없습니다.</p>
      )}

      {!loading && !error && curriculums.length > 0 && (
        <div className="curriculumWrapper">
          <div className="curriculumLayout">

            {/* 사이드바 */}
            <aside className="curriculumSidebar">
              <p className="curriculumSidebarTitle">내 커리큘럼</p>
              <div className="curriculumSidebarDivider" />
              <ul className="curriculumSidebarList">
                {curriculums.map((c) => (
                  <li
                    key={c.cur_id}
                    className={`curriculumSidebarItem ${selectedId === c.cur_id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedId(c.cur_id);
                      setExpandedWeek(null);
                      setActiveTask(null);
                    }}
                  >
                    {c.cur_title}
                  </li>
                ))}
              </ul>
            </aside>

            <div className="curriculumLeft">
              {selectedCurriculum ? (
                <>
                  <div className="extracted-detail-header">
                    <div className="curriculumTitleGroup">
                      <h3 className="curriculumDetailTitle">{selectedCurriculum.cur_title}</h3>
                      <p className="curriculumDetailDesc">{selectedCurriculum.cur_learning_goal || ''}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'var(--line)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--primary)', width: `${overallProgress}%`, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {overallProgress}%
                    </span>
                  </div>

                  <div className="curriculumSteps">
                    {weekPlan.map((step) => {
                      const isExpanded = expandedWeek === step.week;
                      return (
                        <div
                          key={step.week}
                          className={`extracted-accordion-item ${isExpanded ? 'active' : ''}`}
                        >
                          <div className={`extracted-accordion-header ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleWeek(step.week)}>
                            <span className="extracted-week-label">{step.week}주차</span>
                            <span className="extracted-theme-label">{step.theme || '주제 미지정'}</span>
                            <span className="extracted-toggle-label">{isExpanded ? '▲' : '▼'}</span>
                          </div>


                          {isExpanded && (
                            <div className="extracted-accordion-body" onClick={(e) => e.stopPropagation()}>

                              {step.learning_objective && (
                                <div className="extracted-section-margin">
                                  <h4 className="extracted-objective-title">학습 목표</h4>
                                  <p className="extracted-objective-text">{step.learning_objective}</p>
                                </div>
                              )}

                              {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                                <div className="extracted-section-margin">
                                  <h4 className="extracted-task-title">추천 자료</h4>
                                  {step.recommended_articles.map((article, i) => {
                                    const hasValidUrl = article.url && article.url.trim() !== '';
                                    return (
                                      <div key={i} className="extracted-ref-item">
                                        {hasValidUrl
                                          ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="extracted-ref-link">🔗 {article.title}</a>
                                          : <span className="extracted-ref-doc">📁 {article.title}</span>}
                                        {(article.reason_for_reading || article.why_relevant) && (
                                          <p className="extracted-ref-reason">✓ {article.reason_for_reading || article.why_relevant}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {Array.isArray(step.assignments) && step.assignments.length > 0 && (
                                <div className="extracted-section-margin">
                                  <h4 className="extracted-task-title">제출 과제</h4>
                                  {step.assignments.map((a, idx) => {
                                    const sub = getLatestSubmission(selectedId, step.week, idx);
                                    const isActive = activeTask?.week === step.week && activeTask?.assignmentIdx === idx;
                                    return (
                                      <div
                                        key={idx}
                                        className={`extracted-assignment-card ${isActive ? 'active' : ''}`}
                                        onClick={() => handleAssignmentClick(step.week, idx, a)}
                                        style={{
                                          cursor: 'pointer',
                                          border: isActive ? '1px solid var(--primary)' : '1px solid rgba(58, 74, 92, 0.18)',
                                          background: isActive ? '#EAF3F8' : 'var(--card)',
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <strong className="extracted-assignment-name">{a.title || `과제 ${idx + 1}`}</strong>
                                          {sub && (
                                            <span className={`submissionStatusBadge ${sub.task_status}`}>
                                              {STATUS_LABEL[sub.task_status] || '제출 완료'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="curriculumRightEmpty">
                  <p>왼쪽에서 커리큘럼을 선택하세요.</p>
                </div>
              )}
            </div>

            {/* 우측: 과제 상세 */}
            <div className="curriculumRight">
              {!activeTask ? (
                <div className="curriculumRightEmpty">
                  <p>왼쪽 주차 목록에서 과제를 선택하면 상세 내용이 표시됩니다.</p>
                </div>
              ) : (
                <div className="curriculumRightContent">

                  {/* 헤더: 제목 + 전체보기 버튼 */}
                  <div style={{
                    marginBottom: '24px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--card)',
                    zIndex: 1,
                  }}>
                    <div>
                      <span style={{ fontSize: '13px', color: '#718096', fontWeight: '600' }}>
                        {activeTask.week}주차 과제
                      </span>
                      <h3 className="curriculumDetailTitle" style={{ marginTop: '4px', fontSize: '22px' }}>
                        {activeTask.assignmentData.title}
                      </h3>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="fullscreenBtn"
                        onClick={() => setEditorFullscreen(prev => !prev)}
                      >
                        {editorFullscreen ? '축소' : '전체보기'}
                      </button>
                    )}
                  </div>
                  {/* 작성 모드 */}
                  {isEditing ? (
                    <div className={editorFullscreen ? 'editorFullscreenWrap' : ''}>

                      {editorFullscreen && (
                        <div style={{
                          marginBottom: '24px',
                          paddingBottom: '16px',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div>
                            <span style={{ fontSize: '13px', color: '#718096', fontWeight: '600' }}>
                              {activeTask.week}주차 과제 (전체화면 모드)
                            </span>
                            <h3 className="curriculumDetailTitle" style={{ marginTop: '4px', fontSize: '22px' }}>
                              {activeTask.assignmentData.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            className="fullscreenBtn"
                            onClick={() => setEditorFullscreen(false)}
                          >
                            축소
                          </button>
                        </div>
                      )}


                      {!editorFullscreen && (
                        <p style={{ fontSize: '13px', color: '#718096', marginBottom: '12px' }}>
                          마우스로 표의 푸른 점선 빈칸을 클릭하여 내용을 채워주세요.
                        </p>
                      )}
                      {editorFullscreen && (
                        <p style={{ fontSize: '13px', color: '#718096', marginBottom: '12px' }}>
                          마우스로 표의 푸른 점선 빈칸을 클릭하여 내용을 채워주세요.
                        </p>
                      )}

                      <div
                        className="template-render learnerTemplateRender"
                        contentEditable={false}
                        ref={submitEditorRef}
                        dangerouslySetInnerHTML={{ __html: activeTask.assignmentData.template_content || '' }}
                        style={{
                          minHeight: '400px',
                          border: '1px solid #cbd5e0',
                          borderRadius: '8px',
                          padding: '24px',
                          background: '#fff',
                          color: '#2d3748',
                          lineHeight: 1.6,
                          fontSize: '15px',
                        }}
                      />

                      <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e0' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#4a5568', margin: '0 0 10px 0' }}>📎 첨부파일 추가</h4>
                        <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                          <input type="file" multiple onChange={handleFileSelect} disabled={submitting} style={{ display: 'none' }} />
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#3182ce', background: '#fff', border: '1px solid #3182ce', padding: '6px 14px', borderRadius: '6px' }}>
                            + 파일 선택
                          </span>
                        </label>
                        {submitFiles.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
                            {submitFiles.map((f, i) => (
                              <li key={i} style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px', marginBottom: '6px' }}>
                                <span style={{ flex: 1, fontSize: '13px', color: '#2d3748' }}>{f.name}</span>
                                <span style={{ fontSize: '12px', color: '#a0aec0', marginRight: '12px' }}>{formatBytes(f.size)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleFileRemove(i)}
                                  disabled={submitting}
                                  style={{ border: 'none', background: '#fff5f5', color: '#e53e3e', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  삭제
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {submitError && (
                        <p style={{ color: '#e53e3e', background: '#fff5f5', padding: '12px', borderRadius: '6px', fontSize: '13px', marginTop: '12px' }}>
                          {submitError}
                        </p>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '8px' }}>
                        {currentSubmission && (
                          <button
                            onClick={() => setIsEditing(false)}
                            disabled={submitting}
                            style={{ background: '#fff', border: '1px solid #cbd5e0', color: '#718096', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', marginRight: 'auto' }}
                          >
                            취소
                          </button>
                        )}

                        <button
                          onClick={saveTaskDraft}
                          disabled={submitting}
                          style={{ background: '#fff', border: '1px solid var(--ink)', color: 'var(--ink)', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
                        >
                          임시저장
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={submitting}
                          style={{ background: 'var(--ink)', border: 'none', color: '#fff', padding: '12px 32px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', transition: 'background 0.2s' }}
                        >
                          {submitting ? '제출 중...' : '최종 과제 제출'}
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="managerSubmissionItemBody" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                      <div className="managerSubmissionContent" style={{ marginBottom: '24px' }}>
                        <p className="managerSubmissionContentLabel" style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>내가 제출한 내용</p>
                        <div
                          className="managerSubmissionContentBody template-render"
                          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', minHeight: '200px' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentSubmission?.task_submitted_content?.text) || '(내용 없음)' }}
                        />
                      </div>

                      {Array.isArray(currentSubmission?.task_submitted_content?.attachments) && currentSubmission.task_submitted_content.attachments.length > 0 && (
                        <div className="managerSubmissionAttachments" style={{ marginBottom: '24px' }}>
                          <p className="managerSubmissionContentLabel" style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>📎 첨부파일</p>
                          <ul className="managerSubmissionAttachmentList">
                            {currentSubmission.task_submitted_content.attachments.map((a, i) => (
                              <li key={i} className="managerSubmissionAttachmentItem" style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <button type="button" className="managerSubmissionAttachmentLink" onClick={() => handleAttachmentDownload(currentSubmission.task_submission_id, a)} style={{ fontWeight: '600' }}>
                                  {a.filename || a.stored_name}
                                </button>
                                <span className="managerSubmissionAttachmentSize">{formatBytes(a.size)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {currentSubmission?.task_manager_feedback && (
                        <div className="managerSubmissionExistingFeedback" style={{ background: '#ebf8ff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #3182ce', marginBottom: '24px' }}>
                          <p className="managerSubmissionContentLabel" style={{ color: '#2b6cb0', fontWeight: '700', marginBottom: '8px' }}>
                            매니저 피드백
                            <span style={{ fontSize: '12px', color: '#718096', fontWeight: '400', marginLeft: '8px' }}>
                              {formatDateTime(currentSubmission.task_feedback_at)}
                            </span>
                          </p>
                          <div style={{ fontSize: '14px', color: '#2d3748', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {currentSubmission.task_manager_feedback}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed #e2e8f0', paddingTop: '20px' }}>
                        <button
                          onClick={() => {
                            const sub = currentSubmission;
                            if (sub?.task_submitted_content?.text) {
                              setActiveTask(prev => ({
                                ...prev,
                                assignmentData: {
                                  ...prev.assignmentData,
                                  template_content: sub.task_submitted_content.text,
                                }
                              }));
                            }
                            setIsEditing(true)
                          }}
                          style={{ background: '#fff', border: '1px solid #cbd5e0', color: '#4a5568', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
                        >
                          과제 수정 / 재제출하기
                        </button>
                      </div>
                    </div>
                  )}


                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LearnerCurriculumView;
