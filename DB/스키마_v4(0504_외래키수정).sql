-- ============================================================
-- LANDFACTORY DB 스키마 v3.0
-- ============================================================


-- ============================================================
-- 1. 사용자
-- ============================================================

CREATE TABLE users (
    user_id                  BIGINT       AUTO_INCREMENT PRIMARY KEY,  -- 회원ID
    user_email               VARCHAR(255) NOT NULL UNIQUE,			   -- 회원 이메일	
    user_pw                  VARCHAR(255) NOT NULL,					-- 회원 비밀번호
    user_name                VARCHAR(50)  NOT NULL,					-- 회원이름
    user_role                ENUM('j', 'm', 'a') NOT NULL,			-- 회원 역할(주니어/마스터/관리자)
    user_job_title           VARCHAR(100),                          -- 직무 (예: 마케팅 기획)
    user_industry            VARCHAR(100),                          -- 산업군 (예: IT, 금융)
    user_work_years          INT          DEFAULT 0,				-- 경력 연차 (n년)
    user_created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,	-- 가입 일시
    user_updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,	-- 회원정보 수정 일시
    user_deleted_at          DATETIME     NULL						-- 회원탈퇴 일시
);

-- ============================================================
-- 2. 아티클
-- ============================================================

CREATE TABLE articles (
    article_id     		   BIGINT AUTO_INCREMENT PRIMARY KEY,		-- 아티클 ID
    article_source         ENUM('DBR', 'HBR') NOT NULL,				-- 출처 구분(DBR/HBR)
    article_title          VARCHAR(500) NOT NULL,					-- 아티클 제목
    article_author         VARCHAR(200),							-- 아티클 저자
    article_published_date DATE,									-- 발행일
    article_category       VARCHAR(100),							-- 카테고리
    article_source_url     VARCHAR(500),                             -- 원문 URL
    article_image_count    INT          DEFAULT 0,					-- 시각자료 수
    article_chunk_count    INT          DEFAULT 0,                   -- 청크 수
    article_created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,	-- 등록 일시
    article_updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,		-- 수정 일시
    FULLTEXT INDEX ft_articles_title (article_title) WITH PARSER ngram
);


-- ============================================================
-- 3. AI 생성 결과 통합 테이블
-- article_summaries + wordclouds + frameworks 를 하나로 통합
-- output_type으로 구분, 각 유형에 필요한 컬럼은 NULL 허용
-- ============================================================

CREATE TABLE ai_outputs (
    output_id      BIGINT    AUTO_INCREMENT PRIMARY KEY,	-- 결과 ID
    user_id        BIGINT    NOT NULL,						-- 생성자 ID
    article_id     BIGINT    NULL,                           -- 요약·워드클라우드 시 연결
    output_type    ENUM('summary', 'wordcloud', 'framework') NOT NULL,	-- 결과 유형

    -- [summary] AI 생성 요약문
    summary_text   TEXT      NULL,

    -- [wordcloud] 키워드 시각화
    result_json    JSON      NULL,                           -- { "단어": 빈도, ... }
    image_url      VARCHAR(500) NULL,

    -- [framework] 경영 프레임워크
    framework_type VARCHAR(50)  NULL,                        -- 프레임워크 유형 (OKR, AARRR, JTBD 등)
    user_input     TEXT         NULL,                        -- 사용자 입력 내용
    generated_content JSON      NULL,                        -- AI 생성 프레임워크 구조
    is_saved       BOOLEAN      DEFAULT FALSE,				 -- 저장 여부

    model_used     VARCHAR(100) NULL,                        -- 생성에 사용한 AI 모델명
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,	 -- 생성 일시
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE SET NULL
);

