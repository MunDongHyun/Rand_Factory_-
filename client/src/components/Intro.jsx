import React, { useState } from 'react';
import serviceDetailRobot from '../public/인트로 설명 이미지.png'
import api from '../lib/api';
import { setToken } from '../lib/auth';

const Intro = ({ onLogin, onSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const loginRes = await api.post('/users/login', { email, password });
      setToken(loginRes.data.access_token);
      const meRes = await api.get('/users/me');
      onLogin(meRes.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError('로그인 중 문제가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" id="screen-intro">
      <nav className="nav">
        <span className="nav__brand">LF</span>
        {/* <ul className="nav__links">
          <li><a href="#intro">소개</a></li>
          <li><a href="#service">서비스</a></li>
          <li><a href="#contact">문의</a></li>
        </ul> */}
      </nav>

      <div className="intro-grid">
        <section className="intro-left">
          <img src={serviceDetailRobot} className='intro-left_image'></img>
          <span className="intro-left__eyebrow">Knowledge Platform</span>
          <h1 className="intro-left__logo">LAND<span>FACTORY</span></h1>
          <div className="intro-left__rule"></div>
          <ul className="intro-left__features">
            <li className="feature-item"><span className="feature-item__dot"></span>DBR 기반 신뢰있는 아티클</li>
            <li className="feature-item"><span className="feature-item__dot"></span>한 눈에 볼 수 있는 시각화 자료 제공</li>
            <li className="feature-item"><span className="feature-item__dot"></span>원 클릭으로 관리할 수 있는 기업 교육</li>
          </ul>
          <div className="intro-left__footer">
            <span className="intro-left__footer-dot"></span>
            <span className="intro-left__footer-text">Knowledge · Growth · Clarity</span>
          </div>
        </section>

        <section className="intro-right">
          <span className="right-label">Sign In</span>
          <div className="login-wrap">
            <h2 className="login-wrap__heading">시작하기</h2>
            <p className="login-wrap__sub">통합 로그인</p>

            <form className="login-form" onSubmit={handleLogin} autoComplete="off">
              <div className="form-group">
                <label className="form-label" htmlFor="email">이메일</label>
                <input className="form-input"
                  id="email" type="email"
                  placeholder="name@company.com"
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pw">비밀번호</label>
                <input className="form-input"
                  id="pw"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p style={{ color: 'red', fontSize: '13px', margin: '0' }}>{error}</p>} {/* ✅ 에러 메시지 */}
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? '로그인 중...' : '로그인 →'}
              </button>
              <div className="divider-row"><span>또는</span></div>
              <div className="register-block">
                <span className="register-block__hint">혹시 회원이 아니신가요?</span>
                <button type="button" className="btn-register" onClick={onSignup}>회원 등록하기</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Intro;