import { useState, useEffect } from 'react';
import api from '../lib/api';
import curri_nulll from '../public/curri_null.png';
import '../styles/Curriculum.css';

const initialForm = {
  cur_title: '',
  cur_duration_weeks: 4,
  cur_target_job: '',
  cur_target_industry: '',
  cur_learning_goal: '',
  required_content: '',
};

// tasks가 문자열이든 배열이든 안전하게 처리하기 위한 헬퍼 함수
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

const buildGeneratePayload = (form) => ({
  cur_title: form.cur_title.trim(),
  cur_duration_weeks: Number(form.cur_duration_weeks),
  cur_target_job: form.cur_target_job.trim() || null,
  cur_target_industry: form.cur_target_industry.trim() || null,
  cur_learning_goal: form.cur_learning_goal.trim() || null,
  required_content: form.required_content.trim() || null,
});

function CurriculumView({ onOpenArticle }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // 🔥 아코디언 UI를 위한 상태 (메인 화면용, 미리보기 화면용)
  const [detailExpandedWeek, setDetailExpandedWeek] = useState(null);
  const [previewExpandedWeek, setPreviewExpandedWeek] = useState(null);

  const loadCurriculums = () => {
    setLoading(true);
    setError(null);
    return api.get('/curricula')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCurriculums(list);
        setSelectedId((prev) => {
          if (prev && list.some((c) => c.cur_id === prev)) return prev;
          return list[0]?.cur_id ?? null;
        });
        return list;
      })
      .catch((err) => {
        setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
        return [];
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    api.get('/curricula')
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setCurriculums(list);
        if (list.length > 0) setSelectedId(list[0].cur_id);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.detail || '커리큘럼을 불러오지 못했어요.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const selectedCurriculum = curriculums.find((c) => c.cur_id === selectedId);

  const closeModal = () => {
    if (generating || saving) return;
    setModalOpen(false);
    setConfirmOpen(false);
    setPreview(null);
    setFormError(null);
    setPreviewExpandedWeek(null); // 모달 닫을 때 아코디언 초기화
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: name === 'cur_duration_weeks' ? Number(value) : value }));
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    setFormError(null);

    const payload = buildGeneratePayload(form);
    if (!payload.cur_title) {
      setFormError('과정명을 입력해 주세요.');
      return;
    }
    if (!payload.cur_duration_weeks || payload.cur_duration_weeks < 1) {
      setFormError('기간은 1주 이상으로 입력해 주세요.');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/curricula/generate', payload);
      setPreview(res.data);
      // 첫 번째 주차를 기본으로 열어둡니다.
      if (res.data?.cur_week_plan?.length > 0) {
        setPreviewExpandedWeek(res.data.cur_week_plan[0].week);
      }
      setConfirmOpen(true);
    } catch (err) {
      // 🔥 422 에러(배열) 파싱 로직 적용
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail[0].msg);
      } else {
        setFormError(detail || 'AI 커리큘럼 생성에 실패했어요.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setFormError(null);
    try {
      const savePayload = {
        cur_title: preview.cur_title,
        cur_duration_weeks: preview.cur_duration_weeks,
        cur_target_job: preview.cur_target_job || null,
        cur_target_industry: preview.cur_target_industry || null,
        cur_learning_goal: preview.cur_learning_goal || null,

        // 🔥 DB 타입(TEXT)에 맞게 단순 문자열 전송
        cur_learning_detail_goal: form.required_content.trim() || null,
        cur_week_plan: preview.cur_week_plan,

        // 🔥 DB 타입(JSON)에 맞게 빈 배열 전송
        cur_assigned_learner_ids: [],
        cur_status: 'active',
      };
      const res = await api.post('/curricula', savePayload);
      await loadCurriculums();
      setSelectedId(res.data.cur_id);
      setForm(initialForm);
      setPreview(null);
      setConfirmOpen(false);
      setModalOpen(false);
    } catch (err) {
      // 🔥 422 에러(배열) 파싱 로직 적용
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail[0].msg);
      } else {
        setFormError(detail || '커리큘럼 저장에 실패했어요.');
      }
    } finally {
      setSaving(false);
    }
  };

  const previewWeeks = normalizeWeekPlan(preview?.cur_week_plan);

  // 공통으로 사용할 아코디언 아이템 렌더링 함수
  const renderAccordionItem = (step, expandedState, toggleFunc) => {
    const isExpanded = expandedState === step.week;

    return (
      <div
        key={step.week}
        style={{
          border: '1px solid #e1e4e8',
          borderRadius: '8px',
          marginBottom: '12px',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}
      >
        {/* 헤더 영역 (클릭 시 토글) */}
        <div
          onClick={() => toggleFunc(step.week)}
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            backgroundColor: isExpanded ? '#f0f4f8' : '#ffffff',
            transition: 'background-color 0.2s'
          }}
        >
          <span style={{ fontWeight: 'bold', width: '60px', color: '#0366d6' }}>
            {step.week}주차
          </span>
          <span style={{ flex: 1, fontWeight: '600', fontSize: '15px', color: '#24292e' }}>
            {step.theme || '주제 미지정'}
          </span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {isExpanded ? '▲ 접기' : '▼ 펼쳐보기'}
          </span>
        </div>

        {/* 상세 내용 영역 */}
        {isExpanded && (
          <div style={{ padding: '20px', backgroundColor: '#fafbfc', borderTop: '1px solid #e1e4e8' }}>
            {/* 1. 학습 목표 */}
            {step.learning_objective && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', color: '#0366d6', marginBottom: '8px', fontWeight: 'bold' }}>🎯 이번 주차 학습 목표</h4>
                <p style={{ fontSize: '13px', color: '#333', lineHeight: '1.5', margin: 0 }}>{step.learning_objective}</p>
              </div>
            )}

            {/* 2. 핵심 과제 및 OJT 내용 */}
            {(step.tasks || step.task) && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', color: '#24292e', marginBottom: '8px', fontWeight: 'bold' }}>📚 멘토링 및 실습 과제</h4>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {Array.isArray(step.tasks || step.task)
                    ? (step.tasks || step.task).map((t, idx) => (
                      <li key={idx} style={{ fontSize: '13px', color: '#444', marginBottom: '6px', lineHeight: '1.5' }}>{t}</li>
                    ))
                    : <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.5', margin: 0 }}>{step.tasks || step.task}</p>
                  }
                </ul>
              </div>
            )}

            {/* 3. 멘토 피드백 및 체크리스트 */}
            {Array.isArray(step.success_criteria) && step.success_criteria.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fff', border: '1px solid #e1e4e8', borderRadius: '6px' }}>
                <h4 style={{ fontSize: '13px', color: '#cb2431', marginBottom: '8px', fontWeight: 'bold' }}>✅ 멘토 피드백 체크리스트</h4>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  {step.success_criteria.map((criteria, idx) => (
                    <li key={idx} style={{ fontSize: '13px', color: '#444', marginBottom: '4px', lineHeight: '1.4' }}>{criteria}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. 추천 자료 및 시간 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', borderTop: '1px dashed #e1e4e8', paddingTop: '12px' }}>
              <div>
                {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '12px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>📖 추천 참고 자료</h4>
                    {step.recommended_articles.map((article, idx) => {
                      
                      // 🔥 핵심 구조 변경: url이 정상적으로 있으면 그곳으로, 없거나 비어있으면 무조건 구글 검색으로 강제 연결!
                      const targetUrl = article.url && article.url.trim() !== "" 
                        ? article.url 
                        : `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
                      
                      return (
                        <div key={idx} style={{ marginBottom: '6px' }}>
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', fontWeight: 'bold', color: '#0366d6', textDecoration: 'underline', display: 'inline-block' }}
                          >
                            {/* URL이 있으면 🔗 아이콘, 구글 검색으로 대체되었으면 🔍 아이콘 표시 */}
                            {article.url && article.url.trim() !== "" ? '🔗 ' : '🔍 '}
                            {article.title}
                          </a>
                          
                          {article.why_relevant && (
                            <p style={{ fontSize: '11px', color: '#777', margin: '2px 0 0 16px', lineHeight: '1.4' }}>
                              - {article.why_relevant}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {step.estimated_hours && (
                <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', backgroundColor: '#e1e4e8', padding: '4px 8px', borderRadius: '12px' }}>
                  ⏱ 예상 소요: {step.estimated_hours}시간
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="curriculumPageContainer">
      <h2 className="sectionTitle">커리큘럼 관리</h2>

      {loading && <p style={{ padding: '20px' }}>커리큘럼을 불러오는 중...</p>}
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

      {/* 메인 화면 (저장된 커리큘럼 열람) */}
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
                  onClick={() => {
                    setSelectedId(c.cur_id);
                    setDetailExpandedWeek(null); // 탭 변경 시 아코디언 닫기
                  }}
                >
                  {c.cur_title}
                </li>
              ))}
            </ul>
            <button className="curriculumSidebarAddBtn" onClick={() => setModalOpen(true)}>
              + 새 커리큘럼
            </button>
          </aside>

          <div className="curriculumDetail">
            <h3 className="curriculumDetailTitle">{selectedCurriculum.cur_title}</h3>
            <p className="curriculumDetailDesc" style={{ marginBottom: '24px' }}>
              {selectedCurriculum.cur_learning_goal || ''}
            </p>
            <div className="curriculumSteps">
              {normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) =>
                renderAccordionItem(
                  step,
                  detailExpandedWeek,
                  (week) => setDetailExpandedWeek(prev => prev === week ? null : week)
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 커리큘럼 생성 폼 모달 */}
      {modalOpen && (
        <>
          <div className="chatModalOverlay" onClick={closeModal} />
          <div className="chatModalContainer">
            <aside className="chatSidebar">
              <p className="chatSidebarTitle">생성한 커리큘럼</p>
              <div className="chatSidebarDivider" />
              <ul className="chatSidebarList">
                {curriculums.length === 0 && <li>아직 없음</li>}
                {curriculums.map((c) => <li key={c.cur_id}>{c.cur_title}</li>)}
              </ul>
            </aside>
            <div className="chatMain">
              <button className="chatModalClose" onClick={closeModal} disabled={generating || saving}>×</button>
              <p className="chatMainTitle">AI로 커리큘럼 초안을 생성하세요</p>
              <form className="curriculumGenerateForm" onSubmit={handleGenerate}>
                <label className="curriculumField">
                  <span>과정명</span>
                  <input
                    name="cur_title"
                    value={form.cur_title}
                    onChange={handleChange}
                    placeholder="예: 마케팅 신입 4주 온보딩"
                  />
                </label>
                <div className="curriculumFieldGrid">
                  <label className="curriculumField">
                    <span>대상 직무</span>
                    <input
                      name="cur_target_job"
                      value={form.cur_target_job}
                      onChange={handleChange}
                      placeholder="예: 마케터"
                    />
                  </label>
                  <label className="curriculumField">
                    <span>산업</span>
                    <input
                      name="cur_target_industry"
                      value={form.cur_target_industry}
                      onChange={handleChange}
                      placeholder="예: IT"
                    />
                  </label>
                </div>
                <label className="curriculumField">
                  <span>기간</span>
                  <input
                    name="cur_duration_weeks"
                    type="number"
                    min="1"
                    max="52"
                    value={form.cur_duration_weeks}
                    onChange={handleChange}
                  />
                </label>
                <label className="curriculumField">
                  <span>학습 목표</span>
                  <textarea
                    name="cur_learning_goal"
                    value={form.cur_learning_goal}
                    onChange={handleChange}
                    rows="3"
                    placeholder="예: 디지털 마케팅 기초 역량 확보"
                  />
                </label>
                <label className="curriculumField">
                  <span>필수 포함 내용</span>
                  <textarea
                    name="required_content"
                    value={form.required_content}
                    onChange={handleChange}
                    rows="3"
                    placeholder="예: GA4 분석, SEO 기본, 콘텐츠 마케팅 전략"
                  />
                </label>
                {formError && <p className="curriculumFormError">{formError}</p>}
                <button className="curriculumGenerateBtn" type="submit" disabled={generating}>
                  {generating ? 'AI 생성 중...' : 'AI 커리큘럼 생성'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* 커리큘럼 생성 결과 미리보기 및 저장 모달 */}
      {confirmOpen && preview && (
        <>
          <div className="confirmOverlay" onClick={() => !saving && setConfirmOpen(false)} />
          <div className="confirmModal">
            <div className="confirmHeader">
              <div className="confirmHeaderRight">
                <p className="confirmHeaderLabel">
                  {preview.cur_target_job || '직무 미지정'} | {preview.cur_duration_weeks}주차
                </p>
                <h3 className="confirmTitle">이 커리큘럼을 저장할까요?</h3>
                <div className="confirmDivider" />
              </div>
            </div>

            <div className="confirmGoalBox">
              <p className="confirmGoalLabel">교육 목표 :</p>
              <p className="confirmGoalText">{preview.cur_learning_goal || '교육 목표가 입력되지 않았습니다.'}</p>
            </div>

            <p className="confirmProgramName">{preview.cur_title}</p>

            <div className="confirmStepList" style={{ marginTop: '20px' }}>
              {previewWeeks.map((step) =>
                renderAccordionItem(
                  step,
                  previewExpandedWeek,
                  (week) => setPreviewExpandedWeek(prev => prev === week ? null : week)
                )
              )}
            </div>

            {formError && <p className="curriculumFormError" style={{ marginTop: '16px' }}>{formError}</p>}

            <div className="confirmBtns" style={{ marginTop: '24px' }}>
              <button className="confirmBtnBack" onClick={() => setConfirmOpen(false)} disabled={saving}>
                돌아가기
              </button>
              <button className="confirmBtnCreate" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '생성'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CurriculumView;