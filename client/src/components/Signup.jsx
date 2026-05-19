import React, { useEffect, useMemo, useState } from 'react';
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

    // TODO: 백엔드 단일 가입 + 초대 코드 엔드포인트 확정 후 실제 호출 연결
    // (예) await api.post('/users/signup', payload);
    console.log('[signup stub] payload:', payload);
    window.alert('회원가입 화면 동작 확인용입니다. 백엔드 연동은 다음 작업에서 붙입니다.');
    setLoading(false);
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
                autoComplete="organization"
                disabled={loading || noCompany}
              />
              {showCompanyDropdown && (
                <ul className="signup-company-dropdown" role="listbox">
                  {companyMatches.map((c) => (
                    <li
                      key={`${c.name}__${c.industry}`}
                      className="signup-company-option"
                      role="option"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCompany(c.name);
                        setCompanyFocused(false);
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
