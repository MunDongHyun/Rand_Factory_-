function ArticleDetailView({ article, onBack }) {
  return (
    <div className="articleDetailContainer">
      <button className="detailBackBtn" onClick={onBack}>← 뒤로가기</button>
      <div className="articleDetailContent">
        <h1 className="articleDetailTitle">{article.title}</h1>
        <div className="articleDetailBody">
          <p>{article.summary ?? '요약 내용이 없습니다.'}</p>
        </div>
      </div>
    </div>
  );
}

export default ArticleDetailView;