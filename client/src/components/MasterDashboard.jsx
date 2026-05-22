import { useEffect, useRef, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import '../lib/chart';
import api from '../lib/api';
import ReportTemplate from './ReportTemplate';
import MasterMemberPanel from './master/MasterMemberPanel';
import MasterMemberDetailModal from './master/MasterMemberDetailModal';
import MasterArticleCreateModal from './master/MasterArticleCreateModal';
import '../styles/MasterDashboard.css';

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

function MasterDashboard({ user, onLogout }) {
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [articleCreateOpen, setArticleCreateOpen] = useState(false);

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

  // 보고서 PDF 다운로드
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const reportRef = useRef(null);

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

  const ROLE_ORDER = { a: 0, m: 1, j: 2, c: 3 };

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
      toast.error(err.response?.data?.detail || '역할 변경에 실패했습니다.');
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
      toast.error(err.response?.data?.detail || '처리에 실패했습니다.');
    } finally {
      setActionSaving(false);
    }
  };

  const isSelf = detailMember && user && detailMember.user_id === user.user_id;
  const isDeleted = detailMember?.user_deleted_at;

  const handleDownloadReport = async (kind /* 'weekly' | 'monthly' */) => {
    if (reportGenerating) return;
    setReportGenerating(true);
    try {
      const days = kind === 'monthly' ? 30 : 7;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days + 1);

      const tasks = [
        api.get('/users/stats/signups-timeline', { params: { days } }).then((r) => r.data.items || []),
        api.get('/articles/stats/views-timeline', { params: { days } }).then((r) => r.data.items || []),
      ];

      if (members.length === 0) {
        tasks.push(
          api.get('/users', { params: { limit: 200 } }).then((r) => r.data.users || []),
        );
      }

      const results = await Promise.all(tasks);
      const reportSignups = results[0];
      const reportViews = results[1];
      const reportMembers = results[2] || members;

      setReportData({
        period: {
          kind: kind === 'monthly' ? '월간' : '주간',
          start,
          end,
        },
        stats,
        curriculumStats,
        signupsTimeline: reportSignups,
        viewsTimeline: reportViews,
        categoryStats,
        popularArticles,
        members: reportMembers,
      });

      // ReportTemplate가 마운트되고 차트가 그려질 시간 확보
      await new Promise((resolve) => setTimeout(resolve, 600));

      const element = reportRef.current;
      if (!element) throw new Error('보고서 영역을 찾지 못했습니다.');

      const filename = `landfactory_${kind}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const html2pdf = (await import('html2pdf.js')).default;

      await html2pdf()
        .from(element)
        .set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: '.reportPage:not(:first-child)',
          },
        })
        .save();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'PDF 생성에 실패했습니다.');
    } finally {
      setReportData(null);
      setReportGenerating(false);
    }
  };

  return (
    <div className="masterContainer">

      {/* 헤더 */}
      <header className="masterHeader">
        <div className="masterLogo">LANDFACTORY</div>
        <div className="masterHeaderActions">
          <button
            className="masterReportBtn"
            onClick={() => handleDownloadReport('weekly')}
            disabled={reportGenerating}
            title="최근 7일 운영 보고서 PDF 다운로드"
          >
            {reportGenerating ? '생성 중...' : '주간 PDF'}
          </button>
          <button
            className="masterReportBtn"
            onClick={() => handleDownloadReport('monthly')}
            disabled={reportGenerating}
            title="최근 30일 운영 보고서 PDF 다운로드"
          >
            {reportGenerating ? '생성 중...' : '월간 PDF'}
          </button>
          <button className="masterMemberBtn" onClick={() => setArticleCreateOpen(true)}>
            아티클 등록
          </button>
          <button className="masterMemberBtn" onClick={() => setMemberPanelOpen(true)}>
            회원관리
          </button>
        </div>
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
        <MasterMemberPanel
          onClose={() => setMemberPanelOpen(false)}
          onLogout={onLogout}
          memberSearch={memberSearch}
          setMemberSearch={setMemberSearch}
          memberRoleFilter={memberRoleFilter}
          setMemberRoleFilter={setMemberRoleFilter}
          memberSort={memberSort}
          setMemberSort={setMemberSort}
          filteredMembers={filteredMembers}
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          openMemberDetail={openMemberDetail}
        />
      )}

      {/* 회원 상세 모달 */}
      {detailMember && (
        <MasterMemberDetailModal
          detailMember={detailMember}
          detailSummary={detailSummary}
          detailLoading={detailLoading}
          detailError={detailError}
          isSelf={isSelf}
          isDeleted={isDeleted}
          actionSaving={actionSaving}
          confirmDialog={confirmDialog}
          setConfirmDialog={setConfirmDialog}
          closeMemberDetail={closeMemberDetail}
          handleRoleChange={handleRoleChange}
          handleDeleteRestore={handleDeleteRestore}
        />
      )}

      {/* 아티클 등록 패널 */}
      <MasterArticleCreateModal
        open={articleCreateOpen}
        onClose={() => setArticleCreateOpen(false)}
        onCreated={(newArticle) => {
          // 카테고리 통계는 다음 자연스러운 새로고침에 반영. 토스트만 표시.
        }}
      />

      {/* 보고서 (offscreen, html2pdf 캡처용) */}
      {reportData && (
        <div className="masterReportOffscreen" aria-hidden="true">
          <ReportTemplate ref={reportRef} {...reportData} />
        </div>
      )}

    </div>
  );
}

export default MasterDashboard;
