"""알림 생성 헬퍼.

도메인 이벤트(과제 제출/피드백 작성/재제출 요청 등) 발생 시
``create_for_user`` 를 호출해 ``notifications`` 테이블에 row 1개를 적재한다.

알림 생성 실패는 본 도메인 동작(제출/피드백 저장)에 영향을 주면 안 되므로
호출 측에서 try/except 로 감싸 사용한다.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.notification import Notification

# 알림 종류 상수
NOTIF_TYPE_SUBMISSION_RECEIVED = "submission_received"   # 학습자 제출 → 매니저
NOTIF_TYPE_FEEDBACK_RECEIVED = "feedback_received"       # 매니저 피드백 → 학습자
NOTIF_TYPE_RESUBMIT_REQUESTED = "resubmit_requested"     # 매니저 재제출 요청 → 학습자


def create_for_user(
    db: Session,
    *,
    user_id: int,
    notif_type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    ref_type: str | None = None,
    ref_id: int | None = None,
    dedupe_key: str | None = None,
    commit: bool = True,
) -> Notification:
    """단일 사용자에게 알림 1개 생성.

    ``commit=False`` 로 호출하면 호출자가 동일 트랜잭션 안에서 commit 한다.
    ``dedupe_key`` 가 주어지면 ``(user_id, dedupe_key)`` UNIQUE 제약으로 중복 알림이 차단된다
    (현재 트리거에서는 사용하지 않고 NULL 로 둠).
    """
    notification = Notification(
        notif_user_id=user_id,
        notif_type=notif_type,
        notif_title=title,
        notif_body=body,
        notif_link=link,
        notif_ref_type=ref_type,
        notif_ref_id=ref_id,
        notif_dedupe_key=dedupe_key,
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    else:
        db.flush()
    return notification
