import { useState } from 'react';
import '../styles/Dashboard.css';
import searchIcon from '../public/search_icon.png';

function Header({ canUseCurriculum = true, onViewChange, onLogout, onScrollToTop, onScrollToArticle, onSearch, onReset, isModalOpen}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState(''); 

  if (isModalOpen) return null;

  // 검색 실행 핸들러
  const handleSearchAction = () => {
    if (onSearch && inputValue.trim()) {
      onSearch(inputValue.trim());

      onViewChange('articles');

      setInputValue('');
    }
  };


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

            <button 
              onClick={handleSearchAction} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', marginLeft: '5px' }}
            >
              <img src={searchIcon} className='searchIconImg'></img>
            </button>
          </div>

          <div className="headerIcons">
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
