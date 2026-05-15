import { forwardRef } from 'react';
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
import { Line } from 'react-chartjs-2';
import '../styles/ReportTemplate.css';

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

function formatDateKor(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDateShort(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const ROLE_LABEL = { a: '관리자', m: '매니저', j: '학습자' };

const ReportTemplate = forwardRef(function ReportTemplate(
  {
    title = 'LANDFACTORY 운영 보고서',
    period,           // { kind: '주간' | '월간' | '커스텀', start, end }
    stats,            // /users/stats
    curriculumStats,  // /curricula/stats
    signupsTimeline,  // [{ date, count }]
    viewsTimeline,    // [{ date, count }]
    categoryStats,    // [{ category, total_views, article_count }]
    popularArticles,  // [...]
    members,          // [...]
  },
  ref,
) {
  const issuedAt = new Date();

  const viewsTotal = (viewsTimeline || []).reduce((s, p) => s + p.count, 0);
  const signupsTotal = (signupsTimeline || []).reduce((s, p) => s + p.count, 0);

  const roleCounts = (members || []).reduce(
    (acc, m) => {
      if (m.user_deleted_at) {
        acc.deleted += 1;
      } else {
        acc[m.user_role] = (acc[m.user_role] || 0) + 1;
      }
      return acc;
    },
    { a: 0, m: 0, j: 0, deleted: 0 },
  );

  const categoryTotal = (categoryStats || []).reduce((s, c) => s + (c.total_views || 0), 0);
  const top5Categories = (categoryStats || []).slice(0, 5);

  const buildLineData = (items, color) => ({
    labels: (items || []).map((p) => formatDateShort(p.date)),
    datasets: [
      {
        data: (items || []).map((p) => p.count),
        borderColor: color,
        backgroundColor: color + '33',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
      },
    ],
  });

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#666', font: { size: 9, family: 'Pretendard' }, maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#eee' },
        ticks: { color: '#666', font: { size: 9, family: 'Pretendard' }, precision: 0, stepSize: 1 },
      },
    },
  };

  return (
    <div ref={ref} className="reportRoot">
      {/* ===== PAGE 1 ===== */}
      <div className="reportPage">
        <header className="reportHeader">
          <div>
            <p className="reportEyebrow">LANDFACTORY</p>
            <h1 className="reportTitle">{title}</h1>
          </div>
          <div className="reportHeaderRight">
            <p className="reportMetaLine">{period?.kind || '주간'} 보고서</p>
            <p className="reportMetaLine">
              기간: {formatDateKor(period?.start)} ~ {formatDateKor(period?.end)}
            </p>
            <p className="reportMetaLineSmall">발행: {formatDateKor(issuedAt)}</p>
          </div>
        </header>

        {/* 핵심 지표 */}
        <section className="reportSection">
          <h2 className="reportSectionTitle">핵심 지표</h2>
          <div className="reportKpiGrid">
            <div className="reportKpi">
              <p className="reportKpiLabel">총 회원</p>
              <p className="reportKpiValue">{(stats?.total_users ?? 0).toLocaleString()}</p>
              <p className="reportKpiUnit">명</p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">기간 내 신규 가입</p>
              <p className="reportKpiValue">{signupsTotal.toLocaleString()}</p>
              <p className="reportKpiUnit">명</p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">기간 내 아티클 조회</p>
              <p className="reportKpiValue">{viewsTotal.toLocaleString()}</p>
              <p className="reportKpiUnit">회</p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">누적 과제 제출</p>
              <p className="reportKpiValue">{(curriculumStats?.total_submissions ?? 0).toLocaleString()}</p>
              <p className="reportKpiUnit">건</p>
            </div>
          </div>
        </section>

        {/* 회원 동향 */}
        <section className="reportSection">
          <h2 className="reportSectionTitle">회원 동향</h2>
          <div className="reportChartBlock">
            <p className="reportChartLabel">신규 가입자 추이</p>
            <div className="reportChartWrap">
              {(signupsTimeline || []).length === 0 ? (
                <p className="reportChartEmpty">데이터 없음</p>
              ) : (
                <Line data={buildLineData(signupsTimeline, '#1a7f37')} options={lineOptions} />
              )}
            </div>
          </div>
          <div className="reportSubBlock">
            <p className="reportChartLabel">회원 구성</p>
            <div className="reportRolePillRow">
              <span className="reportRolePill">관리자 {roleCounts.a}명</span>
              <span className="reportRolePill">매니저 {roleCounts.m}명</span>
              <span className="reportRolePill">학습자 {roleCounts.j}명</span>
              {roleCounts.deleted > 0 && (
                <span className="reportRolePill warn">탈퇴 {roleCounts.deleted}명</span>
              )}
            </div>
            <p className="reportNote">
              가장 많은 회사: <strong>{stats?.top_company || '-'}</strong>
            </p>
          </div>
        </section>
      </div>

      {/* ===== PAGE 2 ===== */}
      <div className="reportPage">
        {/* 콘텐츠 동향 */}
        <section className="reportSection">
          <h2 className="reportSectionTitle">콘텐츠 동향</h2>
          <div className="reportChartBlock">
            <p className="reportChartLabel">아티클 조회 추이</p>
            <div className="reportChartWrap">
              {(viewsTimeline || []).length === 0 ? (
                <p className="reportChartEmpty">데이터 없음</p>
              ) : (
                <Line data={buildLineData(viewsTimeline, '#0366d6')} options={lineOptions} />
              )}
            </div>
          </div>

          <div className="reportSubBlock">
            <p className="reportChartLabel">카테고리별 조회 TOP 5</p>
            <table className="reportTable">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>순위</th>
                  <th>카테고리</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>조회수</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>비중</th>
                </tr>
              </thead>
              <tbody>
                {top5Categories.length === 0 && (
                  <tr><td colSpan="4" className="reportTableEmpty">데이터 없음</td></tr>
                )}
                {top5Categories.map((c, i) => {
                  const pct = categoryTotal > 0 ? Math.round((c.total_views / categoryTotal) * 100) : 0;
                  return (
                    <tr key={c.category}>
                      <td>{i + 1}</td>
                      <td>{c.category}</td>
                      <td style={{ textAlign: 'right' }}>{(c.total_views || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="reportSubBlock">
            <p className="reportChartLabel">인기 아티클 TOP 5</p>
            <table className="reportTable">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>순위</th>
                  <th>제목</th>
                  <th style={{ width: '20%' }}>카테고리</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>조회수</th>
                </tr>
              </thead>
              <tbody>
                {(popularArticles || []).length === 0 && (
                  <tr><td colSpan="4" className="reportTableEmpty">데이터 없음</td></tr>
                )}
                {(popularArticles || []).slice(0, 5).map((a, i) => (
                  <tr key={a.article_id}>
                    <td>{i + 1}</td>
                    <td className="reportTableTitle">{a.article_title}</td>
                    <td>{a.article_category || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{(a.article_view_count || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 학습 활동 */}
        <section className="reportSection">
          <h2 className="reportSectionTitle">학습 활동</h2>
          <div className="reportKpiGrid reportKpiGridSm">
            <div className="reportKpi">
              <p className="reportKpiLabel">총 커리큘럼</p>
              <p className="reportKpiValue">{(curriculumStats?.total_curricula ?? 0).toLocaleString()}</p>
              <p className="reportKpiUnit">개</p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">진행 중 학습자</p>
              <p className="reportKpiValue">{(curriculumStats?.active_learners ?? 0).toLocaleString()}</p>
              <p className="reportKpiUnit">명</p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">누적 과제 제출</p>
              <p className="reportKpiValue">{(curriculumStats?.total_submissions ?? 0).toLocaleString()}</p>
              <p className="reportKpiUnit">건</p>
            </div>
          </div>
        </section>

        <footer className="reportFooter">
          본 보고서는 LANDFACTORY 시스템에서 자동 생성되었습니다.
        </footer>
      </div>
    </div>
  );
});

export default ReportTemplate;
