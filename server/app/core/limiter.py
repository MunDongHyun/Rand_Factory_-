"""SlowAPI 기반 레이트 리미트.

- 백엔드: 메모리 (서버 재시작 시 카운트 초기화)
- 단일 인스턴스 운영 가정. 다중 인스턴스로 확장 시 Redis 백엔드 권장.
- 라우터에서 ``@limiter.limit("10/minute")`` 형태로 사용하며
  함수 시그니처에 ``request: Request`` 인자가 필요하다.
- key 함수는 기본 ``get_remote_address`` (클라이언트 IP).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
