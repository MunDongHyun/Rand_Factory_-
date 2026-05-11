import { useState } from 'react';
import curri_nulll from '../public/curri_null.png';
import curri_icon from '../public/챗봇_아이콘.png'
import '../styles/Curriculum.css';

// 더미 데이터
const DUMMY_CURRICULUMS = [
  {
    id: 1,
    name: '커리큘럼 A',
    description: '마케팅 기초 과정',
    steps: [
      { week: 1, title: '디지털 마케팅 개론', desc: '디지털 전환 시대의 마케팅 패러다임을 이해합니다.' },
      { week: 2, title: '데이터 기반 의사결정', desc: '데이터를 활용한 마케팅 전략 수립 방법을 학습합니다.' },
      { week: 3, title: '콘텐츠 마케팅 전략', desc: '효과적인 콘텐츠 기획과 배포 전략을 익힙니다.' },
      { week: 4, title: '성과 측정 및 최적화', desc: 'KPI 설정과 마케팅 성과 분석 방법을 다룹니다.' },
    ]
  },
  {
    id: 2,
    name: '커리큘럼 B',
    description: '리더십 심화 과정',
    steps: [
      { week: 1, title: '리더십 기초', desc: '현대 조직에서의 리더십 역할을 이해합니다.' },
      { week: 2, title: '팀 커뮤니케이션', desc: '효과적인 팀 내 커뮤니케이션 방법을 학습합니다.' },
      { week: 3, title: '갈등 관리', desc: '조직 내 갈등을 건설적으로 해결하는 방법을 익힙니다.' },
    ]
  },
  {
    id: 3,
    name: '커리큘럼 C',
    description: 'AI 활용 업무 혁신',
    steps: [
      { week: 1, title: 'AI 도구 개요', desc: '업무에 활용 가능한 AI 도구들을 소개합니다.' },
      { week: 2, title: 'ChatGPT 실무 활용', desc: 'ChatGPT를 업무에 적용하는 실전 방법을 다룹니다.' },
      { week: 3, title: '자동화 워크플로우', desc: 'AI 기반 업무 자동화 프로세스를 설계합니다.' },
      { week: 4, title: 'AI 윤리와 한계', desc: 'AI 활용 시 고려해야 할 윤리적 이슈를 다룹니다.' },
    ]
  },
];

function CurriculumView() {
  const [modalOpen, setModalOpen] = useState(false);
  // 더미데이터 
  // const [curriculums, setCurriculums] = useState(DUMMY_CURRICULUMS); 
  // '없을 때' 화면 확인 
  const [curriculums, setCurriculums] = useState([]);
  
  const [selectedId, setSelectedId] = useState(DUMMY_CURRICULUMS[0].id);

  const selectedCurriculum = curriculums.find(c => c.id === selectedId);

  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">커리큘럼 관리</h2>

      {curriculums.length === 0 ? (
        /* ===== 커리큘럼 없을 때 ===== */
        <div className="curriculumEmptyBox">
          <img src={curri_nulll} className="curriculumEmptyImage" alt="없음" />
          <p className="curriculumEmptyText">생성된 커리큘럼이 존재하지 않습니다.</p>
          <button className="curriculumCreateBtn" onClick={() => setModalOpen(true)}>
            커리큘럼 생성하기
          </button>
        </div>
      ) : (
        /* ===== 커리큘럼 있을 때 ===== */
        <div className="curriculumLayout">

          {/* 왼쪽 목록 */}
          <aside className="curriculumSidebar">
            <p className="curriculumSidebarTitle">생성한 커리큘럼</p>
            <div className="curriculumSidebarDivider" />
            <ul className="curriculumSidebarList">
              {curriculums.map(c => (
                <li
                  key={c.id}
                  className={`curriculumSidebarItem ${selectedId === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  {c.name}
                </li>
              ))}
            </ul>
            <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>
              + 새 커리큘럼
            </button>
          </aside>

          {/* 오른쪽 상세 */}
          <div className="curriculumDetail">
            <h3 className="curriculumDetailTitle">{selectedCurriculum.name}</h3>
            <p className="curriculumDetailDesc">{selectedCurriculum.description}</p>
            <div className="curriculumSteps">
              {selectedCurriculum.steps.map((step) => (
                <div key={step.week} className="curriculumStepCard">
                  <div className="stepWeek">{step.week}주차</div>
                  <div className="stepContent">
                    <p className="stepTitle">{step.title}</p>
                    <p className="stepDesc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 챗봇 모달 */}
      {modalOpen && (
        <>
          <div className="chatModalOverlay" onClick={() => setModalOpen(false)} />
          <div className="chatModalContainer">
            <aside className="chatSidebar">
              <p className="chatSidebarTitle">생성한 커리큘럼</p>
              <div className="chatSidebarDivider" />
              <ul className="chatSidebarList">
                {curriculums.map(c => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </aside>
            <div className="chatMain">
              <button className="chatModalClose" onClick={() => setModalOpen(false)}>✕</button>
              <p className="chatMainTitle">AI 챗봇을 활용해 커리큘럼을 구성하세요.</p>
              <div className="chatMessages">
                <div className="chatBotMessage">
                  <div className="chatBotAvatar" />
                  <div className="chatBubble">안녕하세요! 무엇을 도와드릴까요?</div>
                </div>
              </div>
              <div className="chatInputArea">
                <input className="chatInput" type="text" placeholder="메시지를 입력하세요..." />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CurriculumView;