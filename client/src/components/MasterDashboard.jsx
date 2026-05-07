function MasterDashboard({ user, onLogout }) {
  return (
    <div>
      <h1>마스터 페이지</h1>
      <p>환영합니다, 마스터님.</p>
      <button onClick={onLogout}>로그아웃</button>
    </div>
  );
}

export default MasterDashboard;