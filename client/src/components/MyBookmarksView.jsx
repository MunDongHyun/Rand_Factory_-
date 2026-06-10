import { useEffect, useState } from 'react';
import { fetchMyBookmarks } from '../lib/bookmarks';

function MyBookmarksView({ bookmarkedIds, onToggleBookmark, onOpenArticle }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyBookmarks()
      .then((data) => {
        if (!cancelled) setItems(data.articles || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || '북마크 목록을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 사용자가 토글로 북마크 해제하면 화면에서도 즉시 제거 (재요청 안 함)
  const visibleItems = items.filter((it) => bookmarkedIds.has(it.article_id));

  if (loading) return <p className="bookmarkListStatus">북마크 불러오는 중...</p>;
  if (error) return <p className="bookmarkListStatus error">{error}</p>;

  return (
    <div className="bookmarkPage">
      <h2 className="sectionTitle">내 북마크</h2>
      {visibleItems.length === 0 ? (
        <p className="bookmarkEmpty">아직 북마크한 아티클이 없습니다. 카드의 별을 눌러 저장해보세요.</p>
      ) : (
        <div className="bookmarkGrid">
          {visibleItems.map((item) => (
            <div
              key={item.article_id}
              className="articleCardShell"
              onClick={() => onOpenArticle(item)}
            >
              <article className="articleCard">
                <div className="cardTop">
                  {item.article_thumbnail_url && <img src={item.article_thumbnail_url} alt="" loading="lazy" />}
                  <span className="cardTag"># {item.article_category || '기타'}</span>
                  <button
                    type="button"
                    className="bookmarkBtn active"
                    onClick={(e) => { e.stopPropagation(); onToggleBookmark(item.article_id); }}
                    aria-label="북마크 해제"
                  >
                    ★
                  </button>
                </div>
                <div className="cardBottom">
                  <div className="cardTextGroup">
                    <h3 className="cardTitle">{item.article_title}</h3>
                  </div>
                  <div className="cardMeta">
                    {item.article_published_date && (
                      <>
                        <span className="cardTime">
                          {String(item.article_published_date).split('T')[0]}
                        </span>
                        <span className="cardDot">·</span>
                      </>
                    )}
                    <span className="cardSource">저장: {new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyBookmarksView;
