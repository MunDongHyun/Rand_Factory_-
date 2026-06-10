"""회사 초대 코드 생성/정규화/검증 유틸.

- 형식: Crockford Base32 12자 + 하이픈 3-3-3 그룹 (총 14자)
  - 예: ``9F3K-PXQ7-M2NJ``
  - 알파벳: 0-9 + A-Z 중 혼동 글자 ``I``, ``L``, ``O``, ``U`` 제외 (32자)
- 저장은 14자 형식 (`users.user_invite_code VARCHAR(14)` 컬럼) 그대로.
- 생성은 ``secrets`` CSPRNG 기반. DB unique 충돌 시 재시도.
- 검증은 ``normalize_code`` 로 표준 14자 형식 변환 후 매니저 행 매칭.
"""
from __future__ import annotations

import re
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User

_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'  # Crockford Base32
_GROUP_LEN = 4
_GROUPS = 3
_RAW_LEN = _GROUP_LEN * _GROUPS  # 12
_FORMATTED_LEN = _RAW_LEN + (_GROUPS - 1)  # 14
_MAX_GEN_ATTEMPTS = 8


def _extract_raw(value: str | None) -> str:
    """입력에서 알파벳/숫자만 추출 후 대문자 (하이픈/공백/ZWSP 제거)."""
    if not value:
        return ''
    s = value.replace('​', '').strip().upper()
    return re.sub(r'[^0-9A-Z]', '', s)


def _format_raw(raw: str) -> str:
    """raw 12자 → 14자 표준 형식 ``XXXX-XXXX-XXXX``."""
    return '-'.join(raw[i : i + _GROUP_LEN] for i in range(0, _RAW_LEN, _GROUP_LEN))


def generate_invite_code() -> str:
    """Crockford Base32 12자 + 하이픈 3-3-3 그룹 형식 코드 1개 생성."""
    raw = ''.join(secrets.choice(_ALPHABET) for _ in range(_RAW_LEN))
    return _format_raw(raw)


def normalize_code(value: str | None) -> str:
    """사용자 입력 → 표준 14자 형식. 잘못된 길이/문자 포함이면 빈 문자열."""
    raw = _extract_raw(value)
    if len(raw) != _RAW_LEN:
        return ''
    if not all(ch in _ALPHABET for ch in raw):
        return ''
    return _format_raw(raw)


def is_valid_format(value: str) -> bool:
    """주어진 문자열이 표준 14자 형식인지."""
    if not value or len(value) != _FORMATTED_LEN:
        return False
    if value[_GROUP_LEN] != '-' or value[_GROUP_LEN * 2 + 1] != '-':
        return False
    raw = value.replace('-', '')
    return all(ch in _ALPHABET for ch in raw)


def generate_unique_invite_code(db: Session, max_attempts: int = _MAX_GEN_ATTEMPTS) -> str:
    """DB ``users.user_invite_code`` UNIQUE 제약과 충돌하지 않는 새 코드 생성."""
    for _ in range(max_attempts):
        code = generate_invite_code()
        existing = (
            db.query(User.user_id)
            .filter(User.user_invite_code == code)
            .first()
        )
        if existing is None:
            return code
    # 32^12 ≈ 1.15e18 공간이라 도달 사실상 불가
    raise RuntimeError('Failed to generate a unique invite code')


def find_manager_by_code(db: Session, code: str | None) -> Optional[User]:
    """사용자 입력 코드로 매니저(``m``, 활성) 행 조회. 형식 잘못이면 None."""
    normalized = normalize_code(code)
    if not normalized:
        return None
    return (
        db.query(User)
        .filter(
            User.user_invite_code == normalized,
            User.user_role == 'm',
            User.user_deleted_at.is_(None),
        )
        .first()
    )
