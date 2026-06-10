import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
import { FEEDBACK_QUICK_COMMENTS, appendQuickComment } from '../lib/feedbackTemplates';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale/ko';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('ko', ko);

const formatDateLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatOnlyDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

const toLocalEndOfDayIso = (dateString) => {
  if (!dateString) return null;
  return new Date(`${dateString}T23:59:59`).toISOString();
};
import curri_nulll from '../public/curri_null.png';
import download_img from '../public/download_img.png';
import delete_img from '../public/delete_img.png';
import '../styles/Curriculum.css';
import rodingRafaGif from '../public/roding_rafa.gif';

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

const TiptapMenuBar = ({ editor, readOnly = false }) => {
  if (!editor || readOnly) return null;

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
    <div className="tiptap-toolbar">
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}>H3</button>
      <span className="tiptap-divider"></span>
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}><b>B</b></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''}><u>U</u></button>
      <input type="color" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} title="글자 색상" className="tiptap-color-picker" />
      <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive('highlight') ? 'is-active' : ''}>형광펜</button>
      <span className="tiptap-divider"></span>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}>왼쪽</button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}>가운데</button>
      <span className="tiptap-divider"></span>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>리스트</button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}>숫자 리스트</button>
      <button type="button" onClick={setLink} className={editor.isActive('link') ? 'is-active' : ''}>[링크]</button>
      <button type="button" onClick={addImage}>[이미지]</button>
      <span className="tiptap-divider"></span>
      <div className="tiptap-table-actions">
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>표 삽입</button>
        <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()}>+열 앞</button>
        <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>+열 뒤</button>
        <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="btn-danger">-열 삭제</button>
        <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()}>+행 위</button>
        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>+행 아래</button>
        <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="btn-danger">-행 삭제</button>
        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="btn-danger-bold">표 전체 삭제</button>
      </div>
    </div>
  );
};

