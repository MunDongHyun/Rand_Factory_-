import { useState, useEffect } from 'react';
import api from '../lib/api';
import curri_nulll from '../public/curri_null.png';
import '../styles/Curriculum.css';

const initialForm = {
  cur_title: '',
  cur_duration_weeks: 4,
  cur_target_job: '',
  cur_target_industry: '',
  cur_learning_goal: '',
  required_content: '',
};

// tasks가 문자열이든 배열이든 안전하게 처리하기 위한 헬퍼 함수
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

  // 🔥 아코디언 UI를 위한 상태 (메인 화면용, 미리보기 화면용)
  const [detailExpandedWeek, setDetailExpandedWeek] = useState(null);
  const [previewExpandedWeek, setPreviewExpandedWeek] = useState(null);

  // 학습자 배정 관련
  const [learners, setLearners] = useState([]);
  const [createAssignedIds, setCreateAssignedIds] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSelected, setAssignSelected] = useState([]);
  const [assignSaving, setAssignSaving] = useState(false);

  // 제출된 과제 관련
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({});  // {submission_id: text}
  const [feedbackSavingId, setFeedbackSavingId] = useState(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);

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
        s.task_submission_id === submissionId
          ? { ...s, ...res.data }
          : s
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

  // --- [추가] 다운로드 처리 함수 ---
  const handleDownloadTxt = async () => {
    if (!selectedCurriculum || !selectedCurriculum.cur_week_plan) return;
    try {
      const res = await api.post('/curricula/download/txt', normalizeWeekPlan(selectedCurriculum.cur_week_plan), {
        responseType: 'blob', // 파일 다운로드를 위해 필수
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedCurriculum.cur_title}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('TXT 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCurriculum || !selectedCurriculum.cur_week_plan) return;
    try {
      const res = await api.post('/curricula/download/pdf', normalizeWeekPlan(selectedCurriculum.cur_week_plan), {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedCurriculum.cur_title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('PDF 다운로드 중 오류가 발생했습니다.');
    }
  };
  // --------------------------------

  const closeModal = () => {
    if (generating || saving) return;
    setModalOpen(false);
    setConfirmOpen(false);
    setPreview(null);
    setFormError(null);
    setPreviewExpandedWeek(null); // 모달 닫을 때 아코디언 초기화
    setCreateAssignedIds([]);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: name === 'cur_duration_weeks' ? Number(value) : value }));
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setFormError(null);

    const payload = buildGeneratePayload(form);
    if (!payload.cur_title) {
      setFormError('과정명을 입력해 주세요.');
      return;
    }
    if (!payload.cur_duration_weeks || payload.cur_duration_weeks < 1) {
      setFormError('기간은 1주 이상으로 입력해 주세요.');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/curricula/generate', payload);
      setPreview(res.data);
      // 첫 번째 주차를 기본으로 열어둡니다.
      if (res.data?.cur_week_plan?.length > 0) {
        setPreviewExpandedWeek(res.data.cur_week_plan[0].week);
      }
      setConfirmOpen(true);
    } catch (err) {
      // 🔥 422 에러(배열) 파싱 로직 적용
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail[0].msg);
      } else {
        setFormError(detail || 'AI 커리큘럼 생성에 실패했어요.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setFormError(null);
    try {
      const savePayload = {
        cur_title: preview.cur_title,
        cur_duration_weeks: preview.cur_duration_weeks,
        cur_target_job: preview.cur_target_job || null,
        cur_target_industry: preview.cur_target_industry || null,
        cur_learning_goal: preview.cur_learning_goal || null,

        // 🔥 DB 타입(TEXT)에 맞게 단순 문자열 전송
        cur_learning_detail_goal: form.required_content.trim() || null,
        cur_week_plan: preview.cur_week_plan,

        // 매니저가 confirm 단계에서 선택한 학습자들
        cur_assigned_learner_ids: createAssignedIds,
        cur_status: 'active',
      };
      const res = await api.post('/curricula', savePayload);
      await loadCurriculums();
      setSelectedId(res.data.cur_id);
      setForm(initialForm);
      setPreview(null);
      setConfirmOpen(false);
      setModalOpen(false);
      setCreateAssignedIds([]);
    } catch (err) {
      // 🔥 422 에러(배열) 파싱 로직 적용
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail[0].msg);
      } else {
        setFormError(detail || '커리큘럼 저장에 실패했어요.');
      }
    } finally {
      setSaving(false);
    }
  };

  const previewWeeks = normalizeWeekPlan(preview?.cur_week_plan);

  const handleAssignSave = async () => {
    if (!selectedCurriculum) return;
    setAssignSaving(true);
    try {
      const res = await api.patch(`/curricula/${selectedCurriculum.cur_id}`, {
        cur_assigned_learner_ids: assignSelected,
      });
      setCurriculums((prev) =>
        prev.map((c) => (c.cur_id === res.data.cur_id ? res.data : c))
      );
      setAssignModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.detail || '배정 변경에 실패했습니다.');
    } finally {
      setAssignSaving(false);
    }
  };

  // 공통으로 사용할 아코디언 아이템 렌더링 함수
  const renderAccordionItem = (step, expandedState, toggleFunc) => {
    const isExpanded = expandedState === step.week;

    return (
      <div
        key={step.week}
        style={{
          border: '1px solid #e1e4e8',
          borderRadius: '8px',
          marginBottom: '12px',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}
      >
        {/* 헤더 영역 (클릭 시 토글) */}
        <div
          onClick={() => toggleFunc(step.week)}
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            backgroundColor: isExpanded ? '#f0f4f8' : '#ffffff',
            transition: 'background-color 0.2s'
          }}
        >
          <span style={{ fontWeight: 'bold', width: '60px', color: '#0366d6' }}>
            {step.week}주차
          </span>
          <span style={{ flex: 1, fontWeight: '600', fontSize: '15px', color: '#24292e' }}>
            {step.theme || '주제 미지정'}
          </span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {isExpanded ? '▲ 접기' : '▼ 펼쳐보기'}
          </span>
        </div>

        {/* 상세 내용 영역 */}
        {isExpanded && (
          <div style={{ padding: '20px', backgroundColor: '#fafbfc', borderTop: '1px solid #e1e4e8' }}>
            {/* 1. 학습 목표 */}
            {step.learning_objective && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', color: '#0366d6', marginBottom: '8px', fontWeight: 'bold' }}>🎯 이번 주차 학습 목표</h4>
                <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.5', margin: 0 }}>{step.learning_objective}</p>
              </div>
            )}

            {/* 2. 핵심 과제 및 OJT 내용 */}
            {(step.tasks || step.task) && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', color: '#24292e', marginBottom: '8px', fontWeight: 'bold' }}>📚 멘토링 및 실습 과제</h4>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {Array.isArray(step.tasks || step.task)
                    ? (step.tasks || step.task).map((t, idx) => (
                      <li key={idx} style={{ fontSize: '13px', color: '#444', marginBottom: '6px', lineHeight: '1.5' }}>{t}</li>
                    ))
                    : <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.5', margin: 0 }}>{step.tasks || step.task}</p>
                  }
                </ul>
              </div>
            )}

            {/* --- [추가] 3. 구체적인 제출 과제 (Assignments) --- */}
            {Array.isArray(step.assignments) && step.assignments.length > 0 && (
              <div style={{ marginBottom: '16px', borderTop: '1px dashed #e1e4e8', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '14px', color: '#24292e', marginBottom: '12px', fontWeight: 'bold' }}>📝 제출 과제</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {step.assignments.map((a, idx) => (
                    <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #d1d5da', borderRadius: '6px', padding: '12px' }}>
                      <strong style={{ display: 'block', fontSize: '13px', color: '#0366d6', marginBottom: '6px' }}>
                        [과제명] {a.title}
                      </strong>
                      <p style={{ fontSize: '12px', color: '#444', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                        {a.description}
                      </p>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#28a745', backgroundColor: '#e6ffed', padding: '4px 8px', display: 'inline-block', borderRadius: '4px' }}>
                        제출: {a.submission}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- [추가] 4. 교육담당자 가이드 (Instructor Guide) --- */}
            {step.instructor_guide && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '6px' }}>
                <h4 style={{ fontSize: '13px', color: '#856404', marginBottom: '8px', fontWeight: 'bold' }}>💡 교육담당자 가이드 (평가 팁)</h4>
                
                {Array.isArray(step.instructor_guide.check_points) && step.instructor_guide.check_points.length > 0 && (
                  <ul style={{ paddingLeft: '20px', margin: '0 0 8px 0' }}>
                    {step.instructor_guide.check_points.map((cp, idx) => (
                      <li key={idx} style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>{cp}</li>
                    ))}
                  </ul>
                )}
                
                {step.instructor_guide.feedback_tips && (
                  <p style={{ fontSize: '12px', color: '#856404', margin: 0, fontWeight: 'bold', borderTop: '1px solid #ffeeba', paddingTop: '8px' }}>
                    TIPS: {step.instructor_guide.feedback_tips}
                  </p>
                )}
              </div>
            )}

            {/* 5. 멘토 피드백 및 체크리스트 (기존) */}
            {Array.isArray(step.success_criteria) && step.success_criteria.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fff', border: '1px solid #e1e4e8', borderRadius: '6px' }}>
                <h4 style={{ fontSize: '13px', color: '#cb2431', marginBottom: '8px', fontWeight: 'bold' }}>✅ 멘토 피드백 체크리스트</h4>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {step.success_criteria.map((criteria, idx) => (
                    <li key={idx} style={{ fontSize: '13px', color: '#444', marginBottom: '4px', lineHeight: '1.4' }}>{criteria}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. 추천 자료 및 시간 (기존) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', borderTop: '1px dashed #e1e4e8', paddingTop: '12px' }}>
              <div>
                {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '12px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>📖 추천 참고 자료</h4>
                    {step.recommended_articles.map((article, idx) => {
                      
                      // 🔥 핵심 구조 변경: url이 정상적으로 있으면 그곳으로, 없거나 비어있으면 무조건 구글 검색으로 강제 연결!
                      const targetUrl = article.url && article.url.trim() !== "" 
                        ? article.url 
                        : `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
                      
                      return (
                        <div key={idx} style={{ marginBottom: '6px' }}>
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', fontWeight: 'bold', color: '#0366d6', textDecoration: 'underline', display: 'inline-block' }}
                          >
                            {/* URL이 있으면 🔗 아이콘, 구글 검색으로 대체되었으면 🔍 아이콘 표시 */}
                            {article.url && article.url.trim() !== "" ? '🔗 ' : '🔍 '}
                            {article.title}
                          </a>
                          
                          {article.why_relevant && (
                            <p style={{ fontSize: '11px', color: '#777', margin: '2px 0 0 16px', lineHeight: '1.4' }}>
                              - {article.why_relevant}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {step.estimated_hours && (
                <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', backgroundColor: '#e1e4e8', padding: '4px 8px', borderRadius: '12px' }}>
                  ⏱ 예상 소요: {step.estimated_hours}시간
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">커리큘럼 관리</h2>

      {loading && <p style={{ padding: '20px' }}>커리큘럼을 불러오는 중...</p>}
      {error && <p style={{ padding: '20px', color: '#c33' }}>{error}</p>}

      {!loading && !error && curriculums.length === 0 && (
        <div className="curriculumEmptyBox">
          <img src={curri_nulll} className="curriculumEmptyImage" alt="없음" />
          <p className="curriculumEmptyText">생성된 커리큘럼이 존재하지 않습니다.</p>
          <button className="curriculumCreateBtn" onClick={() => setModalOpen(true)}>
            커리큘럼 생성하기
          </button>
        </div>
      )}

      {/* 메인 화면 (저장된 커리큘럼 열람) */}
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
                  onClick={() => {
                    setSelectedId(c.cur_id);
                    setDetailExpandedWeek(null); // 탭 변경 시 아코디언 닫기
                  }}
                >
                  {c.cur_title}
                </li>
              ))}
            </ul>
            <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>
              + 새 커리큘럼
            </button>
          </aside>

          <div className="curriculumDetail">
            {/* --- [수정] 타이틀, 설명, 다운로드 버튼 그룹 --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 className="curriculumDetailTitle" style={{ marginBottom: '8px' }}>{selectedCurriculum.cur_title}</h3>
                <p className="curriculumDetailDesc" style={{ margin: 0 }}>
                  {selectedCurriculum.cur_learning_goal || ''}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button 
                  onClick={handleDownloadTxt}
                  style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5da', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#24292e' }}
                >
                  📄 TXT 다운로드
                </button>
                <button 
                  onClick={handleDownloadPdf}
                  style={{ padding: '6px 12px', backgroundColor: '#0366d6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#fff' }}
                >
                  📑 PDF 다운로드
                </button>
              </div>
            </div>
            {/* ----------------------------------------------- */}

            {/* 배정 학습자 영역 */}
            <div className="assignedLearnersBox">
              <div className="assignedLearnersHeader">
                <span className="assignedLearnersLabel">
                  배정 학습자 {(selectedCurriculum.cur_assigned_learner_ids || []).length}명
                </span>
                <button
                  className="assignedLearnersEditBtn"
                  onClick={() => {
                    setAssignSelected(selectedCurriculum.cur_assigned_learner_ids || []);
                    setAssignModalOpen(true);
                  }}
                >
                  배정 변경
                </button>
              </div>
              <div className="assignedLearnersList">
                {(selectedCurriculum.cur_assigned_learner_ids || []).length === 0 ? (
                  <span className="assignEmptyInline">배정된 학습자가 없습니다</span>
                ) : (
                  (selectedCurriculum.cur_assigned_learner_ids || []).map((id) => {
                    const l = learners.find((x) => x.user_id === id);
                    return (
                      <span key={id} className="assignedLearnerChip">
                        {l ? l.user_name : `#${id}`}
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            <div className="curriculumSteps" style={{ marginTop: '24px' }}>
              {normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) =>
                renderAccordionItem(
                  step,
                  detailExpandedWeek,
                  (week) => setDetailExpandedWeek(prev => prev === week ? null : week)
                )
              )}
            </div>

            {/* 제출된 과제 섹션 */}
            <div className="managerSubmissionSection">
              <div className="managerSubmissionHeader">
                <h3 className="managerSubmissionTitle">제출된 과제</h3>
                <span className="managerSubmissionCount">{submissions.length}건</span>
              </div>

              {submissionsLoading && <p style={{ color: '#666' }}>제출 과제를 불러오는 중...</p>}
              {!submissionsLoading && submissions.length === 0 && (
                <p className="managerSubmissionEmpty">
                  아직 제출된 과제가 없습니다.
                </p>
              )}

              <div className="managerSubmissionList">
                {submissions.map((s) => {
                  const isExpanded = expandedSubmissionId === s.task_submission_id;
                  const statusClass = s.task_status || '';
                  const statusLabel = {
                    submitted: '피드백 대기',
                    feedback_given: '피드백 완료',
                    resubmit_requested: '재제출 요청',
                  }[s.task_status] || '제출됨';

                  return (
                    <div key={s.task_submission_id} className="managerSubmissionItem">
                      <div
                        className="managerSubmissionItemHeader"
                        onClick={() => setExpandedSubmissionId(prev => prev === s.task_submission_id ? null : s.task_submission_id)}
                      >
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
                            <div className="managerSubmissionContentBody">
                              {s.task_submitted_content?.text || '(내용 없음)'}
                            </div>
                          </div>

                          {s.task_manager_feedback && (
                            <div className="managerSubmissionExistingFeedback">
                              <p className="managerSubmissionContentLabel">현재 피드백 ({formatDateTime(s.task_feedback_at)})</p>
                              <div className="managerSubmissionContentBody">{s.task_manager_feedback}</div>
                            </div>
                          )}

                          <div className="managerFeedbackForm">
                            <p className="managerSubmissionContentLabel">
                              {s.task_manager_feedback ? '피드백 수정' : '피드백 작성'}
                            </p>
                            <textarea
                              className="managerFeedbackTextarea"
                              placeholder="학습자에게 전달할 피드백을 입력하세요"
                              value={feedbackDraft[s.task_submission_id] ?? ''}
                              onChange={(e) =>
                                setFeedbackDraft((prev) => ({
                                  ...prev,
                                  [s.task_submission_id]: e.target.value,
                                }))
                              }
                            />
                            <div className="managerFeedbackBtns">
                              <button
                                className="managerFeedbackBtn secondary"
                                onClick={() => handleFeedbackSave(s.task_submission_id, 'resubmit_requested')}
                                disabled={feedbackSavingId === s.task_submission_id}
                              >
                                재제출 요청
                              </button>
                              <button
                                className="managerFeedbackBtn primary"
                                onClick={() => handleFeedbackSave(s.task_submission_id, 'feedback_given')}
                                disabled={feedbackSavingId === s.task_submission_id}
                              >
                                {feedbackSavingId === s.task_submission_id ? '저장 중...' : '피드백 저장'}
                              </button>
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
        </div>
      )}

      {/* 커리큘럼 생성 폼 모달 */}
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
                <label className="curriculumField">
                  <span>과정명</span>
                  <input
                    name="cur_title"
                    value={form.cur_title}
                    onChange={handleChange}
                    placeholder="예: 마케팅 신입 4주 온보딩"
                  />
                </label>
                <div className="curriculumFieldGrid">
                  <label className="curriculumField">
                    <span>대상 직무</span>
                    <input
                      name="cur_target_job"
                      value={form.cur_target_job}
                      onChange={handleChange}
                      placeholder="예: 마케터"
                    />
                  </label>
                  <label className="curriculumField">
                    <span>산업</span>
                    <input
                      name="cur_target_industry"
                      value={form.cur_target_industry}
                      onChange={handleChange}
                      placeholder="예: IT"
                    />
                  </label>
                </div>
                <label className="curriculumField">
                  <span>기간</span>
                  <input
                    name="cur_duration_weeks"
                    type="number"
                    min="1"
                    max="52"
                    value={form.cur_duration_weeks}
                    onChange={handleChange}
                  />
                </label>
                <label className="curriculumField">
                  <span>학습 목표</span>
                  <textarea
                    name="cur_learning_goal"
                    value={form.cur_learning_goal}
                    onChange={handleChange}
                    rows="3"
                    placeholder="예: 디지털 마케팅 기초 역량 확보"
                  />
                </label>
                <label className="curriculumField">
                  <span>필수 포함 내용</span>
                  <textarea
                    name="required_content"
                    value={form.required_content}
                    onChange={handleChange}
                    rows="3"
                    placeholder="예: GA4 분석, SEO 기본, 콘텐츠 마케팅 전략"
                  />
                </label>
                {formError && <p className="curriculumFormError">{formError}</p>}
                <button className="curriculumGenerateBtn" type="submit" disabled={generating}>
                  {generating ? 'AI 생성 중...' : 'AI 커리큘럼 생성'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* 배정 변경 모달 */}
      {assignModalOpen && selectedCurriculum && (
        <>
          <div className="confirmOverlay" onClick={() => !assignSaving && setAssignModalOpen(false)} />
          <div className="confirmModal" style={{ maxWidth: '560px' }}>
            <div className="confirmHeader">
              <div className="confirmHeaderRight">
                <p className="confirmHeaderLabel">{selectedCurriculum.cur_title}</p>
                <h3 className="confirmTitle">학습자 배정 변경</h3>
                <div className="confirmDivider" />
              </div>
            </div>

            <div className="assignSection">
              {learners.length === 0 ? (
                <p className="assignEmpty">같은 회사의 등록된 학습자가 없습니다.</p>
              ) : (
                <div className="assignCheckList">
                  {learners.map((l) => {
                    const checked = assignSelected.includes(l.user_id);
                    return (
                      <label key={l.user_id} className={`assignCheckItem ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignSelected((prev) => [...prev, l.user_id]);
                            } else {
                              setAssignSelected((prev) => prev.filter((id) => id !== l.user_id));
                            }
                          }}
                        />
                        <span className="assignName">{l.user_name}</span>
                        <span className="assignEmail">{l.user_email}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="confirmBtns" style={{ marginTop: '24px' }}>
              <button
                className="confirmBtnBack"
                onClick={() => setAssignModalOpen(false)}
                disabled={assignSaving}
              >
                취소
              </button>
              <button
                className="confirmBtnCreate"
                onClick={handleAssignSave}
                disabled={assignSaving}
              >
                {assignSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 커리큘럼 생성 결과 미리보기 및 저장 모달 */}
      {confirmOpen && preview && (
        <>
          <div className="confirmOverlay" onClick={() => !saving && setConfirmOpen(false)} />
          <div className="confirmModal">
            <div className="confirmHeader">
              <div className="confirmHeaderRight">
                <p className="confirmHeaderLabel">
                  {preview.cur_target_job || '직무 미지정'} | {preview.cur_duration_weeks}주차
                </p>
                <h3 className="confirmTitle">이 커리큘럼을 저장할까요?</h3>
                <div className="confirmDivider" />
              </div>
            </div>

            <div className="confirmGoalBox">
              <p className="confirmGoalLabel">교육 목표 :</p>
              <p className="confirmGoalText">{preview.cur_learning_goal || '교육 목표가 입력되지 않았습니다.'}</p>
            </div>

            <p className="confirmProgramName">{preview.cur_title}</p>

            <div className="confirmStepList" style={{ marginTop: '20px' }}>
              {previewWeeks.map((step) =>
                renderAccordionItem(
                  step,
                  previewExpandedWeek,
                  (week) => setPreviewExpandedWeek(prev => prev === week ? null : week)
                )
              )}
            </div>

            {/* 학습자 배정 */}
            <div className="assignSection" style={{ marginTop: '24px' }}>
              <p className="assignSectionTitle">학습자 배정 (선택)</p>
              <p className="assignSectionHint">
                선택한 학습자들이 자신의 화면에서 이 커리큘럼을 볼 수 있습니다. 나중에 변경 가능합니다.
              </p>
              {learners.length === 0 ? (
                <p className="assignEmpty">같은 회사의 등록된 학습자가 없습니다.</p>
              ) : (
                <div className="assignCheckList">
                  {learners.map((l) => {
                    const checked = createAssignedIds.includes(l.user_id);
                    return (
                      <label key={l.user_id} className={`assignCheckItem ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateAssignedIds((prev) => [...prev, l.user_id]);
                            } else {
                              setCreateAssignedIds((prev) => prev.filter((id) => id !== l.user_id));
                            }
                          }}
                        />
                        <span className="assignName">{l.user_name}</span>
                        <span className="assignEmail">{l.user_email}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {formError && <p className="curriculumFormError" style={{ marginTop: '16px' }}>{formError}</p>}

            <div className="confirmBtns" style={{ marginTop: '24px' }}>
              <button className="confirmBtnBack" onClick={() => setConfirmOpen(false)} disabled={saving}>
                돌아가기
              </button>
              <button className="confirmBtnCreate" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '생성'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CurriculumView;