"""data/companies_raw.csv -> client/public/companies.json 변환.

- 정규화: '(주)' 접두/접미, '주식회사', ZWSP(\\u200b), 공백 제거 + 소문자 → search 필드
- 중복 처리: (name, industry) 조합 기준 첫 번째만 유지
- 정렬: reviews desc

Usage:
    python scripts/convert_companies.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

# Windows 콘솔 UTF-8 출력
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'companies_raw.csv'
DST = ROOT / 'client' / 'public' / 'companies.json'


def normalize_for_search(name: str) -> str:
    """검색 매칭용 정규화 — (주)/주식회사/ZWSP/공백 제거 + 소문자."""
    s = name.replace('​', '').strip()
    # (주) 접두/접미
    s = re.sub(r'^\(주\)\s*', '', s)
    s = re.sub(r'\s*\(주\)$', '', s)
    # 주식회사 접두/접미
    s = re.sub(r'^주식회사\s*', '', s)
    s = re.sub(r'\s*주식회사$', '', s)
    # 공백 전부 제거
    s = re.sub(r'\s+', '', s)
    return s.lower()


def parse_reviews(raw: str) -> int:
    try:
        return int(raw)
    except (ValueError, TypeError):
        return 0


def main() -> int:
    if not SRC.exists():
        print(f"[ERROR] source not found: {SRC}", file=sys.stderr)
        return 1

    with SRC.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[load] {len(rows)} rows from {SRC.relative_to(ROOT)}")

    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    skipped_empty = 0
    skipped_dup = 0

    for r in rows:
        name = (r.get('기업명') or '').replace('​', '').strip()
        if not name:
            skipped_empty += 1
            continue
        industry = (r.get('산업군') or '').strip()
        sub = (r.get('2차 산업군') or '').strip()
        reviews = parse_reviews(r.get('리뷰개수'))

        key = (name, industry)
        if key in seen:
            skipped_dup += 1
            continue
        seen.add(key)

        out.append({
            'name': name,
            'search': normalize_for_search(name),
            'industry': industry,
            'sub': sub,
            'reviews': reviews,
        })

    out.sort(key=lambda x: x['reviews'], reverse=True)

    DST.parent.mkdir(parents=True, exist_ok=True)
    with DST.open('w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = DST.stat().st_size / 1024
    print(f"[write] {len(out)} entries → {DST.relative_to(ROOT)} ({size_kb:.1f} KB)")
    print(f"  skipped empty: {skipped_empty}")
    print(f"  skipped dup (same name+industry): {skipped_dup}")

    if out:
        print(f"\n[top 5 by reviews]")
        for c in out[:5]:
            print(f"  {c['reviews']:>5}  {c['name']:<25}  [{c['industry']}/{c['sub']}]")

    return 0


if __name__ == '__main__':
    sys.exit(main())
