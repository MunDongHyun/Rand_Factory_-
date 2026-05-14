import { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import api from '../lib/api';
import '../styles/MasterDashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const DOUGHNUT_COLORS = [
  '#4a8fd0',
  '#8a5cf0',
  '#f0735c',
  '#5cc4f0',
  '#f0c95c',
  '#5cf0a8',
  '#f05ca8',
  '#a8a8a8',
];

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

  const [popularArticles, setPopularArticles] = useState([]);
  const [popularError, setPopularError] = useState(null);

  const [curriculumStats, setCurriculumStats] = useState(null);
  const [curriculumStatsError, setCurriculumStatsError] = useState(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');

  useEffect(() => {
    api.get('/users/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setStatsError(err.response?.data?.detail || '통계를 불러오지 못했어요.'));

    api.get('/articles/stats/by-category')
      .then((res) => setCategoryStats(res.data.items || []))
      .catch((err) => setCategoryError(err.response?.data?.detail || '카테고리 통계를 불러오지 못했어요.'));

    api.get('/articles/popular', { params: { limit: 5 } })
      .then((res) => setPopularArticles(res.data || []))
      .catch((err) => setPopularError(err.response?.data?.detail || '인기 아티클을 불러오지 못했어요.'));

    api.get('/curricula/stats')
      .then((res) => setCurriculumStats(res.data))
      .catch((err) => setCurriculumStatsError(err.response?.data?.detail || '커리큘럼 통계를 불러오지 못했어요.'));
  }, []);

  const filteredMembers = members.filter((m) => {
    if (memberRoleFilter !== 'all') {
      if (memberRoleFilter === 'deleted') {
        if (!m.user_deleted_at) return false;
      } else {
        if (m.user_deleted_at) return false;
        if (m.user_role !== memberRoleFilter) return false;
      }
    } else {
      // 'all' 일 때는 탈퇴 포함
    }
    if (memberSearch.trim()) {
      const q = memberSearch.trim().toLowerCase();
      const hay = `${m.user_name || ''} ${m.user_email || ''} ${m.user_company || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!memberPanelOpen || members.length > 0) return;
    setMembersLoading(true);
    api.get('/users', { params: { limit: 50 } })
      .then((res) => setMembers(res.data.users || []))
      .catch((err) => setMembersError(err.response?.data?.detail || '회원 목록을 불러오지 못했어요.'))
      .finally(() => setMembersLoading(false));
  }, [memberPanelOpen, members.length]);

  const topCategoryTotal = categoryStats.reduce((sum, c) => sum + c.total_views, 0);

  const topCategories = categoryStats.slice(0, 5);
  const doughnutData = {
    labels: topCategories.map((c) => c.category),
    datasets: [
      {
        data: topCategories.map((c) => c.total_views),
        backgroundColor: DOUGHNUT_COLORS.slice(0, topCategories.length),
        borderColor: 'rgba(10, 14, 20, 0.9)',
        borderWidth: 3,
        hoverOffset: 10,
        hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
      },
    ],
  };
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: 'rgba(255, 255, 255, 0.85)',
          font: { size: 13, family: 'Pretendard', weight: '500' },
          padding: 14,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 20, 28, 0.95)',
        titleColor: '#ffffff',
        bodyColor: 'rgba(255, 255, 255, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed;
            const pct = topCategoryTotal > 0 ? Math.round((value / topCategoryTotal) * 100) : 0;
            return ` ${ctx.label}: ${value.toLocaleString()}회 (${pct}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };

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


        {/* 학습 활동 현황 */}
        <h2 className="masterSectionTitleTop">학습 활동 현황</h2>
        {curriculumStatsError && <p className="masterError">{curriculumStatsError}</p>}
        <div className="masterStatCards">
          <div className="masterStatCard">
            <p className="masterStatLabel">총 커리큘럼 수</p>
            <p className="masterStatValue">
              {curriculumStats ? curriculumStats.total_curricula.toLocaleString() : '-'}
            </p>
          </div>
          <div className="masterStatCard">
            <p className="masterStatLabel">진행 중 학습자 수</p>
            <p className="masterStatValue">
              {curriculumStats ? curriculumStats.active_learners.toLocaleString() : '-'}
            </p>
          </div>
          <div className="masterStatCard">
            <p className="masterStatLabel">누적 과제 제출 수</p>
            <p className="masterStatValue">
              {curriculumStats ? curriculumStats.total_submissions.toLocaleString() : '-'}
            </p>
          </div>
        </div>


        {/* 아티클 조회수 */}
        <h2 className="masterSectionTitle">아티클 조회수</h2>
        {categoryError && <p className="masterError">{categoryError}</p>}
        <div className="masterChartRow">
          <div className="masterChartBox">
            <p className="masterChartLabel">카테고리별 조회수 (TOP {Math.min(categoryStats.length, 5)})</p>
            <div className="masterDoughnutWrap">
              {categoryStats.length === 0 ? (
                <p className="masterChartEmpty">데이터 없음</p>
              ) : (
                <Doughnut data={doughnutData} options={doughnutOptions} />
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

        {/* 인기 아티클 TOP 5 */}
        <h2 className="masterSectionTitle">인기 아티클 TOP 5</h2>
        {popularError && <p className="masterError">{popularError}</p>}
        <div className="masterPopularGrid">
          {popularArticles.length === 0 && !popularError ? (
            <p className="masterChartEmpty">데이터 없음</p>
          ) : (
            popularArticles.map((article, idx) => (
              <div key={article.article_id} className="masterPopularCard">
                <div className="masterPopularRank">{idx + 1}</div>
                {article.article_thumbnail_url ? (
                  <img
                    className="masterPopularThumb"
                    src={article.article_thumbnail_url}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="masterPopularThumbPlaceholder" />
                )}
                <div className="masterPopularBody">
                  <span className="masterPopularCategory"># {article.article_category || '기타'}</span>
                  <p className="masterPopularTitle">{article.article_title}</p>
                  <p className="masterPopularViews">
                    {(article.article_view_count ?? 0).toLocaleString()}회 조회
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 서비스 이용 만족도 */}
        <h2 className="masterSectionTitle">서비스 이용 만족도</h2>
        <div className="masterSatisfactionBox">
          <p className="masterSatisfactionText">
            만족도 · 의견 수집 기능은 추후 추가 예정입니다
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
                <option value="j">학습자</option>
                <option value="deleted">탈퇴</option>
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
