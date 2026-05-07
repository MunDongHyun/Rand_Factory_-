-- ============================================
-- 1. 기업
-- ============================================
CREATE TABLE companies (
    company_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    industry        VARCHAR(100),                                   -- 산업군 (예: IT, 금융, 제조)
    size_category   ENUM('startup', 'smb', 'enterprise'),          -- 기업 규모
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- 2. 기업 구독/과금 (B2B 단위 과금)
-- ============================================
-- 포인트 시스템 제거, 기업 단위 구독으로 대체
CREATE TABLE company_subscriptions (
    subscription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id      BIGINT NOT NULL UNIQUE,
    plan            ENUM('trial', 'basic', 'pro') NOT NULL DEFAULT 'trial',
    started_at      DATE NOT NULL,
    expires_at      DATE NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE
);


-- ============================================
-- 3. 사용자 (HR담당자 / 사수 / 신입 통합)
-- ============================================
-- role로 세 가지 유형 구분
-- hr: OJT 커리큘럼 생성 권한 / senior: 사수, 대시보드 열람 / newbie: 신입, 과제 수행
CREATE TABLE users (
    user_id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id          BIGINT,                                     -- 소속 기업
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    name                VARCHAR(50) NOT NULL,
    role                ENUM('hr', 'senior', 'newbie') NOT NULL,   -- 역할 구분 (핵심)
    department          VARCHAR(100),                               -- 소속 부서 (예: 마케팅팀)
    job_title           VARCHAR(100),                               -- 직책 (예: 팀장, 신입사원)
    profile_image_url   VARCHAR(500),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted          BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE SET NULL
);


-- ============================================
-- 4. 사수-신입 연결
-- ============================================
-- 기존 mentoring_matches 구조 재활용 (성격만 변경)
-- 1명의 사수가 여러 신입을 담당 가능
CREATE TABLE senior_newbie_pairs (
    pair_id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    senior_id       BIGINT NOT NULL,                                -- 사수 (role = 'senior')
    newbie_id       BIGINT NOT NULL UNIQUE,                        -- 신입 1명은 1명의 사수에만 배정
    status          ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    started_at      DATE,
    ended_at        DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senior_id) REFERENCES users(user_id),
    FOREIGN KEY (newbie_id) REFERENCES users(user_id)
);


-- ============================================
-- 5. 아티클 메타데이터 (DBR + HBR 통합)
-- ============================================
CREATE TABLE articles (
    article_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    source          ENUM('DBR', 'HBR') NOT NULL,                   -- 출처 구분
    title           VARCHAR(500) NOT NULL,
    author          VARCHAR(200),
    published_date  DATE,
    category        VARCHAR(100),                                   -- 예: 리더십, 전략, 조직관리, HR
    industry_tags   JSON,                                           -- 관련 산업군 태그
    keyword_tags    JSON,                                           -- RAG 검색용 핵심 키워드
    summary         TEXT,                                           -- AI 생성 요약문 (테이블 분리)
    source_url      VARCHAR(500),
    image_count     INT DEFAULT 0,
    chunk_count     INT DEFAULT 0,                                  -- Vector DB 청크 수
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- 6. 아티클 워드클라우드 (기존 기능 유지)
-- ============================================
CREATE TABLE article_wordclouds (
    wordcloud_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id      BIGINT NOT NULL UNIQUE,                        -- 아티클당 1건
    word_data       JSON NOT NULL,                                  -- [{word: "리더십", weight: 42}, ...]
    generated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE
);


-- ============================================
-- 7. OJT 커리큘럼 (HR담당자/사수가 생성)
-- ============================================
CREATE TABLE ojt_curriculum (
    curriculum_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_by          BIGINT NOT NULL,                            -- 생성자 (hr 또는 senior)
    title               VARCHAR(300) NOT NULL,                      -- 커리큘럼 제목
    target_role         VARCHAR(100),                               -- 대상 직무 (예: 마케팅 신입)
    target_department   VARCHAR(100),                               -- 대상 부서
    target_industry     VARCHAR(100),                               -- 대상 산업군 (RAG 필터링용)
    duration_weeks      INT,                                        -- 커리큘럼 총 기간 (주)
    objective           TEXT,                                       -- 교육 목표
    user_input          TEXT NOT NULL,                              -- 사용자가 입력한 요구사항
    generated_content   JSON NOT NULL,                              -- AI 생성 커리큘럼 전체 (JSON)
    is_saved            BOOLEAN DEFAULT FALSE,                      -- 임시저장 vs 확정
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);


-- ============================================
-- 8. 커리큘럼 모듈 (주차별 세부 구성)
-- ============================================
CREATE TABLE curriculum_modules (
    module_id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id       BIGINT NOT NULL,
    week_number         INT NOT NULL,                               -- 주차 번호 (1, 2, 3...)
    title               VARCHAR(200) NOT NULL,                      -- 예: "3주차: 고객 커뮤니케이션"
    description         TEXT,
    learning_objectives JSON,                                       -- 학습 목표 리스트
    activities          JSON,                                       -- 학습 활동 (예: ["케이스 스터디"])
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curriculum_id) REFERENCES ojt_curriculum(curriculum_id) ON DELETE CASCADE
);


-- ============================================
-- 9. 신입-커리큘럼 배정
-- ============================================
-- 생성된 커리큘럼을 특정 신입에게 배정
-- 동일 커리큘럼을 여러 신입에게 배정 가능
CREATE TABLE curriculum_assignments (
    assignment_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id   BIGINT NOT NULL,
    newbie_id       BIGINT NOT NULL,
    assigned_by     BIGINT NOT NULL,                                -- 배정한 HR/사수
    start_date      DATE,
    end_date        DATE,
    status          ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_assignment (curriculum_id, newbie_id),            -- 중복 배정 방지
    FOREIGN KEY (curriculum_id) REFERENCES ojt_curricula(curriculum_id),
    FOREIGN KEY (newbie_id)     REFERENCES users(user_id),
    FOREIGN KEY (assigned_by)   REFERENCES users(user_id)
);