const TiptapEditor = ({ value, onChange, heightMode, readOnly = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, Color, Highlight, Image.configure({ inline: true, allowBase64: true }), Link.configure({ openOnClick: false }), TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) { editor.commands.setContent(value, false); }
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className="tiptap-editor-container">
      <TiptapMenuBar editor={editor} readOnly={readOnly} />
      <div className={`tiptap-content-area template-render ${heightMode}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const LoadingModal = ({ generating, currentMessageIndex }) => {
  const messages = [
    { text: "AI가 커리큘럼 초안을 구상 중입니다...", img: rodingRafaGif },
    { text: "직무에 맞는 학습 목표를 설정하고 있습니다...", img: rodingRafaGif },
    { text: "주차별 상세 과제를 생성 중입니다...", img: rodingRafaGif },
    { text: "거의 다 되었습니다. 마지막 정리 중입니다...", img: rodingRafaGif },
    { text: "커리큘럼 생성이 완료되었습니다!", img: rodingRafaGif }
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

const getDDayString = (deadlineStr) => {
  if (!deadlineStr) return null;
  const deadlineDate = new Date(deadlineStr);
  if (isNaN(deadlineDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  deadlineDate.setHours(0, 0, 0, 0); 

  const diffTime = deadlineDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `D-${diffDays}`;
  if (diffDays === 0) return `D-Day`;
  return `D+${Math.abs(diffDays)} (마감됨)`;
};

function CurriculumView({ onOpenArticle, onModalToggle, curriculumDetailRef, notificationTarget }) {
  // 생성/미리보기/저장 모달 상태와 선택된 커리큘럼을 한 화면에서 함께 관리한다.
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageStep, setManageStep] = useState('select');
  const [completionReportComment, setCompletionReportComment] = useState('');
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
  const [selectedLearnerTask, setSelectedLearnerTask] = useState(null);
  const [highlightedSubmissionId, setHighlightedSubmissionId] = useState(null);

  const [reportModal, setReportModal] = useState({ open: false, file: null, loading: false });
  const [templateModal, setTemplateModal] = useState({ open: false, week: null, assignmentIdx: null, title: '', content: '', deadline: '', fullscreen: false, generating: false, deadlineOnly: false });

  const [templateMessageIndex, setTemplateMessageIndex] = useState(0);
  const TEMPLATE_MESSAGES = [
    "과제 양식을 새롭게 구상 중입니다...",
    "학습 목표에 맞춰 표와 항목을 쪼개고 있습니다...",
    "답변하기 쉬운 형태로 빈칸을 배치하고 있습니다...",
    "거의 다 되었습니다. 마무리 정리 중입니다...",
    "템플릿 재생성이 완료되었습니다!"
  ];

  const loadCurriculums = () => {
    // 생성/삭제/배정 변경 후에도 선택 상태를 최대한 유지하기 위한 공통 reload 함수.
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
    setSelectedLearnerTask(null);
  };

  const scrollAssignedLearners = (direction) => {
    if (!assignedLearnersBarRef.current) return;
    const scrollAmount = direction === 'left' ? -220 : 220;
    assignedLearnersBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    // 알림에서 진입한 경우 해당 커리큘럼을 바로 선택하고, 아니면 첫 커리큘럼을 기본 선택한다.
    let mounted = true; setLoading(true); setError(null);
    api.get('/curricula').then((res) => {
      if (!mounted) return; const list = Array.isArray(res.data) ? res.data : []; setCurriculums(list);
      const targetId = Number(notificationTarget?.curriculumId);
      const targetExists = Number.isFinite(targetId) && list.some((c) => Number(c.cur_id) === targetId);
      if (targetExists) setSelectedId(targetId);
      else if (list.length > 0) setSelectedId(list[0].cur_id);
    }).catch((err) => {
      if (!mounted) return; setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // 커리큘럼 목록 로드 이후 도착한 알림 타겟도 다시 반영한다.
    const targetId = Number(notificationTarget?.curriculumId);
    if (!Number.isFinite(targetId) || curriculums.length === 0) return;
    if (curriculums.some((c) => Number(c.cur_id) === targetId)) {
      setSelectedId(targetId);
    }
  }, [notificationTarget, curriculums]);

  useEffect(() => {
    api.get('/users/learners').then((res) => setLearners(Array.isArray(res.data) ? res.data : [])).catch(() => setLearners([]));
  }, []);

  useEffect(() => {
    // 모달이 열려 있을 때 배경 스크롤이 같이 움직이지 않도록 body 스크롤을 잠근다.
    const anyModalOpen = manageModalOpen || modalOpen || confirmOpen || assignModalOpen || templateModal.open;
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [manageModalOpen, modalOpen, confirmOpen, assignModalOpen, templateModal.open]);

  useEffect(() => {
    // 템플릿 배포 모달은 브라우저 뒤로가기와 연동해서 전체 화면 편집 중 이탈을 자연스럽게 처리한다.
    if (!templateModal.open || !curriculumDetailRef) return;
    curriculumDetailRef.current = true;
    window.history.pushState({ templateOpen: true, t: Date.now() }, '');
    const onPop = () => {
      setTemplateModal((prev) => ({ ...prev, open: false, fullscreen: false }));
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      curriculumDetailRef.current = false;
    };
  }, [templateModal.open, curriculumDetailRef]);


  useEffect(() => {
    // 선택된 커리큘럼 기준으로 매니저가 볼 제출물 전체를 가져온다.
    if (!selectedId) { setSubmissions([]); return; }
    setSubmissionsLoading(true);
    api.get(`/task-submissions/by-curriculum/${selectedId}`)
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setSubmissions([]);
        toast.error(err.response?.data?.detail || '제출물 목록을 불러오지 못했습니다.');
      })
      .finally(() => setSubmissionsLoading(false));
  }, [selectedId]);

  useEffect(() => {
    // 과제 제출 알림을 클릭해 들어온 경우 해당 학습자/제출물을 자동 선택하고 잠깐 강조한다.
    if (!notificationTarget || notificationTarget.refType !== 'task_submission') return;

    const targetSubmissionId = Number(notificationTarget.refId);
    if (!Number.isFinite(targetSubmissionId) || submissions.length === 0) return;

    const targetSubmission = submissions.find((s) => Number(s.task_submission_id) === targetSubmissionId);
    if (!targetSubmission) return;

    setViewMode('learner');
    setSelectedLearnerId(targetSubmission.task_learner_id);
    setSelectedSubmissionId(targetSubmission.task_submission_id);
    setSelectedLearnerTask(null);
    setHighlightedSubmissionId(targetSubmission.task_submission_id);
    setSelectedWeek(targetSubmission.task_week_number);
    window.requestAnimationFrame(() => {
      document.querySelector('.curriculumWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [notificationTarget, submissions]);

  useEffect(() => {
    if (!highlightedSubmissionId) return undefined;
    const timer = window.setTimeout(() => setHighlightedSubmissionId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightedSubmissionId]);

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try { await downloadAttachment(submissionId, attachment); } catch (err) { toast.error(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.'); }
  };

  const buildLearnerTasks = (submissionList = submissions) => {
    const weekPlans = normalizeWeekPlan(selectedCurriculum?.cur_week_plan || []);
    const allTasks = [];
    weekPlans.forEach((weekData) => {
      (weekData.assignments || []).forEach((assignment, idx) => {
        const matches = submissionList.filter((s) => {
          if (String(s.task_learner_id) !== String(selectedLearnerId)) return false;
          if (String(s.task_week_number) !== String(weekData.week)) return false;

          if (s.task_submitted_content && typeof s.task_submitted_content === 'object') {
            return String(s.task_submitted_content.assignmentIdx) === String(idx);
          }
          return false;
        });

        const submission = matches.length > 0
          ? matches.reduce((latest, current) =>
            new Date(current.task_submitted_at || 0) > new Date(latest.task_submitted_at || 0) ? current : latest
          )
          : null;

        allTasks.push({
          week: weekData.week,
          assignmentIdx: idx,
          title: assignment.title,
          hasTemplate: !!assignment.template_content,
          deadline: assignment.deadline,
          assignmentData: assignment,
          submission,
        });
      });
    });
    return allTasks;
  };

  const moveToNextFeedbackTask = (submissionId, submissionList) => {
    if (!selectedLearnerId || !selectedCurriculum) return;
    const tasks = buildLearnerTasks(submissionList);
    const currentIndex = tasks.findIndex((task) => task.submission?.task_submission_id === submissionId);
    const isWaitingFeedback = (task) => task.submission?.task_status === 'submitted';
    const afterCurrent = currentIndex >= 0 ? tasks.slice(currentIndex + 1).find(isWaitingFeedback) : null;
    const nextTask = afterCurrent || tasks.find(isWaitingFeedback);

    if (!nextTask) return;
    setSelectedLearnerTask(nextTask);
    setSelectedSubmissionId(nextTask.submission.task_submission_id);
  };

  const handleFeedbackSave = async (submissionId, status = 'feedback_given') => {
    // 같은 피드백 API로 피드백 완료와 재제출 요청을 모두 처리한다.
    const text = (feedbackDraft[submissionId] || '').trim();
    if (!text) {
      toast.warn(status === 'resubmit_requested' ? '재제출 사유를 입력해야 합니다.' : '피드백 내용을 입력하세요.');
      return;
    }
    setFeedbackSavingId(submissionId);
    try {
      const res = await api.patch(`/task-submissions/${submissionId}/feedback`, { task_manager_feedback: text, task_status: status });
      const nextSubmissions = submissions.map((s) => s.task_submission_id === submissionId ? { ...s, ...res.data } : s);
      setSubmissions(nextSubmissions);
      setFeedbackDraft((prev) => ({ ...prev, [submissionId]: '' }));
      toast.success(status === 'resubmit_requested' ? '재제출을 요청했습니다.' : '피드백을 저장했습니다.');
      if (status === 'feedback_given') {
        moveToNextFeedbackTask(submissionId, nextSubmissions);
      }
    } catch (err) { toast.error(err.response?.data?.detail || '피드백 저장에 실패했습니다.'); } finally { setFeedbackSavingId(null); }
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
    } catch (error) { toast.error('TXT 다운로드 중 오류가 발생했습니다.'); }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCurriculum) return;
    try {
      const res = await api.post('/curricula/download/pdf', selectedCurriculum, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { toast.error('PDF 다운로드 중 오류가 발생했습니다.'); }
  };

  const handleDownloadDocx = async () => {
    if (!selectedCurriculum) return;
    try {
      const res = await api.post('/curricula/download/docx', selectedCurriculum, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `${selectedCurriculum.cur_title}.docx`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { toast.error('DOCX 다운로드 중 오류가 발생했습니다.'); }
  };

  const handleDownloadCompletionReport = async (comment = '') => {
    if (!selectedCurriculum) return;
    try {
      const trimmedComment = comment.trim();
      const res = await api.get(`/curricula/${selectedCurriculum.cur_id}/completion-report`, {
        params: trimmedComment ? { comment: trimmedComment } : undefined,
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedCurriculum.cur_title}_completion_report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setCompletionReportComment('');
    } catch (error) {
      toast.error(error.response?.data?.detail || '완료보고서 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteCurriculum = async () => {
    if (!selectedCurriculum) return;
    try {
      await api.delete(`/curricula/${selectedCurriculum.cur_id}`);
      setManageModalOpen(false);
      await loadCurriculums();
    } catch (err) {
      toast.error(err.response?.data?.detail || '삭제에 실패했습니다.');
    }
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
    // AI 생성은 시간이 걸리므로 진행 문구를 순차 노출한 뒤 미리보기 확인 단계로 넘긴다.
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
    // AI가 만든 미리보기 결과를 실제 커리큘럼으로 저장한다.
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
    // 선택된 커리큘럼의 학습자 배정 목록만 갱신한다.
    if (!selectedCurriculum) return;
    setAssignSaving(true);
    try {
      const res = await api.patch(`/curricula/${selectedCurriculum.cur_id}`, { cur_assigned_learner_ids: assignSelected });
      setCurriculums((prev) => prev.map((c) => (c.cur_id === res.data.cur_id ? res.data : c)));
      setAssignModalOpen(false);
    } catch (err) { toast.error(err.response?.data?.detail || '배정 변경에 실패했습니다.'); } finally { setAssignSaving(false); }
  };

  const saveTemplate = async () => {
    // 배포된 템플릿은 학습자가 제출 기준으로 보게 되므로, 수정 전 확인을 한 번 더 받는다.
    if (!selectedCurriculum) return;
    if (!templateModal.deadlineOnly) {
      const isConfirmed = window.confirm("과제를 배포하시면 이후 템플릿 수정이나 재배포가 불가능합니다.\n정말 배포하시겠습니까?");
      if (!isConfirmed) return;
    }

    const weekPlan = normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => ({ ...step }));
    const targetWeek = weekPlan.find((s) => s.week === templateModal.week);
    if (!targetWeek || !Array.isArray(targetWeek.assignments)) { toast.error('대상 과제를 찾을 수 없습니다.'); return; }

    let isoDeadline = null;
    if (templateModal.deadline) {
      isoDeadline = toLocalEndOfDayIso(templateModal.deadline);
    }

    // ✅ JSON 내부에 과제별로 마감일을 저장
    targetWeek.assignments = targetWeek.assignments.map((a, i) =>
      i === templateModal.assignmentIdx ? { ...a, template_content: templateModal.content, deadline: isoDeadline } : a
    );

    setTemplateModal((prev) => ({ ...prev, saving: true }));
    try {
      const res = await api.patch(`/curricula/${selectedCurriculum.cur_id}`, {
        cur_week_plan: weekPlan
      });
      setCurriculums((prev) => prev.map((c) => (c.cur_id === res.data.cur_id ? res.data : c)));
      try {
        localStorage.removeItem(templateDraftKey(selectedCurriculum.cur_id, templateModal.week, templateModal.assignmentIdx));
      } catch { }
      toast.success(templateModal.deadlineOnly ? '마감일이 변경되었습니다.' : '학습자들에게 과제 템플릿이 배포되었습니다.');
      setTemplateModal({ open: false, week: null, assignmentIdx: null, title: '', content: '', deadline: '', generating: false, fullscreen: false, deadlineOnly: false });
    } catch (err) {
      toast.error(err.response?.data?.detail || (templateModal.deadlineOnly ? '마감일 변경에 실패했습니다.' : '템플릿 배포에 실패했습니다.'));
      setTemplateModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleRegenerateTemplate = async () => {
    // 기존 과제 맥락을 유지한 채 해당 과제의 제출 양식만 다시 생성한다.
    if (!selectedCurriculum) return;
    if (templateModal.deadlineOnly) return;
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
      toast.error('AI 템플릿 재생성에 실패했습니다.');
      setTemplateModal(prev => ({ ...prev, generating: false }));
    }
  };

  const templateDraftKey = (curId, week, idx) => `template_draft:${curId}:${week}:${idx}`;

  const openTemplateModal = (week, idx, assignment) => {
    let content = assignment.template_content || `<h3>[${assignment.title}]</h3><p>관련 과제 양식을 자유롭게 작성해주세요.</p>`;
    try {
      if (selectedCurriculum) {
        const draft = localStorage.getItem(templateDraftKey(selectedCurriculum.cur_id, week, idx));
        if (draft != null) {
          content = draft;
          toast.info('임시저장본을 불러왔습니다.');
        }
      }
    } catch { }

    let currentDeadline = '';
    if (assignment.deadline) {
      const d = new Date(assignment.deadline);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        currentDeadline = `${year}-${month}-${day}`;
      }
    }

    setTemplateModal({
      open: true, week, assignmentIdx: idx, title: assignment.title,
      content,
      deadline: currentDeadline,
      generating: false, fullscreen: false, deadlineOnly: !!assignment.template_content
    });
  };

  const saveTemplateDraft = () => {
    if (!selectedCurriculum || templateModal.week == null || templateModal.assignmentIdx == null) return;
    try {
      const key = templateDraftKey(selectedCurriculum.cur_id, templateModal.week, templateModal.assignmentIdx);
      localStorage.setItem(key, templateModal.content || '');
      toast.success('임시저장 되었습니다.');
    } catch {
      toast.error('임시저장에 실패했습니다.');
    }
  };

  const renderAccordionItem = (step, expandedState, toggleFunc, isPreview = false) => {
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
                  {step.assignments.map((a, idx) => {
                    const isDistributed = !!a.template_content;
                    const actionClass = "template-action-btn admin";

                    return (
                      <div key={idx} className="extracted-assignment-card">
                        <strong className="extracted-assignment-name">[과제명] {a.title}</strong>
                        {Array.isArray(a.step_by_step_guide) && a.step_by_step_guide.length > 0 && (
                          <ul className="extracted-guide-list">
                            {a.step_by_step_guide.map((guide, gIdx) => (<li key={gIdx} className="extracted-guide-item">{guide}</li>))}
                          </ul>
                        )}
                        {a.description && <p className="extracted-guide-item">{a.description}</p>}

                        <div className={`extracted-submission-format ${!isPreview ? 'has-actions' : ''}`}>
                          <span>제출 형태: {a.expected_output_format || a.submission || '지정되지 않음'}</span>
                          {!isPreview && (
                            <div className="templateActionBtnGroup">
                              <button
                                className={actionClass}
                                onClick={(e) => { e.stopPropagation(); openTemplateModal(step.week, idx, a); }}
                              >
                                {isDistributed ? '마감일 변경' : '양식 배포(관리자)'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                (() => {
                  const totalWeeks = normalizeWeekPlan(selectedCurriculum.cur_week_plan).length
                    || selectedCurriculum.cur_duration_weeks
                    || 0;
                  return (selectedCurriculum.cur_assigned_learner_ids || []).map((id) => {
                    const l = learners.find((x) => x.user_id === id);
                    const submittedWeeks = new Set(
                      submissions
                        .filter((s) => s.task_learner_id === id)
                        .map((s) => s.task_week_number)
                    );
                    const submittedCount = submittedWeeks.size;
                    return (
                      <span
                        key={id}
                        className={`assignedLearnerChip ${selectedLearnerId === id && viewMode === 'learner' ? 'active' : ''}`}
                        onClick={() => handleLearnerChipClick(id)}
                      >
                        <span className="assignedLearnerChipName">{l ? l.user_name : `#${id}`}</span>
                        {totalWeeks > 0 && (
                          <span
                            className="assignedLearnerChipBadge"
                            title={`${submittedCount}/${totalWeeks} 주차 제출`}
                          >
                            {submittedCount}/{totalWeeks}
                          </span>
                        )}
                      </span>
                    );
                  });
                })()
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
                    <span className='curriculumSidebarItemTitle'>{c.cur_title}</span>
                    <button
                      type="button"
                      className="sidebarMenuBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(c.cur_id);
                        setManageStep('select');
                        setManageModalOpen(true);
                      }}
                    >
                      ⋮
                    </button>

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
                const learner = learners.find(l => l.user_id === selectedLearnerId);
                const weekPlans = normalizeWeekPlan(selectedCurriculum?.cur_week_plan || []);

                const allTasks = [];
                weekPlans.forEach(weekData => {
                  (weekData.assignments || []).forEach((assignment, idx) => {

                    const matches = submissions.filter(s => {
                      if (String(s.task_learner_id) !== String(selectedLearnerId)) return false;
                      if (String(s.task_week_number) !== String(weekData.week)) return false;

                      if (s.task_submitted_content && typeof s.task_submitted_content === 'object') {
                        return String(s.task_submitted_content.assignmentIdx) === String(idx);
                      }
                      return false;
                    });

                    let submission = null;
                    if (matches.length > 0) {
                      submission = matches.reduce((latest, current) =>
                        new Date(current.task_submitted_at || 0) > new Date(latest.task_submitted_at || 0) ? current : latest
                      );
                    }

                    allTasks.push({
                      week: weekData.week,
                      assignmentIdx: idx,
                      title: assignment.title,
                      hasTemplate: !!assignment.template_content,
                      deadline: assignment.deadline,
                      assignmentData: assignment,
                      submission: submission
                    });
                  });
                });

                return (
                  <>
                    <div className="learnerViewHeader">
                      <p className="learnerViewName">{learner?.user_name || `#${selectedLearnerId}`}</p>
                      <p className="learnerViewHint">전체 과제 현황</p>
                    </div>
                    <div className="curriculumSteps">
                      {allTasks.length === 0 && (
                        <p className="managerSubmissionEmpty">배정된 과제가 없습니다.</p>
                      )}
                      {allTasks.map((task, idx) => {
                        const s = task.submission;
                        const isSelectedTask = selectedLearnerTask
                          && selectedLearnerTask.week === task.week
                          && selectedLearnerTask.assignmentIdx === task.assignmentIdx;

                        const statusLabel = s ? {
                          submitted: '피드백 대기',
                          feedback_given: '피드백 완료',
                          resubmit_requested: '재제출 요청',
                        }[s.task_status] || '제출됨' : '미제출';

                        const dDayStr = task.deadline ? getDDayString(task.deadline) : '마감 없음';

                        return (
                          <div
                            key={`${task.week}-${task.title}-${idx}`}
                            className={`extracted-accordion-item ${(selectedSubmissionId === s?.task_submission_id || isSelectedTask) ? 'active' : ''} ${highlightedSubmissionId === s?.task_submission_id ? 'notification-highlight' : ''} clickable`}
                            onClick={() => {
                              setSelectedLearnerTask(task);
                              setSelectedSubmissionId(s ? s.task_submission_id : null);
                            }}
                          >
                            <div className={`extracted-accordion-header ${(selectedSubmissionId === s?.task_submission_id || isSelectedTask) ? 'expanded' : ''}`}>
                              <span className="extracted-week-label">{task.week}주차</span>
                              <span className="extracted-theme-label">{task.title}</span>
                              
                              {s ? (
                                <span className={`submissionStatusBadge ${s.task_status || ''}`}>
                                  {statusLabel}
                                </span>
                              ) : !task.hasTemplate ? (
                                <span className="badge-waiting">
                                  배포 대기
                                </span>
                              ) : (
                                <span className="badge-dday">
                                  {dDayStr}
                                </span>
                              )}
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
                    <div className="extracted-accordion-body no-border">
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
                            {weekData.assignments.map((a, idx) => {
                              const isDistributed = !!a.template_content;
                              const actionClass = "template-action-btn admin";

                              return (
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
                                      <button
                                        className={actionClass}
                                        onClick={(e) => { e.stopPropagation(); openTemplateModal(weekData.week, idx, a); }}
                                      >
                                        {isDistributed ? '마감일 변경' : '양식 배포(관리자)'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
                let taskForDetail = selectedLearnerTask;
                if (!taskForDetail && s) {
                  const weekPlans = normalizeWeekPlan(selectedCurriculum?.cur_week_plan || []);
                  const weekData = weekPlans.find((w) => w.week === s.task_week_number);
                  const assignmentIdx = s.task_submitted_content?.assignmentIdx;
                  const assignmentData = weekData?.assignments?.[assignmentIdx];
                  if (assignmentData) {
                    taskForDetail = {
                      week: s.task_week_number,
                      assignmentIdx,
                      title: assignmentData.title,
                      deadline: assignmentData.deadline,
                      assignmentData,
                    };
                  }
                }
                if (!s && !taskForDetail) return (
                  <div className="curriculumRightEmpty">
                    <p>왼쪽에서 과제를 선택하면 상세 내용이 표시됩니다.</p>
                  </div>
                );
                if (!s && taskForDetail) return (
                  <div className="curriculumRightContent">
                    <div className="learner-right-header">
                      <div>
                        <span className="learner-right-week">{taskForDetail.week}주차 과제</span>
                        <h3 className="curriculumDetailTitle large">{taskForDetail.title}</h3>
                        {taskForDetail.deadline && (
                          <span className="learner-right-dday">
                            마감: {formatOnlyDate(taskForDetail.deadline)} ({getDDayString(taskForDetail.deadline)})
                          </span>
                        )}
                      </div>
                      <span className="badge-waiting">미제출</span>
                    </div>
                    <div className="managerSubmissionItemBody unrestricted">
                      <div className="managerSubmissionContent">
                        <p className="learner-submission-label">배포된 과제 양식</p>
                        <div
                          className="learner-submission-content template-render"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(taskForDetail.assignmentData?.template_content) || '(배포된 양식 없음)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
                return (
                  <div className="managerSubmissionItemBody unrestricted">
                    <div className="managerSubmissionContent">
                      <p className="learner-submission-label">제출 내용</p>
                      <div className="learner-submission-content template-render" dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.task_submitted_content?.text) || '(내용 없음)' }} />
                    </div>
                    {Array.isArray(s.task_submitted_content?.attachments) && s.task_submitted_content.attachments.length > 0 && (
                      <div className="managerSubmissionAttachments">
                        <p className="learner-submission-label-small">[첨부파일]</p>
                        <ul className="managerSubmissionAttachmentList">
                          {s.task_submitted_content.attachments.map((a, i) => (
                            <li key={i} className="learner-submission-attach-item">
                              <button type="button" className="learner-submission-attach-link" onClick={() => handleAttachmentDownload(s.task_submission_id, a)}>{a.filename || a.stored_name}</button>
                              <span className="managerSubmissionAttachmentSize">{formatBytes(a.size)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.task_manager_feedback && (
                      <div className="learner-feedback-box">
                        <p className="learner-feedback-label">현재 피드백 ({formatDateTime(s.task_feedback_at)})</p>
                        <div className="learner-feedback-text">{s.task_manager_feedback}</div>
                      </div>
                    )}
                    <div className="managerFeedbackForm inline">
                      <p className="learner-submission-label-small">{s.task_manager_feedback ? '피드백 수정' : '피드백 작성'}</p>
                      <div className="quickCommentChips">
                        {FEEDBACK_QUICK_COMMENTS.map((c, i) => (
                          <button
                            type="button"
                            key={i}
                            className="quickCommentChip"
                            onClick={() => setFeedbackDraft(prev => ({
                              ...prev,
                              [s.task_submission_id]: appendQuickComment(prev[s.task_submission_id], c),
                            }))}
                            disabled={feedbackSavingId === s.task_submission_id}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
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
      )
      }

      <LoadingModal generating={generating} currentMessageIndex={currentMessageIndex} />

      {/* 모달: 커리큘럼 생성 */}
      {
        modalOpen && createPortal(
          <>
            <div className="chatModalOverlay" onClick={closeModal} />
            <div className="chatModalContainer">
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
        )
      }

      {/* 모달: 학습자 배정 변경 */}
      {
        assignModalOpen && selectedCurriculum && createPortal(
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
          </>,
          document.body
        )
      }

      {/* 모달: 커리큘럼 저장 확인 */}
      {
        confirmOpen && preview && createPortal(
          <>
            <div className="confirmOverlay" onClick={() => !saving && setConfirmOpen(false)} />
            <div className="confirmModal">
              <div className="confirmHeader"><div className="confirmHeaderRight"><p className="confirmHeaderLabel">{preview.cur_target_job || '직무 미지정'} | {preview.cur_duration_weeks}주차</p><h3 className="confirmTitle">이 커리큘럼을 저장할까요?</h3><div className="confirmDivider" /></div></div>
              <div className="confirmGoalBox"><p className="confirmGoalLabel">교육 목표 :</p><p className="confirmGoalText">{preview.cur_learning_goal || '교육 목표가 입력되지 않았습니다.'}</p></div>
              <p className="confirmProgramName">{preview.cur_title}</p>
              <div className="confirmStepList">
                {previewWeeks.map((step) => renderAccordionItem(step, previewExpandedWeek, (week) => setPreviewExpandedWeek(prev => prev === week ? null : week), true))}
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
        )
      }

      {/* 모달: 템플릿 양식 배포 (관리자용) */}
      {
        templateModal.open && createPortal(
          <>
            <div className="confirmOverlay" onClick={() => setTemplateModal({ ...templateModal, open: false })} />
            <div className={`confirmModal templateModal ${templateModal.fullscreen ? 'fullscreen' : ''}`}>
              <div className="modalTopBar">
                <h3 className="templateSectionTitle">{templateModal.deadlineOnly ? '과제 마감일 변경' : '과제 양식(템플릿) 배포'}</h3>
                <div className="modalHeaderActions">
                  {!templateModal.deadlineOnly && (
                    <button type="button" className="template-action-btn admin ai-regenerate-btn" onClick={handleRegenerateTemplate} disabled={templateModal.generating}>
                      {templateModal.generating ? 'AI 작성 중...' : 'AI 템플릿 재작성'}
                    </button>
                  )}
                  <button type="button" className="fullscreenBtn" onClick={() => setTemplateModal(prev => ({ ...prev, fullscreen: !prev.fullscreen }))}>
                    {templateModal.fullscreen ? '축소' : '전체보기'}
                  </button>
                </div>
              </div>

              <p className="assignSectionHint">
                {templateModal.deadlineOnly
                  ? `이미 배포된 '${templateModal.title}' 과제의 작성 양식은 유지하고 마감일만 변경합니다.`
                  : `학습자에게 전달될 '${templateModal.title}'의 작성 양식 가이드를 작성해주세요.\n표나 양식을 지정해주면 학습자가 쉽게 채워넣을 수 있습니다.`}
              </p>

              <div className="templateDeadlineRow">
                <span className="templateDeadlineLabel">마감일</span>
                <div className="templateDeadlinePicker">
                  <DatePicker
                    selected={templateModal.deadline ? new Date(templateModal.deadline) : null}
                    onChange={(d) => setTemplateModal(prev => ({ ...prev, deadline: d ? formatDateLocal(d) : '' }))}
                    dateFormat="yyyy.MM.dd (eee)"
                    locale="ko"
                    minDate={new Date()}
                    placeholderText="날짜 선택"
                    className="templateDeadlineInput"
                    calendarClassName="templateDeadlineCalendar"
                    showPopperArrow={false}
                  />
                  {templateModal.deadline && (
                    <span className="templateDeadlineBadge">{getDDayString(templateModal.deadline)}</span>
                  )}
                </div>
                <div className="templateDeadlineQuick">
                  {[
                    { label: '+1주', days: 7 },
                    { label: '+2주', days: 14 },
                    { label: '+4주', days: 28 },
                  ].map(({ label, days }) => (
                    <button
                      type="button"
                      key={days}
                      className="quickDeadlineBtn"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        setTemplateModal(prev => ({ ...prev, deadline: formatDateLocal(d) }));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="templateEditorWrapper">
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
                  readOnly={templateModal.deadlineOnly}
                />
              </div>
              <div className="confirmBtns" style={{ flexShrink: 0, paddingTop: '16px' }}>
                <button type="button" className="confirmBtnBack" onClick={() => setTemplateModal({ ...templateModal, open: false })} disabled={templateModal.saving}>취소</button>
                {!templateModal.deadlineOnly && (
                  <button type="button" className="confirmBtnBack" onClick={saveTemplateDraft} disabled={templateModal.saving}>임시저장</button>
                )}
                <button type="button" className="confirmBtnCreate" onClick={saveTemplate} disabled={templateModal.saving}>
                  {templateModal.saving
                    ? (templateModal.deadlineOnly ? '저장 중...' : '배포 중...')
                    : (templateModal.deadlineOnly ? '마감일 저장' : '템플릿 배포')}
                </button>
              </div>
            </div>
          </>,
          document.body
        )
      }

      {/* 모달: 관리 (다운로드 / 삭제) */}
      {
        manageModalOpen && createPortal(
          <>
            <div className="downloadOverlay" onClick={() => setManageModalOpen(false)} />
            <div className="downloadModal">

              {manageStep === 'select' && (
                <>
                  <p className="downloadModalTitle">관리</p>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => setManageStep('download')}>
                    <img src={download_img} className="downloadIcon" />
                    <span>다운로드</span>
                  </button>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => setManageStep('delete')}>
                    <img src={delete_img} className="deleteIcon" />
                    삭제
                  </button>
                </>
              )}

              {manageStep === 'download' && (
                <>
                  <p className="downloadModalTitle">다운로드 형식 선택</p>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => { handleDownloadDocx(); setManageModalOpen(false); }}>
                    DOCX 다운로드
                  </button>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => { handleDownloadPdf(); setManageModalOpen(false); }}>
                    PDF 다운로드
                  </button>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => { handleDownloadTxt(); setManageModalOpen(false); }}>
                    TXT 다운로드
                  </button>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => { setCompletionReportComment(''); setManageStep('completionReport'); }}>
                    완료보고서 PDF
                  </button>
                  <button type="button" className="downloadModalBtn back"
                    onClick={() => setManageStep('select')}>
                    ← 뒤로
                  </button>
                </>
              )}

              {manageStep === 'completionReport' && (
                <>
                  <p className="downloadModalTitle">완료보고서 코멘트</p>
                  <textarea
                    className="managerFeedbackTextarea"
                    rows={5}
                    maxLength={1000}
                    placeholder="보고서에 덧붙일 매니저 종합 코멘트를 입력하세요."
                    value={completionReportComment}
                    onChange={(e) => setCompletionReportComment(e.target.value)}
                  />
                  <button type="button" className="downloadModalBtn"
                    onClick={() => { handleDownloadCompletionReport(completionReportComment); setManageModalOpen(false); }}>
                    코멘트 포함 생성
                  </button>
                  <button type="button" className="downloadModalBtn"
                    onClick={() => { handleDownloadCompletionReport(''); setManageModalOpen(false); }}>
                    코멘트 없이 생성
                  </button>
                  <button type="button" className="downloadModalBtn back"
                    onClick={() => setManageStep('download')}>
                    ← 뒤로
                  </button>
                </>
              )}

              {manageStep === 'delete' && (
                <>
                  <p className="downloadModalTitle">커리큘럼 삭제</p>
                  <p style={{ fontSize: '14px', color: '#555', marginBottom: '12px' }}>
                    "{selectedCurriculum?.cur_title}"을(를) 삭제할까요?
                  </p>
                  <button type="button" className="downloadModalBtn delete"
                    onClick={handleDeleteCurriculum}>
                    삭제 확인
                  </button>
                  <button type="button" className="downloadModalBtn back"
                    onClick={() => setManageStep('select')}>
                    ← 뒤로
                  </button>
                </>
              )}

            </div>
          </>,
          document.body
        )
      }
    </div >
  );
}

export default CurriculumView;
