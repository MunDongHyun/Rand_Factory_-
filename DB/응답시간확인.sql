-- 아티클 더미 데이터 1,000건 삽입
INSERT INTO articles (article_source, article_title, article_author,
                      article_published_date, article_category, article_chunk_count)
SELECT
    ELT(FLOOR(RAND()*2)+1, 'DBR','HBR'),
    CONCAT('테스트 아티클 ', seq),
    CONCAT('저자 ', seq),
    DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND()*365*3) DAY),
    ELT(FLOOR(RAND()*5)+1, '전략','마케팅','HR','재무','운영'),
    FLOOR(RAND()*15)+3
FROM (
    SELECT a.N + b.N*10 + c.N*100 + 1 AS seq
    FROM (SELECT 0 N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
               UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
               UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
         (SELECT 0 N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
               UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
               UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
         (SELECT 0 N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
               UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
               UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c
) nums
LIMIT 1000;

-- 회원 더미 데이터 삽입
INSERT INTO users (user_email, user_pw, user_name, user_role, user_job_title, user_industry)
VALUES
    ('manager@test.com', 'hashed_pw', '김관리자', 'm', '인사팀장', 'IT'),
    ('learner@test.com', 'hashed_pw', '이신입', 'j', '마케팅', 'IT');

-- user_id 확인
SELECT user_id, user_name FROM users;

-- 확인된 user_id로 자식 테이블 INSERT
INSERT INTO ai_outputs (user_id, article_id, output_type, summary_text, model_used)
VALUES (1, 1, 'summary', '테스트 요약문입니다.', 'gpt-4o');

-- 요약문 더미 데이터 삽입 (아티클 1개당 요약 1건)
INSERT INTO ai_outputs (user_id, article_id, output_type, summary_text, model_used)
SELECT
    1,
    article_id,
    'summary',
    CONCAT('이 아티클은 ', article_category, ' 분야의 핵심 내용을 다루며, 실무에 바로 적용 가능한 인사이트를 제공합니다. ',
           article_title, '의 주요 논점은 데이터 기반 의사결정과 조직 역량 강화입니다.'),
    'gpt-4o'
FROM articles;

-- 특정 아티클의 요약문 단건 조회 (아티클 상세 페이지)
SELECT
    a.article_id,
    a.article_title,
    a.article_author,
    a.article_category,
    a.article_source,
    o.summary_text,
    o.model_used,
    o.created_at AS summary_generated_at
FROM articles a
LEFT JOIN ai_outputs o
    ON o.article_id = a.article_id
    AND o.output_type = 'summary'
WHERE a.article_id = (SELECT MIN(article_id) FROM articles);

-- 카테고리별 아티클 목록 + 요약문 목록 조회 (대시보드 리스트)
SELECT
    a.article_id,
    a.article_title,
    a.article_source,
    a.article_category,
    a.article_published_date,
    o.summary_text
FROM articles a
LEFT JOIN ai_outputs o
    ON o.article_id = a.article_id
    AND o.output_type = 'summary'
WHERE a.article_category = '마케팅'
ORDER BY a.article_published_date DESC
LIMIT 20;

-- 실행 계획 확인 (가장 중요)
EXPLAIN
SELECT
    a.article_id,
    a.article_title,
    o.summary_text
FROM articles a
LEFT JOIN ai_outputs o
    ON o.article_id = a.article_id
    AND o.output_type = 'summary'
WHERE a.article_category = '마케팅'
ORDER BY a.article_published_date DESC
LIMIT 20;

-- 실행 시간 측정 활성화
SET profiling = 1;

-- 쿼리 실행
SELECT
    a.article_id,
    a.article_title,
    o.summary_text
FROM articles a
LEFT JOIN ai_outputs o
    ON o.article_id = a.article_id
    AND o.output_type = 'summary'
WHERE a.article_category = '마케팅'
ORDER BY a.article_published_date DESC
LIMIT 20;

-- 실행 시간 확인
SHOW PROFILES;