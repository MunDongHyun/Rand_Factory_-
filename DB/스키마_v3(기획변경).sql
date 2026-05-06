-- ============================================================
-- LANDFACTORY DB 스키마 v2.1
-- ============================================================

-- ============================================================
-- SECTION 1. 공통 코드 테이블
-- ============================================================

CREATE TABLE job_categories (
    job_code  CHAR(10)     PRIMARY KEY,
    job_name   VARCHAR(100) NOT NULL,
    is_active BOOLEAN      DEFAULT TRUE
);

CREATE TABLE industries (
    industry_code CHAR(10)     PRIMARY KEY,
    industry_name       VARCHAR(100) NOT NULL,
    is_active     BOOLEAN      DEFAULT TRUE
);


-- ============================================================
-- SECTION 2. 사용자 (자체 로그인 전용)
-- ============================================================

CREATE TABLE users (
    user_id             BIGINT       AUTO_INCREMENT PRIMARY KEY,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,              -- 자체 로그인 전용, NULL 불허
    name                VARCHAR(50)  NOT NULL,
    role                ENUM('learner', 'manager', 'admin') NOT NULL,
    job_code            CHAR(10)     NULL,
    industry_code       CHAR(10)     NULL,
    years_of_experience INT          DEFAULT 0,
    created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME     NULL,                  -- soft delete
    FOREIGN KEY (job_code)      REFERENCES job_categories(job_code),
    FOREIGN KEY (industry_code) REFERENCES industries(industry_code)
);


-- ============================================================
-- SECTION 3. DBR/HBR 아티클
-- ============================================================

-- 3-1. 아티클 메타데이터 (summary 분리, source 추가)
CREATE TABLE articles (
    article_id      BIGINT       AUTO_INCREMENT PRIMARY KEY,
    source          ENUM('DBR', 'HBR') NOT NULL,            -- 아티클 출처 구분
    title           VARCHAR(500) NOT NULL,
    author          VARCHAR(200),
    published_date  DATE,
    category        VARCHAR(100),                           -- 예: 마케팅, 전략, HR
    source_url      VARCHAR(500),
    image_count     INT          DEFAULT 0,                 -- 본문 내 시각자료 수
    chunk_count     INT          DEFAULT 0,                 -- Vector DB 청크 수
    vector_store_id VARCHAR(200) NULL,                      -- Chroma/Pinecone 컬렉션 ID
    embedding_model VARCHAR(100) NULL,                      -- 예: text-embedding-3-small
    embed_status    ENUM('pending', 'done', 'failed') DEFAULT 'pending',
    embedded_at     DATETIME     NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FULLTEXT INDEX ft_articles_title (title) WITH PARSER ngram
);

-- 3-2. AI 생성 요약문 (articles에서 분리)
-- summary는 AI 생성 후 별도 저장되며, 재생성·버전 관리가 필요하므로 분리
CREATE TABLE article_summaries (
    summary_id      BIGINT   AUTO_INCREMENT PRIMARY KEY,
    article_id      BIGINT   NOT NULL UNIQUE,               -- 아티클당 최신 요약 1건
    summary_text    TEXT     NOT NULL,                      -- AI 생성 요약문
    model_used      VARCHAR(100),                           -- 생성에 사용한 AI 모델
    generated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FULLTEXT INDEX ft_summary_text (summary_text) WITH PARSER ngram,
    FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE
);

-- 3-3. 아티클 산업군 태그 (M:N, JSON 대체)
CREATE TABLE article_industry_tags (
    article_id    BIGINT   NOT NULL,
    industry_code CHAR(10) NOT NULL,
    PRIMARY KEY (article_id, industry_code),
    FOREIGN KEY (article_id)    REFERENCES articles(article_id)  ON DELETE CASCADE,
    FOREIGN KEY (industry_code) REFERENCES industries(industry_code)
);

-- 3-4. 워드클라우드 생성 결과
CREATE TABLE wordclouds (
    wordcloud_id BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    article_id   BIGINT       NULL,                         -- 특정 아티클 기반 시
    input_params JSON,                                      -- 생성 파라미터
    result_json  JSON         NOT NULL,                     -- { "단어": 빈도, ... }
    image_url    VARCHAR(500),
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE SET NULL
);


