import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import api from '../lib/api';
import '../styles/MasterDashboard.css';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

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
  const [memberSort, setMemberSort] = useState('created_desc'); // created_desc | created_asc | name_asc | name_desc | role

  // 회원 상세 모달
  const [detailMember, setDetailMember] = useState(null);     // UserResponse (선택된 회원)
  const [detailSummary, setDetailSummary] = useState(null);   // UserActivitySummary
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);   // { kind: 'delete' | 'restore', message }

  const [viewsTimeline, setViewsTimeline] = useState([]);
  const [signupsTimeline, setSignupsTimeline] = useState([]);
  const [timelineDays, setTimelineDays] = useState(14);
  const [timelineError, setTimelineError] = useState(null);

  useEffect(() => {
    setTimelineError(null);
    Promise.all([
      api.get('/articles/stats/views-timeline', { params: { days: timelineDays } })
        .then((res) => setViewsTimeline(res.data.items || []))
        .catch((err) => {
          setViewsTimeline([]);
          setTimelineError(err.response?.data?.detail || '추이 데이터를 불러오지 못했어요.');
        }),
      api.get('/users/stats/signups-timeline', { params: { days: timelineDays } })
        .then((res) => setSignupsTimeline(res.data.items || []))
        .catch(() => setSignupsTimeline([])),
    ]);
  }, [timelineDays]);

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

  const ROLE_ORDER = { a: 0, m: 1, j: 2 };

  const filteredMembers = members
    .filter((m) => {
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
    })
    .sort((a, b) => {
      switch (memberSort) {
        case 'created_asc': {
          const ta = new Date(a.user_created_at || 0).getTime();
          const tb = new Date(b.user_created_at || 0).getTime();
          return ta - tb;
        }
        case 'name_asc':
          return (a.user_name || '').localeCompare(b.user_name || '', 'ko');
        case 'name_desc':
          return (b.user_name || '').localeCompare(a.user_name || '', 'ko');
        case 'role': {
          const ra = a.user_deleted_at ? 3 : (ROLE_ORDER[a.user_role] ?? 9);
          const rb = b.user_deleted_at ? 3 : (ROLE_ORDER[b.user_role] ?? 9);
          if (ra !== rb) return ra - rb;
          return (a.user_name || '').localeCompare(b.user_name || '', 'ko');
        }
        case 'created_desc':
        default: {
          const ta = new Date(a.user_created_at || 0).getTime();
          const tb = new Date(b.user_created_at || 0).getTime();
          return tb - ta;
        }
      }
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

  // 시계열 라인 차트
  const timelineLabels = (viewsTimeline.length ? viewsTimeline : signupsTimeline)
    .map((p) => {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) return p.date;
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });

  const buildLineData = (items, color) => ({
    labels: timelineLabels,
    datasets: [
      {
        data: items.map((p) => p.count),
        borderColor: color,
        backgroundColor: color + '33',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: '#0a0e14',
        pointBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  });

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 20, 28, 0.95)',
        titleColor: '#ffffff',
        bodyColor: 'rgba(255, 255, 255, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: { size: 11, family: 'Pretendard' },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.06)', drawBorder: false },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: { size: 11, family: 'Pretendard' },
          precision: 0,
          stepSize: 1,
        },
      },
    },
  };

  const viewsTotal = viewsTimeline.reduce((sum, p) => sum + p.count, 0);
  const signupsTotal = signupsTimeline.reduce((sum, p) => sum + p.count, 0);

  const openMemberDetail = (member) => {
    setDetailMember(member);
    setDetailSummary(null);
    setDetailError(null);
    setDetailLoading(true);
    api.get(`/users/${member.user_id}/activity-summary`)
      .then((res) => setDetailSummary(res.data))
      .catch((err) => setDetailError(err.response?.data?.detail || '활동 요약을 불러오지 못했어요.'))
      .finally(() => setDetailLoading(false));
  };

  const closeMemberDetail = () => {
    setDetailMember(null);
    setDetailSummary(null);
    setDetailError(null);
    setConfirmDialog(null);
  };

  const handleRoleChange = async (newRole) => {
    if (!detailMember) return;
    if (newRole === detailMember.user_role) return;
    setActionSaving(true);
    try {
      const res = await api.patch(`/users/${detailMember.user_id}`, { user_role: newRole });
      setDetailMember(res.data);
      setMembers((prev) => prev.map((m) => (m.user_id === res.data.user_id ? res.data : m)));
    } catch (err) {
      alert(err.response?.data?.detail || '역할 변경에 실패했습니다.');
    } finally {
      setActionSaving(false);
    }
  };

  const handleDeleteRestore = async (isDelete) => {
    if (!detailMember) return;
    setActionSaving(true);
    try {
      const res = await api.patch(`/users/${detailMember.user_id}`, { is_deleted: isDelete });
      setDetailMember(res.data);
      setMembers((prev) => prev.map((m) => (m.user_id === res.data.user_id ? res.data : m)));
      setConfirmDialog(null);
    } catch (err) {
      alert(err.response?.data?.detail || '처리에 실패했습니다.');
    } finally {
      setActionSaving(false);
    }
  };

  const isSelf = detailMember && user && detailMember.user_id === user.user_id;
  const isDeleted = detailMember?.user_deleted_at;

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


        {/* 최근 활동 추이 (라인 차트) */}
        <div className="masterTimelineHeaderRow">
          <h2 className="masterSectionTitle">최근 활동 추이</h2>
          <div className="masterTimelineRangeBtns">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className={`masterTimelineRangeBtn ${timelineDays === d ? 'active' : ''}`}
                onClick={() => setTimelineDays(d)}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>
        {timelineError && <p className="masterError">{timelineError}</p>}
        <div className="masterTimelineRow">
          <div className="masterChartBox">
            <div className="masterTimelineBoxHeader">
              <p className="masterChartLabel">아티클 조회 추이</p>
              <span className="masterTimelineTotal">총 {viewsTotal.toLocaleString()}회</span>
            </div>
            <div className="masterTimelineWrap">
              {viewsTimeline.length === 0 ? (
                <p className="masterChartEmpty">데이터 없음</p>
              ) : (
                <Line data={buildLineData(viewsTimeline, '#4a8fd0')} options={lineOptions} />
              )}
            </div>
          </div>
          <div className="masterChartBox">
            <div className="masterTimelineBoxHeader">
              <p className="masterChartLabel">신규 가입자 추이</p>
              <span className="masterTimelineTotal">총 {signupsTotal.toLocaleString()}명</span>
            </div>
            <div className="masterTimelineWrap">
              {signupsTimeline.length === 0 ? (
                <p className="masterChartEmpty">데이터 없음</p>
              ) : (
                <Line data={buildLineData(signupsTimeline, '#5cf0a8')} options={lineOptions} />
              )}
            </div>
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
      )}

      {/* 회원 상세 모달 */}
      {detailMember && (
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

            {/* 활동 요약 */}
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

            {/* 역할 변경 */}
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

            {/* 강제 탈퇴 / 복구 */}
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
        </>
      )}

      {/* 확인 다이얼로그 */}
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
    </div>
  );
}

export default MasterDashboard;
