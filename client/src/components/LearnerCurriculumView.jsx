import { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
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

  const [modalState, setModalState] = useState(null);
  const [viewSubmissionModal, setViewSubmissionModal] = useState(null);

  const [submitFiles, setSubmitFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // 템플릿 DOM 참조 컨테이너
  const submitEditorRef = useRef(null);

  const loadSubmissions = () => {
    return api.get('/task-submissions/my')
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {/* silent */ });
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
      const t1 = new Date(latest.task_submitted_at || 0).getTime();
      const t2 = new Date(s.task_submitted_at || 0).getTime();
      return t2 > t1 ? s : latest;
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

  // 📌 과제 제출 모달 열기
  const openSubmitModal = (curId, week) => {
    const targetCurriculum = curriculums.find((c) => c.cur_id === curId) || selected;
    const targetWeek = normalizeWeekPlan(targetCurriculum?.cur_week_plan).find((s) => s.week === week);
    const templateAssignments = (targetWeek && Array.isArray(targetWeek.assignments))
      ? targetWeek.assignments.filter((a) => a && a.template_content)
      : [];

    // 원본 템플릿 HTML 병합
    const initialContent = templateAssignments.length > 0
      ? templateAssignments.map((a) => {
        const title = a.title ? `<h3>${escapeHtml(a.title)}</h3>` : '';
        return `${title}${a.template_content}`;
      }).join('<hr>')
      : '';

    // 상태에 원본 HTML 세팅
    setModalState({ curId, week, fullscreen: false, templateHtml: initialContent });
    setSubmitFiles([]);
    setSubmitError(null);
  };

  const toggleSubmitFullscreen = () => setModalState((prev) => (prev ? { ...prev, fullscreen: !prev.fullscreen } : prev));

  const closeSubmitModal = () => {
    if (submitting) return;
    setModalState(null);
    setSubmitFiles([]);
    setSubmitError(null);
  };

  // ✨ 핵심 마법: 템플릿의 빈칸을 찾아 'contenteditable'로 변환 (Tiptap과 동일한 작동 방식)
  useEffect(() => {
    if (modalState && submitEditorRef.current) {
      const container = submitEditorRef.current;

      const targets = container.querySelectorAll('td, p');
      targets.forEach(el => {
        const text = el.textContent.trim();
        const hasImage = el.querySelector('img') !== null;

        // 텍스트가 비어있는 빈칸만 대상
        if (text === '' && !hasImage) {
          el.setAttribute('contenteditable', 'true');
          el.classList.add('learner-editable-cell');

          // 📌 가이드 문구를 span으로 직접 삽입
          el.innerHTML = '<span class="placeholder-text" style="color:#a0aec0; font-style:italic;">클릭하여 내용 입력</span>';

          // 포커스 시 가이드 문구 삭제
          el.onfocus = function () {
            if (this.querySelector('.placeholder-text')) {
              this.innerHTML = '';
            }
            this.style.backgroundColor = '#ffffff';
            this.style.border = '2px solid #3182ce';
          };

          // 블러 시 내용이 없으면 가이드 문구 복구
          el.onblur = function () {
            if (this.textContent.trim() === '') {
              this.innerHTML = '<span class="placeholder-text" style="color:#a0aec0; font-style:italic;">클릭하여 내용 입력</span>';
            }
            this.style.backgroundColor = '#f8fafc';
            this.style.border = '2px dashed #4a90e2';
          };

          // 초기 스타일 적용
          el.style.backgroundColor = '#f8fafc';
          el.style.border = '2px dashed #4a90e2';
          el.style.minHeight = '30px';
          el.style.padding = '8px';
          el.style.borderRadius = '4px';
        }
      });
    }
  }, [modalState?.templateHtml]);

  const handleFileSelect = (event) => {
    const picked = Array.from(event.target.files || []);
    setSubmitFiles((prev) => [...prev, ...picked]);
    event.target.value = '';
  };

  const handleFileRemove = (idx) => {
    setSubmitFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try {
      await downloadAttachment(submissionId, attachment);
    } catch (err) {
      alert(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.');
    }
  };

  // 📌 제출 시점: 입력 가능한 칸에 적힌 글씨를 그대로 HTML에 저장 후 속성만 지워 전송
  const handleSubmit = async () => {
    if (!modalState || !submitEditorRef.current) return;

    // 현재 템플릿 DOM 전체를 복사
    const htmlCopy = submitEditorRef.current.cloneNode(true);
    let hasContent = false;

    // 복사본에서 contenteditable 속성을 지워서 깔끔한 순수 HTML로 변환
    const editableElements = htmlCopy.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(el => {
      if (el.textContent.trim() !== '') {
        hasContent = true;
      }
      // 제출할 때는 편집 관련 속성과 클래스를 떼버림
      el.removeAttribute('contenteditable');
      el.classList.remove('learner-editable-cell', 'learner-editable-p', 'learner-editable-fallback');
      delete el.dataset.placeholder;
    });

    const finalHtml = htmlCopy.innerHTML.trim();

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
        task_submitted_content: { text: finalHtml },
      });
      const submissionId = res.data?.task_submission_id;

      const failures = [];
      for (const file of submitFiles) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await api.post(`/task-submissions/${submissionId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch (err) {
          failures.push(`${file.name}: ${err.response?.data?.detail || '업로드 실패'}`);
        }
      }

      await loadSubmissions();
      if (failures.length > 0) alert(`제출은 완료됐지만 일부 첨부 업로드에 실패했습니다:\n${failures.join('\n')}`);

      closeSubmitModal();
    } catch (err) {
      setSubmitError(err.response?.data?.detail || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 목록 View =====
  if (!selected) {
    return (
      <div className="curriculumPageContainer">
        <h2 className="sectionTitle">내 학습 커리큘럼</h2>
        {loading && <p className="learnerInlineHint">커리큘럼을 불러오는 중...</p>}
        {error && <p className="learnerInlineError">{error}</p>}
        {!loading && !error && curriculums.length === 0 && (
          <p className="learnerInlineMuted">배정된 커리큘럼이 아직 없습니다. 매니저가 커리큘럼을 배정해주면 여기에 표시됩니다.</p>
        )}
        <div className="learnerCurriculumGrid">
          {curriculums.map((c) => {
            const weeks = normalizeWeekPlan(c.cur_week_plan).length || c.cur_duration_weeks || 0;
            const submitted = submittedWeekCount(c.cur_id);
            const progress = weeks > 0 ? Math.round((submitted / weeks) * 100) : 0;
            return (
              <div key={c.cur_id} className="learnerCurriculumCard" onClick={() => handleSelect(c.cur_id)}>
                <div className="learnerCurriculumCardHeader">
                  <p className="learnerCurriculumCardSubtitle">{c.cur_target_industry || '-'} · {c.cur_target_job || '-'}</p>
                  <h3 className="learnerCurriculumCardTitle">{c.cur_title}</h3>
                </div>
                <div className="learnerCurriculumCardMeta">
                  <span className="learnerCurriculumCardBadge">{weeks}주 과정</span>
                  {c.cur_status === 'active' && <span className="learnerCurriculumCardBadge active">진행 중</span>}
                  <span className="learnerCurriculumCardBadge">제출 {submitted}/{weeks}</span>
                </div>
                <div className="learnerProgressBar"><div className="learnerProgressFill" style={{ width: `${progress}%` }} /></div>
                {c.cur_learning_goal && <p className="learnerCurriculumCardGoal">🎯 {c.cur_learning_goal}</p>}
                <div className="learnerCurriculumCardFooter">주차별 학습 보기 →</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== 상세 View =====
  const weekPlan = normalizeWeekPlan(selected.cur_week_plan);
  const totalWeeks = weekPlan.length || selected.cur_duration_weeks;
  const submittedCount = submittedWeekCount(selected.cur_id);
  const progress = totalWeeks > 0 ? Math.round((submittedCount / totalWeeks) * 100) : 0;

  return (
    <div className="curriculumPageContainer">
      <button className="authorBackBtn" onClick={handleBack}>← 커리큘럼 목록으로</button>

      <div className="learnerDetailHeader">
        <p className="learnerDetailSubtitle">{selected.cur_target_industry || '-'} · {selected.cur_target_job || '-'} · {totalWeeks}주 과정</p>
        <h2 className="learnerDetailTitle">{selected.cur_title}</h2>
        {selected.cur_learning_goal && <p className="learnerDetailGoal">🎯 {selected.cur_learning_goal}</p>}
        <div className="learnerDetailProgress">
          <div className="learnerProgressBar"><div className="learnerProgressFill" style={{ width: `${progress}%` }} /></div>
          <span className="learnerDetailProgressText">{submittedCount} / {totalWeeks} 주차 제출 ({progress}%)</span>
        </div>
      </div>

      <div className="learnerWeekStepper">
        {weekPlan.map((step) => {
          const sub = getLatestSubmission(selected.cur_id, step.week);
          const isActive = expandedWeek === step.week;
          const stateClass = sub ? `submitted ${sub.task_status || ''}` : '';
          return (
            <button key={step.week} className={`learnerWeekStep ${isActive ? 'active' : ''} ${stateClass}`} onClick={() => toggleWeek(step.week)}>
              <span className="learnerWeekStepNum">{step.week}</span>
              <span className="learnerWeekStepLabel">주차</span>
              {sub && <span className="learnerWeekStepDot" />}
            </button>
          );
        })}
      </div>

      <div className="learnerWeekList">
        {weekPlan.length === 0 && <p className="learnerInlineMuted">주차별 계획이 아직 없습니다.</p>}
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
                  {sub && <span className={`learnerWeekStatusBadge ${sub.task_status || ''}`}>{STATUS_LABEL[sub.task_status] || '제출됨'}</span>}
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
                        <ul className="learnerWeekSectionList">{tasks.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      ) : (
                        <p className="learnerWeekSectionText">{tasks}</p>
                      )}
                    </section>
                  )}
                  {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                    <section className="learnerWeekSection">
                      <h4 className="learnerWeekSectionTitle">📖 추천 자료</h4>
                      {step.recommended_articles.map((article, i) => {
                        const targetUrl = article.url && article.url.trim() !== '' ? article.url : `https://www.google.com/search?q=${encodeURIComponent(article.title || '')}`;
                        return (
                          <div key={i} className="learnerWeekArticle">
                            <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="learnerWeekArticleLink">
                              {article.url && article.url.trim() !== '' ? '🔗 ' : '🔍 '}{article.title}
                            </a>
                            {article.why_relevant && <p className="learnerWeekArticleReason">- {article.why_relevant}</p>}
                          </div>
                        );
                      })}
                    </section>
                  )}

                  {sub && (
                    <section className="learnerWeekSubmission">
                      <h4 className="learnerWeekSectionTitle">📝 내 제출</h4>
                      <p className="learnerWeekSubmissionMeta">제출일: {formatDateTime(sub.task_submitted_at)}</p>

                      <button
                        className="btn-view-submission"
                        onClick={() => setViewSubmissionModal(sub)}
                      >
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
                    {step.estimated_hours && <span className="learnerWeekBadge">⏱ 예상 {step.estimated_hours}시간</span>}
                    <button
                      className="learnerWeekSubmitBtn"
                      onClick={() => openSubmitModal(selected.cur_id, step.week)}
                      disabled={!canResubmit}
                      title={canResubmit ? '과제 제출' : '이미 제출 완료 (재제출 요청 시 다시 활성화됩니다)'}
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

      {/* 제출된 과제 내용 확인 모달 (읽기 전용) */}
      {viewSubmissionModal && (
        <>
          <div className="emailModalOverlay" onClick={() => setViewSubmissionModal(null)} />
          <div className="emailModal learnerSubmitModal">
            <div className="emailModalHeader">
              <div className="learnerSubmitModalTitle">제출한 과제 내용</div>
              <button className="emailModalClose" onClick={() => setViewSubmissionModal(null)}>✕</button>
            </div>

            <div className="emailModalDivider" />

            <div className="emailModalBody learnerSubmitModalBody">
              {/* ✨ sanitizeHtml 제거하여 표 구조 유지 */}
              <div
                className="learnerWeekSubmissionBody learner-rendered-content learner-custom-form"
                dangerouslySetInnerHTML={{ __html: viewSubmissionModal.task_submitted_content?.text || '(내용 없음)' }}
              />

              {Array.isArray(viewSubmissionModal.task_submitted_content?.attachments) && viewSubmissionModal.task_submitted_content.attachments.length > 0 && (
                <div className="learnerSubmitAttachmentSection">
                  <h5 className="learnerWeekFeedbackTitle">📎 첨부파일</h5>
                  <ul className="learnerSubmitFileList">
                    {viewSubmissionModal.task_submitted_content.attachments.map((a, i) => (
                      <li key={i} className="learnerSubmitFileItem">
                        <button type="button" className="learnerSubmitAttachmentLink" onClick={() => handleAttachmentDownload(viewSubmissionModal.task_submission_id, a)}>{a.filename || a.stored_name}</button>
                        <span className="learnerSubmitAttachmentSize">{formatBytes(a.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="emailModalFooter">
              <button className="btn-modal-cancel" onClick={() => setViewSubmissionModal(null)}>닫기</button>
            </div>
          </div>
        </>
      )}

      {/* ✨ 과제 제출 모달 (Tiptap 처럼 완벽히 동작하지만 표 구조는 절대 안 부서지는 폼) */}
      {modalState && (
        <>
          <div className="emailModalOverlay" onClick={closeSubmitModal} />
          <div className={`emailModal learnerSubmitModal ${modalState.fullscreen ? 'fullscreen' : ''}`}>
            <div className="emailModalHeader">
              <div className="learnerSubmitModalTitle">{modalState.week}주차 과제 작성</div>
              <div className="learnerSubmitModalHeaderActions">
                <button type="button" className="learnerSubmitFullscreenBtn" onClick={toggleSubmitFullscreen} disabled={submitting}>
                  {modalState.fullscreen ? '✕ 축소' : '⛶ 전체보기'}
                </button>
                <button className="emailModalClose" onClick={closeSubmitModal} disabled={submitting}>✕</button>
              </div>
            </div>

            <div className="emailModalDivider" />

            <div className="emailModalBody learnerSubmitModalBody">
              <section className="learnerSubmitEditorSection">
                <h4 className="learnerSubmitSectionTitle">📝 과제 작성</h4>
                <p className="learnerSubmitSectionHint">
                  마우스로 표의 옅은 회색 빈칸을 클릭하여 자유롭게 내용을 채워주세요. (구조는 변경할 수 없게 잠겨있습니다.)
                </p>

                {/* 📌 ✨ sanitizeHtml 제거! 표가 무너지지 않습니다. */}
                <div
                  className="learnerSubmitEditorWrapper learner-custom-form"
                  contentEditable={false} /* 표 틀 전체는 쓰기 금지! */
                  ref={submitEditorRef}
                  dangerouslySetInnerHTML={{ __html: modalState.templateHtml }}
                ></div>

              </section>

              <section className="learnerSubmitAttachmentSection">
                <h4 className="learnerSubmitSectionTitle">📎 첨부파일</h4>
                <label className="learnerSubmitAttachmentPicker">
                  <input type="file" multiple onChange={handleFileSelect} disabled={submitting} />
                  <span>+ 파일 추가</span>
                </label>
                {submitFiles.length > 0 && (
                  <ul className="learnerSubmitFileList">
                    {submitFiles.map((f, i) => (
                      <li key={i} className="learnerSubmitFileItem">
                        <span className="learnerSubmitFileName">{f.name}</span>
                        <span className="learnerSubmitFileSize">{formatBytes(f.size)}</span>
                        <button type="button" className="learnerSubmitFileRemove" onClick={() => handleFileRemove(i)} disabled={submitting}>삭제</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {submitError && <p className="emailingError learnerSubmitError">{submitError}</p>}

            <div className="emailModalFooter">
              <button className="emailSendBtn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '제출 중...' : '최종 제출하기'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LearnerCurriculumView;