import React, { useState } from 'react';

const Signup = ({ onBack, onComplete }) => {
  const [employees, setEmployees] = useState([
    { id: Date.now(), name: '', email: '', password: '', field:'' }
  ]);

  const addCard = () => {
    setEmployees([...employees, { id: Date.now(), name: '', email: '', password: '', field:''}]);
  };

  const removeCard = (id) => {
    if (employees.length > 1) {
      setEmployees(employees.filter(emp => emp.id !== id));
    }
  };

  const handleRoleChange = (id, newRole) => {
    setEmployees(employees.map(emp =>
      emp.id === id ? { ...emp, role: newRole } : emp
    ));
  };

  return (
    <div className="screen" id="screen-signup">
      <nav className="nav-signup">
        <span className="nav-signup__brand">LAND FACTORY</span>
        <button className="nav-signup__back" onClick={() => onBack('intro')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>로그인으로 돌아가기
        </button>
      </nav>

      <div className="signup-wrapper">

        <div className="signup-header">
          <div className="signup-header__eyebrow">Signup</div>
          <h1 className="signup-header__title">회원 등록</h1>
        </div>

        <div className="company-section">
          <div className="section-label">Company</div>
          <input className="f-input" type="text" placeholder="회사 이름을 입력해주세요" />
        </div>

        <div className="employees-label">Employees</div>
        <div className="employee-list">
          {employees.map((emp, index) => (
            <div key={emp.id} className="employee-card">
              <div className="card-header">
                <span className="card-num">EMPLOYEE #{String(index + 1).padStart(2, '0')}</span>
                <button className="card-delete" onClick={() => removeCard(emp.id)}>✕</button>
              </div>


              <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="field-group">
                  <div className="field-label">이름</div>
                  <input className="f-input" type="text" placeholder="성함 입력" />
                </div>


                <div className="field-group">
                  <div className="field-label">직무</div>
                  <div className="selectWrapper">
                    <select
                      className="f-input field-Select" 
                      name={`field-${emp.id}`}
                      value={emp.field || 'marketing_sales'}
                      onChange={(e) => handleJobChange(emp.id, e.target.value)}
                    >
                      <option value="marketing_sales">마케팅 / 세일즈</option>
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <div className="field-label">이메일</div>
                  <input className="f-input" type="email" placeholder="example@company.com" />
                </div>

                <div className="field-group">
                  <div className="field-label">비밀번호</div>
                  <input className="f-input" type="password" placeholder="••••••••" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="add-btn" onClick={addCard}>
          <span className="add-icon">+</span>새로운 직원 추가하기
        </button>

        <div className="submit-bar">
          <p className="submit-hint">모든 정보를 확인한 후<br /><strong>등록 완료하기</strong>를 눌러주세요.</p>
          <button className="btn-submit" onClick={onComplete}>등록 완료하기 →</button>
        </div>
      </div>
    </div>
  );
};

export default Signup;