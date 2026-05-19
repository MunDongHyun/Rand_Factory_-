import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import '../styles/Signup.css';

const COMPANIES_URL = '/companies.json';
const MAX_SUGGESTIONS = 20;

const normalizeForSearch = (s) => {
  if (!s) return '';
  let r = s.replace(/​/g, '').trim();
  r = r.replace(/^\(주\)\s*/, '').replace(/\s*\(주\)$/, '');
  r = r.replace(/^주식회사\s*/, '').replace(/\s*주식회사$/, '');
  r = r.replace(/\s+/g, '');
  return r.toLowerCase();
};

const Signup = ({ onBack, onComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [company, setCompany] = useState('');
  const [noCompany, setNoCompany] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [companyFocused, setCompanyFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(COMPANIES_URL)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setCompanies(data);
      })
      .catch(() => {
        // 회사 목록 로드 실패해도 자유 텍스트 입력은 계속 가능
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const companyMatches = useMemo(() => {
    const q = normalizeForSearch(company);
    if (!q || !companies.length) return [];
    const results = [];
    for (const c of companies) {
      if (c.search && c.search.startsWith(q)) {
        results.push(c);
        if (results.length >= MAX_SUGGESTIONS) break;
      }
    }
    return results;
  }, [company, companies]);

  const showCompanyDropdown =
    companyFocused && !noCompany && !loading && companyMatches.length > 0;

  // 매칭 결과 바뀌면 강조 인덱스 초기화
  useEffect(() => {
    setHighlightedIndex(companyMatches.length > 0 ? 0 : -1);
  }, [companyMatches]);

  // 강조된 옵션이 dropdown 보이는 영역 안에 있도록 스크롤
  useEffect(() => {
    if (highlightedIndex < 0 || !dropdownRef.current) return;
    const option = dropdownRef.current.children[highlightedIndex];
    if (option && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const selectCompany = (c) => {
    setCompany(c.name);
    setCompanyFocused(false);
    setHighlightedIndex(-1);
  };

  const handleCompanyKeyDown = (e) => {
    if (!showCompanyDropdown) {
      if (e.key === 'ArrowDown' && companyMatches.length > 0) {
        // dropdown이 닫혀 있어도 ArrowDown으로 열기
        e.preventDefault();
        setCompanyFocused(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((idx) => (idx + 1) % companyMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((idx) =>
        idx <= 0 ? companyMatches.length - 1 : idx - 1
      );
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < companyMatches.length) {
        e.preventDefault(); // form submit 방지
        selectCompany(companyMatches[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCompanyFocused(false);
    }
  };

  const validate = () => {
    if (!name.trim()) return '이름을 입력해주세요.';
    if (!email.trim()) return '이메일을 입력해주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '이메일 형식이 올바르지 않습니다.';
    if (!password) return '비밀번호를 입력해주세요.';
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (password !== passwordConfirm) return '비밀번호가 일치하지 않습니다.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setLoading(true);

    const payload = {
      name: name.trim(),
      email: email.trim(),
      password,
      company: noCompany ? null : company.trim() || null,
      invite_code: inviteCode.trim() || null,
    };

    try {
      await api.post('/users/signup', payload);
      onComplete();
    } catch (err) {
      setError(err.response?.data?.detail || '가입 처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" id="screen-signup">
      <nav className="nav-signup">
        <span className="nav-signup__brand">LAND FACTORY</span>
        <button
          type="button"
          className="nav-signup__back"
          onClick={() => onBack('intro')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          로그인으로 돌아가기
        </button>
      </nav>

      <div className="signup-wrapper">
        <header className="signup-header">
          <div className="signup-header__eyebrow">Signup</div>
          <h1 className="signup-header__title">회원가입</h1>
        </header>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <section className="signup-section">
            <div className="signup-section__label">계정 정보</div>

            <div className="signup-field">
              <label className="signup-field__label" htmlFor="signup-name">이름</label>
              <input
                id="signup-name"
                className="f-input"
                type="text"
                placeholder="성함 입력"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="signup-field">
              <label className="signup-field__label" htmlFor="signup-email">이메일</label>
              <input
                id="signup-email"
                className="f-input"
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="signup-field">
              <label className="signup-field__label" htmlFor="signup-password">비밀번호 (8자 이상)</label>
              <input
                id="signup-password"
                className="f-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="signup-field">
              <label className="signup-field__label" htmlFor="signup-password-confirm">비밀번호 확인</label>
              <input
                id="signup-password-confirm"
                className="f-input"
                type="password"
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          </section>

          <section className="signup-section">
            <div className="signup-section__label">회사 (선택)</div>
            <div className="signup-field signup-company-field">
              <input
                className="f-input"
                type="text"
                placeholder="회사 이름"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onFocus={() => setCompanyFocused(true)}
                onBlur={() => setCompanyFocused(false)}
                onKeyDown={handleCompanyKeyDown}
                autoComplete="organization"
                disabled={loading || noCompany}
                aria-autocomplete="list"
                aria-expanded={showCompanyDropdown}
                aria-activedescendant={
                  highlightedIndex >= 0 ? `signup-company-opt-${highlightedIndex}` : undefined
                }
              />
              {showCompanyDropdown && (
                <ul
                  className="signup-company-dropdown"
                  role="listbox"
                  ref={dropdownRef}
                >
                  {companyMatches.map((c, idx) => (
                    <li
                      key={`${c.name}__${c.industry}`}
                      id={`signup-company-opt-${idx}`}
                      className={
                        'signup-company-option' +
                        (idx === highlightedIndex ? ' is-highlighted' : '')
                      }
                      role="option"
                      aria-selected={idx === highlightedIndex}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectCompany(c);
                      }}
                    >
                      <span className="signup-company-option__name">{c.name}</span>
                      {c.industry && (
                        <span className="signup-company-option__meta">{c.industry}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="signup-checkbox">
              <input
                type="checkbox"
                checked={noCompany}
                onChange={(e) => {
                  setNoCompany(e.target.checked);
                  if (e.target.checked) setCompany('');
                }}
                disabled={loading}
              />
              회사 없음 / 개인 사용자
            </label>
          </section>

          <section className="signup-section">
            <div className="signup-section__label">초대 코드 (선택)</div>
            <div className="signup-field">
              <input
                className="f-input"
                type="text"
                placeholder="매니저에게 받은 초대 코드"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={loading}
              />
            </div>
            <p className="signup-section__hint">
              초대 코드를 입력하면 해당 회사의 학습자로 자동 등록됩니다.
            </p>
          </section>

          {error && <p className="signup-error">{error}</p>}

          <div className="signup-submit-bar">
            <p className="signup-submit-bar__hint">
              모든 정보를 확인한 후<br />
              <strong>가입하기</strong>를 눌러주세요.
            </p>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '처리 중...' : '가입하기 →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
