import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../lib/api';
import '../styles/NotificationBell.css';

const POLL_INTERVAL_MS = 60_000;

const formatRelativeTime = (iso) => {
  if (!iso) return '';
  const created = new Date(iso);
  const diffSec = Math.max(0, (Date.now() - created.getTime()) / 1000);
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  return `${Math.floor(diffSec / 86400)}일 전`;
};

// notif_link 형식: "dashboard:{view}:{id}" — 일단 view 이름만 사용 (deep link는 V2)
const parseViewFromLink = (link) => {
  if (!link || typeof link !== 'string') return null;
  const parts = link.split(':');
  if (parts[0] === 'dashboard' && parts[1]) return parts[1];
  return null;
};

function NotificationBell({ onViewChange }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const refreshUnreadCount = useCallback(() => {
    api.get('/notifications/unread-count')
      .then((res) => setUnreadCount(res.data?.count ?? 0))
      .catch(() => {});
  }, []);

  const refreshList = useCallback(() => {
    setLoading(true);
    api.get('/notifications', { params: { limit: 20 } })
      .then((res) => {
        setItems(res.data?.items ?? []);
        setUnreadCount(res.data?.unread_count ?? 0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const id = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) refreshList();
  };

  const handleItemClick = async (item) => {
    setOpen(false);
    if (!item.notif_read_at) {
      try {
        await api.patch(`/notifications/${item.notif_id}/read`);
      } catch {
        // 읽음 처리 실패는 조용히 무시
      }
    }
    const view = parseViewFromLink(item.notif_link);
    if (view && onViewChange) onViewChange(view);
    refreshUnreadCount();
  };

  const handleReadAll = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, notif_read_at: n.notif_read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      toast.error('알림 읽음 처리에 실패했습니다.');
    }
  };

  return (
    <div className="notifBell" ref={dropdownRef}>
      <button
        type="button"
        className="notifBellBtn"
        onClick={handleToggle}
        aria-label="알림"
        title="알림"
      >
        <span className="notifBellIcon" aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="notifBellBadge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notifDropdown" role="dialog">
          <div className="notifDropdownHeader">
            <span className="notifDropdownTitle">알림</span>
            {unreadCount > 0 && (
              <button type="button" className="notifReadAllBtn" onClick={handleReadAll}>
                모두 읽음
              </button>
            )}
          </div>
          <div className="notifDropdownBody">
            {loading && <div className="notifEmpty">불러오는 중…</div>}
            {!loading && items.length === 0 && (
              <div className="notifEmpty">새 알림이 없습니다</div>
            )}
            {!loading && items.map((item) => (
              <button
                key={item.notif_id}
                type="button"
                className={`notifItem ${item.notif_read_at ? '' : 'unread'}`}
                onClick={() => handleItemClick(item)}
              >
                <div className="notifItemTitle">
                  {!item.notif_read_at && <span className="notifUnreadDot" aria-hidden="true" />}
                  {item.notif_title}
                </div>
                {item.notif_body && (
                  <div className="notifItemBody">{item.notif_body}</div>
                )}
                <div className="notifItemMeta">{formatRelativeTime(item.notif_created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
