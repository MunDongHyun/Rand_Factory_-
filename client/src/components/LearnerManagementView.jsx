import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/api';
import LearnerDetailModal from './LearnerDetailModal';
import '../styles/LearnerManagement.css';

const maskInviteCode = (code) => (code ? code.replace(/[^-]/g, '•') : '');

const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

function LearnerManagementView({ user }) {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [codeVisible, setCodeVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/users/learners')
      .then((res) => setLearners(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || '학습자 목록을 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyInviteCode = async () => {
    if (!user?.user_invite_code) return;
    try {
      await navigator.clipboard.writeText(user.user_invite_code);
      toast.success('초대 코드를 복사했습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const filteredLearners = useMemo(() => {
    let arr = learners;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      arr = arr.filter((l) => {
        const hay = `${l.user_name || ''} ${l.user_email || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return [...arr].sort((a, b) => {
      switch (sort) {
        case 'created_asc':
          return new Date(a.user_created_at || 0) - new Date(b.user_created_at || 0);
        case 'name_asc':
          return (a.user_name || '').localeCompare(b.user_name || '', 'ko');
        case 'name_desc':
          return (b.user_name || '').localeCompare(a.user_name || '', 'ko');
        case 'created_desc':
        default:
          return new Date(b.user_created_at || 0) - new Date(a.user_created_at || 0);
      }
    });
  }, [learners, searchQuery, sort]);

  return (
    <div className="learnerMgmtContainer">
      <header className="learnerMgmtHeader">
        <h2 className="learnerMgmtTitle">내 회사 학습자 관리</h2>
        <p className="learnerMgmtSubtitle">
          {user?.user_company ? `${user.user_company} 소속 학습자` : '소속 학습자'} · {learners.length}명
        </p>
      </header>

      {user?.user_invite_code && (
        <div className="learnerMgmtInviteCard">
          <div className="learnerMgmtInviteLabel">회사 초대 코드</div>
          <div className="learnerMgmtInviteRow">
            <code className="learnerMgmtInviteCode">
              {codeVisible ? user.user_invite_code : maskInviteCode(user.user_invite_code)}
            </code>
            <button
              type="button"
              className="learnerMgmtInviteAction"
              onClick={() => setCodeVisible((v) => !v)}
              aria-label={codeVisible ? '코드 숨기기' : '코드 보기'}
              title={codeVisible ? '코드 숨기기' : '코드 보기'}
            >
              {codeVisible ? '🙈' : '👁'}
            </button>
            <button
              type="button"
              className="learnerMgmtInviteAction"
              onClick={handleCopyInviteCode}
              aria-label="초대 코드 복사"
              title="초대 코드 복사"
            >
              📋
            </button>
          </div>
          <p className="learnerMgmtInviteHint">
            이 코드를 받은 사람이 회원가입 시 입력하면 본 회사 학습자로 등록됩니다.
          </p>
        </div>
      )}

      <div className="learnerMgmtControls">
        <input
          type="text"
          className="learnerMgmtSearch"
          placeholder="이름 또는 이메일로 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="learnerMgmtSort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created_desc">최신 가입순</option>
          <option value="created_asc">오래된 가입순</option>
          <option value="name_asc">이름 ㄱ→ㅎ</option>
          <option value="name_desc">이름 ㅎ→ㄱ</option>
        </select>
        <span className="learnerMgmtCount">
          {filteredLearners.length} / {learners.length}명
        </span>
      </div>

      {loading ? (
        <p className="learnerMgmtLoading">불러오는 중...</p>
      ) : error ? (
        <p className="learnerMgmtError">{error}</p>
      ) : filteredLearners.length === 0 ? (
        <div className="learnerMgmtEmpty">
          {learners.length === 0 ? (
            <>
              <p>아직 회사에 등록된 학습자가 없습니다.</p>
              <p className="learnerMgmtEmptyHint">위 초대 코드를 학습자에게 전달해 가입을 요청하세요.</p>
            </>
          ) : (
            <p>검색 결과가 없습니다.</p>
          )}
        </div>
      ) : (
        <ul className="learnerMgmtList">
          {filteredLearners.map((l) => (
            <li
              key={l.user_id}
              className="learnerMgmtCard"
              onClick={() => setSelectedLearnerId(l.user_id)}
            >
              <div className="learnerMgmtCardLeft">
                <div className="learnerMgmtCardName">{l.user_name}</div>
                <div className="learnerMgmtCardEmail">{l.user_email}</div>
              </div>
              <div className="learnerMgmtCardRight">
                <div className="learnerMgmtCardDate">가입 {formatDate(l.user_created_at)}</div>
                <span className="learnerMgmtCardCta">활동 보기 →</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedLearnerId && (
        <LearnerDetailModal
          learnerId={selectedLearnerId}
          learner={learners.find((l) => l.user_id === selectedLearnerId)}
          onClose={() => setSelectedLearnerId(null)}
        />
      )}
    </div>
  );
}

export default LearnerManagementView;
