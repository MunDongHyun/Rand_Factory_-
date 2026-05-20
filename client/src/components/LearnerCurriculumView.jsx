import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
import '../styles/LearnerCurriculum.css';

// --- Tiptap Named Imports ---
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';

// --- Tiptap 컴포넌트 (학습자 전용 툴바 적용) ---
const TiptapMenuBar = ({ editor, role }) => {
  if (!editor) return null;
  const isManager = role !== 'learner';

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => editor.chain().focus().setImage({ src: e.target.result }).run();
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL을 입력하세요', previousUrl);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="tiptap-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px', borderBottom: '1px solid #ddd' }}>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}>H3</button>
      <span className="confirmDivider" style={{ margin: '0 4px', height: '16px', display: 'inline-block', verticalAlign: 'middle' }}></span>
      
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}><b>B</b></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''}><u>U</u></button>
      <input type="color" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} title="글자 색상" style={{ width: '24px', height: '24px', padding: 0, cursor: 'pointer' }} />
      <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive('highlight') ? 'is-active' : ''}>형광펜</button>
      <span className="confirmDivider" style={{ margin: '0 4px', height: '16px', display: 'inline-block', verticalAlign: 'middle' }}></span>
      
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>• 리스트</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}>1. 리스트</button>
      <button type="button" onClick={setLink} className={editor.isActive('link') ? 'is-active' : ''}>🔗 링크</button>
      <button type="button" onClick={addImage}>🖼️ 이미지</button>

      {/* 관리자일 때만 표 구조 변경 버튼 표시 (학습자는 표 내용만 수정 가능) */}
      {isManager && (
        <>
          <span className="confirmDivider" style={{ margin: '0 4px', height: '16px', display: 'inline-block', verticalAlign: 'middle' }}></span>
          <div style={{ display: 'flex', gap: '2px', background: '#ffebee', padding: '2px 4px', borderRadius: '4px' }}>
            <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>표 삽입</button>
            <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()}>+열 앞</button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>+열 뒤</button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} style={{ color: 'red' }}>-열 삭제</button>
            <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()}>+행 위</button>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>+행 아래</button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} style={{ color: 'red' }}>-행 삭제</button>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} style={{ color: 'red', fontWeight: 'bold' }}>표 전체 삭제</button>
          </div>
        </>
      )}
    </div>
  );
};

