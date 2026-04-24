-- ============================================
-- LANDFACTORY DB 스키마 초안
-- 확정된 기능 기준 | 이준서와 함께 검토 후 확정
-- ============================================

-- 1. 회원 (멘토/멘티 공통)
CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role ENUM('mentee', 'mentor') NOT NULL,       -- 멘토/멘티 구분
    job_title VARCHAR(100),                        -- 직무 (예: 마케팅 기획)
    industry VARCHAR(100),                         -- 산업군 (예: IT, 금융)
    years_of_experience INT DEFAULT 0,             -- 경력 연차
    profile_image_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 멘토 추가 정보
CREATE TABLE mentor_profiles (
    mentor_profile_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    business_card_image_url VARCHAR(500),           -- 명함 인증 이미지
    is_verified BOOLEAN DEFAULT FALSE,              -- 인증 완료 여부
    bio TEXT,                                       -- 자기소개
    specialties JSON,                               -- 전문 분야 (예: ["B2B마케팅", "제안서작성"])
    available BOOLEAN DEFAULT TRUE,                 -- 매칭 가능 상태
    rating_avg DECIMAL(2,1) DEFAULT 0.0,            -- 평균 평점
    mentoring_count INT DEFAULT 0,                  -- 멘토링 횟수
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 3. 멘토링 매칭
CREATE TABLE mentoring_matches (
    match_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    mentee_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    title VARCHAR(200),                             -- 멘토링 주제
    description TEXT,                               -- 멘티의 고민/질문 내용
    status ENUM('pending', 'accepted', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    point_cost INT DEFAULT 0,                       -- 소요 포인트
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (mentee_id) REFERENCES users(user_id),
    FOREIGN KEY (mentor_id) REFERENCES users(user_id)
);

-- 4. 멘토링 평가
CREATE TABLE mentoring_reviews (
    review_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    match_id BIGINT NOT NULL UNIQUE,
    reviewer_id BIGINT NOT NULL,                    -- 평가 작성자 (멘티)
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES mentoring_matches(match_id),
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id)
);

-- 5. 포인트 / 리워드
CREATE TABLE points (
    point_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount INT NOT NULL,                            -- 양수: 충전/획득, 음수: 사용
    balance INT NOT NULL,                           -- 거래 후 잔액
    transaction_type ENUM('charge', 'earn', 'spend', 'refund') NOT NULL,
    description VARCHAR(200),                       -- 예: "멘토링 완료 리워드", "멘토링 요청"
    reference_id BIGINT,                            -- 관련 매칭 ID (있을 경우)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 6. DBR 아티클 메타데이터
CREATE TABLE articles (
    article_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(200),
    published_date DATE,
    category VARCHAR(100),                          -- 예: 마케팅, 전략, HR
    industry_tags JSON,                             -- 관련 산업군 태그
    summary TEXT,                                   -- AI 생성 요약문
    source_url VARCHAR(500),
    image_count INT DEFAULT 0,                      -- 본문 내 시각자료 수
    chunk_count INT DEFAULT 0,                      -- Vector DB 청크 수
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 생성된 프레임워크 저장
CREATE TABLE frameworks (
    framework_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    framework_type VARCHAR(50),                     -- 예: OKR, AARRR, JTBD, Flywheel
    user_input TEXT NOT NULL,                       -- 사용자가 입력한 상황/과제
    generated_content JSON NOT NULL,                -- AI가 생성한 프레임워크 (JSON)
    referenced_article_ids JSON,                    -- 참조한 아티클 ID 목록
    is_saved BOOLEAN DEFAULT FALSE,                 -- 사용자 저장 여부
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 8. 채팅 메시지 (멘토-멘티 대화)
CREATE TABLE chat_messages (
    message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    match_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE,               -- 민감정보 감지 여부
    flag_reason VARCHAR(200),                        -- 감지 사유 (예: 전화번호, 사내기밀)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES mentoring_matches(match_id),
    FOREIGN KEY (sender_id) REFERENCES users(user_id)
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_industry ON users(industry);
CREATE INDEX idx_mentor_verified ON mentor_profiles(is_verified);
CREATE INDEX idx_matches_status ON mentoring_matches(status);
CREATE INDEX idx_matches_mentee ON mentoring_matches(mentee_id);
CREATE INDEX idx_matches_mentor ON mentoring_matches(mentor_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_date ON articles(published_date);
CREATE INDEX idx_frameworks_user ON frameworks(user_id);
CREATE INDEX idx_chat_match ON chat_messages(match_id);
CREATE INDEX idx_points_user ON points(user_id);
