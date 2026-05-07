import { useState } from 'react';
import '../styles/Dashboard.css';

function Header({ onViewChange, onLogout, onScrollToTop, onScrollToArticle}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="dashHeader">
        <div className="headerContent">
          <div className="dashLogo" 
               onClick={() => { 
                onViewChange('articles'); 
                setMenuOpen(false); }}>
            LANDFACTORY
          </div>

          <div className="searchContainer">
            <input type="text" className="searchInput" placeholder="검색어를 입력하세요" />
          </div>

          <div className="headerIcons">
            <div className="avatarCircle" onClick={onLogout} />
            <button className="hamburgerBtn" onClick={() => setMenuOpen(true)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
        <div className="bottomLine" />
      </header>

      {menuOpen && <div className="drawerOverlay" onClick={() => setMenuOpen(false)} />}

      <nav className={`sideDrawer ${menuOpen ? 'open' : ''}`}>
        <button className="drawerClose" onClick={() => setMenuOpen(false)}>✕</button>
        <ul className="drawerMenu">
          <li onClick={() => { 
            onViewChange('articles'); 
            setMenuOpen(false); 
            setTimeout(()=> onScrollToTop(),100); 
            }}>아티클 페이지</li>

          
          <li onClick={() => { 
            onViewChange('curriculum'); 
            setMenuOpen(false); }
            }>커리큘럼 관리</li>
            
          <li onClick={() => { 
            onViewChange('emailing'); 
            setMenuOpen(false); 
            }}>저자 이메일링</li>

          <li className="drawerLogout" onClick={() => { 
            onLogout(); setMenuOpen(false); 
            }}>로그아웃</li>

        </ul>
      </nav>
    </>
  );
}

export default Header;