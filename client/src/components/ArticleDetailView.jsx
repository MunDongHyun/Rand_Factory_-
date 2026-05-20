import { useEffect, useState } from 'react';
import api from '../lib/api';
import "../styles/ArticleDetailView.css"

function ArticleDetailView({ article, onBack, onOpenEmailing }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

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

  const goTo = (nextStep) => {
    if (animating) return;
    setAnimating(true);
    setExpandedCard(null);
    setCurrentStep(nextStep);
    setTimeout(() => {
      setAnimating(false);
    }, 300);
  };

  const toggleCard = (index) => {
    setExpandedCard(prev => prev === index ? null : index);
  };

  const displayArticle = article;
  if (!displayArticle) return null;

  const metadata = summary?.metadata || {};
  const cardNews = Array.isArray(summary?.card_news) ? summary.card_news : [];
  const conclusion = summary?.ojt_conclusion || null;

  const rawCards = Array.isArray(summary?.card_news) && summary.card_news.length > 0
    ? summary.card_news
    : [];

  const slides = rawCards.map(card => ({
    ...card,
    contentParagraphs: (card.detailed_summary || "").match(/[^.!?]+[.!?]+/g) || [card.detailed_summary]
  }));

  return (
    <div className="articleDetailContainer">
      <div className="articleDetailContent">
        {displayArticle.article_thumbnail_url && (
          <div className="articleDetailHero">
            <img src={displayArticle.article_thumbnail_url} alt={displayArticle.article_title} loading="lazy" />
          </div>
        )}

        <h1 className="articleDetailTitle">{displayArticle.article_title}</h1>
        <div className="articleDetailMeta">
          <span>{displayArticle.article_source}</span>
          {Array.isArray(displayArticle.authors) && displayArticle.authors.length > 0 ? (
            <>
              <span className="cardDot">·</span>
              <span className="articleAuthorList">
                {displayArticle.authors.map((author, idx) => (
                  <span key={author.author_numb} className="articleAuthorItem">
                    {idx > 0 && <span className="articleAuthorSep">, </span>}
                    <span>{author.author_name}</span>
                    {author.author_email && onOpenEmailing && (
                      <button
                        type="button"
                        className="authorMailBtn"
                        onClick={() => onOpenEmailing(author.author_numb)}
                        aria-label={`${author.author_name}에게 이메일 보내기`}
                        title={`${author.author_name}에게 이메일 보내기`}
                      >
                        ✉
                      </button>
                    )}
                  </span>
                ))}
              </span>
            </>
          ) : (
            displayArticle.article_author && <> <span className="cardDot">·</span> <span>{displayArticle.article_author}</span></>
          )}
          {displayArticle.article_published_date && <> <span className="cardDot">·</span> <span>{displayArticle.article_published_date}</span></>}
          {displayArticle.article_category && <> <span className="cardDot">·</span> <span># {displayArticle.article_category}</span></>}
          <span className="cardDot">·</span>
          <span className="summaryView">👁 조회 {(displayArticle.article_view_count ?? 0).toLocaleString()}</span>
        </div>

        {summaryLoading && <p className="articleSummaryState">요약문을 불러오는 중...</p>}
        {summaryError && <p className="articleSummaryState">{summaryError}</p>}

        {summary && (
          <div className="articleSummary">
            <div className='topDivider' />

            <div className="summaryHeader">
              <p className="summaryEyebrow">AI 요약문</p>
              <h2 className="summaryTitle">{metadata.title || displayArticle.article_title}</h2>
              <p className="summaryMeta">
                {[metadata.category].filter(Boolean).join(' · ')}
              </p>

              {displayArticle.article_source_url && (
                <a
                  className="originalArticleBtn"
                  href={displayArticle.article_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  원문 아티클 보기 →
                </a>
              )}

              {summary.theme_analysis && (
                <div className='summaryThemeWrapper'>
                  <div className="summaryDivider" />
                  <p className="summaryTheme">{summary.theme_analysis}</p>
                </div>
              )}
            </div>

            {cardNews.length > 0 && (
              <section
                className="summarySection"
                onClick={() => {
                  if (expandedCard !== null) {
                    setExpandedCard(null);
                  }
                }}
              >

                <div className="carouselWrapper">
                  <div className="sliderStage">
                    {expandedCard !== null && currentStep > 0 && (
                      <button className="sliderNavBtn left" onClick={() => goTo(currentStep - 1)}>&#10216;</button>
                    )}
                    {expandedCard !== null && currentStep < slides.length - 1 && (
                      <button className="sliderNavBtn right" onClick={() => goTo(currentStep + 1)}>&#10217;</button>
                    )}
                    <div className="slideProgress">
                      {slides.map((_, i) => (
                        <div key={i} className={`progressDot ${i === currentStep ? 'active' : ''}`} />
                      ))}
                    </div>

                    <div className="slideCardTrack">
                      {slides.map((slide, index) => {
                        const diff = index - currentStep;
                        if (Math.abs(diff) > 1) return null;
                        let pos = diff === 0 ? 'current' : (diff === -1 ? 'prev' : 'next');

                        return (
                          <div key={index}
                            className={`slideCard ${pos} ${expandedCard === index ? 'expanded' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (pos === 'current') {
                                e.currentTarget.style.transition = 'none';
                                setExpandedCard(index);
                              } else if (pos === 'prev') {
                                goTo(currentStep - 1);
                              } else if (pos === 'next') {
                                goTo(currentStep + 1);
                              }
                            }}
                          >

                            {pos === 'prev' && (
                              <div className="navArrowOverlay leftArrow">
                                <span>&#10216;</span>
                              </div>
                            )}
                            {pos === 'next' && (
                              <div className="navArrowOverlay rightArrow">
                                <span>&#10217;</span>
                              </div>
                            )}

                            <div className="slideCardInner">
                              <div className="leftSection" >
                                <div className="cardNum">{slide.card_step}</div>
                                <h2 className="cardTitle">{slide.card_title}</h2>
                                <p className="cardMain">"{slide.core_message}"</p>
                                <div className="cardKeyTag"># {slide.keyword}</div>
                              </div>




                              {expandedCard === index && (
                                <>
                                  <div className="dividerLine" />
                                  <div className="rightSection">
                                    {slide.contentParagraphs.map((sentence, sIdx) => (
                                      <span key={sIdx} className="sentence-item">{sentence.trim()}</span>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                            <button
                              className={`cardExpandBtn ${expandedCard === index ? 'isExpanded' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCard(index);
                              }}
                            >
                              {expandedCard === index ? '간략히 보기' : '자세히 보기'}
                              <span className="arrowIcon">{expandedCard === index ? ' ▴' : ' ▾'}</span>
                            </button>
                          </div>
                        );
                      })}

                      {currentStep === slides.length - 1 && (
                        <div
                          className="slideClickArea right replay"
                          onClick={(e) => {
                            e.stopPropagation();
                            goTo(0)
                          }}
                          title="처음부터 다시 보기"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {conclusion && (
              <section className="summaryConclusion">
                <div className="conclusionHeader">
                  <span className="conclusionEyebrow">OJT</span>
                  <h3>{conclusion.title || '실무 적용 가이드'}</h3>
                </div>
                <div className="ojtGrid">
                  {conclusion.practice_task && (
                    <div className="ojtCard">
                      <div className="ojtCardNum">01</div>
                      <div className="ojtCardBody">
                        <div className="ojtCardLabel">실습 과제</div>
                        <p>{conclusion.practice_task}</p>
                      </div>
                    </div>
                  )}
                  {conclusion.discussion_topic && (
                    <div className="ojtCard">
                      <div className="ojtCardNum">02</div>
                      <div className="ojtCardBody">
                        <div className="ojtCardLabel">토론 주제</div>
                        <p>{conclusion.discussion_topic}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <button className="detailBackBtn" onClick={onBack}>목록으로</button>
    </div >
  );
}

export default ArticleDetailView;