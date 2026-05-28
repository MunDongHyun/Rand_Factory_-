import { forwardRef } from 'react';
import { Line } from 'react-chartjs-2';
import '../lib/chart';
import '../styles/ReportTemplate.css';

// 실제 화면용 컴포넌트가 아니라 html2pdf가 캡처할 인쇄용 리포트 템플릿이다.

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

function formatDelta(compare, unit) {
  // 직전 기간 데이터가 없을 때 무리하게 퍼센트를 만들지 않는다.
  if (!compare) return '직전 기간 데이터 없음';
  const sign = compare.delta > 0 ? '+' : '';
  const pct = compare.pct === null ? '' : ` (${sign}${compare.pct}%)`;
  return `직전 기간 대비 ${sign}${compare.delta.toLocaleString()}${unit}${pct}`;
}

function trendClass(compare) {
  if (!compare || compare.delta === 0) return 'neutral';
  return compare.delta > 0 ? 'up' : 'down';
}

const ReportTemplate = forwardRef(function ReportTemplate(
  {
    title = 'ArtiCulum 운영 보고서',
    period,           // { kind: '주간' | '월간' | '커스텀', start, end }
    stats,            // /users/stats
    curriculumStats,  // /curricula/stats
    signupsTimeline,  // [{ date, count }]
    viewsTimeline,    // [{ date, count }]
    submissionsTimeline, // [{ date, count }]
    comparisons,      // { signups, views, submissions }
    categoryStats,    // [{ category, total_views, article_count }]
    popularArticles,  // [...]
    members,          // [...]
  },
  ref,
) {
  const issuedAt = new Date();

  // 리포트 내부 요약 문장과 KPI는 전달받은 기간 데이터만 기준으로 계산한다.
  const viewsTotal = (viewsTimeline || []).reduce((s, p) => s + p.count, 0);
  const signupsTotal = (signupsTimeline || []).reduce((s, p) => s + p.count, 0);
  const submissionsTotal = (submissionsTimeline || []).reduce((s, p) => s + p.count, 0);

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
  const topCategory = top5Categories[0];
  const topArticle = (popularArticles || [])[0];
  const learnerCount = roleCounts.j || 0;
  const activeLearners = curriculumStats?.active_learners ?? 0;
  const activeLearnerRate = learnerCount > 0 ? Math.round((activeLearners / learnerCount) * 100) : 0;

  const insightItems = [
    `이번 ${period?.kind || '기간'} 신규 가입은 ${signupsTotal.toLocaleString()}명이며 ${formatDelta(comparisons?.signups, '명')}입니다.`,
    `아티클 조회는 ${viewsTotal.toLocaleString()}회로 ${topCategory ? `${topCategory.category} 카테고리의 관심이 가장 높습니다.` : '상위 카테고리 데이터가 아직 없습니다.'}`,
    `진행 중 학습자는 ${activeLearners.toLocaleString()}명이며, 학습 제출은 운영 참고 지표로만 확인합니다.`,
  ];

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
            <p className="reportEyebrow">ArtiCulum</p>
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
              <p className={`reportKpiTrend ${trendClass(comparisons?.signups)}`}>
                {formatDelta(comparisons?.signups, '명')}
              </p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">기간 내 아티클 조회</p>
              <p className="reportKpiValue">{viewsTotal.toLocaleString()}</p>
              <p className="reportKpiUnit">회</p>
              <p className={`reportKpiTrend ${trendClass(comparisons?.views)}`}>
                {formatDelta(comparisons?.views, '회')}
              </p>
            </div>
            <div className="reportKpi">
              <p className="reportKpiLabel">기간 내 학습 제출</p>
              <p className="reportKpiValue">{submissionsTotal.toLocaleString()}</p>
              <p className="reportKpiUnit">건</p>
              <p className={`reportKpiTrend ${trendClass(comparisons?.submissions)}`}>
                {formatDelta(comparisons?.submissions, '건')}
              </p>
            </div>
          </div>
        </section>

        <section className="reportSection">
          <h2 className="reportSectionTitle">운영 요약</h2>
          <div className="reportInsightGrid">
            {insightItems.map((item) => (
              <p key={item} className="reportInsight">{item}</p>
            ))}
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
            <p className="reportNote">
              학습자 대비 진행 중 학습자 비중: <strong>{activeLearnerRate}%</strong>
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
                  <th className="reportColW8">순위</th>
                  <th>카테고리</th>
                  <th className="reportColW20 reportAlignRight">조회수</th>
                  <th className="reportColW15 reportAlignRight">비중</th>
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
                      <td className="reportAlignRight">{(c.total_views || 0).toLocaleString()}</td>
                      <td className="reportAlignRight">{pct}%</td>
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
                  <th className="reportColW8">순위</th>
                  <th>제목</th>
                  <th className="reportColW20">카테고리</th>
                  <th className="reportColW15 reportAlignRight">조회수</th>
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
                    <td className="reportAlignRight">{(a.article_view_count || 0).toLocaleString()}</td>
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
          <div className="reportSubBlock">
            <p className="reportChartLabel">운영 참고</p>
            <ul className="reportActionList">
              <li>상위 관심 카테고리 기반으로 다음 추천 콘텐츠를 보강합니다.</li>
              <li>학습 제출은 마스터 화면의 핵심 관리 지표가 아닌 서비스 활성 보조 지표로 해석합니다.</li>
              <li>{topArticle ? `"${topArticle.article_title}" 반응을 후속 커리큘럼 소재로 검토합니다.` : '인기 아티클 데이터가 쌓이면 후속 커리큘럼 소재를 선정합니다.'}</li>
            </ul>
          </div>
        </section>

        <footer className="reportFooter">
          본 보고서는 ArtiCulum 시스템에서 자동 생성되었습니다.
        </footer>
      </div>
    </div>
  );
});

export default ReportTemplate;
