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

function CurriculumView() {
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
      setConfirmOpen(true);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'AI 커리큘럼 생성에 실패했어요.');
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
        cur_target_job: preview.cur_target_job,
        cur_target_industry: preview.cur_target_industry,
        cur_learning_goal: preview.cur_learning_goal,
        cur_ai_prompt_input: form.required_content.trim() || null,
        cur_week_plan: preview.cur_week_plan,
        cur_status: 'draft',
      };
      const res = await api.post('/curricula', savePayload);
      await loadCurriculums();
      setSelectedId(res.data.cur_id);
      setForm(initialForm);
      setPreview(null);
      setConfirmOpen(false);
      setModalOpen(false);
    } catch (err) {
      setFormError(err.response?.data?.detail || '커리큘럼 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  const previewWeeks = normalizeWeekPlan(preview?.cur_week_plan);

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
            <p className="curriculumDetailDesc">
              {selectedCurriculum.cur_learning_goal || ''}
            </p>
            <div className="curriculumSteps">
              {normalizeWeekPlan(selectedCurriculum.cur_week_plan).map((step) => (
                <div key={step.week} className="curriculumStepCard">
                  <div className="stepWeek">{step.week}주차</div>
                  <div className="stepContent">
                    <p className="stepTitle">{step.theme}</p>
                    {step.learning_objective && (
                      <p className="stepObjective" style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                        🎯 {step.learning_objective}
                      </p>
                    )}
                    <p className="stepDesc">{formatTasks(step.tasks ?? step.task)}</p>
                    {Array.isArray(step.success_criteria) && step.success_criteria.length > 0 && (
                      <ul className="stepCriteria" style={{ margin: '6px 0', paddingLeft: 18, fontSize: 13, color: '#666' }}>
                        {step.success_criteria.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                      <div className="stepArticles" style={{ marginTop: 8, padding: 8, background: '#f6f8fa', borderRadius: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>📚 추천 아티클</p>
                        {step.recommended_articles.map((a, i) => (
                          <div key={i} style={{ marginTop: 4 }}>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</p>
                            {a.why_relevant && (
                              <p style={{ fontSize: 12, color: '#777' }}>{a.why_relevant}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {step.estimated_hours && (
                      <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                        ⏱ 예상 {step.estimated_hours}시간
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

            <div className="confirmStepList">
              {previewWeeks.map((step) => (
                <div key={step.week} className="confirmStepRow" style={{ alignItems: 'flex-start' }}>
                  <span className="confirmStepWeek">week {step.week}</span>
                  <span className="confirmStepDivider" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="confirmStepTask">{step.theme}</span>
                    {step.learning_objective && (
                      <span style={{ fontSize: 12, color: '#666' }}>🎯 {step.learning_objective}</span>
                    )}
                    <span className="confirmStepTheme">{formatTasks(step.tasks ?? step.task)}</span>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888', marginTop: 2 }}>
                      {Array.isArray(step.recommended_articles) && step.recommended_articles.length > 0 && (
                        <span>📚 {step.recommended_articles.length}편</span>
                      )}
                      {Array.isArray(step.success_criteria) && step.success_criteria.length > 0 && (
                        <span>✓ {step.success_criteria.length}개 기준</span>
                      )}
                      {step.estimated_hours && <span>⏱ {step.estimated_hours}h</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {formError && <p className="curriculumFormError">{formError}</p>}

            <div className="confirmBtns">
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