-- ============================================================
-- SECTION 4. 프레임워크
-- ============================================================

CREATE TABLE frameworks (
    framework_id      BIGINT  AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT  NOT NULL,
    framework_type    VARCHAR(50),                          -- OKR, AARRR, JTBD 등
    user_input        TEXT    NOT NULL,
    generated_content JSON    NOT NULL,
    is_saved          BOOLEAN DEFAULT FALSE,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- frameworks ↔ articles M:N 연결
CREATE TABLE framework_article_refs (
    framework_id    BIGINT        NOT NULL,
    article_id      BIGINT        NOT NULL,
    relevance_score DECIMAL(4, 3) NULL     COMMENT 'RAG 유사도 점수 (0.000~1.000)',
    created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (framework_id, article_id),
    FOREIGN KEY (framework_id) REFERENCES frameworks(framework_id) ON DELETE CASCADE,
    FOREIGN KEY (article_id)   REFERENCES articles(article_id)     ON DELETE RESTRICT
);


-- ============================================================
-- SECTION 5. OJT 커리큘럼
-- ============================================================

-- 5-1. 커리큘럼 (상위 단위)
CREATE TABLE curricula (
    curriculum_id   BIGINT       AUTO_INCREMENT PRIMARY KEY,
    creator_id      BIGINT       NOT NULL,                  -- 생성한 관리자
    title           VARCHAR(200) NOT NULL,
    target_job_code CHAR(10)     NULL,
    target_industry CHAR(10)     NULL,
    duration_weeks  INT          NOT NULL,
    learning_goal   TEXT,
    ai_prompt_input TEXT,                                   -- AI 생성 시 입력값 보존
    status          ENUM('draft', 'active', 'archived') DEFAULT 'draft',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME     NULL,
    FOREIGN KEY (creator_id)      REFERENCES users(user_id),
    FOREIGN KEY (target_job_code) REFERENCES job_categories(job_code),
    FOREIGN KEY (target_industry) REFERENCES industries(industry_code)
);

-- 5-2. 주차별 세부 계획
CREATE TABLE curriculum_weeks (
    week_id       BIGINT       AUTO_INCREMENT PRIMARY KEY,
    curriculum_id BIGINT       NOT NULL,
    week_number   INT          NOT NULL,
    theme         VARCHAR(200),
    learning_goal TEXT,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_curriculum_week (curriculum_id, week_number),
    FOREIGN KEY (curriculum_id) REFERENCES curricula(curriculum_id) ON DELETE CASCADE
);

-- 5-3. 주차별 배정 아티클 (M:N)
CREATE TABLE curriculum_week_articles (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    week_id       BIGINT NOT NULL,
    article_id    BIGINT NOT NULL,
    display_order INT    DEFAULT 0,
    UNIQUE KEY uq_week_article (week_id, article_id),
    FOREIGN KEY (week_id)    REFERENCES curriculum_weeks(week_id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(article_id)      ON DELETE RESTRICT
);

-- 5-4. 주차별 프레임워크 과제
CREATE TABLE curriculum_week_tasks (
    task_id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    week_id          BIGINT       NOT NULL,
    framework_type   VARCHAR(50),
    task_title       VARCHAR(200) NOT NULL,
    task_description TEXT,
    display_order    INT          DEFAULT 0,
    created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (week_id) REFERENCES curriculum_weeks(week_id) ON DELETE CASCADE
);


-- ============================================================
-- SECTION 6. 학습 관리
-- ============================================================

-- 6-1. 학습자-커리큘럼 배정
CREATE TABLE learner_assignments (
    assignment_id BIGINT   AUTO_INCREMENT PRIMARY KEY,
    curriculum_id BIGINT   NOT NULL,
    learner_id    BIGINT   NOT NULL,
    assigned_by   BIGINT   NOT NULL,
    started_at    DATETIME NULL,
    due_date      DATE     NULL,
    status        ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_assignment (curriculum_id, learner_id),
    FOREIGN KEY (curriculum_id) REFERENCES curricula(curriculum_id),
    FOREIGN KEY (learner_id)    REFERENCES users(user_id),
    FOREIGN KEY (assigned_by)   REFERENCES users(user_id)
);

-- 6-2. 과제 제출 및 피드백
CREATE TABLE task_submissions (
    submission_id     BIGINT   AUTO_INCREMENT PRIMARY KEY,
    assignment_id     BIGINT   NOT NULL,
    task_id           BIGINT   NOT NULL,
    submitted_content JSON     NOT NULL,
    submitted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    manager_feedback  TEXT     NULL,
    feedback_at       DATETIME NULL,
    status            ENUM('submitted', 'feedback_given', 'resubmit_requested') DEFAULT 'submitted',
    UNIQUE KEY uq_submission (assignment_id, task_id),
    FOREIGN KEY (assignment_id) REFERENCES learner_assignments(assignment_id),
    FOREIGN KEY (task_id)       REFERENCES curriculum_week_tasks(task_id)
);


-- ============================================================
-- SECTION 7. RAG 챗봇 (관리자 커리큘럼 생성 전용)
-- 관리자가 커리큘럼 초안 작성 중 DBR/HBR 아티클 기반으로 질의
-- ============================================================

-- 7-1. 챗봇 세션 (커리큘럼 초안과 연결)
CREATE TABLE chatbot_sessions (
    session_id    BIGINT   AUTO_INCREMENT PRIMARY KEY,
    manager_id    BIGINT   NOT NULL,                        -- 관리자만 사용
    curriculum_id BIGINT   NULL,                            -- 작성 중인 커리큘럼 (임시저장 전엔 NULL)
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id)   REFERENCES users(user_id),
    FOREIGN KEY (curriculum_id) REFERENCES curricula(curriculum_id) ON DELETE SET NULL
);

-- 7-2. 챗봇 대화 메시지
CREATE TABLE chatbot_messages (
    message_id BIGINT   AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT   NOT NULL,
    role       ENUM('user', 'assistant') NOT NULL,
    content    TEXT     NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chatbot_sessions(session_id) ON DELETE CASCADE
);

-- 7-3. 응답 근거 아티클 (RAG 참조 추적)
CREATE TABLE chatbot_message_refs (
    message_id      BIGINT        NOT NULL,
    article_id      BIGINT        NOT NULL,
    relevance_score DECIMAL(4, 3) NULL,
    PRIMARY KEY (message_id, article_id),
    FOREIGN KEY (message_id) REFERENCES chatbot_messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(article_id)
);


-- ============================================================
-- SECTION 8. 알림
-- ============================================================

CREATE TABLE notifications (
    notification_id BIGINT  AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT  NOT NULL,
    type            ENUM(
                        'curriculum_assigned',
                        'task_submitted',
                        'feedback_received',
                        'deadline_reminder',
                        'system'
                    ) NOT NULL,
    reference_type  VARCHAR(50) NULL,
    reference_id    BIGINT      NULL,
    is_read         BOOLEAN  DEFAULT FALSE,
    read_at         DATETIME NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);


-- ============================================================
-- INDEX
-- ============================================================

-- users
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_users_job         ON users(job_code);
CREATE INDEX idx_users_industry    ON users(industry_code);
CREATE INDEX idx_users_deleted     ON users(deleted_at);

-- articles
CREATE INDEX idx_articles_source      ON articles(source);
CREATE INDEX idx_articles_category    ON articles(category);
CREATE INDEX idx_articles_date        ON articles(published_date);
CREATE INDEX idx_articles_embed       ON articles(embed_status);
CREATE INDEX idx_articles_source_cat  ON articles(source, category);  -- 출처+카테고리 복합

-- curricula
CREATE INDEX idx_curricula_creator    ON curricula(creator_id);
CREATE INDEX idx_curricula_status     ON curricula(status, deleted_at);

-- learner_assignments
CREATE INDEX idx_assign_learner_status ON learner_assignments(learner_id, status);
CREATE INDEX idx_assign_curriculum     ON learner_assignments(curriculum_id);

-- task_submissions
CREATE INDEX idx_submission_status     ON task_submissions(status);

-- chatbot
CREATE INDEX idx_chatbot_manager       ON chatbot_sessions(manager_id);
CREATE INDEX idx_chatbot_msg_session   ON chatbot_messages(session_id, created_at);

-- notifications
CREATE INDEX idx_notif_user_read       ON notifications(user_id, is_read);

-- wordclouds
CREATE INDEX idx_wordcloud_user        ON wordclouds(user_id);