import { useState } from 'react';
import '../styles/EmailingView.css';
import icon from '../public/챗봇_아이콘.png'

const DUMMY_AUTHORS = [
  {
    id: 1,
    name: '김철수',
    career: '10년차 | 마케팅 | ABC기업',
    intro: '디지털 마케팅 전문가로 다양한 기업의 브랜드 전략을 수립해왔습니다.',
    email: 'kimcs@abc.com',
    articles: ['#마케팅', '#전략'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 2,
    name: '이영희',
    career: '7년차 | 전략 | DEF기업',
    intro: '경영 전략 컨설턴트로 중소기업 성장 전략을 전문으로 합니다.',
    email: 'leeyh@def.com',
    articles: ['#전략', '#혁신'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 3,
    name: '박민준',
    career: '5년차 | AI | GHI기업',
    intro: 'AI 기반 업무 혁신 전문가로 자동화 솔루션을 연구합니다.',
    email: 'parkmj@ghi.com',
    articles: ['#AI', '#자동화'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 4,
    name: '최수진',
    career: '12년차 | 리더십 | JKL기업',
    intro: '조직 문화와 리더십 개발을 전문으로 하는 HR 전문가입니다.',
    email: 'choisj@jkl.com',
    articles: ['#리더십', '#조직문화'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 5,
    name: '정다은',
    career: '8년차 | 세일즈 | MNO기업',
    intro: 'B2B 세일즈 전략과 고객 관계 관리를 전문으로 합니다.',
    email: 'jungde@mno.com',
    articles: ['#세일즈', '#B2B'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 6,
    name: '한기훈',
    career: '15년차 | 혁신 | PQR기업',
    intro: '비즈니스 혁신과 디지털 전환을 이끄는 전략가입니다.',
    email: 'hankh@pqr.com',
    articles: ['#혁신', '#디지털전환'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 7,
    name: '오세영',
    career: '6년차 | 콘텐츠 | STU기업',
    intro: '콘텐츠 마케팅과 브랜드 스토리텔링 전문가입니다.',
    email: 'ohsy@stu.com',
    articles: ['#콘텐츠', '#브랜딩'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 8,
    name: '임재현',
    career: '9년차 | 데이터 | VWX기업',
    intro: '데이터 분석 기반 비즈니스 의사결정을 전문으로 합니다.',
    email: 'limjh@vwx.com',
    articles: ['#데이터', '#분석'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
  {
    id: 9,
    name: '강미래',
    career: '4년차 | 스타트업 | YZA기업',
    intro: '스타트업 생태계와 초기 창업 전략을 연구합니다.',
    email: 'kangmr@yza.com',
    articles: ['#스타트업', '#창업'],
    works: Array(5).fill({ title: '디지털 전환 시대의 마케팅 패러다임', tags: '#전략 #마케팅 #혁신' })
  },
];

function EmailingView() {
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ title: '', to: '', from: '', content: '' });

  const handleAuthorClick = (author) => {
    setSelectedAuthor(author);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedAuthor(null);
    setEmailModalOpen(false);
  };

  // ===== 저자 목록 =====
  if (!selectedAuthor) {
    return (
      <div className="emailingContainer">
        <h2 className="sectionTitle">저자 이메일링</h2>
        <div className="authorGrid">
          {DUMMY_AUTHORS.map((author) => (
            <div
              key={author.id}
              className="authorCard"
              onClick={() => handleAuthorClick(author)}
            >
              {/* 아바타 이미지*/}
              <img src={icon} className="authorCardAvatar" />

              {/* 저자 정보 */}
              <div className="authorCardInfo">
                <p className="authorCardName">{author.name}</p>
                <p className="authorCardCareer">{author.career}</p>
                <p className="authorCardIntro">{author.intro}</p>
                <div className="authorCardTags">
                  {author.articles.map((tag, i) => (
                    <span key={i} className="authorCardTag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="authorCardArrow">▶</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===== 저자 상세 =====
  return (
    <div className="emailingContainer">
      <button className="authorBackBtn" onClick={handleBack}>← 목록으로</button>

      <div className="authorDetailBox">

        {/* 상단 프로필 */}
        <div className="authorProfile">
          <img src={icon} className="authorProfileAvatar" />
          <div className="authorProfileInfo">
            <h3 className="authorProfileName">{selectedAuthor.name}</h3>
            <p className="authorProfileCareer">{selectedAuthor.career}</p>
            <p className="authorProfileIntro">{selectedAuthor.intro}</p>
            <p className="authorProfileEmail">{selectedAuthor.email}</p>
          </div>
        </div>

        <div className="authorProfileDivider" />

        {/* 작성한 기사 */}
        <div className="authorWorksSection">
          <p className="authorWorksTitle">저자가 DBR에서 작성한 기사</p>
          <div className="authorWorksDivider" />
          <div className="authorWorksGrid">
            {selectedAuthor.works.map((work, i) => (
              <article key={i} className="articleCard">
                <div className="cardTop">
                  <span className="cardTag">{work.tags}</span>
                </div>
                <div className="cardBottom">
                  <h3 className="cardTitle">{work.title}</h3>
                  <div className="cardMeta">
                    <span className="cardSource">출처</span>
                    <span className="cardDot">·</span>
                    <span className="cardTime">2시간 전</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* 이메일 작성 버튼 */}
        <div className="authorEmailBtnWrap">
          <button className="authorEmailBtn" onClick={() => setEmailModalOpen(true)}>
            이메일 작성
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
                value={emailForm.title}
                onChange={(e) => setEmailForm({ ...emailForm, title: e.target.value })}
                autoFocus 
              />

              <button className="emailModalClose" onClick={() => setEmailModalOpen(false)}>✕</button>
            </div>
            <div className="emailModalDivider" />

            <div className="emailModalField">
              <label className="emailModalLabel">받는 사람</label>
              <div className="emailModalInput">{selectedAuthor.email}</div>
            </div>

            <div className="emailModalField">
              <label className="emailModalLabel">보내는 사람</label>
              <div className="emailModalInput">
                <input
                  type="text"
                  placeholder="이메일을 입력하세요"
                  value={emailForm.from}
                  onChange={(e) => setEmailForm({ ...emailForm, from: e.target.value })}
                />
              </div>
            </div>

            <div className="emailModalBody">
              <textarea
                className="emailModalTextarea"
                placeholder="내용을 입력하세요"
                value={emailForm.content}
                onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })}
              />
            </div>

            <div className="emailModalFooter">
              <button className="emailSendBtn">전송</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default EmailingView;