import React, { useState } from 'react';
import api from '../lib/api';

const makeEmptyEmployee = () => ({
  id: Date.now() + Math.random(),
  name: '',
  email: '',
  password: '',
  job_title: '',
});

const Signup = ({ onBack, onComplete }) => {
  const [company, setCompany] = useState('');
  const [employees, setEmployees] = useState([makeEmptyEmployee()]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const addCard = () => {
    setEmployees([...employees, makeEmptyEmployee()]);
  };

  const removeCard = (id) => {
    if (employees.length > 1) {
      setEmployees(employees.filter((emp) => emp.id !== id));
    }
  };

  const updateField = (id, field, value) => {
    setEmployees(employees.map((emp) => (emp.id === id ? { ...emp, [field]: value } : emp)));
  };

  const validate = () => {
    if (!company.trim()) return '회사명을 입력해주세요.';
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const label = i === 0 ? '매니저' : `직원 #${i + 1}`;
      if (!emp.name.trim()) return `${label}의 이름을 입력해주세요.`;
      if (!emp.email.trim()) return `${label}의 이메일을 입력해주세요.`;
      if (!emp.password) return `${label}의 비밀번호를 입력해주세요.`;
    }
    const emails = employees.map((e) => e.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) return '직원들 간에 중복된 이메일이 있습니다.';
    return '';
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/users/signup/bulk', {
        company: company.trim(),
        employees: employees.map((e) => ({
          name: e.name.trim(),
          email: e.email.trim(),
          password: e.password,
          job_title: e.job_title.trim() || null,
        })),
      });
      onComplete();
    } catch (err) {
      setError(err.response?.data?.detail || '등록 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" id="screen-signup">
      <nav className="nav-signup">
        <span className="nav-signup__brand">LAND FACTORY</span>
        <button className="nav-signup__back" onClick={() => onBack('intro')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          로그인으로 돌아가기
        </button>
      </nav>

      <div className="signup-wrapper">
        <div className="signup-header">
          <div className="signup-header__eyebrow">Signup</div>
          <h1 className="signup-header__title">회원 등록</h1>
        </div>

        <div className="company-section">
          <div className="section-label">Company</div>
          <input
            className="f-input"
            type="text"
            placeholder="회사 이름을 입력해주세요"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <div className="employees-label">Employees</div>
        <div className="employee-list">
          {employees.map((emp, index) => (
            <div key={emp.id} className="employee-card">
              <div className="card-header">
                <span className="card-num">
                  EMPLOYEE #{String(index + 1).padStart(2, '0')} {index === 0 ? '· 매니저' : '· 학습자'}
                </span>
                <button
                  className="card-delete"
                  onClick={() => removeCard(emp.id)}
                  disabled={employees.length === 1}
                >
                  ✕
                </button>
              </div>

              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="field-group">
                  <div className="field-label">이름</div>
                  <input
                    className="f-input"
                    type="text"
                    placeholder="성함 입력"
                    value={emp.name}
                    onChange={(e) => updateField(emp.id, 'name', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <div className="field-label">직무</div>
                  <input
                    className="f-input"
                    type="text"
                    placeholder="예: 마케팅, 영업, 기획"
                    value={emp.job_title}
                    onChange={(e) => updateField(emp.id, 'job_title', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <div className="field-label">이메일</div>
                  <input
                    className="f-input"
                    type="email"
                    placeholder="example@company.com"
                    value={emp.email}
                    onChange={(e) => updateField(emp.id, 'email', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <div className="field-label">비밀번호</div>
                  <input
                    className="f-input"
                    type="password"
                    placeholder="••••••••"
                    value={emp.password}
                    onChange={(e) => updateField(emp.id, 'password', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="add-btn" onClick={addCard}>
          <span className="add-icon">+</span>새로운 직원 추가하기
        </button>

        {error && (
          <p style={{ color: '#c33', fontSize: '14px', margin: '12px 0' }}>{error}</p>
        )}

        <div className="submit-bar">
          <p className="submit-hint">
            모든 정보를 확인한 후<br />
            <strong>등록 완료하기</strong>를 눌러주세요.
          </p>
          <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? '등록 중...' : '등록 완료하기 →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
