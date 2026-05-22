import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api';

const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

function LearnerDetailModal({ learnerId, learner, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!learnerId) return;
    setLoading(true);
    setError(null);
    api.get(`/users/${learnerId}/activity-summary`)
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.response?.data?.detail || '활동 요약을 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  return createPortal(
    <>
      <div className="learnerDetailOverlay" onClick={onClose} />
      <div className="learnerDetailModal" role="dialog" aria-modal="true">
        <div className="learnerDetailHeader">
          <h3 className="learnerDetailTitle">{learner?.user_name || '학습자'}</h3>
          <button
            type="button"
            className="learnerDetailClose"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="learnerDetailInfo">
          <div className="learnerDetailRow">
            <span className="learnerDetailLabel">이메일</span>
            <span className="learnerDetailValue">{learner?.user_email || '-'}</span>
          </div>
          <div className="learnerDetailRow">
            <span className="learnerDetailLabel">가입일</span>
            <span className="learnerDetailValue">{formatDate(learner?.user_created_at)}</span>
          </div>
          <div className="learnerDetailRow">
            <span className="learnerDetailLabel">소속</span>
            <span className="learnerDetailValue">{learner?.user_company || '-'}</span>
          </div>
        </div>

        <div className="learnerDetailSection">
          <h4 className="learnerDetailSectionTitle">학습 활동 요약</h4>
          {loading ? (
            <p className="learnerDetailMuted">불러오는 중...</p>
          ) : error ? (
            <p className="learnerDetailError">{error}</p>
          ) : summary ? (
            <div className="learnerDetailStats">
              <div className="learnerDetailStat">
                <p className="learnerDetailStatLabel">배정 커리큘럼</p>
                <p className="learnerDetailStatValue">{summary.curricula_assigned ?? 0}</p>
              </div>
              <div className="learnerDetailStat">
                <p className="learnerDetailStatLabel">제출한 과제</p>
                <p className="learnerDetailStatValue">{summary.submissions_count ?? 0}</p>
              </div>
              <div className="learnerDetailStat">
                <p className="learnerDetailStatLabel">받은 피드백</p>
                <p className="learnerDetailStatValue">{summary.feedbacks_received ?? 0}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>,
    document.body
  );
}

export default LearnerDetailModal;
