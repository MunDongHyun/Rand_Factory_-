function ArticleDetailView({ article, onBack }) {
  if (!article) return null;
  return (
    <div className="articleDetailContainer">
      <button className="detailBackBtn" onClick={onBack}>← 뒤로가기</button>
      <div className="articleDetailContent">
        <h1 className="articleDetailTitle">{article.article_title}</h1>
        <div className="articleDetailMeta" style={{ margin: '8px 0 24px', color: '#666', fontSize: '14px' }}>
          <span>{article.article_source}</span>
          {article.article_author && <> · <span>{article.article_author}</span></>}
          {article.article_published_date && <> · <span>{article.article_published_date}</span></>}
          {article.article_category && <> · <span># {article.article_category}</span></>}
        </div>
        <div className="articleDetailBody">
          <p>본문 및 시각화는 추후 연결 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}

export default ArticleDetailView;
