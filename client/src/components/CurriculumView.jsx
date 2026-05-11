import { useState, useEffect } from 'react';
import api from '../lib/api';
import curri_nulll from '../public/curri_null.png';
import '../styles/Curriculum.css';

const formatTasks = (tasks) => {
  if (Array.isArray(tasks)) return tasks.join(', ');
  if (typeof tasks === 'string') return tasks;
  return '';
};

const normalizeWeekPlan = (plan) => {
  if (Array.isArray(plan)) return plan;
  if (plan && typeof plan === 'object') return [plan];
  return [];
};

// 미리보기용 더미 (생성 흐름은 아직 미연결)
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get('/curricula')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setCurriculums(list);
        if (list.length > 0) setSelectedId(list[0].cur_id);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selectedCurriculum = curriculums.find((c) => c.cur_id === selectedId);

  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">커리큘럼 관리</h2>

      {loading && <p style={{ padding: '20px' }}>커리큘럼 불러오는 중...</p>}
      {error && <p style={{ padding: '20px', color: '#c33' }}>{error}</p>}

      {!loading && !error && curriculums.length === 0 && (
        <div className="curriculumEmptyBox">
          <img src={curri_nulll} className="curriculumEmptyImage" alt="없음" />
          <p className="curriculumEmptyText">생성된 커리큘럼이 존재하지 않습니다.</p>
          <button className="curriculumCreateBtn" onClick={() => setModalOpen(true)}>
            커리큘럼 생성하기
          </button>
        </div>
      )}

      {!loading && !error && curriculums.length > 0 && selectedCurriculum && (
        <div className="curriculumLayout">
          <aside className="curriculumSidebar">
            <p className="curriculumSidebarTitle">생성한 커리큘럼</p>
            <div className="curriculumSidebarDivider" />
            <ul className="curriculumSidebarList">
              {curriculums.map((c) => (
                <li
                  key={c.cur_id}
                  className={`curriculumSidebarItem ${selectedId === c.cur_id ? 'active' : ''}`}
                  onClick={() => setSelectedId(c.cur_id)}
                >{c.cur_title}</li>
              ))}
            </ul>
            <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>
              + 새 커리큘럼
            </button>
          </aside>

          <div className="curriculumDetail">
            <h3 className="curriculumDetailTitle">{selectedCurriculum.cur_title}</h3>
            <p className="curriculumDetailDesc">
              {selectedCurriculum.cur_learning_goal || ''}
            </p>
            <div className="curriculumSteps">
              {normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => (
                <div key={step.week} className="curriculumStepCard">
                  <div className="stepWeek">{step.week}주차</div>
                  <div className="stepContent">
                    <p className="stepTitle">{formatTasks(step.tasks ?? step.task)}</p>
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
                {curriculums.map((c) => <li key={c.cur_id}>{c.cur_title}</li>)}
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
