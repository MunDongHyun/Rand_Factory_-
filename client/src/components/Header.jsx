import { useState } from 'react';
import '../styles/Dashboard.css';

function Header({ onViewChange, onLogout, onScrollToTop, onScrollToArticle, onSearch, onReset }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState(''); // 검색어 상태 추가

  // 검색 실행 핸들러
  const handleSearchAction = () => {
    if (onSearch && inputValue.trim()) {
      onSearch(inputValue.trim());
      // 검색 후 뷰를 아티클 페이지로 전환 (다른 뷰에 있을 때 검색할 경우를 대비)
      onViewChange('articles');
    }
  };

  // 엔터 키 입력 감지
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearchAction();
    }
  };

  return (
    <>
      <header className="dashHeader">
        <div className="headerContent">
          <div
            className="dashLogo"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setMenuOpen(false);
              setInputValue('');
              if (onReset) onReset();
            }}
          >
            LANDFACTORY
          </div>

          <div className="searchContainer" style={{ display: 'flex', alignItems: 'center' }}>
            <input 
              type="text" 
              className="searchInput" 
              placeholder="검색어를 입력하세요" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {/* 돋보기 버튼 추가 */}
            <button 
              onClick={handleSearchAction} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', marginLeft: '5px' }}
            >
              🔍
            </button>
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
            setTimeout(() => onScrollToTop(), 100); 
          }}>아티클 페이지</li>
          
          <li onClick={() => { 
            onViewChange('curriculum'); 
            setMenuOpen(false); 
          }}>커리큘럼 관리</li>
            
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