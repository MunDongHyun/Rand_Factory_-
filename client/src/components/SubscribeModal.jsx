import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import api from '../lib/api';
import '../styles/Dashboard.css';

export default function SubscribeModal({ open, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handlePay = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/users/me/upgrade');
      toast.success('매니저로 승급되었습니다. 회사 초대 코드가 발급되었습니다.');
      if (onSuccess) onSuccess(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || '승급 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      <div className="subscribeOverlay" onClick={submitting ? undefined : onClose} />
      <div className="subscribeModal" role="dialog" aria-modal="true">
        <div className="subscribeModalHeader">
          <h3 className="subscribeModalTitle">OJT 매니저 플랜</h3>
          <button type="button" className="subscribeCloseBtn" onClick={onClose} disabled={submitting} aria-label="닫기">×</button>
        </div>

        <div className="subscribePlanCard">
          <div className="subscribePlanBadge">RECOMMENDED</div>
          <div className="subscribePlanPrice">
            <span className="subscribePlanAmount">99,000</span>
            <span className="subscribePlanUnit">원 / 월</span>
          </div>
          <ul className="subscribePlanFeatures">
            <li>회사 학습자 초대 (무제한)</li>
            <li>AI 커리큘럼 자동 생성</li>
            <li>과제 템플릿 배포 + 피드백</li>
            <li>학습 현황 대시보드</li>
          </ul>
        </div>

        <p className="subscribePlanNote">
          결제 완료 즉시 매니저 권한으로 전환되며, 회사 전용 초대 코드가 발급됩니다.
        </p>

        <div className="subscribeActions">
          <button type="button" className="subscribeCancelBtn" onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button type="button" className="subscribePayBtn" onClick={handlePay} disabled={submitting}>
            {submitting ? '결제 처리 중...' : '결제하기'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
