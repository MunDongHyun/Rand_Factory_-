import { useState, useEffect } from 'react';
import api from '../lib/api';
import curri_nulll from '../public/download_img.png';
import '../styles/Curriculum.css';

import JoditEditor from 'jodit-react';

const initialForm = {
  cur_title: '',
  cur_duration_weeks: 4,
  cur_target_job: '',
  cur_target_industry: '',
  cur_learning_goal: '',
  required_content: '',
};

const formatTasks = (tasks) => {
  if (Array.isArray(tasks)) return tasks.join(', ');
  if (typeof tasks === 'string') return tasks;
  return '';
};

const normalizeWeekPlan = (plan) => {
  if (Array.isArray(plan)) return plan;
  if (plan && typeof plan === 'object') return [plan];
  return [];
};

const buildGeneratePayload = (form) => ({
  cur_title: form.cur_title.trim(),
  cur_duration_weeks: Number(form.cur_duration_weeks),
  cur_target_job: form.cur_target_job.trim() || null,
  cur_target_industry: form.cur_target_industry.trim() || null,
  cur_learning_goal: form.cur_learning_goal.trim() || null,
  required_content: form.required_content.trim() || null,
});

function CurriculumView({ onOpenArticle }) {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [detailExpandedWeek, setDetailExpandedWeek] = useState(null);
  const [previewExpandedWeek, setPreviewExpandedWeek] = useState(null);

  const [learners, setLearners] = useState([]);
  const [createAssignedIds, setCreateAssignedIds] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSelected, setAssignSelected] = useState([]);
  const [assignSaving, setAssignSaving] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [feedbackSavingId, setFeedbackSavingId] = useState(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);

  const [templateModal, setTemplateModal] = useState({ open: false, week: null, assignmentIdx: null, title: '', content: '', fullscreen: false }); const [submissionModal, setSubmissionModal] = useState({ open: false, week: null, assignmentIdx: null, title: '', templateContent: '', content: '', status: 'draft' });

  const loadCurriculums = () => {
    setLoading(true);
    setError(null);
    return api.get('/curricula')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCurriculums(list);
        setSelectedId((prev) => {
          if (prev && list.some((c) => c.cur_id === prev)) return prev;
          return list[0]?.cur_id ?? null;
        });
        return list;
      })
      .catch((err) => {
        setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
        return [];
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    api.get('/curricula')
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setCurriculums(list);
        if (list.length > 0) setSelectedId(list[0].cur_id);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    api.get('/users/learners')
      .then((res) => setLearners(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLearners([]));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSubmissions([]);
      return;
    }
    setSubmissionsLoading(true);
    api.get(`/task-submissions/by-curriculum/${selectedId}`)
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSubmissions([]))
      .finally(() => setSubmissionsLoading(false));
  }, [selectedId]);

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try {
      const res = await api.get(
        `/task-submissions/${submissionId}/attachments/${attachment.stored_name}`,
        { responseType: 'blob' },
      );
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', attachment.filename || attachment.stored_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.');
    }
  };

  const formatAttachmentSize = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleFeedbackSave = async (submissionId, status = 'feedback_given') => {
    const text = (feedbackDraft[submissionId] || '').trim();
    if (!text) {
      alert('피드백 내용을 입력하세요.');
      return;
    }
    setFeedbackSavingId(submissionId);
    try {
      const res = await api.patch(`/task-submissions/${submissionId}/feedback`, {
        task_manager_feedback: text,
        task_status: status,
      });
      setSubmissions((prev) => prev.map((s) =>
        s.task_submission_id === submissionId ? { ...s, ...res.data } : s
      ));
      setFeedbackDraft((prev) => ({ ...prev, [submissionId]: '' }));
    } catch (err) {
      alert(err.response?.data?.detail || '피드백 저장에 실패했습니다.');
    } finally {
      setFeedbackSavingId(null);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const selectedCurriculum = curriculums.find((c) => c.cur_id === selectedId);

  const handleDownloadTxt = async () => {
    if (!selectedCurriculum || !selectedCurriculum.cur_week_plan) return;
    try {
      const res = await api.post('/curricula/download/txt', normalizeWeekPlan(selectedCurriculum.cur_week_plan), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.txt`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { alert('TXT 다운로드 중 오류가 발생했습니다.'); }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCurriculum || !selectedCurriculum.cur_week_plan) return;
    try {
      const res = await api.post('/curricula/download/pdf', normalizeWeekPlan(selectedCurriculum.cur_week_plan), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { alert('PDF 다운로드 중 오류가 발생했습니다.'); }
  };

  const closeModal = () => {
    if (generating || saving) return;
    setModalOpen(false); setConfirmOpen(false); setPreview(null); setFormError(null); setPreviewExpandedWeek(null); setCreateAssignedIds([]);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: name === 'cur_duration_weeks' ? Number(value) : value }));
  };

  const handleGenerate = async (event) => {
    event.preventDefault(); setFormError(null);
    const payload = buildGeneratePayload(form);
    if (!payload.cur_title) { setFormError('과정명을 입력해 주세요.'); return; }
    if (!payload.cur_duration_weeks || payload.cur_duration_weeks < 1) { setFormError('기간은 1주 이상으로 입력해 주세요.'); return; }
    setGenerating(true);
    try {
      const res = await api.post('/curricula/generate', payload);
      setPreview(res.data);
      if (res.data?.cur_week_plan?.length > 0) setPreviewExpandedWeek(res.data.cur_week_plan[0].week);
      setConfirmOpen(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail[0].msg : detail || 'AI 커리큘럼 생성에 실패했어요.');
    } finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true); setFormError(null);
    try {
      const savePayload = {
        cur_title: preview.cur_title, cur_duration_weeks: preview.cur_duration_weeks, cur_target_job: preview.cur_target_job || null,
        cur_target_industry: preview.cur_target_industry || null, cur_learning_goal: preview.cur_learning_goal || null,
        cur_learning_detail_goal: form.required_content.trim() || null, cur_week_plan: preview.cur_week_plan,
        cur_assigned_learner_ids: createAssignedIds, cur_status: 'active',
      };
      const res = await api.post('/curricula', savePayload);
      await loadCurriculums();
      setSelectedId(res.data.cur_id); setForm(initialForm); setPreview(null); setConfirmOpen(false); setModalOpen(false); setCreateAssignedIds([]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail[0].msg : detail || '커리큘럼 저장에 실패했어요.');
    } finally { setSaving(false); }
  };

  const previewWeeks = normalizeWeekPlan(preview?.cur_week_plan);

  const handleAssignSave = async () => {
    if (!selectedCurriculum) return;
    setAssignSaving(true);
    try {
      const res = await api.patch(`/curricula/${selectedCurriculum.cur_id}`, { cur_assigned_learner_ids: assignSelected });
      setCurriculums((prev) => prev.map((c) => (c.cur_id === res.data.cur_id ? res.data : c)));
      setAssignModalOpen(false);
    } catch (err) { alert(err.response?.data?.detail || '배정 변경에 실패했습니다.'); } finally { setAssignSaving(false); }
  };

  const saveTemplate = async () => {
    if (!selectedCurriculum) return;
    // 현재 커리큘럼의 week_plan에서 해당 주차/assignment를 찾아 template_content만 갱신
    const weekPlan = normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => ({ ...step }));
    const targetWeek = weekPlan.find((s) => s.week === templateModal.week);
    if (!targetWeek || !Array.isArray(targetWeek.assignments)) {
      alert('대상 과제를 찾을 수 없습니다.');
      return;
    }
    targetWeek.assignments = targetWeek.assignments.map((a, i) =>
      i === templateModal.assignmentIdx ? { ...a, template_content: templateModal.content } : a
    );
    setTemplateModal((prev) => ({ ...prev, saving: true }));
    try {
      const res = await api.patch(`/curricula/${selectedCurriculum.cur_id}`, {
        cur_week_plan: weekPlan,
      });
      setCurriculums((prev) => prev.map((c) => (c.cur_id === res.data.cur_id ? res.data : c)));
      alert('학습자들에게 과제 템플릿이 배포되었습니다.');
      setTemplateModal({ open: false, week: null, assignmentIdx: null, title: '', content: '' });
    } catch (err) {
      alert(err.response?.data?.detail || '템플릿 배포에 실패했습니다.');
      setTemplateModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const openSubmissionModal = (week, idx, assignment) => {
    setSubmissionModal({
      open: true, week, assignmentIdx: idx, title: assignment.title,
      templateContent: assignment.template_content || '사수가 작성한 템플릿 내용 및 가이드가 이곳에 표시됩니다.',
      content: '', status: 'draft'
    });
  };

  const saveSubmission = async (isSubmit) => {
    if (isSubmit) alert('과제가 최종 제출되었습니다.'); else alert('작성 중인 내용이 임시 저장되었습니다.');
    setSubmissionModal({ ...submissionModal, open: false });
  };

  const openTemplateModal = (week, idx, assignment) => {
    setTemplateModal({
      open: true, week, assignmentIdx: idx, title: assignment.title,
      content: assignment.template_content || `[${assignment.title}] 관련 과제 양식을 자유롭게 작성해주세요.\n\n1. 핵심 지표:\n2. 분석 결과:\n3. 향후 전략:\n`
    });
  };

  const renderAccordionItem = (step, expandedState, toggleFunc) => {
    const isExpanded = expandedState === step.week;
    return (
      <div key={step.week} className="extracted-accordion-item">
        <div onClick={() => toggleFunc(step.week)} className={`extracted-accordion-header ${isExpanded ? 'expanded' : ''}`}>
          <span className="extracted-week-label">{step.week}주차</span>
          <span className="extracted-theme-label">{step.theme || '주제 미지정'}</span>
          <span className="extracted-toggle-label">{isExpanded ? '▲ 접기' : '▼ 펼쳐보기'}</span>
        </div>
        {isExpanded && (
          <div className="extracted-accordion-body">
            {step.learning_objective && (
              <div className="extracted-section-margin">
                <h4 className="extracted-objective-title">🎯 이번 주차 학습 목표</h4>
                <p className="extracted-objective-text">{step.learning_objective}</p>
              </div>
            )}
            {(step.tasks || step.task) && (
              <div className="extracted-section-margin">
                <h4 className="extracted-task-title">📚 멘토링 및 실습 과제</h4>
                <ul className="extracted-task-list">
                  {Array.isArray(step.tasks || step.task) ? (step.tasks || step.task).map((t, idx) => (<li key={idx} className="extracted-list-item">{t}</li>)) : <p className="extracted-objective-text">{step.tasks || step.task}</p>}
                </ul>
              </div>
            )}
            {Array.isArray(step.assignments) && step.assignments.length > 0 && (
              <div className="extracted-assignment-wrapper">
                <h4 className="extracted-task-title">📝 실무 수행 과제</h4>
                <div className="extracted-assignment-grid">
                  {step.assignments.map((a, idx) => (
                    <div key={idx} className="extracted-assignment-card">
                      <strong className="extracted-assignment-name">[과제명] {a.title}</strong>
                      {Array.isArray(a.step_by_step_guide) && a.step_by_step_guide.length > 0 && (
                        <ul className="extracted-guide-list">
                          {a.step_by_step_guide.map((guide, gIdx) => (<li key={gIdx} className="extracted-guide-item">{guide}</li>))}
                        </ul>
                      )}
                      {a.description && <p className="extracted-guide-item">{a.description}</p>}
                      <div className="extracted-submission-format has-actions">
                        <span>제출 형태: {a.expected_output_format || a.submission || '지정되지 않음'}</span>
                        <div className="templateActionBtnGroup">
                          <button className="template-action-btn admin" onClick={(e) => { e.stopPropagation(); openTemplateModal(step.week, idx, a); }}>양식 배포(관리자)</button>
                          <button className="template-action-btn user" onClick={(e) => { e.stopPropagation(); openSubmissionModal(step.week, idx, a); }}>과제 작성(학습자)</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step.instructor_guide && (
              <div className="extracted-instructor-box">
                <h4 className="extracted-instructor-title">💡 교육담당자(사수) 코칭 가이드</h4>
                {Array.isArray(step.instructor_guide.check_points) && step.instructor_guide.check_points.length > 0 && (
                  <div className="extracted-section-margin">
                    <strong className="extracted-guide-label">[평가 체크포인트]</strong>
                    <ul className="extracted-guide-list-no-margin">
                      {step.instructor_guide.check_points.map((cp, idx) => (<li key={idx} className="extracted-guide-item-small">{cp}</li>))}
                    </ul>
                  </div>
                )}
                {Array.isArray(step.instructor_guide.coaching_questions) && step.instructor_guide.coaching_questions.length > 0 && (
                  <div>
                    <strong className="extracted-guide-label">[1:1 미팅 권장 질문]</strong>
                    <ul className="extracted-coaching-list">
                      {step.instructor_guide.coaching_questions.map((cq, idx) => (<li key={idx} className="extracted-coaching-item">🗣️ {cq}</li>))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="extracted-footer-wrapper">
              <div>
                {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                  <>
                    <h4 className="extracted-ref-title">📖 참고 자료</h4>
                    {step.recommended_articles.map((article, idx) => {
                      const hasValidUrl = article.url && article.url.trim() !== "";
                      return (
                        <div key={idx} className="extracted-ref-item">
                          {hasValidUrl ? (<a href={article.url} target="_blank" rel="noopener noreferrer" className="extracted-ref-link">🔗 {article.title}</a>) : (<span className="extracted-ref-doc">📁 {article.title} <span className="extracted-ref-small">(사내 문서 참고)</span></span>)}
                          {(article.reason_for_reading || article.why_relevant) && (<p className="extracted-ref-reason">✓ {article.reason_for_reading || article.why_relevant}</p>)}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {step.estimated_hours && (<div className="extracted-time-badge">⏱ 예상 소요: {step.estimated_hours}시간</div>)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">커리큘럼 관리</h2>
      {loading && <p className="curriculumStatusMsg">커리큘럼을 불러오는 중...</p>}
      {error && <p className="curriculumStatusMsg error">{error}</p>}
      {!loading && !error && curriculums.length === 0 && (
        <div className="curriculumEmptyBox">
          <img src={curri_nulll} className="curriculumEmptyImage" alt="없음" />
          <p className="curriculumEmptyText">생성된 커리큘럼이 존재하지 않습니다.</p>
          <button className="curriculumCreateBtn" onClick={() => setModalOpen(true)}>커리큘럼 생성하기</button>
        </div>
      )}
      {!loading && !error && curriculums.length > 0 && selectedCurriculum && (
        <div className="curriculumLayout">
          <aside className="curriculumSidebar">
            <p className="curriculumSidebarTitle">생성한 커리큘럼</p>
            <div className="curriculumSidebarDivider" />
            <ul className="curriculumSidebarList">
              {curriculums.map((c) => (
                <li
                  key={c.cur_id}
                  className={`curriculumSidebarItem ${selectedId === c.cur_id ? 'active' : ''}`}
                  onClick={() => { setSelectedId(c.cur_id); setDetailExpandedWeek(null); }}
                >
                  {c.cur_title}
                </li>
              ))}
            </ul>
            <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>+ 새 커리큘럼</button>
          </aside>
          <div className="curriculumDetail">
            <div className="extracted-detail-header">
              <div className="curriculumTitleGroup">
                <div className="curriculumTitleRow">
                  <h3 className="curriculumDetailTitle">{selectedCurriculum.cur_title}</h3>
                  <img
                    src={curri_nulll}
                    alt="다운로드"
                    className="downloadIcon"
                    onClick={() => setDownloadModalOpen(true)}
                  />
                </div>
                <p className="curriculumDetailDesc">{selectedCurriculum.cur_learning_goal || ''}</p>
              </div>
            </div>
            <div className="assignedLearnersRow">
              {(selectedCurriculum.cur_assigned_learner_ids || []).length === 0
                ? <span className="assignEmptyInline">배정된 학습자가 없습니다</span>
                : (selectedCurriculum.cur_assigned_learner_ids || []).map((id) => {
                  const l = learners.find((x) => x.user_id === id);
                  return <span key={id} className="assignedLearnerChip">{l ? l.user_name : `#${id}`}</span>;
                })}
              <button
                className="assignedLearnersEditBtn"
                onClick={() => { setAssignSelected(selectedCurriculum.cur_assigned_learner_ids || []); setAssignModalOpen(true); }}
              >
                변경
              </button>
            </div>
            <div className="curriculumSteps">
              {normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => renderAccordionItem(step, detailExpandedWeek, (week) => setDetailExpandedWeek(prev => prev === week ? null : week)))}
            </div>

          </div>
          <div className="managerSubmissionSection">
            <div className="managerSubmissionHeader">
              <h3 className="managerSubmissionTitle">제출된 과제</h3>
              <span className="managerSubmissionCount">{submissions.length}건</span>
            </div>
            {submissionsLoading && <p className="managerSubmissionLoading">제출 과제를 불러오는 중...</p>}
            {!submissionsLoading && submissions.length === 0 && <p className="managerSubmissionEmpty">아직 제출된 과제가 없습니다.</p>}
            <div className="managerSubmissionList">
              {submissions.map((s) => {
                const isExpanded = expandedSubmissionId === s.task_submission_id;
                const statusClass = s.task_status || '';
                const statusLabel = { submitted: '피드백 대기', feedback_given: '피드백 완료', resubmit_requested: '재제출 요청' }[s.task_status] || '제출됨';
                return (
                  <div key={s.task_submission_id} className="managerSubmissionItem">
                    <div className="managerSubmissionItemHeader" onClick={() => setExpandedSubmissionId(prev => prev === s.task_submission_id ? null : s.task_submission_id)}>
                      <div className="managerSubmissionItemMain">
                        <span className="managerSubmissionWeek">{s.task_week_number}주차</span>
                        <span className="managerSubmissionLearner">{s.learner_name || `#${s.task_learner_id}`}</span>
                        <span className="managerSubmissionTime">{formatDateTime(s.task_submitted_at)}</span>
                      </div>
                      <div className="managerSubmissionItemRight">
                        <span className={`managerSubmissionStatus ${statusClass}`}>{statusLabel}</span>
                        <span className="managerSubmissionToggle">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="managerSubmissionItemBody">
                        <div className="managerSubmissionContent">
                          <p className="managerSubmissionContentLabel">제출 내용</p>
                          <div className="managerSubmissionContentBody" dangerouslySetInnerHTML={{ __html: s.task_submitted_content?.text || '(내용 없음)' }}></div>
                        </div>
                        {Array.isArray(s.task_submitted_content?.attachments) && s.task_submitted_content.attachments.length > 0 && (
                          <div className="managerSubmissionAttachments">
                            <p className="managerSubmissionContentLabel">📎 첨부파일</p>
                            <ul className="managerSubmissionAttachmentList">
                              {s.task_submitted_content.attachments.map((a, i) => (
                                <li key={i} className="managerSubmissionAttachmentItem">
                                  <button
                                    type="button"
                                    className="managerSubmissionAttachmentLink"
                                    onClick={() => handleAttachmentDownload(s.task_submission_id, a)}
                                  >
                                    {a.filename || a.stored_name}
                                  </button>
                                  <span className="managerSubmissionAttachmentSize">{formatAttachmentSize(a.size)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {s.task_manager_feedback && (
                          <div className="managerSubmissionExistingFeedback">
                            <p className="managerSubmissionContentLabel">현재 피드백 ({formatDateTime(s.task_feedback_at)})</p>
                            <div className="managerSubmissionContentBody">{s.task_manager_feedback}</div>
                          </div>
                        )}
                        <div className="managerFeedbackForm">
                          <p className="managerSubmissionContentLabel">{s.task_manager_feedback ? '피드백 수정' : '피드백 작성'}</p>
                          <textarea className="managerFeedbackTextarea" placeholder="학습자에게 전달할 피드백을 입력하세요" value={feedbackDraft[s.task_submission_id] ?? ''} onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, [s.task_submission_id]: e.target.value }))} />
                          <div className="managerFeedbackBtns">
                            <button className="managerFeedbackBtn secondary" onClick={() => handleFeedbackSave(s.task_submission_id, 'resubmit_requested')} disabled={feedbackSavingId === s.task_submission_id}>재제출 요청</button>
                            <button className="managerFeedbackBtn primary" onClick={() => handleFeedbackSave(s.task_submission_id, 'feedback_given')} disabled={feedbackSavingId === s.task_submission_id}>{feedbackSavingId === s.task_submission_id ? '저장 중...' : '피드백 저장'}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      )}

      {modalOpen && (
        <>
          <div className="chatModalOverlay" onClick={closeModal} />
          <div className="chatModalContainer">
            <aside className="chatSidebar">
              <p className="chatSidebarTitle">생성한 커리큘럼</p>
              <div className="chatSidebarDivider" />
              <ul className="chatSidebarList">
                {curriculums.length === 0 && <li>아직 없음</li>}
                {curriculums.map((c) => <li key={c.cur_id}>{c.cur_title}</li>)}
              </ul>
            </aside>
            <div className="chatMain">
              <button className="chatModalClose" onClick={closeModal} disabled={generating || saving}>×</button>
              <p className="chatMainTitle">AI로 커리큘럼 초안을 생성하세요</p>
              <form className="curriculumGenerateForm" onSubmit={handleGenerate}>
                <label className="curriculumField"><span>과정명</span><input name="cur_title" value={form.cur_title} onChange={handleChange} placeholder="예: 마케팅 신입 4주 온보딩" /></label>
                <div className="curriculumFieldGrid">
                  <label className="curriculumField"><span>대상 직무</span><input name="cur_target_job" value={form.cur_target_job} onChange={handleChange} placeholder="예: 마케터" /></label>
                  <label className="curriculumField"><span>산업</span><input name="cur_target_industry" value={form.cur_target_industry} onChange={handleChange} placeholder="예: IT" /></label>
                </div>
                <label className="curriculumField"><span>기간</span><input name="cur_duration_weeks" type="number" min="1" max="52" value={form.cur_duration_weeks} onChange={handleChange} /></label>
                <label className="curriculumField"><span>학습 목표</span><textarea name="cur_learning_goal" value={form.cur_learning_goal} onChange={handleChange} rows="3" placeholder="예: 디지털 마케팅 기초 역량 확보" /></label>
                <label className="curriculumField"><span>필수 포함 내용</span><textarea name="required_content" value={form.required_content} onChange={handleChange} rows="3" placeholder="예: GA4 분석, SEO 기본, 콘텐츠 마케팅 전략" /></label>
                {formError && <p className="curriculumFormError">{formError}</p>}
                <button className="curriculumGenerateBtn" type="submit" disabled={generating}>{generating ? 'AI 생성 중...' : 'AI 커리큘럼 생성'}</button>
              </form>
            </div>
          </div>
        </>
      )}

      {assignModalOpen && selectedCurriculum && (
        <>

          <div className="confirmOverlay" onClick={() => !assignSaving && setAssignModalOpen(false)} />
          <div className="confirmModal assignModal">
            <div className="confirmHeader"><div className="confirmHeaderRight"><p className="confirmHeaderLabel">{selectedCurriculum.cur_title}</p><h3 className="confirmTitle">학습자 배정 변경</h3><div className="confirmDivider" /></div></div>
            <div className="assignSection">
              {learners.length === 0 ? <p className="assignEmpty">같은 회사의 등록된 학습자가 없습니다.</p> : (
                <div className="assignCheckList">
                  {learners.map((l) => {
                    const checked = assignSelected.includes(l.user_id);
                    return (<label key={l.user_id} className={`assignCheckItem ${checked ? 'checked' : ''}`}><input type="checkbox" checked={checked} onChange={(e) => setAssignSelected((prev) => e.target.checked ? [...prev, l.user_id] : prev.filter((id) => id !== l.user_id))} /><span className="assignName">{l.user_name}</span><span className="assignEmail">{l.user_email}</span></label>);
                  })}
                </div>
              )}
            </div>
            <div className="confirmBtns"><button className="confirmBtnBack" onClick={() => setAssignModalOpen(false)} disabled={assignSaving}>취소</button><button className="confirmBtnCreate" onClick={handleAssignSave} disabled={assignSaving}>{assignSaving ? '저장 중...' : '저장'}</button></div>
          </div>
        </>
      )}

      {confirmOpen && preview && (
        <>
          <div className="confirmOverlay" onClick={() => !saving && setConfirmOpen(false)} />
          <div className="confirmModal">
            <div className="confirmHeader"><div className="confirmHeaderRight"><p className="confirmHeaderLabel">{preview.cur_target_job || '직무 미지정'} | {preview.cur_duration_weeks}주차</p><h3 className="confirmTitle">이 커리큘럼을 저장할까요?</h3><div className="confirmDivider" /></div></div>
            <div className="confirmGoalBox"><p className="confirmGoalLabel">교육 목표 :</p><p className="confirmGoalText">{preview.cur_learning_goal || '교육 목표가 입력되지 않았습니다.'}</p></div>
            <p className="confirmProgramName">{preview.cur_title}</p>
            <div className="confirmStepList">
              {previewWeeks.map((step) => renderAccordionItem(step, previewExpandedWeek, (week) => setPreviewExpandedWeek(prev => prev === week ? null : week)))}
            </div>
            <div className="assignSection">
              <p className="assignSectionTitle">학습자 배정 (선택)</p><p className="assignSectionHint">선택한 학습자들이 자신의 화면에서 이 커리큘럼을 볼 수 있습니다. 나중에 변경 가능합니다.</p>
              {learners.length === 0 ? <p className="assignEmpty">같은 회사의 등록된 학습자가 없습니다.</p> : (
                <div className="assignCheckList">
                  {learners.map((l) => {
                    const checked = createAssignedIds.includes(l.user_id);
                    return (<label key={l.user_id} className={`assignCheckItem ${checked ? 'checked' : ''}`}><input type="checkbox" checked={checked} onChange={(e) => setCreateAssignedIds((prev) => e.target.checked ? [...prev, l.user_id] : prev.filter((id) => id !== l.user_id))} /><span className="assignName">{l.user_name}</span><span className="assignEmail">{l.user_email}</span></label>);
                  })}
                </div>
              )}
            </div>
            {formError && <p className="curriculumFormError">{formError}</p>}
            <div className="confirmBtns"><button className="confirmBtnBack" onClick={() => setConfirmOpen(false)} disabled={saving}>돌아가기</button><button className="confirmBtnCreate" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '생성'}</button></div>
          </div>
        </>
      )}

      {templateModal.open && (
        <>
          <div className="confirmOverlay" onClick={() => setTemplateModal({ ...templateModal, open: false })} />
          <div className={`confirmModal templateModal ${templateModal.fullscreen ? 'fullscreen' : ''}`}>


            <div className="modalTopBar">
              <h3 className="confirmTitle">과제 양식(템플릿) 배포</h3>
              <button
                className="fullscreenBtn"
                onClick={() => setTemplateModal(prev => ({ ...prev, fullscreen: !prev.fullscreen }))}
              >
                {templateModal.fullscreen ? '✕ 축소' : '⛶ 전체보기'}
              </button>

            </div>

            <p className="assignSectionHint">
              학습자에게 전달될 '{templateModal.title}'의 작성 양식 가이드를 작성해주세요. 표나 양식을 지정해주면 학습자가 쉽게 채워넣을 수 있습니다.
            </p>
            <div className="templateEditorWrapper">
              <JoditEditor
                value={templateModal.content}
                config={{
                  height: templateModal.fullscreen ? 600 : 400,
                  language: 'ko',
                  placeholder: '표 삽입, 텍스트 색상 변경 등을 자유롭게 활용해 양식을 작성하세요...',
                  toolbarSticky: false,        // ← 툴바 고정 해제
                  popup: {
                    selection: [],             // ← 선택 팝업 최소화
                  },
                  iframe: true,                // 페이지 글로벌 reset으로부터 에디터 내부 격리 (리스트 마커 등)
                }}
                onBlur={(newContent) => setTemplateModal({ ...templateModal, content: newContent })}
              />
            </div>
            <div className="confirmBtns">
              <button
                className="confirmBtnBack"
                onClick={() => setTemplateModal({ ...templateModal, open: false })}
                disabled={templateModal.saving}
              >취소</button>
              <button
                className="confirmBtnCreate"
                onClick={saveTemplate}
                disabled={templateModal.saving}
              >{templateModal.saving ? '배포 중...' : '템플릿 배포'}</button>
            </div>
          </div>
        </>
      )}

      {submissionModal.open && (
        <>
          <div className="confirmOverlay" onClick={() => setSubmissionModal({ ...submissionModal, open: false })} />
          <div className="confirmModal submissionModal">
            <h3 className="confirmTitle">📝 과제 수행: {submissionModal.title}</h3>

            <div className="document-workspace">
              <div className="document-guide-section">
                <strong className="documentGuideTitle">사수(교육담당자)의 과제 작성 가이드</strong>
                <div
                  className="document-template-content"
                  dangerouslySetInnerHTML={{ __html: submissionModal.templateContent }}
                ></div>
              </div>

              <div className="document-edit-section">
                <div className="document-toolbar">
                  <span>과제 작성 에디터 (임시저장 가능)</span>
                  <span className="status-label">{submissionModal.status === 'draft' ? '📝 작성 중' : '✅ 제출 완료'}</span>
                </div>
                <div className="joditEditorWrapper">
                  <JoditEditor
                    value={submissionModal.content}
                    config={{
                      height: 400,
                      language: 'ko',
                      placeholder: '담당자가 배포한 가이드에 맞추어 이곳에 과제를 작성하세요...',
                      iframe: true,            // 페이지 글로벌 reset으로부터 에디터 내부 격리
                    }}
                    onBlur={(newContent) => setSubmissionModal({ ...submissionModal, content: newContent })}
                  />
                </div>
              </div>
            </div>

            <div className="confirmBtns">
              <button className="confirmBtnBack" onClick={() => setSubmissionModal({ ...submissionModal, open: false })}>닫기</button>
              <button className="confirmBtnCreate btnSuccess" onClick={() => saveSubmission(false)}>임시 저장</button>
              <button className="confirmBtnCreate" onClick={() => saveSubmission(true)}>최종 제출하기</button>
            </div>
          </div>
        </>
      )}

      {downloadModalOpen && (
        <>
          <div className="downloadOverlay" onClick={() => setDownloadModalOpen(false)} />
          <div className="downloadModal">
            <p className="downloadModalTitle">다운로드 형식 선택</p>
            <button className="downloadModalBtn" onClick={() => { handleDownloadTxt(); setDownloadModalOpen(false); }}>TXT 다운로드</button>
            <button className="downloadModalBtn" onClick={() => { handleDownloadPdf(); setDownloadModalOpen(false); }}>PDF 다운로드</button>
          </div>
        </>
      )}

    </div>
  );
}

export default CurriculumView;
