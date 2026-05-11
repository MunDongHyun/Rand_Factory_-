import { useState } from 'react';
import curri_nulll from '../public/curri_null.png';
import '../styles/Curriculum.css';

const DUMMY_CURRICULUMS = [
  {
    id: 1,
    name: '커리큘럼 A',
    description: '마케팅 기초 과정',
    steps: [
      { week: 1, theme: 'targetjob | target industry', task: '디지털 마케팅 개론' },
      { week: 2, theme: 'targetjob | target industry', task: '데이터 기반 의사결정' },
      { week: 3, theme: 'targetjob | target industry', task: '콘텐츠 마케팅 전략' },
      { week: 4, theme: 'targetjob | target industry', task: '성과 측정 및 최적화' },
    ]
  },
  {
    id: 2,
    name: '커리큘럼 B',
    description: '리더십 심화 과정',
    steps: [
      { week: 1, theme: 'targetjob | target industry', task: '리더십 기초' },
      { week: 2, theme: 'targetjob | target industry', task: '팀 커뮤니케이션' },
      { week: 3, theme: 'targetjob | target industry', task: '갈등 관리' },
    ]
  },
  {
    id: 3,
    name: '커리큘럼 C',
    description: 'AI 활용 업무 혁신',
    steps: [
      { week: 1, theme: 'targetjob | target industry', task: 'AI 도구 개요' },
      { week: 2, theme: 'targetjob | target industry', task: 'ChatGPT 실무 활용' },
      { week: 3, theme: 'targetjob | target industry', task: '자동화 워크플로우' },
      { week: 4, theme: 'targetjob | target industry', task: 'AI 윤리와 한계' },
    ]
  },
];

// 더미 미리보기 데이터
const DUMMY_PREVIEW = {
  name: '마케팅 프레임워크 과정',
  goal: 'DBR 아티클 기반으로 마케팅 프레임워크를 습득하고 실무에 적용할 수 있다(cur_learing_goal)',
  steps: [
    { week: 1, theme: 'targetjob | industry', task: '디지털 마케팅 개론' },
    { week: 2, theme: 'targetjob | industry', task: '데이터 기반 의사결정' },
    { week: 3, theme: 'targetjob | industry', task: '콘텐츠 마케팅 전략' },
    { week: 4, theme: 'targetjob | industry', task: '성과 측정 및 최적화' },
  ]
};

function CurriculumView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false); // ✅ 확인 모달
  const [curriculums, setCurriculums] = useState(DUMMY_CURRICULUMS);
  const [selectedId, setSelectedId] = useState(DUMMY_CURRICULUMS[0].id);

  const selectedCurriculum = curriculums.find(c => c.id === selectedId);

  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">커리큘럼 관리</h2>

      {curriculums.length === 0 ? (
        <div className="curriculumEmptyBox">
          <img src={curri_nulll} className="curriculumEmptyImage" alt="없음" />
          <p className="curriculumEmptyText">생성된 커리큘럼이 존재하지 않습니다.</p>
          <button className="curriculumCreateBtn" onClick={() => setModalOpen(true)}>
            커리큘럼 생성하기
          </button>
        </div>
      ) : (
        <div className="curriculumLayout">
          <aside className="curriculumSidebar">
            <p className="curriculumSidebarTitle">생성한 커리큘럼</p>
            <div className="curriculumSidebarDivider" />
            <ul className="curriculumSidebarList">
              {curriculums.map(c => (
                <li
                  key={c.id}
                  className={`curriculumSidebarItem ${selectedId === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(c.id)}
                >{c.name}</li>
              ))}
            </ul>
            <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>
              + 새 커리큘럼
            </button>
          </aside>

          <div className="curriculumDetail">
            <h3 className="curriculumDetailTitle">{selectedCurriculum.name}</h3>
            <p className="curriculumDetailDesc">{selectedCurriculum.description}</p>
            <div className="curriculumSteps">
              {selectedCurriculum.steps.map((step) => (
                <div key={step.week} className="curriculumStepCard">
                  <div className="stepWeek">{step.week}주차</div>
                  <div className="stepContent">
                    <p className="stepTitle">{step.task}</p>
                    <p className="stepDesc">{step.theme}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <>
          <div className="chatModalOverlay" onClick={() => setModalOpen(false)} />
          <div className="chatModalContainer">
            <aside className="chatSidebar">
              <p className="chatSidebarTitle">생성한 커리큘럼</p>
              <div className="chatSidebarDivider" />
              <ul className="chatSidebarList">
                {curriculums.map(c => <li key={c.id}>{c.name}</li>)}
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
                {/* ✅ 테스트용: 입력창 클릭 시 확인 모달 오픈 */}
                <input
                  className="chatInput"
                  type="text"
                  placeholder="메시지를 입력하세요... (클릭 시 미리보기 테스트)"
                  onClick={() => setConfirmOpen(true)}
                  readOnly
                />
              </div>
            </div>
          </div>
        </>
      )}

      {confirmOpen && (
        <>
          <div className="confirmOverlay" onClick={() => setConfirmOpen(false)} />
          <div className="confirmModal">

            <div className="confirmHeader">
              <div className="confirmHeaderRight">
                <p className="confirmHeaderLabel">직무 | N주차</p>
                <h3 className="confirmTitle">이 커리큘럼을 생성하시겠습니까?</h3>
                <div className="confirmDivider" />
              </div>
            </div>

            <div className="confirmGoalBox">
              <p className="confirmGoalLabel">교육 목표 :</p>
              <p className="confirmGoalText">{DUMMY_PREVIEW.goal}</p>
            </div>

            <p className="confirmProgramName">{DUMMY_PREVIEW.name}</p>

            <div className="confirmStepList">
              {DUMMY_PREVIEW.steps.map((step) => (
                <div key={step.week} className="confirmStepRow">
                  <span className="confirmStepWeek">week {step.week}</span>
                  <span className="confirmStepDivider" />
                  <span className="confirmStepTask">{step.task}</span>
                  <span className="confirmStepDivider" />
                  <span className="confirmStepTheme">{step.theme}</span>
                </div>
              ))}
            </div>

            <div className="confirmBtns">
              <button className="confirmBtnBack" onClick={() => setConfirmOpen(false)}>
                뒤로가기
              </button>
              <button className="confirmBtnCreate" onClick={() => {
                setConfirmOpen(false);
                setModalOpen(false);
              }}>
                생성
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

export default CurriculumView;