-- ai_outputs(framework) ↔ articles 참조 연결
CREATE TABLE output_article_refs (
    output_id       BIGINT        NOT NULL,					-- 결과 ID
    article_id      BIGINT        NOT NULL,					-- 아티클 ID
    relevance_score DECIMAL(4, 3) NULL,						-- RAG 유사도 점수(0.000 ~ 1.000)
    PRIMARY KEY (output_id, article_id),					
    FOREIGN KEY (output_id)  REFERENCES ai_outputs(output_id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(article_id)  ON DELETE RESTRICT
);


-- ============================================================
-- 4. 커리큘럼
-- 주차·과제·배정 정보를 JSON으로 curriculum에 통합
-- 과제 제출만 별도 테이블로 분리
-- ============================================================

CREATE TABLE curriculum (
    cur_id       			BIGINT       AUTO_INCREMENT PRIMARY KEY,	-- 커리큘럼 ID
    cur_creator_id          BIGINT       NOT NULL,						-- 생성 관리자 ID
    cur_title               VARCHAR(200) NOT NULL,				 -- 제목
    cur_target_job          VARCHAR(100) NULL,                   -- 대상 직무
    cur_target_industry     VARCHAR(100) NULL,                   -- 대상 산업군
    cur_duration_weeks      INT          NOT NULL,               -- 총 교육 주차 수
    cur_learning_goal       TEXT,								 -- 교육 기간
    cur_ai_prompt_input     TEXT,                                -- AI 생성 시 입력값
    cur_week_plan           JSON         NULL,                   -- 주차별 계획 및 과제
                                                             -- [{week:1, theme:"...", tasks:[...]}, ...]
    cur_assigned_learner_ids JSON        NULL,                   -- 배정 학습자 ID 목록 [3, 7, 12]
    cur_status              ENUM('draft', 'active', 'archived') DEFAULT 'draft', -- 상태
    cur_created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,				 -- 생성 일시
    cur_updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,		-- 수정 일시
    cur_deleted_at          DATETIME     NULL,					 -- 삭제 일시
    FOREIGN KEY (cur_creator_id) REFERENCES users(user_id)
);

-- 과제 제출
CREATE TABLE task_submissions (
    task_submission_id     BIGINT   AUTO_INCREMENT PRIMARY KEY,  -- 제출 ID
    task_curriculum_id     BIGINT   NOT NULL,					 -- 커리큘럼 ID
    task_learner_id        BIGINT   NOT NULL,					 -- 학습자 ID
    task_week_number       INT      NOT NULL,                     -- 주차 번호 (몇 주차 과제인지)
    task_framework_type    VARCHAR(50),							-- 프레임워크 유형
    task_submitted_content JSON     NOT NULL,					-- 제출 내용
    task_submitted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,	-- 제출 일시
    task_manager_feedback  TEXT     NULL,						-- 관리자 피드백
    task_feedback_at       DATETIME NULL,						-- 피드백 등록 일시
    task_status            ENUM('submitted', 'feedback_given', 'resubmit_requested') DEFAULT 'submitted',	-- 제출 상태
    FOREIGN KEY (task_curriculum_id) REFERENCES curriculum(cur_id),
    FOREIGN KEY (task_learner_id)    REFERENCES users(user_id)
);


-- ============================================================
-- 5. RAG 챗봇 (관리자 커리큘럼 생성 전용)
-- ============================================================

-- 챗봇 세션
CREATE TABLE chatbot_sessions (
    cb_session_id    BIGINT   AUTO_INCREMENT PRIMARY KEY,			-- 세션 ID
    cb_manager_id    BIGINT   NOT NULL,								-- 관리자 ID
    cb_curriculum_id 	 BIGINT   NULL,								-- 커리큘럼 ID
    cb_created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,			-- 세션 시작 일시
    FOREIGN KEY (cb_manager_id)    REFERENCES users(user_id),
    FOREIGN KEY (cb_curriculum_id) REFERENCES curriculum(cur_id) ON DELETE SET NULL
);

-- 챗봇 메시지
CREATE TABLE chatbot_messages (
    message_id BIGINT   AUTO_INCREMENT PRIMARY KEY,		-- 메시지 ID
    session_id BIGINT   NOT NULL,						-- 세션 ID
    role       ENUM('user', 'assistant') NOT NULL,		-- 발화 주체
    content    TEXT     NOT NULL,						-- 메시지 내용
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,		-- 발화 일시
    FOREIGN KEY (session_id) REFERENCES chatbot_sessions(cb_session_id) ON DELETE CASCADE
);


-- ============================================================
-- 인덱스
-- ============================================================

CREATE INDEX idx_users_role          ON users(user_role);
CREATE INDEX idx_users_deleted       ON users(user_deleted_at);
CREATE INDEX idx_articles_source     ON articles(article_source);
CREATE INDEX idx_articles_category   ON articles(article_category);
CREATE INDEX idx_articles_src_cat ON articles(article_source, article_category);
CREATE INDEX idx_ai_outputs_type     ON ai_outputs(user_id, output_type);
CREATE INDEX idx_curriculum_creator   ON curriculum(cur_creator_id);
CREATE INDEX idx_curriculum_creator   ON curriculum(cur_creator_id);
CREATE INDEX idx_curriculum_status    ON curriculum(cur_status, cur_deleted_at);
CREATE INDEX idx_submissions_curriculum   ON task_submissions(task_curriculum_id, task_learner_id);
CREATE INDEX idx_chatbot_manager     ON chatbot_sessions(cb_manager_id);
CREATE INDEX idx_chatbot_msg_session ON chatbot_messages(cb_session_id, cb_created_at);

SELECT *
  FROM users;
  
  SELECT *
  FROM articles;
  
  SELECT *
  FROM ai_outputs;
  
  SELECT *
  FROM output_article_refs;
  
  SELECT *
  FROM curriculum;
  
  SELECT *
  FROM task_submissions;
  
  SELECT *
  FROM chatbot_sessions;
  
  SELECT *
  FROM chatbot_messages;
  
