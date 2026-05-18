import { useEffect, useState } from 'react';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import '../styles/Curriculum.css';

// 👉 Tiptap 관련 모듈 Import (Jodit Import 제거됨)
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';

// 👉 기능이 꽉 찬 Tiptap 에디터 커스텀 컴포넌트
const TiptapEditor = ({ value, onChange, isFullscreen }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor-wrapper">
      <div className="tiptap-toolbar">
        {/* 실행 취소 / 다시 실행 */}
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↩️ 취소</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↪️ 복구</button>
        <span className="toolbar-divider">|</span>

        {/* 텍스트 스타일 */}
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}><b>B</b></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}><i>I</i></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''}><u>U</u></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''}><s>S</s></button>
        
        {/* 글자 색상 */}
        <input 
          type="color" 
          onInput={(e) => editor.chain().focus().setColor(e.target.value).run()} 
          value={editor.getAttributes('textStyle').color || '#000000'}
          className="tiptap-color-picker"
          title="글자 색상"
        />
        <span className="toolbar-divider">|</span>

        {/* 헤딩 및 리스트 */}
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>• 리스트</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}>1. 리스트</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''}>인용구</button>
        <span className="toolbar-divider">|</span>

        {/* 텍스트 정렬 */}
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}>왼쪽</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}>가운데</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}>오른쪽</button>
        <span className="toolbar-divider">|</span>

        {/* 표 관련 */}
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>표 삽입</button>
        <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} disabled={!editor.can().addColumnBefore()}>열 추가</button>
        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()}>행 추가</button>
        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()}>표 삭제</button>
      </div>
      <div className={`tiptap-editor-content ${isFullscreen ? 'fullscreen' : ''}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

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

function LearnerCurriculumView({ curriculumDetailRef }) {
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [submissions, setSubmissions] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);

  const [modalState, setModalState] = useState(null); // { curId, week, fullscreen }
  const [submitContent, setSubmitContent] = useState('');
  const [submitFiles, setSubmitFiles] = useState([]);
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

  useEffect(() => {
    if (curriculumDetailRef) {
      curriculumDetailRef.current = Boolean(selectedId);
    }

    const onPop = () => {
      if (!selectedId) return;
      setSelectedId(null);
      setExpandedWeek(null);
      if (curriculumDetailRef) {
        curriculumDetailRef.current = false;
      }
    };

    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (curriculumDetailRef) {
        curriculumDetailRef.current = false;
      }
    };
  }, [selectedId, curriculumDetailRef]);

  const selected = curriculums.find((c) => c.cur_id === selectedId) || null;

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
    setModalState({ curId, week, fullscreen: false });
    setSubmitContent('');
    setSubmitFiles([]);
    setSubmitError(null);
  };

  const toggleSubmitFullscreen = () => {
    setModalState((prev) => (prev ? { ...prev, fullscreen: !prev.fullscreen } : prev));
  };

  const closeSubmitModal = () => {
    if (submitting) return;
    setModalState(null);
    setSubmitContent('');
    setSubmitFiles([]);
    setSubmitError(null);
  };

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

  const handleSubmit = async () => {
    if (!modalState) return;
    const trimmed = (submitContent || '').replace(/<p><br><\/p>/g, '').trim();
    if (!trimmed && submitFiles.length === 0) {
      setSubmitError('작성 내용이나 첨부파일 중 하나는 있어야 합니다.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post('/task-submissions', {
        task_curriculum_id: modalState.curId,
        task_week_number: modalState.week,
        task_submitted_content: { text: trimmed },
      });
      const submissionId = res.data?.task_submission_id;

      const failures = [];
      for (const file of submitFiles) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          await api.post(
            `/task-submissions/${submissionId}/attachments`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          );
        } catch (err) {
          failures.push(`${file.name}: ${err.response?.data?.detail || '업로드 실패'}`);
        }
      }
      await loadSubmissions();
      if (failures.length > 0) {
        alert(`제출은 완료됐지만 일부 첨부 업로드에 실패했습니다:\n${failures.join('\n')}`);
      }
      setModalState(null);
      setSubmitContent('');
      setSubmitFiles([]);
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

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

                  {sub && (
                    <section className="learnerWeekSubmission">
                      <h4 className="learnerWeekSectionTitle">📝 내 제출</h4>
                      <p className="learnerWeekSubmissionMeta">
                        제출일: {formatDateTime(sub.task_submitted_at)}
                      </p>
                      <div
                        className="learnerWeekSubmissionBody"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(sub.task_submitted_content?.text) || '(내용 없음)' }}
                      />

                      {Array.isArray(sub.task_submitted_content?.attachments) && sub.task_submitted_content.attachments.length > 0 && (
                        <div className="learnerWeekSubmissionAttachments">
                          <h5 className="learnerWeekFeedbackTitle">📎 첨부파일</h5>
                          <ul className="learnerSubmitAttachmentList">
                            {sub.task_submitted_content.attachments.map((a, i) => (
                              <li key={i} className="learnerSubmitAttachmentItem">
                                <button
                                  type="button"
                                  className="learnerSubmitAttachmentLink"
                                  onClick={() => handleAttachmentDownload(sub.task_submission_id, a)}
                                >
                                  {a.filename || a.stored_name}
                                </button>
                                <span className="learnerSubmitAttachmentSize">{formatBytes(a.size)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

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

      {modalState && (() => {
        const week = normalizeWeekPlan(selected?.cur_week_plan).find((s) => s.week === modalState.week);
        const templateAssignments = (week && Array.isArray(week.assignments))
          ? week.assignments.filter((a) => a && a.template_content)
          : [];

        return (
          <>
            <div className="emailModalOverlay" onClick={closeSubmitModal} />
            <div className={`emailModal learnerSubmitModal ${modalState.fullscreen ? 'fullscreen' : ''}`}>
              <div className="emailModalHeader">
                <div className="learnerSubmitModalTitle">
                  {modalState.week}주차 과제 제출
                </div>
                <div className="learnerSubmitModalHeaderActions">
                  <button
                    type="button"
                    className="learnerSubmitFullscreenBtn"
                    onClick={toggleSubmitFullscreen}
                    disabled={submitting}
                  >
                    {modalState.fullscreen ? '✕ 축소' : '⛶ 전체보기'}
                  </button>
                  <button className="emailModalClose" onClick={closeSubmitModal} disabled={submitting}>✕</button>
                </div>
              </div>
              <div className="emailModalDivider" />

              <div className="emailModalBody learnerSubmitModalBody">
                {templateAssignments.length > 0 && (
                  <section className="learnerSubmitTemplateSection">
                    <h4 className="learnerSubmitSectionTitle">📋 사수가 배포한 양식</h4>
                    {templateAssignments.map((a, idx) => (
                      <div key={idx} className="learnerSubmitTemplateCard">
                        <strong className="learnerSubmitTemplateTitle">{a.title}</strong>
                        <div
                          className="learnerSubmitTemplateContent"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(a.template_content) }}
                        />
                      </div>
                    ))}
                  </section>
                )}

                <section className="learnerSubmitEditorSection">
                  <h4 className="learnerSubmitSectionTitle">📝 과제 작성</h4>
                  <TiptapEditor
                    value={submitContent}
                    onChange={setSubmitContent}
                    isFullscreen={modalState.fullscreen}
                  />
                </section>

                <section className="learnerSubmitAttachmentSection">
                  <h4 className="learnerSubmitSectionTitle">📎 첨부파일</h4>
                  <label className="learnerSubmitAttachmentPicker">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      disabled={submitting}
                    />
                    <span>+ 파일 추가</span>
                  </label>
                  {submitFiles.length > 0 && (
                    <ul className="learnerSubmitFileList">
                      {submitFiles.map((f, i) => (
                        <li key={i} className="learnerSubmitFileItem">
                          <span className="learnerSubmitFileName">{f.name}</span>
                          <span className="learnerSubmitFileSize">{formatBytes(f.size)}</span>
                          <button
                            type="button"
                            className="learnerSubmitFileRemove"
                            onClick={() => handleFileRemove(i)}
                            disabled={submitting}
                          >삭제</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {submitError && (
                <p className="emailingError learnerSubmitError">{submitError}</p>
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
        );
      })()}
    </div>
  );
}

export default LearnerCurriculumView;