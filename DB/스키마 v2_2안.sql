-- 1. 회원 (사수, 신입, HR 공통)
CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    company_name VARCHAR(100) NOT NULL,            -- 소속 기업명
    role ENUM('senior', 'new_hire', 'hr') NOT NULL,-- 사수, 신입, HR로 역할 재정의
    job_title VARCHAR(100),                        -- 직무
    industry VARCHAR(100),                         -- 산업군
    profile_image_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_deleted BOOLEAN DEFAULT FALSE
);

-- 2. 사수-신입 연결 (기존 멘토-멘티 매칭 대체)
CREATE TABLE ojt_connections (
    connection_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    senior_id BIGINT NOT NULL,                     -- 사수 ID
    new_hire_id BIGINT NOT NULL,                   -- 신입 ID
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senior_id) REFERENCES users(user_id),
    FOREIGN KEY (new_hire_id) REFERENCES users(user_id)
);

-- 3. DBR / HBR 아티클 메타데이터 (유지)
CREATE TABLE articles (
    article_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_type ENUM('DBR', 'HBR') DEFAULT 'DBR',
    title VARCHAR(500) NOT NULL,
    author VARCHAR(200),
    published_date DATE,
    category VARCHAR(100),
    industry_tags JSON,
    summary TEXT,
    wordcloud_data JSON,                            -- 워드클라우드용 데이터
    source_url VARCHAR(500),
    chunk_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. OJT 커리큘럼 (AI 자동 생성)
CREATE TABLE ojt_curriculums (
    curriculum_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connection_id BIGINT NOT NULL,                  -- 어떤 사수-신입의 커리큘럼인지
    target_job VARCHAR(100) NOT NULL,               -- 신입 직무
    duration_weeks INT DEFAULT 4,                   -- 교육 기간
    generated_content JSON NOT NULL,                -- AI가 생성한 주차별 전체 커리큘럼
    progress_rate INT DEFAULT 0,                    -- 전체 진도율 (대시보드 표시용)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES ojt_connections(connection_id)
);

-- 5. OJT 실무 프레임워크 과제 (기존 frameworks 대체)
CREATE TABLE ojt_assignments (
    assignment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id BIGINT NOT NULL,
    new_hire_id BIGINT NOT NULL,
    article_id BIGINT NOT NULL,                     -- 기반이 된 아티클
    week_number INT NOT NULL,                       -- 해당 과제의 주차
    framework_type VARCHAR(50),                     -- 예: OKR, AARRR 등
    new_hire_content TEXT,                          -- 신입이 작성한 프레임워크 내용
    ai_feedback TEXT,                               -- AI가 제공한 평가/피드백 내용 (RAG 기반)
    status ENUM('pending', 'submitted', 'reviewed') DEFAULT 'pending', -- 과제 상태
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (curriculum_id) REFERENCES ojt_curriculums(curriculum_id),
    FOREIGN KEY (new_hire_id) REFERENCES users(user_id),
    FOREIGN KEY (article_id) REFERENCES articles(article_id)
);

-- 6. 채팅 메시지 (사수-신입 소통 채널, 기존 기능 재활용)
CREATE TABLE chat_messages (
    message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connection_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES ojt_connections(connection_id),
    FOREIGN KEY (sender_id) REFERENCES users(user_id)
);

-- 7. RAG 기반 신입 질의응답 로그 (신규 추가)
CREATE TABLE rag_qna_logs (
    qna_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    new_hire_id BIGINT NOT NULL,
    curriculum_id BIGINT,                           -- 특정 커리큘럼 진행 중 질문한 경우
    user_question TEXT NOT NULL,                    -- 신입의 질문
    ai_answer TEXT NOT NULL,                        -- RAG 기반 AI 답변
    referenced_article_ids JSON,                    -- 답변에 참고된 아티클 ID 목록
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (new_hire_id) REFERENCES users(user_id),
    FOREIGN KEY (curriculum_id) REFERENCES ojt_curriculums(curriculum_id)
);

-- ============================================
-- 인덱스 (조회 성능 최적화)
-- ============================================
CREATE INDEX idx_users_role_company ON users(role, company_name);
CREATE INDEX idx_connections_senior ON ojt_connections(senior_id);
CREATE INDEX idx_connections_new_hire ON ojt_connections(new_hire_id);
CREATE INDEX idx_assignments_status ON ojt_assignments(status);
CREATE INDEX idx_chat_connection ON chat_messages(connection_id);