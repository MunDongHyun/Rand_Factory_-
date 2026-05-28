import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/api';
import { sanitizeHtml } from '../lib/sanitize';
import { downloadAttachment, formatBytes } from '../lib/attachments';
import { FEEDBACK_QUICK_COMMENTS, appendQuickComment } from '../lib/feedbackTemplates';
import '../styles/LearnerManagement.css';
import '../styles/Curriculum.css';
import eyeIcon from '../public/eye_icon.png';
import eyeCloseIcon from '../public/eye-closed_icon.png';
import copyIcon from '../public/copy_icon.png';

const maskInviteCode = (code) => (code ? code.replace(/[^-]/g, '•') : '');

const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateTime = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatRelative = (val) => {
  if (!val) return '활동 없음';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '활동 없음';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  return formatDate(val);
};

const SUBMISSION_STATUS_LABEL = {
  submitted: '피드백 대기',
  feedback_given: '피드백 완료',
  resubmit_requested: '재제출 요청',
};

const SUBMISSION_STATUS_CLASS = {
  submitted: 'waiting',
  feedback_given: 'done',
  resubmit_requested: 'resubmit',
};

function LearnerManagementView({ user }) {
  // 학습자 목록
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [codeVisible, setCodeVisible] = useState(false);

  // 우측 상세 - 활동 요약
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // 우측 상세 - 커리큘럼 배정
  const [curricula, setCurricula] = useState([]);
  const [curriculaLoading, setCurriculaLoading] = useState(true);
  const [editAssign, setEditAssign] = useState(false);
  const [assignSelected, setAssignSelected] = useState(() => new Set());
  const [assignSaving, setAssignSaving] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [certificateActionId, setCertificateActionId] = useState(null);

  // 우측 상세 - 최근 제출 이력
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);

  // 제출 카드 펼침 + 피드백 작성 상태
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [feedbackSavingId, setFeedbackSavingId] = useState(null);

  useEffect(() => {
    // 화면 진입 시 매니저 회사에 속한 학습자 목록을 한 번 불러온다.
    setLoading(true);
    api.get('/users/learners')
      .then((res) => setLearners(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || '학습자 목록을 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // 배정 관리와 수료증 발급 버튼을 위해 매니저가 접근 가능한 커리큘럼 목록을 유지한다.
    setCurriculaLoading(true);
    api.get('/curricula')
      .then((res) => setCurricula(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCurricula([]))
      .finally(() => setCurriculaLoading(false));
  }, []);

  useEffect(() => {
    // 학습자를 선택하면 우측 상세에 필요한 요약/제출/수료증 데이터를 함께 갱신한다.
    if (!selectedLearnerId) {
      setSummary(null);
      setSummaryError(null);
      setEditAssign(false);
      setSubmissions([]);
      setSubmissionsError(null);
      setCertificates([]);
      setExpandedSubmissionId(null);
      setFeedbackDraft({});
      return;
    }
    setExpandedSubmissionId(null);
    setFeedbackDraft({});
    setSummaryLoading(true);
    setSummaryError(null);
    setEditAssign(false);
    api.get(`/users/${selectedLearnerId}/activity-summary`)
      .then((res) => setSummary(res.data))
      .catch((err) => setSummaryError(err.response?.data?.detail || '활동 요약을 불러오지 못했어요.'))
      .finally(() => setSummaryLoading(false));

    setSubmissionsLoading(true);
    setSubmissionsError(null);
    api.get(`/task-submissions/by-learner/${selectedLearnerId}`)
      .then((res) => setSubmissions(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setSubmissionsError(err.response?.data?.detail || '제출 이력을 불러오지 못했어요.'))
      .finally(() => setSubmissionsLoading(false));

    setCertificatesLoading(true);
    // 선택한 학습자에게 이미 발급된 수료증을 먼저 가져와 커리큘럼별 버튼 상태를 결정한다.
    api.get('/certificates', { params: { learner_id: selectedLearnerId } })
      .then((res) => setCertificates(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCertificates([]))
      .finally(() => setCertificatesLoading(false));
  }, [selectedLearnerId]);

  const handleToggleExpand = (sid) => {
    setExpandedSubmissionId((prev) => (prev === sid ? null : sid));
  };

  const handleAttachmentDownload = async (submissionId, attachment) => {
    try {
      await downloadAttachment(submissionId, attachment);
    } catch (err) {
      toast.error(err.response?.data?.detail || '첨부파일 다운로드에 실패했습니다.');
    }
  };

  const handleFeedbackSave = async (submissionId, status = 'feedback_given') => {
    const text = (feedbackDraft[submissionId] || '').trim();
    if (!text) {
      toast.warn(status === 'resubmit_requested' ? '재제출 사유를 입력해야 합니다.' : '피드백 내용을 입력하세요.');
      return;
    }
    setFeedbackSavingId(submissionId);
    try {
      const res = await api.patch(`/task-submissions/${submissionId}/feedback`, {
        task_manager_feedback: text,
        task_status: status,
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.task_submission_id === submissionId ? { ...s, ...res.data } : s))
      );
      setFeedbackDraft((prev) => ({ ...prev, [submissionId]: '' }));
      toast.success(status === 'feedback_given' ? '피드백을 저장했습니다.' : '재제출을 요청했습니다.');
      // 활동 요약 카운트 갱신
      api.get(`/users/${selectedLearnerId}/activity-summary`)
        .then((r) => setSummary(r.data))
        .catch(() => { });
    } catch (err) {
      toast.error(err.response?.data?.detail || '피드백 저장에 실패했습니다.');
    } finally {
      setFeedbackSavingId(null);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!user?.user_invite_code) return;
    try {
      await navigator.clipboard.writeText(user.user_invite_code);
      toast.success('초대 코드를 복사했습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const downloadCertificate = async (certificate) => {
    const res = await api.get(`/certificates/${certificate.cert_id}/download`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const filename = `${certificate.cert_curriculum_title || '수료증'}_${certificate.cert_learner_name || '학습자'}.pdf`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCertificateAction = async (curriculum) => {
    if (!selectedLearnerId || certificateActionId) return;
    const existing = certificates.find((cert) => cert.cert_curriculum_id === curriculum.cur_id);
    setCertificateActionId(curriculum.cur_id);
    try {
      // 이미 발급된 수료증은 재발급하지 않고 바로 다운로드한다.
      if (existing) {
        await downloadCertificate(existing);
        return;
      }

      // 서버의 수료 조건 검사를 통과한 경우에만 발급 요청을 보낸다.
      const eligibilityRes = await api.get('/certificates/eligibility', {
        params: {
          curriculum_id: curriculum.cur_id,
          learner_id: selectedLearnerId,
        },
      });
      if (!eligibilityRes.data?.eligible) {
        toast.info('아직 수료증 발급 조건을 만족하지 않았습니다.');
        return;
      }

      const issueRes = await api.post('/certificates', {
        cert_curriculum_id: curriculum.cur_id,
        cert_learner_id: selectedLearnerId,
        cert_title: 'ArtiCulum 수료증',
      });
      setCertificates((prev) => {
        const others = prev.filter((cert) => cert.cert_id !== issueRes.data.cert_id);
        return [issueRes.data, ...others];
      });
      toast.success('수료증을 발급했습니다.');
      await downloadCertificate(issueRes.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : detail?.message || '수료증 처리에 실패했습니다.';
      toast.error(message);
    } finally {
      setCertificateActionId(null);
    }
  };

  const handleSampleCertificateDownload = async () => {
    // TODO: 수료증 템플릿 확정 후 제거. 실제 발급 기록 없이 샘플 PDF만 확인한다.
    try {
      const res = await api.get('/certificates/sample/download', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'articulum_certificate_sample.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.detail || '샘플 수료증 다운로드에 실패했습니다.');
    }
  };

  const filteredLearners = useMemo(() => {
    let arr = learners;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      arr = arr.filter((l) => {
        const hay = `${l.user_name || ''} ${l.user_email || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return [...arr].sort((a, b) => {
      switch (sort) {
        case 'created_asc':
          return new Date(a.user_created_at || 0) - new Date(b.user_created_at || 0);
        case 'name_asc':
          return (a.user_name || '').localeCompare(b.user_name || '', 'ko');
        case 'name_desc':
          return (b.user_name || '').localeCompare(a.user_name || '', 'ko');
        case 'created_desc':
        default:
          return new Date(b.user_created_at || 0) - new Date(a.user_created_at || 0);
      }
    });
  }, [learners, searchQuery, sort]);

  const selectedLearner = learners.find((l) => l.user_id === selectedLearnerId) || null;

  const assignedCurricula = curricula.filter(
    (c) => Array.isArray(c.cur_assigned_learner_ids) && c.cur_assigned_learner_ids.includes(selectedLearnerId)
  );

  const startEditAssign = () => {
    setAssignSelected(new Set(assignedCurricula.map((c) => c.cur_id)));
    setEditAssign(true);
  };

  const cancelEditAssign = () => {
    setEditAssign(false);
  };

  const toggleAssign = (curId) => {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      if (next.has(curId)) next.delete(curId);
      else next.add(curId);
      return next;
    });
  };

  const saveAssign = async () => {
    if (!selectedLearnerId) return;
    setAssignSaving(true);
    try {
      const tasks = [];
      for (const c of curricula) {
        const wasAssigned = Array.isArray(c.cur_assigned_learner_ids) && c.cur_assigned_learner_ids.includes(selectedLearnerId);
        const willAssign = assignSelected.has(c.cur_id);
        if (wasAssigned === willAssign) continue;
        const nextIds = wasAssigned
          ? (c.cur_assigned_learner_ids || []).filter((id) => id !== selectedLearnerId)
          : [...(c.cur_assigned_learner_ids || []), selectedLearnerId];
        tasks.push(api.patch(`/curricula/${c.cur_id}`, { cur_assigned_learner_ids: nextIds }));
      }
      if (tasks.length === 0) {
        setEditAssign(false);
        return;
      }
      const results = await Promise.all(tasks);
      setCurricula((prev) => {
        const next = [...prev];
        for (const res of results) {
          const idx = next.findIndex((c) => c.cur_id === res.data.cur_id);
          if (idx >= 0) next[idx] = res.data;
        }
        return next;
      });
      toast.success('커리큘럼 배정이 업데이트되었습니다.');
      setEditAssign(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || '커리큘럼 배정 변경에 실패했습니다.');
    } finally {
      setAssignSaving(false);
    }
  };

  return (
    <div className="learnerMgmtContainer">
      <header className="learnerMgmtHeader">
        <h2 className="sectionTitle">내 회사 학습자 관리</h2>
        <p className="learnerMgmtSubtitle">
          {user?.user_company ? `${user.user_company} 소속 학습자` : '소속 학습자'} · {learners.length}명
        </p>
      </header>

      <div className="learnerMgmtSplit">
        <aside className="learnerMgmtSide">
          {user?.user_invite_code && (
            <div className="learnerMgmtInviteCard">
              <div className="learnerMgmtInviteLabel">회사 초대 코드</div>
              <div className="learnerMgmtInviteRow">
                <code className="learnerMgmtInviteCode">
                  {codeVisible ? user.user_invite_code : maskInviteCode(user.user_invite_code)}
                </code>
                <button
                  type="button"
                  className="learnerMgmtInviteAction"
                  onClick={() => setCodeVisible((v) => !v)}
                  aria-label={codeVisible ? '코드 숨기기' : '코드 보기'}
                  title={codeVisible ? '코드 숨기기' : '코드 보기'}
                >
                  {codeVisible ?
                    <img src={eyeCloseIcon} alt="코드 숨기기" className="inviteActionIcon" /> : <img src={eyeIcon} alt="코드 보기" className="inviteActionIcon" />}
                </button>
                <button
                  type="button"
                  className="learnerMgmtInviteAction"
                  onClick={handleCopyInviteCode}
                  aria-label="초대 코드 복사"
                  title="초대 코드 복사"
                >
                  <img src={copyIcon} alt="코드 복사" className="inviteActionIcon" />
                </button>
              </div>
              <p className="learnerMgmtInviteHint">
                이 코드를 받은 사람이 회원가입 시 입력하면 본 회사 학습자로 등록됩니다.
              </p>
            </div>
          )}

          <div className="learnerMgmtControls">
            <input
              type="text"
              className="learnerMgmtSearch"
              placeholder="이름 또는 이메일로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="learnerMgmtSort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="created_desc">최신 가입순</option>
              <option value="created_asc">오래된 가입순</option>
              <option value="name_asc">이름 ㄱ→ㅎ</option>
              <option value="name_desc">이름 ㅎ→ㄱ</option>
            </select>
          </div>

          <div className="learnerMgmtCount">{filteredLearners.length} / {learners.length}명</div>

          {loading ? (
            <p className="learnerMgmtLoading">불러오는 중...</p>
          ) : error ? (
            <p className="learnerMgmtError">{error}</p>
          ) : filteredLearners.length === 0 ? (
            <div className="learnerMgmtEmpty">
              {learners.length === 0 ? (
                <>
                  <p>아직 회사에 등록된 학습자가 없습니다.</p>
                  <p className="learnerMgmtEmptyHint">위 초대 코드를 학습자에게 전달해 가입을 요청하세요.</p>
                </>
              ) : (
                <p>검색 결과가 없습니다.</p>
              )}
            </div>
          ) : (
            <ul className="learnerMgmtList">
              {filteredLearners.map((l) => (
                <li
                  key={l.user_id}
                  className={`learnerMgmtCard ${selectedLearnerId === l.user_id ? 'active' : ''}`}
                  onClick={() => setSelectedLearnerId(l.user_id)}
                >
                  <div className="learnerMgmtCardLeft">
                    <div className="learnerMgmtCardName">{l.user_name}</div>
                    <div className="learnerMgmtCardEmail">{l.user_email}</div>
                  </div>
                  <div className="learnerMgmtCardRight">
                    <div className="learnerMgmtCardDate">가입 {formatDate(l.user_created_at)}</div>
                    <span className="learnerMgmtCardArrow">▶</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* 우측: 선택된 학습자 상세 */}
        <section className="learnerMgmtDetail">
          {!selectedLearner ? (
            <div className="learnerMgmtEmptyDetail">
              <p>좌측에서 학습자를 선택하면 상세 정보가 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div className="learnerMgmtDetailTop">
                <div className="learnerMgmtDetailHeader">
                  <h3 className="learnerMgmtDetailName">{selectedLearner.user_name}</h3>
                  <button
                    type="button"
                    className="learnerMgmtDetailClose"
                    onClick={() => setSelectedLearnerId(null)}
                    aria-label="선택 해제"
                    title="선택 해제"
                  >
                    ×
                  </button>
                </div>
                <div className="learnerMgmtInfo">
                  <div className="learnerMgmtInfoRow">
                    <span className="learnerMgmtInfoLabel">이메일</span>
                    <span className="learnerMgmtInfoValue">{selectedLearner.user_email || '-'}</span>
                  </div>
                  <div className="learnerMgmtInfoRow">
                    <span className="learnerMgmtInfoLabel">가입일</span>
                    <span className="learnerMgmtInfoValue">{formatDate(selectedLearner.user_created_at)}</span>
                  </div>
                  <div className="learnerMgmtInfoRow">
                    <span className="learnerMgmtInfoLabel">소속</span>
                    <span className="learnerMgmtInfoValue">{selectedLearner.user_company || '-'}</span>
                  </div>
                </div>


              </div>

              <div className="learnerMgmtDeatilBody">


                <div className="learnerMgmtDetailGrid">
                  <div className="learnerMgmtSection" style={{ position: "relative" }}>
                    <h4 className="learnerMgmtSectionTitle" style={{ marginBottom: "20px" }}>학습 활동 요약</h4>
                    <span className="learnerMgmtLastActivity">
                      최근 활동: {summaryLoading ? '⋯' : formatRelative(summary?.last_activity_at)}
                    </span>
                    <div className="learnerMgmtStats">
                      <div className="learnerMgmtStat">
                        <p className="learnerMgmtStatLabel">진행률</p>
                        <p className="learnerMgmtStatValue">
                          {summaryLoading ? '⋯' : `${summary?.progress_avg ?? 0}%`}
                        </p>
                      </div>
                      <div className="learnerMgmtStat">
                        <p className="learnerMgmtStatLabel">배정 커리큘럼</p>
                        <p className="learnerMgmtStatValue">
                          {summaryLoading ? '⋯' : (summary?.curricula_assigned ?? 0)}
                        </p>
                      </div>
                      <div className="learnerMgmtStat">
                        <p className="learnerMgmtStatLabel">제출한 과제</p>
                        <p className="learnerMgmtStatValue">
                          {summaryLoading ? '⋯' : (summary?.submissions_count ?? 0)}
                        </p>
                      </div>
                      <div className="learnerMgmtStat">
                        <p className="learnerMgmtStatLabel">받은 피드백</p>
                        <p className="learnerMgmtStatValue">
                          {summaryLoading ? '⋯' : (summary?.feedbacks_received ?? 0)}
                        </p>
                      </div>
                    </div>
                    {summaryError && (
                      <p className="learnerMgmtSectionError">{summaryError}</p>
                    )}
                  </div>

                  <div className="learnerMgmtSection" >
                    <div className="learnerMgmtSectionTopRow">
                      <h4 className="learnerMgmtSectionTitle">커리큘럼 배정</h4>
                      {!editAssign && !curriculaLoading && curricula.length > 0 && (
                        <div className="learnerMgmtSectionActions">
                          <button type="button" className="learnerMgmtEditBtn" onClick={handleSampleCertificateDownload}>
                            샘플 수료증
                          </button>
                          <button type="button" className="learnerMgmtEditBtn" onClick={startEditAssign}>
                            관리
                          </button>
                        </div>
                      )}
                    </div>

                    {curriculaLoading ? (
                      <p className="learnerMgmtMuted">불러오는 중...</p>
                    ) : !editAssign ? (
                      assignedCurricula.length === 0 ? (
                        <p className="learnerMgmtMuted">아직 배정된 커리큘럼이 없습니다.</p>
                      ) : (
                        <ul className="learnerMgmtAssignList">
                          {assignedCurricula.map((c) => (
                            <li key={c.cur_id} className="learnerMgmtAssignItem" title={c.cur_title}>
                              <span className="learnerMgmtAssignTitle">{c.cur_title}</span>
                              <button
                                type="button"
                                className={`learnerMgmtCertBtn ${certificates.some((cert) => cert.cert_curriculum_id === c.cur_id) ? 'issued' : ''}`}
                                onClick={() => handleCertificateAction(c)}
                                disabled={certificatesLoading || certificateActionId === c.cur_id}
                              >
                                {certificateActionId === c.cur_id
                                  ? '처리 중'
                                  : certificates.some((cert) => cert.cert_curriculum_id === c.cur_id)
                                    ? '다운로드'
                                    : '수료증 발급'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <>
                        <div className="learnerMgmtAssignEdit">
                          {curricula.length === 0 ? (
                            <p className="learnerMgmtMuted">생성한 커리큘럼이 없습니다.</p>
                          ) : (
                            curricula.map((c) => {
                              const checked = assignSelected.has(c.cur_id);
                              return (
                                <label key={c.cur_id} className="learnerMgmtAssignRow" title={c.cur_title}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAssign(c.cur_id)}
                                    disabled={assignSaving}
                                  />
                                  <span>{c.cur_title}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <div className="learnerMgmtAssignActions">
                          <button
                            type="button"
                            className="learnerMgmtAssignCancelBtn"
                            onClick={cancelEditAssign}
                            disabled={assignSaving}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            className="learnerMgmtAssignSaveBtn"
                            onClick={saveAssign}
                            disabled={assignSaving}
                          >
                            {assignSaving ? '저장 중...' : '저장'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="learnerMgmtSection learnerMgmtSubmissionsSection">
                  <h4 className="learnerMgmtSectionTitle">최근 제출 이력</h4>
                  {submissionsLoading ? (
                    <p className="learnerMgmtMuted">불러오는 중...</p>
                  ) : submissionsError ? (
                    <p className="learnerMgmtSectionError">{submissionsError}</p>
                  ) : submissions.length === 0 ? (
                    <p className="learnerMgmtMuted">아직 제출한 과제가 없습니다.</p>
                  ) : (
                    <ul className="learnerMgmtSubmissionsList">
                      {submissions.slice(0, 8).map((s) => {
                        const cur = curricula.find((c) => c.cur_id === s.task_curriculum_id);
                        const statusKey = s.task_status || 'submitted';
                        const statusLabel = SUBMISSION_STATUS_LABEL[statusKey] || '제출';
                        const statusCls = SUBMISSION_STATUS_CLASS[statusKey] || 'waiting';
                        const isExpanded = expandedSubmissionId === s.task_submission_id;
                        const attachments = Array.isArray(s.task_submitted_content?.attachments)
                          ? s.task_submitted_content.attachments
                          : [];
                        const isSaving = feedbackSavingId === s.task_submission_id;
                        return (
                          <li
                            key={s.task_submission_id}
                            className={`learnerMgmtSubmissionItem${isExpanded ? ' expanded' : ''}`}
                          >
                            <button
                              type="button"
                              className="learnerMgmtSubmissionHeader"
                              onClick={() => handleToggleExpand(s.task_submission_id)}
                              aria-expanded={isExpanded}
                            >
                              <div className="learnerMgmtSubmissionLeft">
                                <span className="learnerMgmtSubmissionWeek">{s.task_week_number}주차</span>
                                <span
                                  className="learnerMgmtSubmissionCur"
                                  title={cur ? cur.cur_title : `#${s.task_curriculum_id}`}
                                >
                                  {cur ? cur.cur_title : `#${s.task_curriculum_id}`}
                                </span>
                              </div>
                              <div className="learnerMgmtSubmissionRight">
                                <span className={`learnerMgmtSubmissionStatus ${statusCls}`}>{statusLabel}</span>
                                <span className="learnerMgmtSubmissionDate">{formatDate(s.task_submitted_at)}</span>
                                <span className="learnerMgmtSubmissionExpandIcon" aria-hidden="true">
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="learnerMgmtSubmissionExpanded">
                                <div className="managerSubmissionContent">
                                  <p className="learner-submission-label">제출 내용</p>
                                  <div
                                    className="learner-submission-content template-render"
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHtml(s.task_submitted_content?.text) || '(내용 없음)',
                                    }}
                                  />
                                </div>
                                {attachments.length > 0 && (
                                  <div className="managerSubmissionAttachments">
                                    <p className="learner-submission-label-small">[첨부파일]</p>
                                    <ul className="managerSubmissionAttachmentList">
                                      {attachments.map((a, i) => (
                                        <li key={i} className="learner-submission-attach-item">
                                          <button
                                            type="button"
                                            className="learner-submission-attach-link"
                                            onClick={() => handleAttachmentDownload(s.task_submission_id, a)}
                                          >
                                            {a.filename || a.stored_name}
                                          </button>
                                          <span className="managerSubmissionAttachmentSize">{formatBytes(a.size)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {s.task_manager_feedback && (
                                  <div className="learner-feedback-box">
                                    <p className="learner-feedback-label">
                                      현재 피드백
                                      <span className="learner-feedback-date">{formatDateTime(s.task_feedback_at)}</span>
                                    </p>
                                    <div className="learner-feedback-text">{s.task_manager_feedback}</div>
                                  </div>
                                )}
                                <div className="managerFeedbackForm inline">
                                  <p className="learner-submission-label-small">
                                    {s.task_manager_feedback ? '피드백 수정' : '피드백 작성'}
                                  </p>
                                  <div className="quickCommentChips">
                                    {FEEDBACK_QUICK_COMMENTS.map((c, i) => (
                                      <button
                                        type="button"
                                        key={i}
                                        className="quickCommentChip"
                                        onClick={() =>
                                          setFeedbackDraft((prev) => ({
                                            ...prev,
                                            [s.task_submission_id]: appendQuickComment(
                                              prev[s.task_submission_id],
                                              c
                                            ),
                                          }))
                                        }
                                        disabled={isSaving}
                                      >
                                        {c}
                                      </button>
                                    ))}
                                  </div>
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
                                      type="button"
                                      className="managerFeedbackBtn secondary"
                                      onClick={() => handleFeedbackSave(s.task_submission_id, 'resubmit_requested')}
                                      disabled={isSaving}
                                    >
                                      재제출 요청
                                    </button>
                                    <button
                                      type="button"
                                      className="managerFeedbackBtn primary"
                                      onClick={() => handleFeedbackSave(s.task_submission_id, 'feedback_given')}
                                      disabled={isSaving}
                                    >
                                      {isSaving ? '저장 중...' : '피드백 저장'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default LearnerManagementView;
