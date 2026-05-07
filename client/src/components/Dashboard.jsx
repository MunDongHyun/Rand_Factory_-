import { useState , useRef} from 'react';
import Header from './Header';
import '../styles/Dashboard.css';
import CurriculumView from './CurriculumView';
import EmailingView from './EmailingView';
import ArticleDetailView from './ArticleDetailView';


const DASHBOARD_DATA = [
  {
    category: "좋은 기업 매너란?",
    theme: 'blue',
    items: Array(5).fill({ title: "디지털 전환 시대의 마케팅 패러다임", tags: "# 전략 #마케팅 #혁신" })
  },
  {
    category: "AI 업데이트",
    theme: 'green',
    items: Array(5).fill({ title: "AI 휴머노이드 로봇 대인기", tags: "# 전략 #마케팅 #혁신" })
  },

  {
    category: "마케팅 / 세일즈 ",
    theme: 'brown',
    items: Array(5).fill({ title: "디지털 전환 시대의 마케팅 패러다임", tags: "# 전략 #마케팅 #혁신" })
  }
];

function Dashboard({ user, onLogout }) {
  const [view, setView] = useState('articles');
  const [selectedArticle, setSelectedArticle] = useState(null);

  const scrollToTop = () =>{
    window.scrollTo({top:0, behavior:'smooth'});
  };


  const ArticleListView = () => (
    <>


      <div className="serviceIntroBanner">
        <h3>LANDFACTORY</h3>
        <p>DBR 아티클을 통해 비즈니스 인사이트를 요약하고 시각화하여 제공합니다.</p>
        <p>사용자는 제공된 아티클을 기반으로 기업 교육에 필요한 커리큘럼을 생성할 수 있습니다. </p>
        <button className="heroCta" onClick={() => setView('curriculum')}>
          커리큘럼 생성하기
        </button>
      </div>

      {DASHBOARD_DATA.map((section, idx) => (
        <section key={idx} className={'sectionGroup highlightSection'} data-theme={section.theme}>
          <h2 className="sectionTitle">{section.category}</h2>
          <div className="articleGrid">
            {section.items.map((item, i) => (
              <article key={i} 
                className="articleCard"
                onClick={()=> {
                  setSelectedArticle(item);
                  setView('articleDetail');
                  window.scrollTo({top:0,behavior:'smooth'});
                }}
                >
                <div className="cardTop">
                  <span className="cardTag">{item.tags}</span>
                </div>
                <div className="cardBottom">
                  <h3 className="cardTitle">{item.title}</h3>
                  <div className="cardMeta">
                    <span className="cardSource">출처</span>
                    <span className="cardDot">·</span>
                    <span className="cardTime">2시간 전</span>
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
        onViewChange={(v)=>{
          setView(v);
          setSelectedArticle(null);
        }}
        onLogout={onLogout} 
        onScrollToTop={scrollToTop}
      />

      <main className="dashMain">
        {view === 'articles' && <ArticleListView /> }
        {view === 'articleDetail' && 
          (<ArticleDetailView
            article={selectedArticle}
            onBack={()=> {
              setView('articles');
              window.scrollTo({ top:0 , behavior: 'smooth'});
            }}
          />
          )}
        {view === 'curriculum' && <CurriculumView /> }
        {view === 'emailing' && <EmailingView /> }
        
      </main>

    </div>
  );
}

export default Dashboard;