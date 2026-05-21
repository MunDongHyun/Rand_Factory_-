import { useState } from 'react';
import { toast } from 'react-toastify';
import '../styles/Dashboard.css';
import searchIcon from '../public/search_icon.png';

const ROLE_LABELS = {
  c: '일반회원',
  j: '학습자',
  m: '매니저',
  a: '관리자',
};

// 하이픈은 그대로 두고 영숫자만 • 로 마스킹 (예: 9F3K-PXQ7-M2NJ → ••••-••••-••••)
const maskInviteCode = (code) => (code ? code.replace(/[^-]/g, '•') : '');

function Header({ user, canUseCurriculum = true, currentView, onViewChange, onLogout, onScrollToTop, onScrollToArticle, onSearch, onReset, isModalOpen}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [codeVisible, setCodeVisible] = useState(false);

  const handleCopyInviteCode = async () => {
    if (!user?.user_invite_code) return;
    try {
      await navigator.clipboard.writeText(user.user_invite_code);
      toast.success('초대 코드를 복사했습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

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
            <button
              type="button"
              className={`headerBookmarkBtn ${currentView === 'bookmarks' ? 'active' : ''}`}
              onClick={() => onViewChange('bookmarks')}
              aria-label="내 북마크"
              title="내 북마크"
            >
              ★
            </button>
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
        {user && (
          <div className="drawerUserInfo">
            <div className="drawerUserName">{user.user_name}</div>
            <div className="drawerUserMeta">
              {ROLE_LABELS[user.user_role] || '회원'}
              {user.user_company ? ` · ${user.user_company}` : ''}
            </div>
            {user.user_role === 'm' && user.user_invite_code && (
              <div className="drawerInviteSection">
                <div className="drawerInviteLabel">내 회사 초대 코드</div>
                <div className="drawerInviteRow">
                  <code className="drawerInviteCode">
                    {codeVisible ? user.user_invite_code : maskInviteCode(user.user_invite_code)}
                  </code>
                  <button
                    type="button"
                    className="drawerInviteAction"
                    onClick={() => setCodeVisible((v) => !v)}
                    aria-label={codeVisible ? '코드 숨기기' : '코드 보기'}
                    title={codeVisible ? '코드 숨기기' : '코드 보기'}
                  >
                    {codeVisible ? '🙈' : '👁'}
                  </button>
                  <button
                    type="button"
                    className="drawerInviteAction"
                    onClick={handleCopyInviteCode}
                    aria-label="초대 코드 복사"
                    title="초대 코드 복사"
                  >
                    📋
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <ul className="drawerMenu">
          <li onClick={() => { 
            onViewChange('articles'); 
            setMenuOpen(false); 
            setTimeout(() => onScrollToTop(), 100); 
          }}>아티클 페이지</li>
          
          {canUseCurriculum && (
            <li onClick={() => {
              onViewChange('curriculum');
              setMenuOpen(false);
            }}>커리큘럼 관리</li>
          )}

          <li onClick={() => {
            onViewChange('bookmarks');
            setMenuOpen(false);
          }}>내 북마크</li>

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
