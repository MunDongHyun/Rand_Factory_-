import { useEffect, useState } from 'react';
import api from '../lib/api';
import '../styles/Curriculum.css';

const normalizeWeekPlan = (plan) => {
  if (Array.isArray(plan)) return plan;
  if (plan && typeof plan === 'object') return [plan];
  return [];
};

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

function LearnerCurriculumView() {
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [submissions, setSubmissions] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  const [modalState, setModalState] = useState(null); // { curId, week }
  const [submitText, setSubmitText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const loadSubmissions = () => {
    return api.get('/task-submissions/my')
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {/* silent */});
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

  const selected = curriculums.find((c) => c.cur_id === selectedId) || null;

  // 특정 (커리큘럼, 주차)의 가장 최근 제출만 반환
  const getLatestSubmission = (curId, week) => {
    const matches = submissions.filter(
      (s) => s.task_curriculum_id === curId && s.task_week_number === week
    );
    if (matches.length === 0) return null;
    return matches.reduce((latest, s) => {
      if (!latest) return s;
      const t1 = new Date(latest.task_submitted_at || 0).getTime();
      const t2 = new Date(s.task_submitted_at || 0).getTime();
      return t2 > t1 ? s : latest;
    }, null);
  };

  const submittedWeekCount = (curId) => {
    const set = new Set(
      submissions
        .filter((s) => s.task_curriculum_id === curId)
        .map((s) => s.task_week_number)
    );
    return set.size;
  };

  const handleSelect = (curId) => {
    setSelectedId(curId);
    setExpandedWeek(null);
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
    setModalState({ curId, week });
    setSubmitText('');
    setSubmitError(null);
  };

  const closeSubmitModal = () => {
    setModalState(null);
    setSubmitText('');
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!modalState) return;
    if (!submitText.trim()) {
      setSubmitError('내용을 입력하세요.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/task-submissions', {
        task_curriculum_id: modalState.curId,
        task_week_number: modalState.week,
        task_submitted_content: { text: submitText.trim() },
      });
      await loadSubmissions();
      closeSubmitModal();
    } catch (err) {
      setSubmitError(err.response?.data?.detail || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 목록 =====
  if (!selected) {
    return (
      <div className="curriculumPageContainer">
        <h2 className="sectionTitle">내 학습 커리큘럼</h2>

        {loading && <p style={{ padding: '20px' }}>커리큘럼을 불러오는 중...</p>}
        {error && <p style={{ padding: '20px', color: '#c33' }}>{error}</p>}
        {!loading && !error && curriculums.length === 0 && (
          <p style={{ padding: '20px', color: '#666' }}>
            배정된 커리큘럼이 아직 없습니다. 매니저가 커리큘럼을 배정해주면 여기에 표시됩니다.
          </p>
        )}

        <div className="learnerCurriculumGrid">
          {curriculums.map((c) => {
            const weeks = normalizeWeekPlan(c.cur_week_plan).length || c.cur_duration_weeks || 0;
            const submitted = submittedWeekCount(c.cur_id);
            const progress = weeks > 0 ? Math.round((submitted / weeks) * 100) : 0;
            return (
              <div
                key={c.cur_id}
                className="learnerCurriculumCard"
                onClick={() => handleSelect(c.cur_id)}
              >
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
                  <span className="learnerCurriculumCardBadge">
                    제출 {submitted}/{weeks}
                  </span>
                </div>

                <div className="learnerProgressBar">
                  <div className="learnerProgressFill" style={{ width: `${progress}%` }} />
                </div>

                {c.cur_learning_goal && (
                  <p className="learnerCurriculumCardGoal">
                    🎯 {c.cur_learning_goal}
                  </p>
                )}

                <div className="learnerCurriculumCardFooter">
                  주차별 학습 보기 →
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== 상세 =====
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
          <span className="learnerDetailProgressText">{submittedCount} / {totalWeeks} 주차 제출 ({progress}%)</span>
        </div>
      </div>

      {/* 주차별 스텝퍼 */}
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

      {/* 주차별 아코디언 */}
      <div className="learnerWeekList">
        {weekPlan.length === 0 && (
          <p style={{ padding: '20px', color: '#666' }}>주차별 계획이 아직 없습니다.</p>
        )}

        {weekPlan.map((step) => {
          const isExpanded = expandedWeek === step.week;
          const tasks = step.tasks || step.task;
          const sub = getLatestSubmission(selected.cur_id, step.week);
          const canResubmit = !sub || sub.task_status === 'resubmit_requested';
          return (
            <div key={step.week} className="learnerWeekCard">
              <div
                className="learnerWeekCardHeader"
                onClick={() => toggleWeek(step.week)}
              >
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
                        const targetUrl = article.url && article.url.trim() !== ''
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
                              {article.url && article.url.trim() !== '' ? '🔗 ' : '🔍 '}
                              {article.title}
                            </a>
                            {article.why_relevant && (
                              <p className="learnerWeekArticleReason">- {article.why_relevant}</p>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  )}

                  {Array.isArray(step.success_criteria) && step.success_criteria.length > 0 && (
                    <section className="learnerWeekSection">
                      <h4 className="learnerWeekSectionTitle">✅ 체크리스트</h4>
                      <ul className="learnerWeekSectionList">
                        {step.success_criteria.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </section>
                  )}

                  {/* 본인 제출 내역 */}
                  {sub && (
                    <section className="learnerWeekSubmission">
                      <h4 className="learnerWeekSectionTitle">📝 내 제출</h4>
                      <p className="learnerWeekSubmissionMeta">
                        제출일: {formatDateTime(sub.task_submitted_at)}
                      </p>
                      <div className="learnerWeekSubmissionBody">
                        {sub.task_submitted_content?.text || '(내용 없음)'}
                      </div>

                      {sub.task_manager_feedback ? (
                        <div className="learnerWeekFeedback">
                          <h5 className="learnerWeekFeedbackTitle">🗨 매니저 피드백</h5>
                          <p className="learnerWeekFeedbackMeta">
                            {formatDateTime(sub.task_feedback_at)}
                          </p>
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
                      title={canResubmit ? '과제 제출' : '이미 제출 완료 (재제출 요청 시 다시 활성화됩니다)'}
                    >
                      {sub ? (canResubmit ? '재제출하기' : '제출 완료') : '과제 제출하기'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 제출 모달 */}
      {modalState && (
        <>
          <div className="emailModalOverlay" onClick={closeSubmitModal} />
          <div className="emailModal">
            <div className="emailModalHeader">
              <div className="learnerSubmitModalTitle">
                {modalState.week}주차 과제 제출
              </div>
              <button className="emailModalClose" onClick={closeSubmitModal}>✕</button>
            </div>
            <div className="emailModalDivider" />

            <div className="emailModalBody">
              <textarea
                className="emailModalTextarea"
                placeholder="과제 내용을 입력하세요"
                value={submitText}
                onChange={(e) => setSubmitText(e.target.value)}
                autoFocus
              />
            </div>

            {submitError && (
              <p className="emailingError" style={{ padding: '0 24px' }}>{submitError}</p>
            )}

            <div className="emailModalFooter">
              <button
                className="emailSendBtn"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LearnerCurriculumView;
