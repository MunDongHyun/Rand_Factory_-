"""DB 조회 공통 헬퍼."""
from __future__ import annotations

from typing import TypeVar

from sqlalchemy.orm import InstrumentedAttribute, Query, Session

T = TypeVar("T")


def fetch_in_order(
    db: Session,
    id_query: Query,
    model_class: type[T],
    pk_attr: InstrumentedAttribute,
) -> list[T]:
    """sort buffer 폭발 방지 패턴 추출.

    1단계: ``id_query`` (이미 정렬·필터된 PK만 SELECT) 로 id 만 가져온다.
    2단계: ``WHERE pk IN (...)`` 로 본 row 를 가져온 뒤 1단계 순서대로 재정렬한다.

    큰 JSON/Text 컬럼이 ORDER BY 의 sort buffer 에 적재돼 MySQL 이 터지는 문제를 피한다.

    예시::

        rows = fetch_in_order(
            db,
            db.query(Curriculum.cur_id)
              .filter(Curriculum.cur_deleted_at.is_(None))
              .order_by(Curriculum.cur_created_at.desc())
              .offset(offset)
              .limit(limit),
            Curriculum,
            Curriculum.cur_id,
        )
    """
    id_rows = id_query.all()
    pk_name = pk_attr.key
    ids = [getattr(row, pk_name) for row in id_rows]
    if not ids:
        return []
    rows = db.query(model_class).filter(pk_attr.in_(ids)).all()
    order = {oid: i for i, oid in enumerate(ids)}
    rows.sort(key=lambda r: order[getattr(r, pk_name)])
    return rows
