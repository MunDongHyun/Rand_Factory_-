import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/api';
import { fetchMyBookmarks, addBookmark, removeBookmark } from '../lib/bookmarks';
import Header from './Header';
import '../styles/Dashboard.css';
import CurriculumView from './CurriculumView';
import LearnerCurriculumView from './LearnerCurriculumView';
import EmailingView from './EmailingView';
import ArticleDetailView from './ArticleDetailView';
import HeroBanner from './HeroBanner';
import MyBookmarksView from './MyBookmarksView';

const SECTION_THEMES = ['blue', 'green', 'brown'];

const CATEGORY_EN = {
  '마케팅': 'MARKETING',
  '경영전략': 'MANAGEMENT',
  '리더쉽': 'LEADERSHIP',
  'AI': 'AI',
  '인사조직': 'ORGANIZATION',
  'HRD': 'HRD',
  '인문': 'HUMANITIES',
  '자기계발': 'Development',
  '기타': 'OTHERS'
};

function Dashboard({ user, onLogout }) {
  const canUseCurriculum = ['j', 'm', 'a'].includes(user?.user_role);
  const canCreateCurriculum = ['m', 'a'].includes(user?.user_role);

  const [view, setView] = useState('articles');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [pendingAuthorNumb, setPendingAuthorNumb] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- 검색 및 모달 관련 상태 ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState('searching');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [originalSections, setOriginalSections] = useState([]);

  // EmailingView가 상세 화면에 들어가 있는지 알리기 위한 ref (popstate 처리 분기용)
  const emailingDetailRef = useRef(false);
  const curriculumDetailRef = useRef(false);
  // 요약문(✉)에서 이메일링으로 외부 진입한 경우: 뒤로가기 시 요약문 복귀를 위한 플래그
  const cameFromArticleDetailRef = useRef(false);
  // articleDetail 직전 view 기억 (뒤로가기 시 그 view 로 복귀)
  const previousViewRef = useRef(null);

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
            items,
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

  // --- 북마크 상태: 사용자의 북마크한 article_id 셋 ---
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set());

  useEffect(() => {
    fetchMyBookmarks()
      .then(({ articles }) => {
        setBookmarkedIds(new Set(articles.map((a) => a.article_id)));
      })
      .catch(() => {
        // 토큰 만료/네트워크 오류는 조용히 무시 (다른 영역도 영향받으면 별도 처리됨)
      });
  }, []);

  const toggleBookmark = async (articleId) => {
    if (!articleId) return;
    const wasBookmarked = bookmarkedIds.has(articleId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
    try {
      if (wasBookmarked) await removeBookmark(articleId);
      else await addBookmark(articleId);
    } catch (err) {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(articleId);
        else next.delete(articleId);
        return next;
      });
      toast.error(err.response?.data?.detail || '북마크 처리에 실패했습니다.');
    }
  };

  // 새로고침 시 view 복원: sessionStorage 에 저장된 view/articleId 가 있으면 그대로 진입
  useEffect(() => {
    const savedView = sessionStorage.getItem('dash:view');
    const savedArticleId = sessionStorage.getItem('dash:articleId');
    if (!savedView || savedView === 'articles') return;

    if (savedView === 'articleDetail' && savedArticleId) {
      api.get(`/articles/${savedArticleId}`)
        .then((res) => {
          setSelectedArticle(res.data);
          setView('articleDetail');
        })
        .catch(() => {
          sessionStorage.removeItem('dash:view');
          sessionStorage.removeItem('dash:articleId');
        });
    } else if (savedView === 'curriculum' || savedView === 'emailing' || savedView === 'bookmarks') {
      if (savedView === 'curriculum' && !canUseCurriculum) {
        sessionStorage.removeItem('dash:view');
        return;
      }
      setView(savedView);
    }
  }, []);

  // view / 선택 아티클 변경 시 sessionStorage 에 영속화
  useEffect(() => {
    sessionStorage.setItem('dash:view', view);
    if (view === 'articleDetail' && selectedArticle?.article_id) {
      sessionStorage.setItem('dash:articleId', String(selectedArticle.article_id));
    } else {
      sessionStorage.removeItem('dash:articleId');
    }
  }, [view, selectedArticle?.article_id]);

  const handleSearch = async (query) => {
    if (!query || !query.trim()) {
      setSections(originalSections);
      return;
    }

    setSearchQuery(query);
    setIsModalOpen(true);
    setModalStatus('searching');
    setSelectedCategory(null);

    try {
      const res = await api.get('/articles', { params: { keyword: query } });
      const foundArticles = res.data.articles;

      if (foundArticles && foundArticles.length > 0) {
        setSections([{
          category: ` "${query}" 연관 아티클`,
          theme: 'blue',
          items: foundArticles.slice(0, 5)
        }]);
        setIsModalOpen(false);
      } else {
        setModalStatus('not_found');
      }
    } catch (err) {
      console.error(err);
      // 400(부적절한 단어)은 전용 모달, 그 외 네트워크/서버 오류는 error 모달로 분기
      if (err.response && err.response.status === 400) {
        setModalStatus('inappropriate');
        setSearchQuery('');
        setSections(originalSections);
      } else {
        setModalStatus('error');
      }
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const resetDashboard = () => {
    setView('articles');
    setSelectedArticle(null);
    setSelectedCategory(null);
    setSearchQuery('');
    setSections(originalSections);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const replaceArticleInSections = (article) => {
    if (!article?.article_id) return;

    const replaceInList = (list) =>
      list.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.article_id === article.article_id
            ? { ...item, ...article }
            : item
        ),
      }));

    setSections((prev) => replaceInList(prev));
    setOriginalSections((prev) => replaceInList(prev));
  };

  const openArticleDetail = async (article) => {
    // articleDetail 끼리 이동(예: 추천 아티클 클릭) 시에는 최초 진입한 view 를 유지
    if (viewRef.current !== 'articleDetail') {
      previousViewRef.current = viewRef.current;
    }
    setSelectedArticle(article);
    setView('articleDetail');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!article?.article_id) return;

    try {
      const res = await api.post(`/articles/${article.article_id}/view`);
      setSelectedArticle(res.data);
      replaceArticleInSections(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openEmailingForAuthor = (authorNumb) => {
    if (!authorNumb) return;
    cameFromArticleDetailRef.current = true;
    setPendingAuthorNumb(authorNumb);
    setView('emailing');
  };

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
      if (emailingDetailRef.current) return;
      if (curriculumDetailRef.current) return;

      if (viewRef.current === 'emailing' && cameFromArticleDetailRef.current) {
        cameFromArticleDetailRef.current = false;
        setView('articleDetail');
        return;
      }

      if (
        viewRef.current === 'articleDetail' &&
        previousViewRef.current &&
        previousViewRef.current !== 'articleDetail' &&
        previousViewRef.current !== 'articles'
      ) {
        const prev = previousViewRef.current;
        previousViewRef.current = null;
        setView(prev);
        return;
      }

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
  }, [originalSections]);

  const ArticleListView = () => {
    // 👇 수정됨: 인라인 스타일 전부 CSS 클래스로 변경
    if (loading) return <p className="dashboardLoading">아티클 불러오는 중...</p>;
    if (error) return <p className="dashboardError">{error}</p>;
    if (sections.length === 0) return <p className="dashboardEmpty">표시할 아티클이 없습니다.</p>;

    const displaySections = selectedCategory
      ? sections.filter(s => s.category === selectedCategory)
      : sections.map((section) => ({
        ...section,
        items: section.items.slice(0, 5),
      }));

    return (
      <div className="categoryArticlePage">
        <div className="catTabBarTop">
          <button
            className={`catTabTop ${!selectedCategory ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory(null);
              setSections(originalSections);
              setSearchQuery('');
            }}
          >
            전체
          </button>

          {originalSections.map((s) => (
            <button
              key={s.category}
              className={`catTabTop ${selectedCategory === s.category ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(s.category);
                setSections(originalSections);
                setSearchQuery('');
              }}
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

            <div className="articleGrid">
              {section.items.map((item, index) => (
                <div
                  key={item.article_id || Math.random()}
                  className="articleCardShell"
                  onClick={() => openArticleDetail(item)}
                >
                  <article className="articleCard">
                    <div className="cardTop">
                      {item.article_thumbnail_url && <img src={item.article_thumbnail_url} alt="" loading="lazy" />}
                      <span className="cardTag"># {item.article_category || '기타'}</span>
                      <button
                        type="button"
                        className={`bookmarkBtn ${bookmarkedIds.has(item.article_id) ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(item.article_id); }}
                        aria-label={bookmarkedIds.has(item.article_id) ? '북마크 해제' : '북마크 추가'}
                      >
                        {bookmarkedIds.has(item.article_id) ? '★' : '☆'}
                      </button>
                    </div>
                    <div className="cardBottom">
                      <div className="cardTextGroup">
                        <h3 className="cardTitle">{item.article_title}</h3>
                        {index === 0 && item.article_preview_summary_title && (
                          <p className="cardPreviewTitle">{item.article_preview_summary_title}</p>
                        )}
                      </div>
                      <div className="cardMeta">
                        <span className="cardSource">{item.article_source || 'AI 리포트'}</span>
                        <span className="cardDot">·</span>
                        <span className="cardTime">
                          {item.article_published_date ? String(item.article_published_date).split('T')[0] : '최근'}
                        </span>
                        <span className="cardDot">·</span>
                        <span className="cardViews">👁 {(item.article_view_count ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </article>
                </div>
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
        user={user}
        canUseCurriculum={canUseCurriculum}
        currentView={view}
        onViewChange={(v) => {
          setView(v);
          setSelectedArticle(null);
        }}
        onLogout={onLogout}
        onScrollToTop={scrollToTop}
        onSearch={handleSearch}
        onReset={resetDashboard}
        isModalOpen={isModalOpen || isSubModalOpen}
      />

      {isModalOpen && <isModalOpenModal onClose={() => setIsModalOpen(false)} />}

      {view === 'articles' && (
        <HeroBanner
          showCreateCta={canCreateCurriculum}
          onCreateCurriculum={() => setView('curriculum')}
          onOpenArticle={openArticleDetail}
        />
      )}

      <main className="dashMain">
        {view === 'articles' && <ArticleListView />}
        {view === 'articleDetail' && (
          <ArticleDetailView
            article={selectedArticle}
            onBack={() => window.history.back()}
            onOpenEmailing={openEmailingForAuthor}
            isBookmarked={selectedArticle ? bookmarkedIds.has(selectedArticle.article_id) : false}
            onToggleBookmark={() => selectedArticle && toggleBookmark(selectedArticle.article_id)}
          />
        )}

        {view === 'curriculum' && canUseCurriculum && (
          user?.user_role === 'j'
            ? <LearnerCurriculumView curriculumDetailRef={curriculumDetailRef} />
            : <CurriculumView onOpenArticle={openArticleDetail} onModalToggle={setIsSubModalOpen} />
        )}

        {view === 'bookmarks' && (
          <MyBookmarksView
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={toggleBookmark}
            onOpenArticle={openArticleDetail}
          />
        )}

        {view === 'emailing' && (
          <EmailingView
            onOpenArticle={openArticleDetail}
            emailingDetailRef={emailingDetailRef}
            initialAuthorNumb={pendingAuthorNumb}
            onConsumePendingAuthor={() => setPendingAuthorNumb(null)}
          />
        )}
      </main>

      {isModalOpen && (
        <div className="modalOverlay">
          <div className="modalContent">
            {modalStatus === 'searching' && (
              <div className="modalSearchWrapper">
                <h3>🔍 아티클을 찾고 있습니다...</h3>
                <p className="modalSearchDesc">잠시만 기다려주세요.</p>
              </div>
            )}

            {modalStatus === 'not_found' && (
              <div className="modalNotFoundWrapper">
                <h3 className="modalNotFoundTitle">검색 결과 없음</h3>

                <p className="modalNotFoundDesc">
                  <strong className="modalNotFoundKeyword">"{searchQuery}"</strong>와(과) 연관된 전문 아티클이 존재하지 않습니다.<br />
                  다른 키워드나 문장으로 검색해 보시겠어요?
                </p>

                <div className="modalNotFoundBtnWrapper">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="modalNotFoundBtn"
                  >
                    확인
                  </button>
                </div>
              </div>
            )}
            {modalStatus === 'inappropriate' && (
              <div className="modalNotFoundWrapper">
                <h3 className="modalNotFoundTitle" style={{ color: '#e53e3e' }}>⚠️ 검색 오류</h3>
                <p className="modalNotFoundDesc">
                  적절하지 못한 단어로 검색을 하셨습니다.<br />
                  검색어를 다시 입력해주세요.
                </p>
                <div className="modalNotFoundBtnWrapper">
                  <button onClick={() => setIsModalOpen(false)} className="modalNotFoundBtn">
                    확인
                  </button>
                </div>
              </div>
            )}
            {modalStatus === 'error' && (
              <div className="modalNotFoundWrapper">
                <h3 className="modalNotFoundTitle">검색 중 오류가 발생했습니다</h3>
                <p className="modalNotFoundDesc">
                  잠시 후 다시 시도해주세요.<br />
                  문제가 계속되면 새로고침해보세요.
                </p>
                <div className="modalNotFoundBtnWrapper">
                  <button onClick={() => setIsModalOpen(false)} className="modalNotFoundBtn">
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;