import os
import json
import sys
import re
from pathlib import Path

# 경로 설정
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.article import Article
from app.services import rag_service

SUMMARY_DIR = BASE_DIR.parent / "ai" / "summary"

def clean_text_for_match(text):
    """특수문자와 공백을 모두 제거하여 순수 텍스트만 남김 (비교용)"""
    if not text:
        return ""
    # 한글, 영문, 숫자만 남기고 모두 제거
    return re.sub(r'[^가-힣a-zA-Z0-9]', '', str(text))

def ingest_json_summaries():
    if not os.path.exists(SUMMARY_DIR):
        print(f"오류: {SUMMARY_DIR} 폴더를 찾을 수 없습니다.")
        return

    json_files = [f for f in os.listdir(SUMMARY_DIR) if f.endswith('.json')]
    print(f"총 {len(json_files)}개의 JSON 요약문 파일을 발견했습니다. 매핑을 시작합니다...\n")

    db = SessionLocal()
    try:
        # 1. DB에서 모든 아티클을 미리 다 가져옴 (메모리 매핑용)
        all_articles = db.query(Article).all()
        
        success_count = 0
        failed_files = []

        for file_name in json_files:
            file_path = os.path.join(SUMMARY_DIR, file_name)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                try:
                    data = json.load(f)
                    
                    # JSON 내부 제목 추출
                    raw_title = data.get("metadata", {}).get("title", "")
                    json_title = raw_title.strip("'\"") 
                    
                    if not json_title:
                        failed_files.append((file_name, "JSON 내부에 title 값이 없음"))
                        continue

                    # 2. 텍스트 정규화 비교 (공백, 기호 무시)
                    cleaned_json_title = clean_text_for_match(json_title)
                    matched_article = next(
                        (a for a in all_articles if clean_text_for_match(a.article_title) == cleaned_json_title), 
                        None
                    )
                    
                    if not matched_article:
                        failed_files.append((file_name, f"DB 제목과 일치하지 않음 -> [{json_title}]"))
                        continue
                    
                    article_id = matched_article.article_id

                    # 3. 텍스트 조립
                    content_parts = []
                    if "theme_analysis" in data:
                        content_parts.append(data["theme_analysis"])
                    
                    if "card_news" in data:
                        for card in data["card_news"]:
                            keyword = card.get("keyword", "")
                            msg = card.get("core_message", "")
                            detail = card.get("detailed_summary", "")
                            content_parts.append(f"[{keyword}] {msg}\n{detail}")
                    
                    full_content = "\n\n".join(content_parts)

                    if not full_content.strip():
                        failed_files.append((file_name, "추출할 본문(요약) 데이터가 없음"))
                        continue

                    # 4. 벡터 DB 적재
                    chunks_count = rag_service.ingest_article(
                        article_id=article_id,
                        title=matched_article.article_title,
                        content=full_content
                    )
                    print(f"✅ [{file_name}] 적재 완료 (Article ID: {article_id})")
                    success_count += 1
                    
                except json.JSONDecodeError:
                    failed_files.append((file_name, "JSON 파일 형식 오류"))
                except Exception as e:
                    failed_files.append((file_name, f"알 수 없는 오류: {str(e)}"))

        # 결과 요약 리포트 출력
        print("\n" + "="*50)
        print(f"🎉 최종 결과: {len(json_files)}개 중 {success_count}개 성공")
        
        if failed_files:
            print(f"\n⚠️ 누락된 파일 목록 ({len(failed_files)}개):")
            for fname, reason in failed_files:
                print(f" - {fname} : {reason}")
            print("="*50)
            
    finally:
        db.close()

if __name__ == "__main__":
    ingest_json_summaries()