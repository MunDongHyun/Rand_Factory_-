import { useEffect, useState } from 'react';
import api from '../lib/api';
import '../styles/MasterDashboard.css';

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
  return '학습자';
}

function MasterDashboard({ user, onLogout }) {
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(null);

  const [categoryStats, setCategoryStats] = useState([]);
  const [categoryError, setCategoryError] = useState(null);

  useEffect(() => {
    api.get('/users/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setStatsError(err.response?.data?.detail || '통계를 불러오지 못했어요.'));

    api.get('/articles/stats/by-category')
      .then((res) => setCategoryStats(res.data.items || []))
      .catch((err) => setCategoryError(err.response?.data?.detail || '카테고리 통계를 불러오지 못했어요.'));
  }, []);

  useEffect(() => {
    if (!memberPanelOpen || members.length > 0) return;
    setMembersLoading(true);
    api.get('/users', { params: { limit: 50 } })
      .then((res) => setMembers(res.data.users || []))
      .catch((err) => setMembersError(err.response?.data?.detail || '회원 목록을 불러오지 못했어요.'))
      .finally(() => setMembersLoading(false));
  }, [memberPanelOpen, members.length]);

  const topCategoryTotal = categoryStats.reduce((sum, c) => sum + c.total_views, 0);

  return (
    <div className="masterContainer">

      {/* 헤더 */}
      <header className="masterHeader">
        <div className="masterLogo">LANDFACTORY</div>
        <button className="masterMemberBtn" onClick={() => setMemberPanelOpen(true)}>
          회원관리
        </button>
      </header>
      <div className="masterHeaderLine" />

      {/* 메인 콘텐츠 */}
      <main className="masterMain">

        {/* 등록된 사용자 현황 */}
        <h2 className="masterSectionTitleTop">등록된 사용자 현황</h2>
        {statsError && <p className="masterError">{statsError}</p>}
        <div className="masterStatCards">
          <div className="masterStatCard">
            <p className="masterStatLabel">총 사용자 개수 (계정)</p>
            <p className="masterStatValue">{stats ? stats.total_users.toLocaleString() : '-'}</p>
          </div>
          <div className="masterStatCard">
            <p className="masterStatLabel">이번 달 가입자 수</p>
            <p className="masterStatValue">{stats ? stats.monthly_signups.toLocaleString() : '-'}</p>
          </div>
          <div className="masterStatCard">
            <p className="masterStatLabel">가장 많은 회사</p>
            <p className="masterStatValue">{stats?.top_company || '-'}</p>
          </div>
        </div>

        <br></br>

        {/* 아티클 조회수 */}
        <h2 className="masterSectionTitle">아티클 조회수</h2>
        {categoryError && <p className="masterError">{categoryError}</p>}
        <div className="masterChartRow">
          <div className="masterChartBox">
            <p className="masterChartLabel">카테고리별 조회수 (TOP {Math.min(categoryStats.length, 5)})</p>
            <div className="masterChartPlaceholder">
              {categoryStats.length === 0 ? (
                <p className="masterChartEmpty">데이터 없음</p>
              ) : (
                <ul className="masterCategoryList">
                  {categoryStats.slice(0, 5).map((c) => {
                    const pct = topCategoryTotal > 0 ? Math.round((c.total_views / topCategoryTotal) * 100) : 0;
                    return (
                      <li key={c.category}>
                        <div className="masterCategoryRow">
                          <span className="masterCategoryName"># {c.category}</span>
                          <span className="masterCategoryViews">{c.total_views.toLocaleString()}회</span>
                        </div>
                        <div className="masterCategoryBar">
                          <div className="masterCategoryBarFill" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <div className="masterChartBox">
            <p className="masterChartLabel">카테고리별 아티클 수</p>
            <div className="masterChartPlaceholder">
              {categoryStats.length === 0 ? (
                <p className="masterChartEmpty">데이터 없음</p>
              ) : (
                <ul className="masterCategoryList">
                  {categoryStats.map((c) => (
                    <li key={c.category}>
                      <div className="masterCategoryRow">
                        <span className="masterCategoryName"># {c.category}</span>
                        <span className="masterCategoryViews">{c.article_count}개</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 서비스 이용 만족도 */}
        <h3 className="masterSectionTitleTop">"☆☆☆☆☆"</h3>
        <div className="masterSatisfactionBox">
          <p className="masterSatisfactionText">
            만족도 / 의견 수집 기능은 추후 추가 예정입니다.
          </p>
        </div>

      </main>

      {/* 회원관리 오버레이 */}
      {memberPanelOpen && (
        <>
          <div className="masterPanelOverlay" onClick={() => setMemberPanelOpen(false)} />
          <aside className="masterMemberPanel">
            <div className="masterPanelHeader">
              <h2 className="sectionTitle">회원관리</h2>
              <button className="masterdrawerLogout" onClick={onLogout}>
                로그아웃
              </button>
            </div>

            <div className="masterPanelContent">
              {membersLoading && <p className="masterLoading">회원 목록 불러오는 중...</p>}
              {membersError && <p className="masterError">{membersError}</p>}
              {!membersLoading && !membersError && members.length === 0 && (
                <p className="masterLoading">표시할 회원이 없습니다.</p>
              )}
              {members.map((member) => {
                const status = statusFor(member);
                const isWarning = status === '탈퇴';
                return (
                  <div key={member.user_id} className={`masterMemberRow ${isWarning ? 'warning' : ''}`}>
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
      )}
    </div>
  );
}

export default MasterDashboard;
