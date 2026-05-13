import { useEffect, useState } from 'react';
import api from '../lib/api';
import "../styles/ArticleDetailView.css"

function ArticleDetailView({ article, onBack }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [animating, setAnimating] = useState(false);

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
    setCurrentStep(nextStep);
    setTimeout(() => {
      setAnimating(false);
    }, 300);
  };

  const displayArticle = article;

  if (!displayArticle) return null;

  const metadata = summary?.metadata || {};
  const cardNews = Array.isArray(summary?.card_news) ? summary.card_news : [];
  const conclusion = summary?.ojt_conclusion || null;

  const rawCards = Array.isArray(summary?.card_news) && summary.card_news.length > 0
    ? summary.card_news
    : [
      {
        card_step: "01",
        card_title: "디지털 전환 시대의 마케팅",
        keyword: "DX_마케팅",
        core_message: "데이터 기반의 맞춤형 고객 경험 설계",
        detailed_summary: "AI 기능이 제품과 서비스 전반에 빠르게 확산되면서... (중략) 신뢰를 의도적으로 설계해야 합니다."
      },
      {
        card_step: "02",
        card_title: "보이지 않는 AI를 보이게 만들어야 신뢰가 생긴다",
        keyword: "투명성 가시화",
        core_message: "이해 가능한 핵심 정보의 구조화",
        detailed_summary: "고객은 복잡한 알고리즘 설명보다 이 기능이 무엇을 하는지... (중략) 시각화하고 쉬운 언어로 재구성해야 합니다."
      }
    ];

  const slides = rawCards.map(card => ({
    ...card,
    contentParagraphs: (card.detailed_summary || "").match(/[^.!?]+[.!?]+/g) || [card.detailed_summary]
  }));

  return (
    <div className="articleDetailContainer">
      <button className="detailBackBtn" onClick={onBack}>목록으로</button>

      <div className="articleDetailContent">
        {displayArticle.article_thumbnail_url && (
          <div className="articleDetailHero">
            <img src={displayArticle.article_thumbnail_url} alt={displayArticle.article_title} loading="lazy" />
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
              <div className="carouselWrapper">
                <div className="sliderStage">
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
                        <div key={index} className={`slideCard ${pos}`}>
                          <div className="slideCardInner">
                            <div className="leftSection">
                              <div className="cardNum">{slide.card_step}</div>
                              <h2 className="cardTitle">{slide.card_title}</h2>
                              <p className="cardMain">"{slide.core_message}"</p>
                            </div>
                            <div className="dividerLine" />
                            <div className="rightSection">
                              {slide.contentParagraphs.map((sentence, sIdx) => (
                                <span key={sIdx} className="sentence-item">{sentence.trim()}</span>
                              ))}
                            </div>
                          </div>
                          <div className="cardTag"># {slide.keyword}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="navGroup">
                    <button 
                      className="navBtn prev" 
                      onClick={() => goTo(currentStep - 1)} 
                      disabled={currentStep === 0}
                    >PREV</button>
                    {currentStep === slides.length - 1 ? (
                      <button className="navBtn next" onClick={() => goTo(0)}>REPLAY</button>
                    ) : (
                      <button className="navBtn next" onClick={() => goTo(currentStep + 1)}>NEXT</button>
                    )}
                  </div>
                </div>
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