-- ============================================
-- 10. 신입 모듈별 학습 진행 현황
-- ============================================
-- 사수 대시보드의 진행률 시각화 및 PDF 보고서 출력에 활용
CREATE TABLE module_progress (
    progress_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    assignment_id   BIGINT NOT NULL,                                -- 어떤 배정건인지
    module_id       BIGINT NOT NULL,                                -- 어떤 모듈인지
    status          ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
    started_at      DATETIME,
    completed_at    DATETIME,
    UNIQUE KEY uq_progress (assignment_id, module_id),
    FOREIGN KEY (assignment_id) REFERENCES curriculum_assignments(assignment_id) ON DELETE CASCADE,
    FOREIGN KEY (module_id)     REFERENCES curriculum_modules(module_id)         ON DELETE CASCADE
);


-- ============================================
-- 11. 프레임워크 과제 (신입이 작성 + AI 피드백)
-- ============================================
-- 신입이 주차별로 OKR, AARRR 등 프레임워크를 직접 작성하고 AI 피드백을 받음
CREATE TABLE framework_submissions (
    submission_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    module_id           BIGINT NOT NULL,                            -- 어느 주차 과제인지
    newbie_id           BIGINT NOT NULL,                            -- 제출한 신입
    framework_type      VARCHAR(50),                                -- 예: OKR, AARRR, JTBD
    submitted_content   JSON NOT NULL,                              -- 신입이 작성한 프레임워크 내용
    ai_feedback         TEXT,                                       -- RAG 기반 AI 피드백
    feedback_generated_at DATETIME,                                 -- AI 피드백 생성 시각
    is_reviewed         BOOLEAN DEFAULT FALSE,                      -- 사수 확인 여부
    reviewed_at         DATETIME,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id)  REFERENCES curriculum_modules(module_id),
    FOREIGN KEY (newbie_id)  REFERENCES users(user_id)
);

-- 7-1. 프레임워크 과제 - 아티클 연결 (AI가 피드백 생성 시 참조한 아티클 추적)
CREATE TABLE submission_article_refs (
    submission_id   BIGINT NOT NULL,
    article_id      BIGINT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (submission_id, article_id),
    FOREIGN KEY (submission_id) REFERENCES framework_submissions(submission_id) ON DELETE CASCADE,
    FOREIGN KEY (article_id)    REFERENCES articles(article_id)                 ON DELETE RESTRICT
);


-- ============================================
-- 12. 채팅 메시지 (사수-신입 소통 + RAG 챗봇)
-- ============================================
-- 기존 chat_messages 재활용, sender_type으로 사람/AI 구분
CREATE TABLE chat_messages (
    message_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    assignment_id   BIGINT NOT NULL,                                -- 어느 배정건의 채팅인지
    sender_id       BIGINT,                                         -- NULL이면 AI 응답
    sender_type     ENUM('senior', 'newbie', 'ai') NOT NULL,       -- 발신자 유형
    content         TEXT NOT NULL,
    -- RAG 챗봇 응답인 경우 참조 아티클 기록
    referenced_article_ids JSON,                                    -- 예: [3, 17, 42]
    is_flagged      BOOLEAN DEFAULT FALSE,                          -- 민감정보 감지 여부
    flag_reason     VARCHAR(200),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES curriculum_assignments(assignment_id),
    FOREIGN KEY (sender_id)     REFERENCES users(user_id) ON DELETE SET NULL
);


-- ============================================
-- 13. 커리큘럼 - 아티클 연결 (RAG 참조 추적)
-- ============================================
CREATE TABLE curriculum_article_refs (
    curriculum_id   BIGINT NOT NULL,
    article_id      BIGINT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (curriculum_id, article_id),
    FOREIGN KEY (curriculum_id) REFERENCES ojt_curricula(curriculum_id) ON DELETE CASCADE,
    FOREIGN KEY (article_id)    REFERENCES articles(article_id)         ON DELETE RESTRICT
);


-- ============================================
-- 인덱스
-- ============================================

-- users
CREATE INDEX idx_users_company     ON users(company_id);
CREATE INDEX idx_users_role        ON users(role);                  -- hr/senior/newbie 필터링

-- articles
CREATE INDEX idx_articles_source   ON articles(source);             -- DBR/HBR 필터링
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_date     ON articles(published_date);

-- ojt_curricula
CREATE INDEX idx_curricula_creator ON ojt_curricula(created_by);
CREATE INDEX idx_curricula_role    ON ojt_curricula(target_role);

-- curriculum_assignments (대시보드 핵심 조회)
CREATE INDEX idx_assignments_newbie    ON curriculum_assignments(newbie_id);
CREATE INDEX idx_assignments_status    ON curriculum_assignments(status);

-- module_progress (진행률 조회)
CREATE INDEX idx_progress_assignment   ON module_progress(assignment_id);

-- framework_submissions
CREATE INDEX idx_submissions_newbie    ON framework_submissions(newbie_id);
CREATE INDEX idx_submissions_module    ON framework_submissions(module_id);

-- chat_messages
CREATE INDEX idx_chat_assignment       ON chat_messages(assignment_id);
CREATE INDEX idx_chat_sender_type      ON chat_messages(sender_type);

-- senior_newbie_pairs
CREATE INDEX idx_pairs_senior          ON senior_newbie_pairs(senior_id);

-- company_subscriptions
CREATE INDEX idx_subscription_company  ON company_subscriptions(company_id);