import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
import '../styles/LearnerCurriculum.css';

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

  const [modalState, setModalState] = useState(null);
  const [viewSubmissionModal, setViewSubmissionModal] = useState(null);

  const [submitFiles, setSubmitFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const submitEditorRef = useRef(null);

  const loadSubmissions = () => {
    return api.get('/task-submissions/my')
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
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

  useEffect(() => {
    if (curriculumDetailRef) curriculumDetailRef.current = Boolean(selectedId);
    const onPop = () => {
      if (!selectedId) return;
      setSelectedId(null);
      setExpandedWeek(null);
      if (curriculumDetailRef) curriculumDetailRef.current = false;
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (curriculumDetailRef) curriculumDetailRef.current = false;
    };
  }, [selectedId, curriculumDetailRef]);

  const selected = curriculums.find((c) => c.cur_id === selectedId) || null;

  const getLatestSubmission = (curId, week) => {
    const matches = submissions.filter((s) => s.task_curriculum_id === curId && s.task_week_number === week);
    if (matches.length === 0) return null;
    return matches.reduce((latest, s) => {
      if (!latest) return s;
      return new Date(s.task_submitted_at || 0) > new Date(latest.task_submitted_at || 0) ? s : latest;
    }, null);
  };

  const submittedWeekCount = (curId) => {
    const set = new Set(submissions.filter((s) => s.task_curriculum_id === curId).map((s) => s.task_week_number));
    return set.size;
  };

  const handleSelect = (curId) => {
    setSelectedId(curId);
    setExpandedWeek(null);
    window.history.pushState({ view: 'curriculum', curriculumDetail: true, curId }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedId(null);
    setExpandedWeek(null);
  };

  const toggleWeek = (week) => {
    setExpandedWeek((prev) => (prev === week ? null : week));
  };

  const openSubmitModal = (curId, week) => {
    const targetCurriculum = curriculums.find((c) => c.cur_id === curId) || selected;
    const targetWeek = normalizeWeekPlan(targetCurriculum?.cur_week_plan).find((s) => s.week === week);
    const templateAssignments = (targetWeek && Array.isArray(targetWeek.assignments))
      ? targetWeek.assignments.filter((a) => a && a.template_content)
      : [];

    const initialContent = templateAssignments.length > 0
      ? templateAssignments.map((a) => {
          const title = a.title ? `<h3>${escapeHtml(a.title)}</h3>` : '';
          return `${title}${a.template_content}`;
        }).join('<hr>')
      : '';

    setModalState({ curId, week, fullscreen: false, templateHtml: initialContent });
    setSubmitFiles([]);
    setSubmitError(null);
  };

  const toggleSubmitFullscreen = () =>
    setModalState((prev) => (prev ? { ...prev, fullscreen: !prev.fullscreen } : prev));

  const closeSubmitModal = () => {
    if (submitting) return;
    setModalState(null);
    setSubmitFiles([]);
    setSubmitError(null);
  };

  useEffect(() => {
    if (modalState && submitEditorRef.current) {
      const container = submitEditorRef.current;
      let injectedCount = 0;

      container.querySelectorAll('td').forEach((td) => {
        if (td.textContent.trim() === '' && !td.querySelector('img')) {
          td.setAttribute('contenteditable', 'true');
          td.classList.add('learner-editable-cell');
          td.innerHTML = '<span class="placeholder-text">클릭하여 내용 입력</span>';
          td.onfocus = function () {
            if (this.querySelector('.placeholder-text')) this.innerHTML = '';
            this.classList.add('focused-cell');
          };
          td.onblur = function () {
            if (this.textContent.trim() === '')
              this.innerHTML = '<span class="placeholder-text">클릭하여 내용 입력</span>';
            this.classList.remove('focused-cell');
          };
          injectedCount++;
        }
      });

      container.querySelectorAll('p').forEach((p) => {
        if (p.closest('td')) return;
        if (p.textContent.trim() === '' && !p.querySelector('img')) {
          p.setAttribute('contenteditable', 'true');
          p.classList.add('learner-editable-p');
          p.innerHTML = '<span class="placeholder-text">답변을 입력해주세요...</span>';
          p.onfocus = function () {
            if (this.querySelector('.placeholder-text')) this.innerHTML = '';
            this.classList.add('focused-p');
          };
          p.onblur = function () {
            if (this.textContent.trim() === '')
              this.innerHTML = '<span class="placeholder-text">답변을 입력해주세요...</span>';
            this.classList.remove('focused-p');
          };
          injectedCount++;
        }
      });

      if (injectedCount === 0 && modalState.templateHtml !== '') {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'learner-fallback-container';
        fallbackDiv.innerHTML = '<h4>📝 답변 작성</h4>';
        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        editableDiv.className = 'learner-editable-fallback';
        editableDiv.innerHTML = '<span class="placeholder-text">여기에 내용을 자유롭게 작성해주세요...</span>';
        editableDiv.onfocus = function () {
          if (this.querySelector('.placeholder-text')) this.innerHTML = '';
          this.classList.add('focused-fallback');
        };
        editableDiv.onblur = function () {
          if (this.textContent.trim() === '')
            this.innerHTML = '<span class="placeholder-text">여기에 내용을 자유롭게 작성해주세요...</span>';
          this.classList.remove('focused-fallback');
        };
        fallbackDiv.appendChild(editableDiv);
        container.appendChild(fallbackDiv);
      }

      if (modalState.templateHtml === '') {
        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        editableDiv.className = 'learner-editable-fallback empty-template';
        editableDiv.innerHTML =
          '<span class="placeholder-text">등록된 템플릿이 없습니다. 자유롭게 과제 내용을 작성해주세요.</span>';
        editableDiv.onfocus = function () {
          if (this.querySelector('.placeholder-text')) this.innerHTML = '';
          this.classList.add('focused-fallback');
        };
        editableDiv.onblur = function () {
          if (this.textContent.trim() === '')
            this.innerHTML =
              '<span class="placeholder-text">등록된 템플릿이 없습니다. 자유롭게 과제 내용을 작성해주세요.</span>';
          this.classList.remove('focused-fallback');
        };
        container.appendChild(editableDiv);
      }
    }
  }, [modalState?.templateHtml]);

  const handleFileSelect = (e) => {
    setSubmitFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    e.target.value = '';
  };

  const handleFileRemove = (idx) => setSubmitFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try {
      await downloadAttachment(submissionId, attachment);
    } catch (err) {
      toast.error(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.');
    }
  };

  const handleSubmit = async () => {
    if (!modalState || !submitEditorRef.current) return;

    const htmlCopy = submitEditorRef.current.cloneNode(true);
    let hasContent = false;

    htmlCopy.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      if (el.querySelector('.placeholder-text')) el.innerHTML = '';
      if (el.textContent.trim() !== '') hasContent = true;
      el.removeAttribute('contenteditable');
      el.classList.remove(
        'learner-editable-cell', 'learner-editable-p', 'learner-editable-fallback',
        'focused-cell', 'focused-p', 'focused-fallback'
      );
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
        task_curriculum_id: modalState.curId,
        task_week_number: modalState.week,
        task_submitted_content: { text: htmlCopy.innerHTML.trim() },
      });
      const submissionId = res.data?.task_submission_id;

      const failures = [];
      for (const file of submitFiles) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await api.post(`/task-submissions/${submissionId}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (err) {
          failures.push(`${file.name}: ${err.response?.data?.detail || '업로드 실패'}`);
        }
      }

      await loadSubmissions();
      if (failures.length > 0)
        toast.warn(`제출은 완료됐지만 일부 첨부 업로드에 실패했습니다:\n${failures.join('\n')}`);
      closeSubmitModal();
    } catch (err) {
      setSubmitError(err.response?.data?.detail || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 커리큘럼 목록 뷰 ──
  if (!selected) {
    return (
      <div className="curriculumPageContainer">
        <h2 className="sectionTitle">내 학습 커리큘럼</h2>
        {loading && <p className="learnerInlineHint">커리큘럼을 불러오는 중...</p>}
        {error && <p className="learnerInlineError">{error}</p>}
        {!loading && !error && curriculums.length === 0 && (
          <p className="learnerInlineMuted">
            배정된 커리큘럼이 아직 없습니다. 매니저가 커리큘럼을 배정해주면 여기에 표시됩니다.
          </p>
        )}
        <div className="learnerCurriculumGrid">
          {curriculums.map((c) => {
            const weeks = normalizeWeekPlan(c.cur_week_plan).length || c.cur_duration_weeks || 0;
            const submitted = submittedWeekCount(c.cur_id);
            const progress = weeks > 0 ? Math.round((submitted / weeks) * 100) : 0;
            return (
              <div key={c.cur_id} className="learnerCurriculumCard" onClick={() => handleSelect(c.cur_id)}>
                <div className="learnerCurriculumCardHeader">
                  <p className="learnerCurriculumCardSubtitle">
                    {c.cur_target_industry || '-'} · {c.cur_target_job || '-'}
                  </p>
                  <h3 className="learnerCurriculumCardTitle">{c.cur_title}</h3>
                </div>
                <div className="learnerCurriculumCardMeta">
                  <span className="learnerCurriculumCardBadge">{weeks}주 과정</span>
                  {c.cur_status === 'active' && (
                    <span className="learnerCurriculumCardBadge active">진행 중</span>
                  )}
                  <span className="learnerCurriculumCardBadge">제출 {submitted}/{weeks}</span>
                </div>
                <div className="learnerProgressBar">
                  <div className="learnerProgressFill" style={{ width: `${progress}%` }} />
                </div>
                {c.cur_learning_goal && (
                  <p className="learnerCurriculumCardGoal">🎯 {c.cur_learning_goal}</p>
                )}
                <div className="learnerCurriculumCardFooter">주차별 학습 보기 →</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 커리큘럼 상세 뷰 ──
  const weekPlan = normalizeWeekPlan(selected.cur_week_plan);
  const totalWeeks = weekPlan.length || selected.cur_duration_weeks;
  const submittedCount = submittedWeekCount(selected.cur_id);
  const progress = totalWeeks > 0 ? Math.round((submittedCount / totalWeeks) * 100) : 0;

  return (
    <div className="curriculumPageContainer">
      <button className="authorBackBtn" onClick={handleBack}>← 커리큘럼 목록으로</button>

      <div className="learnerDetailHeader">
        <p className="learnerDetailSubtitle">
          {selected.cur_target_industry || '-'} · {selected.cur_target_job || '-'} · {totalWeeks}주 과정
        </p>
        <h2 className="learnerDetailTitle">{selected.cur_title}</h2>
        {selected.cur_learning_goal && (
          <p className="learnerDetailGoal">🎯 {selected.cur_learning_goal}</p>
        )}
        <div className="learnerDetailProgress">
          <div className="learnerProgressBar">
            <div className="learnerProgressFill" style={{ width: `${progress}%` }} />
          </div>
          <span className="learnerDetailProgressText">
            {submittedCount} / {totalWeeks} 주차 제출 ({progress}%)
          </span>
        </div>
      </div>

      {/* 주차 스텝퍼 */}
      <div className="learnerWeekStepper">
        {weekPlan.map((step) => {
          const sub = getLatestSubmission(selected.cur_id, step.week);
          const isActive = expandedWeek === step.week;
          const stateClass = sub ? `submitted ${sub.task_status || ''}` : '';
          return (
            <button
              key={step.week}
              className={`learnerWeekStep ${isActive ? 'active' : ''} ${stateClass}`}
              onClick={() => toggleWeek(step.week)}
            >
              <span className="learnerWeekStepNum">{step.week}</span>
              <span className="learnerWeekStepLabel">주차</span>
              {sub && <span className="learnerWeekStepDot" />}
            </button>
          );
        })}
      </div>

      {/* 주차 카드 목록 */}
      <div className="learnerWeekList">
        {weekPlan.length === 0 && (
          <p className="learnerInlineMuted">주차별 계획이 아직 없습니다.</p>
        )}
        {weekPlan.map((step) => {
          const isExpanded = expandedWeek === step.week;
          const tasks = step.tasks || step.task;
          const sub = getLatestSubmission(selected.cur_id, step.week);
          const canResubmit = !sub || sub.task_status === 'resubmit_requested';

          return (
            <div key={step.week} className="learnerWeekCard">
              <div className="learnerWeekCardHeader" onClick={() => toggleWeek(step.week)}>
                <div>
                  <span className="learnerWeekCardWeek">{step.week}주차</span>
                  <span className="learnerWeekCardTheme">{step.theme || '주제 미지정'}</span>
                </div>
                <div className="learnerWeekCardHeaderRight">
                  {sub && (
                    <span className={`learnerWeekStatusBadge ${sub.task_status || ''}`}>
                      {STATUS_LABEL[sub.task_status] || '제출됨'}
                    </span>
                  )}
                  <span className="learnerWeekCardToggle">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="learnerWeekCardBody">
                  {step.learning_objective && (
                    <section className="learnerWeekSection">
                      <h4 className="learnerWeekSectionTitle">🎯 이번 주차 학습 목표</h4>
                      <p className="learnerWeekSectionText">{step.learning_objective}</p>
                    </section>
                  )}
                  {tasks && (
                    <section className="learnerWeekSection">
                      <h4 className="learnerWeekSectionTitle">📚 실습 과제</h4>
                      {Array.isArray(tasks) ? (
                        <ul className="learnerWeekSectionList">
                          {tasks.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      ) : (
                        <p className="learnerWeekSectionText">{tasks}</p>
                      )}
                    </section>
                  )}
                  {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                    <section className="learnerWeekSection">
                      <h4 className="learnerWeekSectionTitle">📖 추천 자료</h4>
                      {step.recommended_articles.map((article, i) => {
                        const targetUrl =
                          article.url?.trim()
                            ? article.url
                            : `https://www.google.com/search?q=${encodeURIComponent(article.title || '')}`;
                        return (
                          <div key={i} className="learnerWeekArticle">
                            <a
                              href={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="learnerWeekArticleLink"
                            >
                              {article.url?.trim() ? '🔗 ' : '🔍 '}{article.title}
                            </a>
                            {article.why_relevant && (
                              <p className="learnerWeekArticleReason">- {article.why_relevant}</p>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  )}

                  {sub && (
                    <section className="learnerWeekSubmission">
                      <h4 className="learnerWeekSectionTitle">📝 내 제출</h4>
                      <p className="learnerWeekSubmissionMeta">
                        제출일: {formatDateTime(sub.task_submitted_at)}
                      </p>
                      <button className="btn-view-submission" onClick={() => setViewSubmissionModal(sub)}>
                        제출한 내용 보기
                      </button>
                      {sub.task_manager_feedback ? (
                        <div className="learnerWeekFeedback">
                          <h5 className="learnerWeekFeedbackTitle">🗨 매니저 피드백</h5>
                          <p className="learnerWeekFeedbackMeta">{formatDateTime(sub.task_feedback_at)}</p>
                          <p className="learnerWeekFeedbackBody">{sub.task_manager_feedback}</p>
                        </div>
                      ) : (
                        <p className="learnerWeekFeedbackPending">아직 매니저 피드백이 없습니다.</p>
                      )}
                    </section>
                  )}

                  <div className="learnerWeekFooter">
                    {step.estimated_hours && (
                      <span className="learnerWeekBadge">⏱ 예상 {step.estimated_hours}시간</span>
                    )}
                    <button
                      className="learnerWeekSubmitBtn"
                      onClick={() => openSubmitModal(selected.cur_id, step.week)}
                      disabled={!canResubmit}
                      title={
                        canResubmit
                          ? '과제 제출'
                          : '이미 제출 완료 (재제출 요청 시 다시 활성화됩니다)'
                      }
                    >
                      {sub ? (canResubmit ? '재제출' : '제출 완료') : '과제제출'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 모달 1: 제출한 과제 확인 ── */}
      {viewSubmissionModal && (
        <>
          <div className="confirmOverlay" onClick={() => setViewSubmissionModal(null)} />
          <div className="submit-modal">
            {/* 헤더 */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 30px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <h3 className="sectionTitle" style={{ margin: 0 }}>제출한 과제 내용 확인</h3>
              <button
                onClick={() => setViewSubmissionModal(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#718096' }}
              >✕</button>
            </div>

            {/* 바디 */}
            <div style={{ flex: '1 1 0%', overflowY: 'auto', padding: '24px 30px', minHeight: 0 }}>
              <div
                className="learner-rendered-content learner-custom-form"
                style={{ border: 'none', minHeight: 'unset' }}
                dangerouslySetInnerHTML={{
                  __html: viewSubmissionModal.task_submitted_content?.text || '(내용 없음)',
                }}
              />
              {Array.isArray(viewSubmissionModal.task_submitted_content?.attachments) &&
                viewSubmissionModal.task_submitted_content.attachments.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: '700', color: '#4a5568', margin: '0 0 8px 0' }}>
                      📎 첨부파일
                    </h5>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {viewSubmissionModal.task_submitted_content.attachments.map((a, i) => (
                        <li
                          key={i}
                          style={{
                            display: 'flex', alignItems: 'center',
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            padding: '8px 12px', borderRadius: '6px', marginBottom: '6px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleAttachmentDownload(viewSubmissionModal.task_submission_id, a)}
                            style={{ border: 'none', background: 'none', color: '#2b6cb0', cursor: 'pointer', flex: 1, textAlign: 'left', fontWeight: '500' }}
                          >
                            {a.filename || a.stored_name}
                          </button>
                          <span style={{ fontSize: '11px', color: '#718096' }}>{formatBytes(a.size)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>

            {/* 푸터 */}
            <div style={{
              flexShrink: 0, padding: '16px 30px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end',
            }}>
              <button type="button" className="confirmBtnBack" onClick={() => setViewSubmissionModal(null)}>
                닫기
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 모달 2: 과제 제출 작성 ── */}
      {modalState && (
        <>
          <div className="confirmOverlay" onClick={closeSubmitModal} />
          <div className={`submit-modal ${modalState.fullscreen ? 'fullscreen' : ''}`}>
            {/* 헤더 */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 30px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <h3 className="sectionTitle" style={{ margin: 0 }}>
                {modalState.week}주차 과제 작성 및 제출
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={toggleSubmitFullscreen}
                  disabled={submitting}
                  style={{
                    fontSize: '12px', fontWeight: '600',
                    color: '#2b6cb0', background: '#ebf8ff',
                    border: '1px solid #bee3f8', borderRadius: '4px',
                    padding: '5px 12px', cursor: 'pointer',
                  }}
                >
                  {modalState.fullscreen ? '✕ 축소' : '⛶ 전체보기'}
                </button>
                <button
                  onClick={closeSubmitModal}
                  disabled={submitting}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#718096' }}
                >✕</button>
              </div>
            </div>

            {/* 힌트 텍스트 */}
            <p style={{
              flexShrink: 0,
              margin: '10px 30px',
              fontSize: '13px',
              color: '#718096',
              whiteSpace: 'pre-wrap',
            }}>
              마우스로 표의 푸른 점선 빈칸을 클릭하여 과제 내용을 빠짐없이 채워주세요.
            </p>

            {/* 바디 (스크롤 영역) */}
            <div style={{
              flex: '1 1 0%',
              overflowY: 'auto',
              padding: '0 30px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              minHeight: 0,
            }}>
              {/* 에디터 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
                <div
                  className="learner-custom-form"
                  contentEditable={false}
                  ref={submitEditorRef}
                  dangerouslySetInnerHTML={{ __html: modalState.templateHtml }}
                  style={{
                    flex: 1,
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    padding: '24px',
                    overflowY: 'auto',
                    background: '#fff',
                  }}
                />
              </div>

              {/* 첨부파일 */}
              <div style={{ flexShrink: 0 }}>
                <h4 style={{
                  fontSize: '11px', fontWeight: '700', color: '#718096',
                  textTransform: 'uppercase', margin: '0 0 8px 0',
                }}>
                  📎 첨부파일 추가
                </h4>
                <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  <input type="file" multiple onChange={handleFileSelect} disabled={submitting} style={{ display: 'none' }} />
                  <span style={{
                    fontSize: '12px', fontWeight: '600', color: '#2b6cb0',
                    background: '#ebf8ff', border: '1px dashed #63b3ed',
                    padding: '6px 14px', borderRadius: '4px',
                  }}>
                    + 파일 선택
                  </span>
                </label>
                {submitFiles.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0 0' }}>
                    {submitFiles.map((f, i) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'center',
                          background: '#f8fafc', border: '1px solid #e2e8f0',
                          padding: '6px 12px', borderRadius: '4px', marginBottom: '4px',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: '13px', color: '#2d3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#718096', marginRight: '10px' }}>
                          {formatBytes(f.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleFileRemove(i)}
                          disabled={submitting}
                          style={{
                            border: 'none', background: '#fed7d7', color: '#c53030',
                            padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
                          }}
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 에러 */}
            {submitError && (
              <p style={{
                margin: '0 30px', color: '#e53e3e', background: '#fff5f5',
                padding: '8px 12px', borderRadius: '4px', fontSize: '13px', flexShrink: 0,
              }}>
                {submitError}
              </p>
            )}

            {/* 푸터 */}
            <div style={{
              flexShrink: 0, padding: '16px 30px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
              background: '#fff',
            }}>
              <button type="button" className="confirmBtnBack" onClick={closeSubmitModal} disabled={submitting}>
                취소
              </button>
              <button type="button" className="confirmBtnCreate" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '제출 중...' : '최종 과제 제출'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LearnerCurriculumView;