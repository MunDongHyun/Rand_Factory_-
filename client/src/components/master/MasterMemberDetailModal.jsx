function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function MasterMemberDetailModal({
  detailMember,
  detailSummary,
  detailLoading,
  detailError,
  isSelf,
  isDeleted,
  actionSaving,
  confirmDialog,
  setConfirmDialog,
  closeMemberDetail,
  handleRoleChange,
  handleDeleteRestore,
}) {
  if (!detailMember) return null;

  return (
    <>
      <div className="masterDetailOverlay" onClick={closeMemberDetail} />
      <div className="masterDetailModal">
        <div className="masterDetailHeader">
          <div>
            <p className="masterDetailEyebrow">회원 상세</p>
            <h2 className="masterDetailName">{detailMember.user_name}</h2>
            <p className="masterDetailMeta">
              {detailMember.user_email} · {detailMember.user_company || '-'}
            </p>
            <p className="masterDetailMetaSmall">
              가입일: {formatDate(detailMember.user_created_at)}
              {isDeleted && ' · 탈퇴 상태'}
            </p>
          </div>
          <button className="masterDetailClose" onClick={closeMemberDetail}>✕</button>
        </div>

        {detailError && <p className="masterError">{detailError}</p>}

        <div className="masterDetailSection">
          <p className="masterDetailSectionTitle">활동 요약</p>
          <div className="masterDetailGrid">
            <div className="masterDetailStat">
              <p className="masterDetailStatLabel">만든 커리큘럼</p>
              <p className="masterDetailStatValue">
                {detailLoading ? '...' : (detailSummary?.curricula_created ?? 0)}
              </p>
            </div>
            <div className="masterDetailStat">
              <p className="masterDetailStatLabel">배정 커리큘럼</p>
              <p className="masterDetailStatValue">
                {detailLoading ? '...' : (detailSummary?.curricula_assigned ?? 0)}
              </p>
            </div>
            <div className="masterDetailStat">
              <p className="masterDetailStatLabel">제출 과제</p>
              <p className="masterDetailStatValue">
                {detailLoading ? '...' : (detailSummary?.submissions_count ?? 0)}
              </p>
            </div>
            <div className="masterDetailStat">
              <p className="masterDetailStatLabel">받은 피드백</p>
              <p className="masterDetailStatValue">
                {detailLoading ? '...' : (detailSummary?.feedbacks_received ?? 0)}
              </p>
            </div>
            <div className="masterDetailStat">
              <p className="masterDetailStatLabel">작성 피드백</p>
              <p className="masterDetailStatValue">
                {detailLoading ? '...' : (detailSummary?.feedbacks_given ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="masterDetailSection">
          <p className="masterDetailSectionTitle">역할 변경</p>
          {isSelf ? (
            <p className="masterDetailHint">본인 역할은 변경할 수 없습니다.</p>
          ) : (
            <div className="masterDetailRoleRow">
              {[
                { value: 'a', label: '관리자' },
                { value: 'm', label: '매니저' },
                { value: 'j', label: '학습자' },
              ].map((opt) => {
                const isActive = detailMember.user_role === opt.value;
                return (
                  <button
                    key={opt.value}
                    className={`masterDetailRoleBtn ${isActive ? 'active' : ''}`}
                    onClick={() => handleRoleChange(opt.value)}
                    disabled={actionSaving || isActive}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="masterDetailSection">
          <p className="masterDetailSectionTitle">계정 상태</p>
          {isSelf ? (
            <p className="masterDetailHint">본인 계정은 탈퇴/복구할 수 없습니다.</p>
          ) : isDeleted ? (
            <button
              className="masterDetailRestoreBtn"
              onClick={() => setConfirmDialog({
                kind: 'restore',
                message: `${detailMember.user_name}님의 탈퇴를 해제하고 복구하시겠습니까?`,
              })}
              disabled={actionSaving}
            >
              탈퇴 해제 (복구)
            </button>
          ) : (
            <button
              className="masterDetailDeleteBtn"
              onClick={() => setConfirmDialog({
                kind: 'delete',
                message: `${detailMember.user_name}님을 강제 탈퇴 처리하시겠습니까? (복구 가능)`,
              })}
              disabled={actionSaving}
            >
              강제 탈퇴
            </button>
          )}
        </div>
      </div>

      {confirmDialog && (
        <>
          <div className="masterConfirmOverlay" onClick={() => !actionSaving && setConfirmDialog(null)} />
          <div className="masterConfirmModal">
            <p className="masterConfirmMessage">{confirmDialog.message}</p>
            <div className="masterConfirmBtns">
              <button
                className="masterConfirmCancel"
                onClick={() => setConfirmDialog(null)}
                disabled={actionSaving}
              >
                취소
              </button>
              <button
                className={confirmDialog.kind === 'delete' ? 'masterConfirmDanger' : 'masterConfirmPrimary'}
                onClick={() => handleDeleteRestore(confirmDialog.kind === 'delete')}
                disabled={actionSaving}
              >
                {actionSaving ? '처리 중...' : (confirmDialog.kind === 'delete' ? '탈퇴 처리' : '복구')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MasterMemberDetailModal;