const TiptapEditor = ({ value, onChange, role = 'learner' }) => {
  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, Color, Highlight, Image.configure({ inline: true, allowBase64: true }), Link.configure({ openOnClick: false }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) { editor.commands.setContent(value, false); }
  }, [value, editor]);

  return (
    <div className="tiptap-editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TiptapMenuBar editor={editor} role={role} />
      <div className="tiptap-content-area" style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#fff' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

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

  const openSubmitModal = (curId, week) => {
    const targetCurriculum = curriculums.find((c) => c.cur_id === curId) || selected;
    const targetWeek = normalizeWeekPlan(targetCurriculum?.cur_week_plan).find((s) => s.week === week);
    const templateAssignments = (targetWeek && Array.isArray(targetWeek.assignments))
      ? targetWeek.assignments.filter((a) => a && a.template_content)
      : [];
    const initialContent = templateAssignments
      .map((a) => {
        const title = a.title ? `<h3>${escapeHtml(a.title)}</h3>` : '';
        return `${title}${a.template_content}`;
      })
      .join('<hr>');
      
    setModalState({ curId, week, fullscreen: false });
    setSubmitContent(initialContent || '<p>사수가 배포한 양식이 없습니다. 자유롭게 작성해주세요.</p>');
    setSubmitFiles([]);
    setSubmitError(null);
  };

  const toggleSubmitFullscreen = () => setModalState((prev) => (prev ? { ...prev, fullscreen: !prev.fullscreen } : prev));

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
      await downloadAttachment(submissionId, attachment);
    } catch (err) {
      alert(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.');
    }
  };

  const handleSubmit = async () => {
    if (!modalState) return;
    // Tiptap은 HTML 문자열 자체를 관리하므로 별도의 DOM 복제/동기화(syncFormControlValues)가 필요 없습니다.
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
                      <div className="learnerWeekSubmissionBody" dangerouslySetInnerHTML={{ __html: sanitizeHtml(sub.task_submitted_content?.text) || '(내용 없음)' }} />
                      
                      {Array.isArray(sub.task_submitted_content?.attachments) && sub.task_submitted_content.attachments.length > 0 && (
                        <div className="learnerWeekSubmissionAttachments">
                          <h5 className="learnerWeekFeedbackTitle">📎 첨부파일</h5>
                          <ul className="learnerSubmitAttachmentList">
                            {sub.task_submitted_content.attachments.map((a, i) => (
                              <li key={i} className="learnerSubmitAttachmentItem">
                                <button type="button" className="learnerSubmitAttachmentLink" onClick={() => handleAttachmentDownload(sub.task_submission_id, a)}>{a.filename || a.stored_name}</button>
                                <span className="learnerSubmitAttachmentSize">{formatBytes(a.size)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
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
                    {/* 과제 작성 모달을 여는 버튼 */}
                    <button
                      className="learnerWeekSubmitBtn"
                      onClick={() => openSubmitModal(selected.cur_id, step.week)}
                      disabled={!canResubmit}
                      title={canResubmit ? '과제 제출' : '이미 제출 완료 (재제출 요청 시 다시 활성화됩니다)'}
                    >
                      {sub ? (canResubmit ? '재제출하기' : '제출 완료') : '과제 작성하기'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tiptap 에디터가 탑재된 과제 제출 모달 */}
      {modalState && (
        <>
          <div className="emailModalOverlay" onClick={closeSubmitModal} />
          {/* Flex 레이아웃을 통해 버튼이 에디터에 밀리지 않도록 구성 */}
          <div className={`emailModal learnerSubmitModal ${modalState.fullscreen ? 'fullscreen' : ''}`} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="emailModalHeader" style={{ flexShrink: 0 }}>
              <div className="learnerSubmitModalTitle">{modalState.week}주차 과제 작성</div>
              <div className="learnerSubmitModalHeaderActions">
                <button type="button" className="learnerSubmitFullscreenBtn" onClick={toggleSubmitFullscreen} disabled={submitting}>
                  {modalState.fullscreen ? '✕ 축소' : '⛶ 전체보기'}
                </button>
                <button className="emailModalClose" onClick={closeSubmitModal} disabled={submitting}>✕</button>
              </div>
            </div>
            
            <div className="emailModalDivider" style={{ flexShrink: 0 }} />

            <div className="emailModalBody learnerSubmitModalBody" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <section className="learnerSubmitEditorSection" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                <h4 className="learnerSubmitSectionTitle">📝 과제 작성</h4>
                <p className="learnerSubmitSectionHint" style={{ marginBottom: '8px', fontSize: '13px', color: '#666' }}>
                  사수가 배포한 양식의 표 빈칸을 채워주세요. (표의 구조는 변경할 수 없습니다)
                </p>
                <div className="learnerSubmitEditorWrapper" style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                  {/* ✨ 새로 만든 Tiptap 에디터를 역할(role="learner")과 함께 렌더링 */}
                  <TiptapEditor 
                    role="learner" 
                    value={submitContent} 
                    onChange={setSubmitContent} 
                  />
                </div>
              </section>

              <section className="learnerSubmitAttachmentSection" style={{ flexShrink: 0, marginTop: '16px' }}>
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

            {submitError && <p className="emailingError learnerSubmitError" style={{ flexShrink: 0 }}>{submitError}</p>}

            <div className="emailModalFooter" style={{ flexShrink: 0, paddingTop: '16px', borderTop: '1px solid #eee' }}>
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