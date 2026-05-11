import { useState } from 'react';
import '../styles/MasterDashboard.css';

const DUMMY_STATS = {
  totalUsers: 1284,
  monthlyUsers: 342,
  topIndustry: '마케팅',
};

const DUMMY_MEMBERS = Array(10).fill(null).map((_, i) => ({
  id: i + 1,
  name: `사용자 ${i + 1}`,
  email: `user${i + 1}@company.com`,
  industry: ['마케팅', '전략', 'AI', '리더십', '세일즈'][i % 5],
  joinDate: '2025.01.01',
  status: i % 7 === 0 ? '경고' : '정상',
}));

function MasterDashboard({ user, onLogout }) {
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);

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
        <div className="masterStatCards">
          <div className="masterStatCard">
            <p className="masterStatLabel">총 사용자 개수 (계정)</p>
            <p className="masterStatValue">{DUMMY_STATS.totalUsers.toLocaleString()}</p>
          </div>
          <div className="masterStatCard">
            <p className="masterStatLabel">월별 사용자 계정 개수</p>
            <p className="masterStatValue">{DUMMY_STATS.monthlyUsers.toLocaleString()}</p>
          </div>
          <div className="masterStatCard">
            <p className="masterStatLabel">가장 많은 산업군 사용자?</p>
            <p className="masterStatValue">{DUMMY_STATS.topIndustry}</p>
          </div>
        </div>

        <br></br>

        {/* 아티클 조회수 */}
        <h2 className="masterSectionTitle">아티클 조회수</h2>
        <div className="masterChartRow">
          <div className="masterChartBox">
            <p className="masterChartLabel">월별 높은 아티클 조회수 도넛 차트</p>
            {/* 차트 자리 */}
            <div className="masterChartPlaceholder" />
          </div>
          <div className="masterChartBox">
            <p className="masterChartLabel">상세 디테일 내용?</p>
            <div className="masterChartPlaceholder" />
          </div>
        </div>

        {/* 서비스 이용 만족도 */}
        <h3 className="masterSectionTitleTop">"☆☆☆☆☆"</h3>
        <div className="masterSatisfactionBox">
          <p className="masterSatisfactionText">
            불만이나 서비스에 대한 의견이 있다면 이곳에 출력이 된다
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
              {DUMMY_MEMBERS.map((member) => (
                <div key={member.id} className={`masterMemberRow ${member.status === '경고' ? 'warning' : ''}`}>
                  <div className="masterMemberInfo">
                    <p className="masterMemberName">{member.name}</p>
                    <p className="masterMemberEmail">{member.email}</p>
                    <p className="masterMemberMeta">{member.industry} · {member.joinDate}</p>
                  </div>
                  <span className={`masterMemberStatus ${member.status === '경고' ? 'warning' : ''}`}>
                    {member.status}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default MasterDashboard;