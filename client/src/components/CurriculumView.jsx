import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
import curri_nulll from '../public/download_img.png';
import '../styles/Curriculum.css';

import rodingRafaGif from '../public/roding_rafa.gif';
import randLogo from '../public/roding_rafa.png';

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

const TiptapMenuBar = ({ editor }) => {
  if (!editor) return null;

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

      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}>왼쪽</button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}>가운데</button>
      <span className="confirmDivider" style={{ margin: '0 4px', height: '16px', display: 'inline-block', verticalAlign: 'middle' }}></span>

      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>리스트</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}>숫자 리스트</button>
      <button type="button" onClick={setLink} className={editor.isActive('link') ? 'is-active' : ''}>[링크]</button>
      <button type="button" onClick={addImage}>[이미지]</button>
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
    </div>
  );
};

const TiptapEditor = ({ value, onChange, heightMode }) => {
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
      <TiptapMenuBar editor={editor} />
      <div className={`tiptap-content-area ${heightMode}`} style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#fff' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const LoadingModal = ({ generating, currentMessageIndex }) => {
  const messages = [
    { text: "AI가 커리큘럼 초안을 구상 중입니다...", img: rodingRafaGif },
    { text: "직무에 맞는 학습 목표를 설정하고 있습니다...", img: rodingRafaGif },
    { text: "주차별 상세 과제를 생성 중입니다...", img: randLogo },
    { text: "거의 다 되었습니다. 마지막 정리 중입니다...", img: randLogo },
    { text: "커리큘럼 생성이 완료되었습니다!", img: randLogo }
  ];

  const currentMessage = messages[currentMessageIndex];

  return createPortal(
    <div className={`loadingModalOverlay ${generating ? 'active' : ''}`}>
      <div className="loadingModalContainer">
        <img src={currentMessage.img} alt="로딩 이미지" className="loadingModalImage" />
        <p className="loadingModalText">{currentMessage.text}</p>
        <div className="loadingModalBar">
          <div className="loadingModalBarFill" style={{ width: `${(currentMessageIndex + 1) / messages.length * 100}%` }} />
        </div>
      </div>
    </div>,
    document.body
  );
};

const initialForm = { cur_title: '', cur_duration_weeks: 4, cur_target_job: '', cur_target_industry: '', cur_learning_goal: '', required_content: '' };
const normalizeWeekPlan = (plan) => { if (Array.isArray(plan)) return plan; if (plan && typeof plan === 'object') return [plan]; return []; };
const buildGeneratePayload = (form) => ({
  cur_title: form.cur_title.trim(), cur_duration_weeks: Number(form.cur_duration_weeks), cur_target_job: form.cur_target_job.trim() || null,
  cur_target_industry: form.cur_target_industry.trim() || null, cur_learning_goal: form.cur_learning_goal.trim() || null, required_content: form.required_content.trim() || null,
});

