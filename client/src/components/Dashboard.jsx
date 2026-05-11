import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import Header from './Header';
import '../styles/Dashboard.css';
import CurriculumView from './CurriculumView';
import EmailingView from './EmailingView';
import ArticleDetailView from './ArticleDetailView';

const SECTION_THEMES = ['blue', 'green', 'brown'];

function Dashboard({ user, onLogout }) {
  const [view, setView] = useState('articles');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get('/articles', { params: { limit: 100 } })
      .then((res) => {
        if (cancelled) return;
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
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.detail || '아티클을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (view !== 'articles') {
      window.history.pushState({ view, t: Date.now() }, '');
    }
  }, [view]);

  useEffect(() => {
    window.history.pushState({ view: 'articles', t: Date.now() }, '');
    window.history.pushState({ view: 'articles', t: Date.now() + 1 }, '');

    const onPop = () => {
      if (viewRef.current === 'articles') {
        window.history.pushState({ view: 'articles', t: Date.now() }, '');
      } else {
        setView('articles');
        setSelectedArticle(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const ArticleListView = () => (
    <>
      <div className="serviceIntroBanner">
        <h3>LANDFACTORY</h3>
        <p>DBR 아티클을 통해 비즈니스 인사이트를 요약하고 시각화하여 제공합니다.</p>
        <p>사용자는 제공된 아티클을 기반으로 기업 교육에 필요한 커리큘럼을 생성할 수 있습니다.</p>
        <button className="heroCta" onClick={() => setView('curriculum')}>
          커리큘럼 생성하기
        </button>
      </div>

      {loading && <p style={{ padding: '20px' }}>아티클 불러오는 중...</p>}
      {error && <p style={{ padding: '20px', color: '#c33' }}>{error}</p>}
      {!loading && !error && sections.length === 0 && (
        <p style={{ padding: '20px' }}>표시할 아티클이 없습니다.</p>
      )}

      {sections.map((section) => (
        <section key={section.category} className={'sectionGroup highlightSection'} data-theme={section.theme}>
          <h2 className="sectionTitle">{section.category}</h2>
          <div className="articleGrid">
            {section.items.map((item) => (
              <article key={item.article_id}
                className="articleCard"
                onClick={() => {
                  setSelectedArticle(item);
                  setView('articleDetail');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <div className="cardTop">
                  <span className="cardTag"># {item.article_category || '기타'}</span>
                </div>
                <div className="cardBottom">
                  <h3 className="cardTitle">{item.article_title}</h3>
                  <div className="cardMeta">
                    <span className="cardSource">{item.article_source}</span>
                    {item.article_published_date && (
                      <>
                        <span className="cardDot">·</span>
                        <span className="cardTime">{item.article_published_date}</span>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );

  return (
    <div className="dashContainer">
      <Header
        onViewChange={(v) => {
          setView(v);
          setSelectedArticle(null);
        }}
        onLogout={onLogout}
        onScrollToTop={scrollToTop}
      />

      <main className="dashMain">
        {view === 'articles' && <ArticleListView />}
        {view === 'articleDetail' &&
          (<ArticleDetailView
            article={selectedArticle}
            onBack={() => window.history.back()}
          />
          )}
        {view === 'curriculum' && <CurriculumView />}
        {view === 'emailing' && <EmailingView />}

      </main>

    </div>
  );
}

export default Dashboard;
