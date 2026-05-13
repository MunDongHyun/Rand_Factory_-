import { useEffect, useState } from 'react';
import api from '../lib/api';

function ArticleDetailView({ article, onBack }) {
  const [viewedArticle, setViewedArticle] = useState(article);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    setViewedArticle(article);
    if (!article?.article_id) return;

    let cancelled = false;
    api.get(`/articles/${article.article_id}`)
      .then((res) => {
        if (!cancelled) setViewedArticle(res.data);
      })
      .catch(() => {
        if (!cancelled) setViewedArticle(article);
      });

    return () => { cancelled = true; };
  }, [article?.article_id]);

  useEffect(() => {
    if (!article?.article_id) return;

    let cancelled = false;
    setSummary(null);
    setSummaryError(null);

    if (article.article_has_summary === false) {
      setSummaryLoading(false);
      setSummaryError('아직 등록된 AI 요약문이 없습니다.');
      return () => { cancelled = true; };
    }

    setSummaryLoading(true);

    api.get(`/articles/${article.article_id}/summary`)
      .then((res) => {
        if (!cancelled) setSummary(res.data.summary_text || null);
      })
      .catch((err) => {
        if (!cancelled) {
          const detail = err.response?.status === 404
            ? '아직 등록된 AI 요약문이 없습니다.'
            : err.response?.data?.detail || '요약문을 불러오지 못했어요.';
          setSummaryError(detail);
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => { cancelled = true; };
  }, [article?.article_id, article?.article_has_summary]);

  const displayArticle = viewedArticle || article;

  if (!displayArticle) return null;

  const metadata = summary?.metadata || {};
  const cardNews = Array.isArray(summary?.card_news) ? summary.card_news : [];
  const conclusion = summary?.ojt_conclusion || null;

  return (
    <div className="articleDetailContainer">
      <button className="detailBackBtn" onClick={onBack}>목록으로</button>
      <div className="articleDetailContent">
        {displayArticle.article_thumbnail_url && (
          <div className="articleDetailHero">
            <img src={displayArticle.article_thumbnail_url} alt={displayArticle.article_title} />
          </div>
        )}

        <h1 className="articleDetailTitle">{displayArticle.article_title}</h1>
        <div className="articleDetailMeta">
          <span>{displayArticle.article_source}</span>
          {displayArticle.article_author && <> <span className="cardDot">·</span> <span>{displayArticle.article_author}</span></>}
          {displayArticle.article_published_date && <> <span className="cardDot">·</span> <span>{displayArticle.article_published_date}</span></>}
          {displayArticle.article_category && <> <span className="cardDot">·</span> <span># {displayArticle.article_category}</span></>}
          <span className="cardDot">·</span>
          <span>조회 {displayArticle.article_view_count ?? 0}</span>
        </div>

        {summaryLoading && <p className="articleSummaryState">요약문을 불러오는 중...</p>}
        {summaryError && <p className="articleSummaryState">{summaryError}</p>}

        {summary && (
          <div className="articleSummary">
            <div className="summaryIntro">
              <p className="summaryEyebrow">AI 요약문</p>
              <h2>{metadata.title || displayArticle.article_title}</h2>
              <p>
                {[metadata.author, metadata.category].filter(Boolean).join(' · ')}
              </p>
            </div>

            {summary.theme_analysis && (
              <section className="summarySection">
                <h3>주제 분석</h3>
                <p>{summary.theme_analysis}</p>
              </section>
            )}

            {cardNews.length > 0 && (
              <section className="summarySection">
                <h3>카드 뉴스</h3>
                <div className="summaryCardGrid">
                  {cardNews.map((card, index) => (
                    <article className="summaryCard" key={`${card.card_step || index}-${card.card_title || index}`}>
                      <span>{card.card_step || `Card ${index + 1}`}</span>
                      <h4>{card.card_title}</h4>
                      {card.keyword && <p className="summaryKeyword"># {card.keyword}</p>}
                      <p className="summaryCore">{card.core_message}</p>
                      <p>{card.detailed_summary}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {conclusion && (
              <section className="summarySection summaryConclusion">
                <h3>{conclusion.title || '실무 적용 가이드'}</h3>
                {conclusion.practice_task && (
                  <div>
                    <strong>실습 과제</strong>
                    <p>{conclusion.practice_task}</p>
                  </div>
                )}
                {conclusion.discussion_topic && (
                  <div>
                    <strong>토론 주제</strong>
                    <p>{conclusion.discussion_topic}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ArticleDetailView;