function CurriculumView({ onOpenArticle, onModalToggle }) {
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

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [detailExpandedWeek, setDetailExpandedWeek] = useState(null);
  const [previewExpandedWeek, setPreviewExpandedWeek] = useState(null);

  const [learners, setLearners] = useState([]);
  const assignedLearnersBarRef = useRef(null);
  const [createAssignedIds, setCreateAssignedIds] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSelected, setAssignSelected] = useState([]);
  const [assignSaving, setAssignSaving] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [feedbackSavingId, setFeedbackSavingId] = useState(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);

  const [viewMode, setViewMode] = useState('curriculum'); 
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  const [templateModal, setTemplateModal] = useState({ open: false, week: null, assignmentIdx: null, title: '', content: '', fullscreen: false, generating: false });
  
  const [templateMessageIndex, setTemplateMessageIndex] = useState(0);
  const TEMPLATE_MESSAGES = [
    "과제 양식을 새롭게 구상 중입니다...",
    "학습 목표에 맞춰 표와 항목을 쪼개고 있습니다...",
    "답변하기 쉬운 형태로 빈칸을 배치하고 있습니다...",
    "거의 다 되었습니다. 마무리 정리 중입니다...",
    "템플릿 재생성이 완료되었습니다!"
  ];

  const loadCurriculums = () => {
    setLoading(true); setError(null);
    return api.get('/curricula').then((res) => {
      const list = Array.isArray(res.data) ? res.data : []; setCurriculums(list);
      setSelectedId((prev) => { if (prev && list.some((c) => c.cur_id === prev)) return prev; return list[0]?.cur_id ?? null; });
      return list;
    }).catch((err) => { setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.'); return []; }).finally(() => setLoading(false));
  };

  const handleLearnerChipClick = (id) => {
    setViewMode('learner');
    setSelectedLearnerId(id);
    setSelectedSubmissionId(null);
  };

  const scrollAssignedLearners = (direction) => {
    if (!assignedLearnersBarRef.current) return;
    const scrollAmount = direction === 'left' ? -220 : 220;
    assignedLearnersBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    let mounted = true; setLoading(true); setError(null);
    api.get('/curricula').then((res) => {
      if (!mounted) return; const list = Array.isArray(res.data) ? res.data : []; setCurriculums(list);
      if (list.length > 0) setSelectedId(list[0].cur_id);
    }).catch((err) => {
      if (!mounted) return; setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    api.get('/users/learners').then((res) => setLearners(Array.isArray(res.data) ? res.data : [])).catch(() => setLearners([]));
  }, []);

  useEffect(() => {
    if (!selectedId) { setSubmissions([]); return; }
    setSubmissionsLoading(true);
    api.get(`/task-submissions/by-curriculum/${selectedId}`)
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : [])).catch(() => setSubmissions([])).finally(() => setSubmissionsLoading(false));
  }, [selectedId]);

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try { await downloadAttachment(submissionId, attachment); } catch (err) { alert(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.'); }
  };

  const handleFeedbackSave = async (submissionId, status = 'feedback_given') => {
    const text = (feedbackDraft[submissionId] || '').trim();
    if (!text) { alert('피드백 내용을 입력하세요.'); return; }
    setFeedbackSavingId(submissionId);
    try {
      const res = await api.patch(`/task-submissions/${submissionId}/feedback`, { task_manager_feedback: text, task_status: status });
      setSubmissions((prev) => prev.map((s) => s.task_submission_id === submissionId ? { ...s, ...res.data } : s));
      setFeedbackDraft((prev) => ({ ...prev, [submissionId]: '' }));
    } catch (err) { alert(err.response?.data?.detail || '피드백 저장에 실패했습니다.'); } finally { setFeedbackSavingId(null); }
  };

  const formatDateTime = (value) => {
    if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const selectedCurriculum = curriculums.find((c) => c.cur_id === selectedId);

  const handleDownloadTxt = async () => {
    if (!selectedCurriculum) return;
    try {
      const res = await api.post('/curricula/download/txt', selectedCurriculum, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.txt`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { alert('TXT 다운로드 중 오류가 발생했습니다.'); }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCurriculum) return;
    try {
      const res = await api.post('/curricula/download/pdf', selectedCurriculum, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { alert('PDF 다운로드 중 오류가 발생했습니다.'); }
  };

  const handleDownloadDocx = async () => {
    if (!selectedCurriculum) return;
    try {
      const res = await api.post('/curricula/download/docx', selectedCurriculum, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.docx`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { alert('DOCX 다운로드 중 오류가 발생했습니다.'); }
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
    setCurrentMessageIndex(0);
    const timer = setInterval(() => {
      setCurrentMessageIndex(prev => {
        if (prev < 3) return prev + 1; 
        clearInterval(timer);
        return prev;
      });
    }, 4000); 

    try {
      const res = await api.post('/curricula/generate', payload);
      
      clearInterval(timer);
      setCurrentMessageIndex(4);
      setTimeout(() => {
        setGenerating(false);
        setPreview(res.data);
        if (res.data?.cur_week_plan?.length > 0) setPreviewExpandedWeek(res.data.cur_week_plan[0].week);
        setConfirmOpen(true);
      }, 2000); 

    } catch (err) {
      clearInterval(timer);
      setGenerating(false);
      const detail = err.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail[0].msg : detail || 'AI 커리큘럼 생성에 실패했어요. 입력값을 확인해주세요.');
    }
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
    const weekPlan = normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => ({ ...step }));
    const targetWeek = weekPlan.find((s) => s.week === templateModal.week);
    if (!targetWeek || !Array.isArray(targetWeek.assignments)) { alert('대상 과제를 찾을 수 없습니다.'); return; }

    targetWeek.assignments = targetWeek.assignments.map((a, i) =>
      i === templateModal.assignmentIdx ? { ...a, template_content: templateModal.content } : a
    );
    setTemplateModal((prev) => ({ ...prev, saving: true }));
    try {
      const res = await api.patch(`/curricula/${selectedCurriculum.cur_id}`, { cur_week_plan: weekPlan });
      setCurriculums((prev) => prev.map((c) => (c.cur_id === res.data.cur_id ? res.data : c)));
      alert('학습자들에게 과제 템플릿이 배포되었습니다.');
      setTemplateModal({ open: false, week: null, assignmentIdx: null, title: '', content: '', generating: false, fullscreen: false });
    } catch (err) {
      alert(err.response?.data?.detail || '템플릿 배포에 실패했습니다.');
      setTemplateModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleRegenerateTemplate = async () => {
    if (!selectedCurriculum) return;
    const weekPlan = normalizeWeekPlan(selectedCurriculum.cur_week_plan);
    const targetWeek = weekPlan.find((s) => s.week === templateModal.week);
    if (!targetWeek || !Array.isArray(targetWeek.assignments)) return;
    const assignment = targetWeek.assignments[templateModal.assignmentIdx];

    setTemplateModal(prev => ({ ...prev, generating: true }));
    
    setTemplateMessageIndex(0);
    const timer = setInterval(() => {
      setTemplateMessageIndex(prev => {
        if (prev < 3) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 3500); 

    try {
      const res = await api.post('/curricula/generate-template', {
        theme: targetWeek.theme,
        learning_objective: targetWeek.learning_objective,
        assignment_title: assignment.title,
        step_by_step_guide: assignment.step_by_step_guide || [],
        expected_output_format: assignment.expected_output_format || assignment.submission || '지정되지 않음'
      });
      
      clearInterval(timer);
      setTemplateMessageIndex(4);
      setTimeout(() => {
        setTemplateModal(prev => ({ ...prev, content: res.data.template_content, generating: false }));
      }, 1500);
      
    } catch (err) {
      clearInterval(timer);
      alert('AI 템플릿 재생성에 실패했습니다.');
      setTemplateModal(prev => ({ ...prev, generating: false }));
    }
  };

  const openTemplateModal = (week, idx, assignment) => {
    setTemplateModal({
      open: true, week, assignmentIdx: idx, title: assignment.title,
      content: assignment.template_content || `<h3>[${assignment.title}]</h3><p>관련 과제 양식을 자유롭게 작성해주세요.</p>`,
      generating: false, fullscreen: false
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
                <h4 className="extracted-objective-title">[학습 목표]</h4>
                <p className="extracted-objective-text">{step.learning_objective}</p>
              </div>
            )}
            {(step.tasks || step.task) && (
              <div className="extracted-section-margin">
                <h4 className="extracted-task-title">[멘토링 및 실습 과제]</h4>
                <ul className="extracted-task-list">
                  {Array.isArray(step.tasks || step.task) ? (step.tasks || step.task).map((t, idx) => (<li key={idx} className="extracted-list-item">{t}</li>)) : <p className="extracted-objective-text">{step.tasks || step.task}</p>}
                </ul>
              </div>
            )}
            {Array.isArray(step.assignments) && step.assignments.length > 0 && (
              <div className="extracted-assignment-wrapper">
                <h4 className="extracted-task-title">[실무 수행 과제]</h4>
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {step.instructor_guide && (
              <div className="extracted-instructor-box">
                <h4 className="extracted-instructor-title">[교육담당자 코칭 가이드]</h4>
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
                    <strong className="extracted-guide-label">[권장 질문]</strong>
                    <ul className="extracted-coaching-list">
                      {step.instructor_guide.coaching_questions.map((cq, idx) => (<li key={idx} className="extracted-coaching-item">- {cq}</li>))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="extracted-footer-wrapper">
              <div>
                {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                  <>
                    <h4 className="extracted-ref-title">[참고 자료]</h4>
                    {step.recommended_articles.map((article, idx) => {
                      const hasValidUrl = article.url && article.url.trim() !== "";
                      return (
                        <div key={idx} className="extracted-ref-item">
                          {hasValidUrl ? (<a href={article.url} target="_blank" rel="noopener noreferrer" className="extracted-ref-link">[링크] {article.title}</a>) : (<span className="extracted-ref-doc">[문서] {article.title} <span className="extracted-ref-small">(사내 문서 참고)</span></span>)}
                          {(article.reason_for_reading || article.why_relevant) && (<p className="extracted-ref-reason">- {article.reason_for_reading || article.why_relevant}</p>)}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {step.estimated_hours && (<div className="extracted-time-badge">[예상 소요] {step.estimated_hours}시간</div>)}
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
        <div className="curriculumWrapper">
          <div className="assignedLearnersBar">
            <button type="button" className="assignedLearnersBarArrow" onClick={() => scrollAssignedLearners('left')}>‹</button>
            <div className="assignedLearnersBarScroll" ref={assignedLearnersBarRef}>
              {(selectedCurriculum.cur_assigned_learner_ids || []).length === 0 ? (
                <span className="assignEmptyInline">배정된 학습자가 없습니다</span>
              ) : (
                (selectedCurriculum.cur_assigned_learner_ids || []).map((id) => {
                  const l = learners.find((x) => x.user_id === id);
                  return (
                    <span
                      key={id}
                      className={`assignedLearnerChip ${selectedLearnerId === id && viewMode === 'learner' ? 'active' : ''}`}
                      onClick={() => handleLearnerChipClick(id)}
                    >
                      {l ? l.user_name : `#${id}`}
                    </span>
                  );
                })
              )}
            </div>
            <button type="button" className="assignedLearnersBarArrow" onClick={() => scrollAssignedLearners('right')}>›</button>
            <button className="assignedLearnersEditBtn" onClick={() => { setAssignSelected(selectedCurriculum.cur_assigned_learner_ids || []); setAssignModalOpen(true); }}>변경</button>
          </div>

          <div className="curriculumLayout">

            <aside className="curriculumSidebar">
              <p className="curriculumSidebarTitle">생성한 커리큘럼</p>
              <div className="curriculumSidebarDivider" />
              <ul className="curriculumSidebarList">
                {curriculums.map((c) => (
                  <li
                    key={c.cur_id}
                    className={`curriculumSidebarItem ${selectedId === c.cur_id ? 'active' : ''}`}
                    onClick={() => { setSelectedId(c.cur_id); setDetailExpandedWeek(null); setViewMode('curriculum'); }}
                  >
                    {c.cur_title}
                  </li>
                ))}
              </ul>
              <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>+ 새 커리큘럼</button>
            </aside>

            <div className="curriculumLeft">

              {viewMode === 'curriculum' && (
                <>
                  <div className="extracted-detail-header">
                    <div className="curriculumTitleGroup">
                      <div className="curriculumTitleRow">
                        <h3 className="curriculumDetailTitle">{selectedCurriculum.cur_title}</h3>
                      </div>
                      <p className="curriculumDetailDesc">{selectedCurriculum.cur_learning_goal || ''}</p>
                      <img src={curri_nulll} alt="다운로드" className="downloadIcon" onClick={() => setDownloadModalOpen(true)} />
                    </div>
                  </div>

                  <div className="curriculumSteps">
                    {normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => (
                      <div
                        key={step.week}
                        className={`extracted-accordion-item ${selectedWeek === step.week ? 'active' : ''}`}
                        onClick={() => setSelectedWeek(prev => prev === step.week ? null : step.week)}
                      >
                        <div className={`extracted-accordion-header ${selectedWeek === step.week ? 'expanded' : ''}`}>
                          <span className="extracted-week-label">{step.week}주차</span>
                          <span className="extracted-theme-label">{step.theme || '주제 미지정'}</span>
                          <span className="extracted-toggle-label">{selectedWeek === step.week ? '◀' : '▶'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {viewMode === 'learner' && (() => {
                const learnerSubmissions = submissions.filter(s => s.task_learner_id === selectedLearnerId);
                const learner = learners.find(l => l.user_id === selectedLearnerId);
                return (
                  <>
                    <div className="learnerViewHeader">
                      <p className="learnerViewName">{learner?.user_name || `#${selectedLearnerId}`}</p>
                      <p className="learnerViewHint">제출한 과제 목록</p>
                    </div>
                    <div className="curriculumSteps">
                      {learnerSubmissions.length === 0 && (
                        <p className="managerSubmissionEmpty">제출된 과제가 없습니다.</p>
                      )}
                      {learnerSubmissions.map((s) => {
                        const statusLabel = {
                          submitted: '피드백 대기',
                          feedback_given: '피드백 완료',
                          resubmit_requested: '재제출 요청',
                        }[s.task_status] || '제출됨';
                        return (
                          <div
                            key={s.task_submission_id}
                            className={`extracted-accordion-item ${selectedSubmissionId === s.task_submission_id ? 'active' : ''}`}
                            onClick={() => setSelectedSubmissionId(prev => prev === s.task_submission_id ? null : s.task_submission_id)}
                          >
                            <div className={`extracted-accordion-header ${selectedSubmissionId === s.task_submission_id ? 'expanded' : ''}`}>
                              <span className="extracted-week-label">{s.task_week_number}주차</span>
                              <span className="extracted-theme-label">{s.task_assignment_title || '제출 과제'}</span>
                              <span className={`submissionStatusBadge ${s.task_status || ''}`}>{statusLabel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="curriculumRight">

              {viewMode === 'curriculum' && (() => {
                const weekData = normalizeWeekPlan(selectedCurriculum.cur_week_plan).find(s => s.week === selectedWeek);
                if (!weekData) return (
                  <div className="curriculumRightEmpty">
                    <p>왼쪽에서 주차를 선택하면 내용이 표시됩니다.</p>
                  </div>
                );
                return (
                  <div className="curriculumRightContent">
                    <div className="extracted-accordion-body" style={{ border: 'none', background: 'transparent' }}>
                      {weekData.learning_objective && (
                        <div className="extracted-section-margin">
                          <h4 className="extracted-objective-title">[학습 목표]</h4>
                          <p className="extracted-objective-text">{weekData.learning_objective}</p>
                        </div>
                      )}
                      {(weekData.tasks || weekData.task) && (
                        <div className="extracted-section-margin">
                          <h4 className="extracted-task-title">[멘토링 및 실습 과제]</h4>
                          <ul className="extracted-task-list">
                            {Array.isArray(weekData.tasks || weekData.task)
                              ? (weekData.tasks || weekData.task).map((t, idx) => <li key={idx} className="extracted-list-item">{t}</li>)
                              : <p className="extracted-objective-text">{weekData.tasks || weekData.task}</p>}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(weekData.assignments) && weekData.assignments.length > 0 && (
                        <div className="extracted-assignment-wrapper">
                          <h4 className="extracted-task-title">[실무 수행 과제]</h4>
                          <div className="extracted-assignment-grid">
                            {weekData.assignments.map((a, idx) => (
                              <div key={idx} className="extracted-assignment-card">
                                <strong className="extracted-assignment-name">[과제명] {a.title}</strong>
                                {Array.isArray(a.step_by_step_guide) && a.step_by_step_guide.length > 0 && (
                                  <ul className="extracted-guide-list">
                                    {a.step_by_step_guide.map((guide, gIdx) => <li key={gIdx} className="extracted-guide-item">{guide}</li>)}
                                  </ul>
                                )}
                                {a.description && <p className="extracted-guide-item">{a.description}</p>}
                                <div className="extracted-submission-format has-actions">
                                  <span>제출 형태: {a.expected_output_format || a.submission || '지정되지 않음'}</span>
                                  <div className="templateActionBtnGroup">
                                    <button className="template-action-btn admin" onClick={(e) => { e.stopPropagation(); openTemplateModal(weekData.week, idx, a); }}>양식 배포(관리자)</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {weekData.instructor_guide && (
                        <div className="extracted-instructor-box">
                          <h4 className="extracted-instructor-title">[교육담당자 코칭 가이드]</h4>
                          {Array.isArray(weekData.instructor_guide.check_points) && weekData.instructor_guide.check_points.length > 0 && (
                            <div className="extracted-section-margin">
                              <strong className="extracted-guide-label">[평가 체크포인트]</strong>
                              <ul className="extracted-guide-list-no-margin">
                                {weekData.instructor_guide.check_points.map((cp, idx) => <li key={idx} className="extracted-guide-item-small">{cp}</li>)}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(weekData.instructor_guide.coaching_questions) && weekData.instructor_guide.coaching_questions.length > 0 && (
                            <div>
                              <strong className="extracted-guide-label">[권장 질문]</strong>
                              <ul className="extracted-coaching-list">
                                {weekData.instructor_guide.coaching_questions.map((cq, idx) => <li key={idx} className="extracted-coaching-item">- {cq}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="extracted-footer-wrapper">
                        <div>
                          {Array.isArray(weekData.recommended_articles) && weekData.recommended_articles.length > 0 && (
                            <>
                              <h4 className="extracted-ref-title">[참고 자료]</h4>
                              {weekData.recommended_articles.map((article, idx) => {
                                const hasValidUrl = article.url && article.url.trim() !== "";
                                return (
                                  <div key={idx} className="extracted-ref-item">
                                    {hasValidUrl
                                      ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="extracted-ref-link">[링크] {article.title}</a>
                                      : <span className="extracted-ref-doc">[문서] {article.title} <span className="extracted-ref-small">(사내 문서 참고)</span></span>}
                                    {(article.reason_for_reading || article.why_relevant) && (
                                      <p className="extracted-ref-reason">- {article.reason_for_reading || article.why_relevant}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                        {weekData.estimated_hours && <div className="extracted-time-badge">[예상 소요] {weekData.estimated_hours}시간</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {viewMode === 'learner' && (() => {
                const s = submissions.find(sub => sub.task_submission_id === selectedSubmissionId);
                if (!s) return (
                  <div className="curriculumRightEmpty">
                    <p>왼쪽에서 과제를 선택하면 상세 내용이 표시됩니다.</p>
                  </div>
                );
                const statusLabel = {
                  submitted: '피드백 대기',
                  feedback_given: '피드백 완료',
                  resubmit_requested: '재제출 요청',
                }[s.task_status] || '제출됨';
                return (
                  <div className="managerSubmissionItemBody" style={{ maxHeight: 'none', overflow: 'visible' }}>
                    <div className="managerSubmissionContent">
                      <p className="managerSubmissionContentLabel">제출 내용</p>
                      <div className="managerSubmissionContentBody" dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.task_submitted_content?.text) || '(내용 없음)' }} />
                    </div>
                    {Array.isArray(s.task_submitted_content?.attachments) && s.task_submitted_content.attachments.length > 0 && (
                      <div className="managerSubmissionAttachments">
                        <p className="managerSubmissionContentLabel">[첨부파일]</p>
                        <ul className="managerSubmissionAttachmentList">
                          {s.task_submitted_content.attachments.map((a, i) => (
                            <li key={i} className="managerSubmissionAttachmentItem">
                              <button type="button" className="managerSubmissionAttachmentLink" onClick={() => handleAttachmentDownload(s.task_submission_id, a)}>{a.filename || a.stored_name}</button>
                              <span className="managerSubmissionAttachmentSize">{formatBytes(a.size)}</span>
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
                    <div className="managerFeedbackForm" style={{ position: 'static', margin: 0, padding: 0, boxShadow: 'none', borderTop: 'none' }}>
                      <p className="managerSubmissionContentLabel">{s.task_manager_feedback ? '피드백 수정' : '피드백 작성'}</p>
                      <textarea
                        className="managerFeedbackTextarea"
                        placeholder="학습자에게 전달할 피드백을 입력하세요"
                        value={feedbackDraft[s.task_submission_id] ?? ''}
                        onChange={(e) => setFeedbackDraft(prev => ({ ...prev, [s.task_submission_id]: e.target.value }))}
                      />
                      <div className="managerFeedbackBtns">
                        <button className="managerFeedbackBtn secondary" onClick={() => handleFeedbackSave(s.task_submission_id, 'resubmit_requested')} disabled={feedbackSavingId === s.task_submission_id}>재제출 요청</button>
                        <button className="managerFeedbackBtn primary" onClick={() => handleFeedbackSave(s.task_submission_id, 'feedback_given')} disabled={feedbackSavingId === s.task_submission_id}>
                          {feedbackSavingId === s.task_submission_id ? '저장 중...' : '피드백 저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      <LoadingModal generating={generating} currentMessageIndex={currentMessageIndex} />

      {modalOpen && createPortal(
        <>
          <div className="chatModalOverlay" style={{ zIndex: 99998 }} onClick={closeModal} />
          <div className="chatModalContainer" style={{ zIndex: 99999 }}>
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
        </>,
        document.body
      )}

      {assignModalOpen && selectedCurriculum && createPortal(
        <>
          <div className="confirmOverlay" style={{ zIndex: 99998 }} onClick={() => !assignSaving && setAssignModalOpen(false)} />
          <div className="confirmModal assignModal" style={{ zIndex: 99999 }}>
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
        </>,
        document.body
      )}

      {confirmOpen && preview && createPortal(
        <>
          <div className="confirmOverlay" style={{ zIndex: 99998 }} onClick={() => !saving && setConfirmOpen(false)} />
          <div className="confirmModal" style={{ zIndex: 99999 }}>
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
        </>,
        document.body
      )}

      {templateModal.open && createPortal(
        <>
          <div className="confirmOverlay" style={{ zIndex: 99998 }} onClick={() => setTemplateModal({ ...templateModal, open: false })} />

          <div className={`confirmModal templateModal ${templateModal.fullscreen ? 'fullscreen' : ''}`} style={{ zIndex: 99999, display: 'flex', flexDirection: 'column', height: '90vh', overflow: 'hidden' }}>

            <div className="modalTopBar" style={{ flexShrink: 0 }}>
              <h3 className="sectionTitle">과제 양식(템플릿) 배포</h3>
              <div className="modalHeaderActions">
                <button type="button" className="template-action-btn admin ai-regenerate-btn" onClick={handleRegenerateTemplate} disabled={templateModal.generating}>
                  {templateModal.generating ? 'AI 작성 중...' : 'AI 템플릿 재작성'}
                </button>
                <button type="button" className="fullscreenBtn" onClick={() => setTemplateModal(prev => ({ ...prev, fullscreen: !prev.fullscreen }))}>
                  {templateModal.fullscreen ? '축소' : '전체보기'}
                </button>
              </div>
            </div>

            <p className="assignSectionHint" style={{ whiteSpace: 'pre-wrap', flexShrink: 0 }}>
              {`학습자에게 전달될 '${templateModal.title}'의 작성 양식 가이드를 작성해주세요.\n표나 양식을 지정해주면 학습자가 쉽게 채워넣을 수 있습니다.`}
            </p>

            <div className="templateEditorWrapper" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden', minHeight: 0 }}>
              
              {templateModal.generating && (
                <div className="template-loading-overlay">
                  <img src={rodingRafaGif} alt="AI 로딩" className="template-loading-gif" />
                  <p className="template-loading-text">{TEMPLATE_MESSAGES[templateMessageIndex]}</p>
                  <div className="template-loading-bar">
                    <div className="template-loading-bar-fill" style={{ width: `${((templateMessageIndex + 1) / TEMPLATE_MESSAGES.length) * 100}%` }} />
                  </div>
                </div>
              )}

              <TiptapEditor
                value={templateModal.content}
                onChange={(newContent) => setTemplateModal({ ...templateModal, content: newContent })}
              />
            </div>

            <div className="confirmBtns" style={{ flexShrink: 0, paddingTop: '16px' }}>
              <button type="button" className="confirmBtnBack" onClick={() => setTemplateModal({ ...templateModal, open: false })} disabled={templateModal.saving}>취소</button>
              <button type="button" className="confirmBtnCreate" onClick={saveTemplate} disabled={templateModal.saving}>{templateModal.saving ? '배포 중...' : '템플릿 배포'}</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {downloadModalOpen && createPortal(
        <>
          <div className="downloadOverlay" style={{ zIndex: 99998 }} onClick={() => setDownloadModalOpen(false)} />
          <div className="downloadModal" style={{ zIndex: 99999 }}>
            <p className="downloadModalTitle">다운로드 형식 선택</p>
            <button type="button" className="downloadModalBtn" onClick={() => { handleDownloadDocx(); setDownloadModalOpen(false); }}>DOCX 다운로드</button>
            <button type="button" className="downloadModalBtn" onClick={() => { handleDownloadPdf(); setDownloadModalOpen(false); }}>PDF 다운로드</button>
            <button type="button" className="downloadModalBtn" onClick={() => { handleDownloadTxt(); setDownloadModalOpen(false); }}>TXT 다운로드</button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export default CurriculumView;