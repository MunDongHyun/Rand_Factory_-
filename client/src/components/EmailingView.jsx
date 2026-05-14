import { useEffect, useState } from 'react';
import api from '../lib/api';
import '../styles/EmailingView.css';
import icon from '../public/챗봇_아이콘.png';

function formatPublishedDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function EmailingView({ onOpenArticle, emailingDetailRef }) {
  const [authors, setAuthors] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);

  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', reply_to: '', body: '' });
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    setListLoading(true);
    api.get('/authors')
      .then((res) => setAuthors(res.data.authors || []))
      .catch((err) => setListError(err.response?.data?.detail || '저자 목록을 불러오지 못했어요.'))
      .finally(() => setListLoading(false));
  }, []);

  // 상세 진입 시 history push + popstate로 뒤로가기 처리
  useEffect(() => {
    if (emailingDetailRef) emailingDetailRef.current = !!selectedAuthor;

    if (!selectedAuthor) return;

    window.history.pushState({ in: 'emailing-detail' }, '');

    const onPop = () => {
      setSelectedAuthor(null);
      setEmailModalOpen(false);
      setSendResult(null);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [selectedAuthor, emailingDetailRef]);

  const handleAuthorClick = async (authorListItem) => {
    setDetailError(null);
    setSelectedAuthor({ ...authorListItem, articles: [] });
    setDetailLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const res = await api.get(`/authors/${authorListItem.author_numb}`);
      setSelectedAuthor(res.data);
    } catch (err) {
      setDetailError(err.response?.data?.detail || '저자 상세 정보를 불러오지 못했어요.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedAuthor(null);
    setEmailModalOpen(false);
    setSendResult(null);
  };

  const openEmailModal = () => {
    setEmailForm({ subject: '', reply_to: '', body: '' });
    setSendResult(null);
    setEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedAuthor) return;
    if (!emailForm.subject.trim()) {
      setSendResult({ ok: false, msg: '제목을 입력하세요.' });
      return;
    }
    if (!emailForm.body.trim()) {
      setSendResult({ ok: false, msg: '내용을 입력하세요.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      await api.post(`/authors/${selectedAuthor.author_numb}/email`, {
        subject: emailForm.subject,
        body: emailForm.body,
        reply_to: emailForm.reply_to || null,
      });
      setSendResult({ ok: true, msg: '메일을 보냈습니다.' });
      setEmailForm({ subject: '', reply_to: '', body: '' });
    } catch (err) {
      const detail = err.response?.data?.detail || '메일 발송에 실패했습니다.';
      setSendResult({ ok: false, msg: detail });
    } finally {
      setSending(false);
    }
  };

  // ===== 저자 목록 =====
  if (!selectedAuthor) {
    return (
      <div className="emailingContainer">
        <h2 className="sectionTitle">저자 이메일링</h2>
        {listLoading && <p className="emailingHint">저자 목록을 불러오는 중...</p>}
        {listError && <p className="emailingError">{listError}</p>}
        {!listLoading && !listError && authors.length === 0 && (
          <p className="emailingHint">표시할 저자가 없습니다.</p>
        )}
        <div className="authorGrid">
          {authors.map((author) => {
            const hasEmail = !!author.author_email;
            const topCats = (author.categories || []).slice(0, 3);
            return (
              <div
                key={author.author_numb}
                className="authorCard"
                onClick={() => handleAuthorClick(author)}
              >
                <img src={icon} className="authorCardAvatar" alt="" />

                <div className="authorCardInfo">
                  <p className="authorCardName">{author.author_name}</p>
                  <p className="authorCardCareer">{author.author_from || '소속 정보 없음'}</p>
                  <p className="authorCardIntro">
                    {hasEmail ? author.author_email : '등록된 이메일 없음'}
                    {' · '}
                    아티클 {author.article_count}건
                  </p>
                  <div className="authorCardTags">
                    {topCats.map((tag) => (
                      <span key={tag} className="authorCardTag"># {tag}</span>
                    ))}
                  </div>
                </div>

                <div className="authorCardArrow">▶</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== 저자 상세 =====
  const hasEmail = !!selectedAuthor.author_email;

  return (
    <div className="emailingContainer">
      <button className="authorBackBtn" onClick={handleBack}>← 목록으로</button>

      <div className="authorDetailBox">

        {/* 상단 프로필 */}
        <div className="authorProfile">
          <img src={icon} className="authorProfileAvatar" alt="" />
          <div className="authorProfileInfo">
            <h3 className="authorProfileName">{selectedAuthor.author_name}</h3>
            <p className="authorProfileCareer">{selectedAuthor.author_from || '소속 정보 없음'}</p>
            <p className="authorProfileIntro">
              {(selectedAuthor.categories || []).map((c) => `#${c}`).join(' ') || '카테고리 정보 없음'}
            </p>
            <p className="authorProfileEmail">{selectedAuthor.author_email || '등록된 이메일 없음'}</p>
          </div>
        </div>

        <div className="authorProfileDivider" />

        {/* 작성한 기사 */}
        <div className="authorWorksSection">
          <p className="authorWorksTitle">저자가 작성한 아티클</p>
          <div className="authorWorksDivider" />
          {detailLoading && <p className="emailingHint">불러오는 중...</p>}
          {detailError && <p className="emailingError">{detailError}</p>}
          {!detailLoading && !detailError && (selectedAuthor.articles || []).length === 0 && (
            <p className="emailingHint">매핑된 아티클이 없습니다.</p>
          )}
          <div className="authorWorksGrid">
            {(selectedAuthor.articles || []).map((work) => (
              <article
                key={work.article_id}
                className="articleCard"
                onClick={() => onOpenArticle && onOpenArticle(work)}
                style={onOpenArticle ? { cursor: 'pointer' } : undefined}
              >
                <div className="cardTop">
                  {work.article_thumbnail_url && (
                    <img src={work.article_thumbnail_url} alt="" loading="lazy" />
                  )}
                  <span className="cardTag"># {work.article_category || '기타'}</span>
                </div>
                <div className="cardBottom">
                  <h3 className="cardTitle">{work.article_title}</h3>
                  <div className="cardMeta">
                    <span className="cardSource">{work.article_source || '-'}</span>
                    <span className="cardDot">·</span>
                    <span className="cardTime">{formatPublishedDate(work.article_published_date)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* 이메일 작성 버튼 */}
        <div className="authorEmailBtnWrap">
          <button
            className="authorEmailBtn"
            onClick={openEmailModal}
            disabled={!hasEmail}
            title={hasEmail ? '이메일 작성' : '저자의 이메일이 등록돼 있지 않습니다'}
          >
            {hasEmail ? '이메일 작성' : '이메일 정보 없음'}
          </button>
        </div>
      </div>

      {/* 이메일 작성 모달 */}
      {emailModalOpen && (
        <>
          <div className="emailModalOverlay" onClick={() => setEmailModalOpen(false)} />
          <div className="emailModal">

            <div className="emailModalHeader">
              <input
                type="text"
                className="emailModalSubjectInput"
                placeholder="제목"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                autoFocus
              />
              <button className="emailModalClose" onClick={() => setEmailModalOpen(false)}>✕</button>
            </div>
            <div className="emailModalDivider" />

            <div className="emailModalField">
              <label className="emailModalLabel">받는 사람</label>
              <div className="emailModalInput">{selectedAuthor.author_email}</div>
            </div>

            <div className="emailModalField">
              <label className="emailModalLabel">답장받을 이메일 (선택)</label>
              <div className="emailModalInput">
                <input
                  type="email"
                  placeholder="비워두면 내 계정으로 답장이 옵니다"
                  value={emailForm.reply_to}
                  onChange={(e) => setEmailForm({ ...emailForm, reply_to: e.target.value })}
                />
              </div>
            </div>

            <div className="emailModalBody">
              <textarea
                className="emailModalTextarea"
                placeholder="내용을 입력하세요"
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
              />
            </div>

            {sendResult && (
              <p className={sendResult.ok ? 'emailingHint' : 'emailingError'} style={{ padding: '0 24px' }}>
                {sendResult.msg}
              </p>
            )}

            <div className="emailModalFooter">
              <button className="emailSendBtn" onClick={handleSendEmail} disabled={sending}>
                {sending ? '전송 중...' : '전송'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default EmailingView;
