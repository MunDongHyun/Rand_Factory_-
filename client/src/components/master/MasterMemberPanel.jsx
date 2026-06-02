function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function statusFor(member) {
  if (member.user_deleted_at) return '탈퇴';
  if (member.user_role === 'a') return '관리자';
  if (member.user_role === 'm') return '매니저';
  if (member.user_role === 'c') return '일반회원';
  return '학습자';
}

function MasterMemberPanel({
  onClose,
  onLogout,
  memberSearch,
  setMemberSearch,
  memberRoleFilter,
  setMemberRoleFilter,
  memberSort,
  setMemberSort,
  filteredMembers,
  members,
  membersLoading,
  membersError,
  openMemberDetail,
}) {
  return (
    <>
      <div className="masterPanelOverlay" onClick={onClose} />
      <aside className="masterMemberPanel">
        <div className="masterPanelHeader">
          <h2 className="sectionTitle">회원관리</h2>
          <button className="masterdrawerLogout" onClick={onLogout}>
            로그아웃
          </button>
        </div>

        <div className="masterMemberControls">
          <input
            type="text"
            className="masterMemberSearch"
            placeholder="이름, 이메일, 회사로 검색"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
          <select
            className="masterMemberFilter"
            value={memberRoleFilter}
            onChange={(e) => setMemberRoleFilter(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="a">관리자</option>
            <option value="m">매니저</option>
            <option value="c">일반회원</option>
            <option value="j">학습자</option>
            <option value="deleted">탈퇴</option>
          </select>
          <select
            className="masterMemberFilter"
            value={memberSort}
            onChange={(e) => setMemberSort(e.target.value)}
          >
            <option value="created_desc">최신 가입순</option>
            <option value="created_asc">오래된 가입순</option>
            <option value="name_asc">이름 ㄱ→ㅎ</option>
            <option value="name_desc">이름 ㅎ→ㄱ</option>
            <option value="role">역할별</option>
          </select>
          <span className="masterMemberCount">
            {filteredMembers.length} / {members.length}명
          </span>
        </div>

        <div className="masterPanelContent">
          {membersLoading && <p className="masterLoading">회원 목록 불러오는 중...</p>}
          {membersError && <p className="masterError">{membersError}</p>}
          {!membersLoading && !membersError && members.length === 0 && (
            <p className="masterLoading">표시할 회원이 없습니다.</p>
          )}
          {!membersLoading && !membersError && members.length > 0 && filteredMembers.length === 0 && (
            <p className="masterLoading">검색 조건에 맞는 회원이 없습니다.</p>
          )}
          {filteredMembers.map((member) => {
            const status = statusFor(member);
            const isWarning = status === '탈퇴';
            return (
              <div
                key={member.user_id}
                className={`masterMemberRow clickable ${isWarning ? 'warning' : ''}`}
                onClick={() => openMemberDetail(member)}
              >
                <div className="masterMemberInfo">
                  <p className="masterMemberName">{member.user_name}</p>
                  <p className="masterMemberEmail">{member.user_email}</p>
                  <p className="masterMemberMeta">
                    {(member.user_company || '-')} · {formatDate(member.user_created_at)}
                  </p>
                </div>
                <span className={`masterMemberStatus ${isWarning ? 'warning' : ''}`}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

export default MasterMemberPanel;
