import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Header from './Header';
import '../styles/Dashboard.css';
import CurriculumView from './CurriculumView';
import EmailingView from './EmailingView';
import ArticleDetailView from './ArticleDetailView';
import HeroBanner from './HeroBanner';


const SECTION_THEMES = ['blue', 'green', 'brown'];

const CATEGORY_EN = {
  '마케팅': 'MARKETING',
  '경영전략': 'MANAGEMENT',
  '리더쉽': 'LEADERSHIP',
  'AI': 'AI',
  '인사조직': 'ORGANIZATION',
  'HRD': 'HRD',
  '인문': 'HUMANITIES',
  '자기계발' : 'Development',
  '기타': 'OTHERS'
};

function Dashboard({ user, onLogout }) {
  const [view, setView] = useState('articles');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- 검색 및 모달 관련 상태 ---
  const [searchQuery, setSearchQuery] = useState(''); // AI 생성을 위해 보관할 검색어
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState('searching');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [originalSections, setOriginalSections] = useState([]);

  const fetchArticles = () => {
    setLoading(true);
    api.get('/articles', { params: { limit: 100 } })
      .then((res) => {
        const grouped = {};
        for (const a of res.data.articles) {
          const cat = a.article_category || '기타';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(a);
        }
        const built = Object.entries(grouped)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([category, items], i) => ({
            category,
            theme: SECTION_THEMES[i % SECTION_THEMES.length],
            items: items.slice(0, 5),
          }));
        setSections(built);
        setOriginalSections(built);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || '아티클을 불러오지 못했어요.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleSearch = async (query) => {
    if (!query || !query.trim()) {
      setSections(originalSections);
      return;
    }

    setSearchQuery(query);
    setIsModalOpen(true);
    setModalStatus('searching');

    try {
      const res = await api.get('/articles', { params: { keyword: query } });
      const foundArticles = res.data.articles;

      if (foundArticles && foundArticles.length > 0) {
        setSections([{
          category: `🔍 "${query}" 연관 아티클`,
          theme: 'blue',
          items: foundArticles.slice(0, 5) // 수정: 상위 5개만 표시
        }]);
        setIsModalOpen(false);
      } else {
        setModalStatus('not_found');
      }
    } catch (err) {
      console.error(err);
      setModalStatus('not_found');
    }
  };

  const handleGenerate = async () => {
    setModalStatus('generating');
    try {
      const res = await api.post('/articles/generate', { keyword: searchQuery });
      const newArticle = res.data.article;

      setSections(originalSections);
      setSearchQuery('');

      setSelectedArticle(newArticle);
      setView('articleDetail');
      setIsModalOpen(false);
    } catch (err) {
      alert('아티클 생성에 실패했습니다. 다시 시도해주세요.');
      setIsModalOpen(false);
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (view !== 'articles') {
      window.history.pushState({ view, t: Date.now() }, '');
    }
  }, [view]);

  useEffect(() => {
    // 초기 진입 시 히스토리 설정
    window.history.pushState({ view: 'articles', t: Date.now() }, '');
    window.history.pushState({ view: 'articles', t: Date.now() + 1 }, '');

    const onPop = () => {
      if (viewRef.current === 'articles') {
        window.history.pushState({ view: 'articles', t: Date.now() }, '');
      } else {
        setView('articles');
        setSelectedArticle(null);

        setSections(originalSections);
        setSearchQuery('');

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [originalSections]); // originalSections가 설정된 후 참조할 수 있도록 의존성 추가

  const CategoryTabBar = () => (
    <div className="catTabBarTop">
    
      <button
        className={`catTabTop ${!selectedCategory ? 'active' : ''}`}
        onClick={() => setSelectedCategory(null)}
      >전체</button>


      {originalSections.map((section) => (
        <button
          key={section.category}
          className={`catTabTop ${selectedCategory === section.category ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory(section.category);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {section.category}
        </button>
      ))}
    </div>
  );

  const ArticleListView = () => {
    if (loading) return <p style={{ padding: '20px' }}>아티클 불러오는 중...</p>;
    if (error) return <p style={{ padding: '20px', color: '#c33' }}>{error}</p>;
    if (sections.length === 0) return <p style={{ padding: '20px' }}>표시할 아티클이 없습니다.</p>;

    const displaySections = selectedCategory 
      ? sections.filter(s => s.category === selectedCategory)
      : sections;

    return (
      <div className="categoryArticlePage">
        <div className="catTabBarTop">
          <button 
            className={`catTabTop ${!selectedCategory ? 'active' : ''}`}
            onClick={() => { setSelectedCategory(null);  }}
          >
            전체
          </button>
          {originalSections.map((s) => (
            <button
              key={s.category}
              className={`catTabTop ${selectedCategory === s.category ? 'active' : ''}`}
              onClick={() => { setSelectedCategory(s.category); }}
            >
              {s.category}
            </button>
          ))}
        </div>

        {displaySections.map((section) => (
          <section key={section.category} className="sectionGroup highlightSection" data-theme={section.theme}>
            <div className="catHeroZone">
              <div className="catWatermark">{CATEGORY_EN[section.category] || 'ARTICLE'}</div>
              <div className="catEllipse" />
            </div>

            <h2 className="sectionTitle">{section.category}</h2>

            <div className="articleGrid">
              {section.items.map((item) => (
                <article 
                  key={item.article_id || Math.random()} 
                  className="articleCard" 
                  onClick={() => {
                    setSelectedArticle(item);
                    setView('articleDetail');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div className="cardTop">
                    {item.article_thumbnail_url && <img src={item.article_thumbnail_url} alt="" />}
                    <span className="cardTag"># {item.article_category || '기타'}</span>
                  </div>
                  <div className="cardBottom">
                    <h3 className="cardTitle">{item.article_title}</h3>
                    <div className="cardMeta">
                      <span className="cardSource">{item.article_source || 'AI 리포트'}</span>
                      <span className="cardDot">·</span>
                      <span className="cardTime">
                        {item.article_published_date ? String(item.article_published_date).split('T')[0] : '최근'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  return (
    <div className="dashContainer">
      <Header
        onViewChange={(v) => {
          setView(v);
          setSelectedArticle(null);
        }}
        onLogout={onLogout}
        onScrollToTop={scrollToTop}
        onSearch={handleSearch} 
      />

      {view === 'articles' && <HeroBanner onCreateCurriculum={() => setView('curriculum')} />}


      <main className="dashMain">
        {view === 'articles' && <ArticleListView />}
        {view === 'articleDetail' && (
          <ArticleDetailView
            article={selectedArticle}
            onBack={() => window.history.back()}
          />
        )}
        {view === 'curriculum' && <CurriculumView />}
        {view === 'emailing' && <EmailingView />}
      </main>

     
      {isModalOpen && (
        <div className="modalOverlay" style={modalOverlayStyle}>
          <div className="modalContent" style={modalContentStyle}>
            {modalStatus === 'searching' && (
              <div style={{ textAlign: 'center' }}>
                <h3>🔍 아티클을 찾고 있습니다...</h3>
                <p style={{ color: '#666', marginTop: '10px' }}>잠시만 기다려주세요.</p>
              </div>
            )}

            {modalStatus === 'not_found' && (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#d9534f' }}>검색 결과 없음</h3>
                <p style={{ color: '#555', marginTop: '10px' }}>해당 검색어와 연관되는 아티클 요약문이 없습니다.</p>
                <p style={{ fontWeight: 'bold', marginTop: '15px', color: '#333' }}>해당 검색어를 기반으로 새로운 아티클 요약문을<br />생성해드릴까요?</p>
                <div style={{ marginTop: '25px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button onClick={handleGenerate} style={{ padding: '10px 30px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>예</button>
                  <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 30px', background: '#ccc', color: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>아니오</button>
                </div>
              </div>
            )}

            {modalStatus === 'generating' && (
              <div style={{ textAlign: 'center' }}>
                <h3>✨ AI가 아티클 요약문을 생성 중입니다...</h3>
                <p style={{ color: '#666', marginTop: '15px', lineHeight: '1.5' }}>
                  문서를 분석하고 인사이트를 추출하는데<br />약 1~2분 정도 소요될 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const modalContentStyle = {
  background: '#fff', padding: '40px', borderRadius: '12px', maxWidth: '450px', width: '90%',
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
};

export default Dashboard;