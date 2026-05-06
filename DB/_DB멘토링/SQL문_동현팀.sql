CREATE TABLE users
(
    user_id         BIGINT              NOT NULL AUTO_INCREMENT COMMENT '회원ID',
    user_emaiL      VARCHAR(255)        NOT NULL COMMENT '이메일',
    user_pw         VARCHAR(255)        NOT NULL COMMENT '비밀번호',
    user_name       VARCHAR(50)         NOT NULL COMMENT '이름',
    user_role       ENUM('j', 'm', 'a') NOT NULL COMMENT '역할',
    user_job_title  VARCHAR(100)        NOT NULL COMMENT '직무',
    user_industry   VARCHAR(100)        NOT NULL COMMENT '산업군',
    user_work_years INT                 NOT NULL DEFAULT 0 COMMENT '경력 연차',
    user_created_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
    user_updated_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
    user_deleted_at DATETIME            NOT NULL COMMENT '탈퇴 일시',
    PRIMARY KEY (user_id)
);

CREATE INDEX idx_users_deleted
        ON users(user_deleted_at);

CREATE INDEX idx_users_role
        ON users(user_role);


CREATE TABLE articles
(
    article_id             BIGINT               NOT NULL AUTO_INCREMENT COMMENT '아티클 ID',
    article_source         ENUM('DBR', 'HBR')   NOT NULL COMMENT '출처 구분',
    article_title          VARCHAR(500)         NOT NULL COMMENT '제목',
    article_author         VARCHAR(200)         NOT NULL COMMENT '저자',
    article_published_date DATE                 NOT NULL COMMENT '발행일',
    article_category       VARCHAR(100)         NOT NULL COMMENT '카테고리',
    article_source_url     VARCHAR(500)         NOT NULL COMMENT '원문 URL',
    article_image_count    INT                  NOT NULL DEFAULT 0 COMMENT '시각자료 수',
    article_chunk_count    INT                  NOT NULL DEFAULT 0 COMMENT '청크 수',
    article_created_at     DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
    article_updated_at     DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
    PRIMARY KEY (article_id)
);

CREATE INDEX idx_articles_category
    ON articles(article_category);

CREATE INDEX idx_articles_source
    ON articles(article_source);

CREATE INDEX idx_articles_src_cat
    ON articles(article_source, article_category);



CREATE TABLE curriculum
(
    cur_id                   BIGINT                              NOT NULL AUTO_INCREMENT COMMENT '커리큘럼 ID',
    cur_creator_id           BIGINT                              NOT NULL COMMENT '생성 관리자 ID',
    cur_title                VARCHAR(200)                        NOT NULL COMMENT '제목',
    cur_target_job           VARCHAR(100)                        NOT NULL COMMENT '대상 직무',
    cur_target_industry      VARCHAR(100)                        NOT NULL COMMENT '대상 산업군',
    cur_duration_weeks       INT                                 NOT NULL COMMENT '교육 기간',
    cur_learning_goal        TEXT                                NOT NULL COMMENT '학습 목표',
    cur_ai_prompt_input      TEXT                                NOT NULL COMMENT 'AI 입력값 원문',
    cur_week_plan            JSON                                NOT NULL COMMENT '주차별 계획 JSON',
    cur_assigned_learner_ids JSON                                NOT NULL COMMENT '배정 학습자 ID 목록',
    cur_status               ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft' COMMENT '상태',
    cur_created_at           DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
    cur_updated_at           DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수정 일시',
    cur_deleted_at           DATETIME                            NOT NULL DEFAULT COMMENT '삭제 일시',
    PRIMARY KEY (cur_id)
);

CREATE INDEX idx_curriculum_creator
    ON curriculum(cur_creator_id);

CREATE INDEX idx_curriculum_status
    ON curriculum(cur_status, cur_deleted_at);

ALTER TABLE curriculum
    ADD CONSTRAINT  FOREIGN KEY (cur_creator_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE ai_outputs(
    output_id         BIGINT                                    NOT NULL AUTO_INCREMENT COMMENT '결과 ID',
    user_id           BIGINT                                    NOT NULL COMMENT '생성자 ID',
    article_id        BIGINT                                    NOT NULL COMMENT '연결 아티클 ID',
    output_type       ENUM('summary', 'wordcloud', 'framework') NOT NULL COMMENT '결과 유형',
    summary_text      TEXT                                      NOT NULL COMMENT '요약문',
    result_json       JSON                                      NOT NULL COMMENT '워드클라우드 JSON',
    image_url         VARCHAR(500)                              NOT NULL COMMENT '이미지 URL',
    framework_type    VARCHAR(50)                               NOT NULL COMMENT '프레임워크 유형',
    user_input        TEXT                                      NOT NULL COMMENT '사용자 입력 내용',
    generated_content JSON                                      NOT NULL COMMENT 'AI 생성 프레임워크 구조',
    is_saved          BOOLEAN                                   NOT NULL DEFAULT FALSE COMMENT '저장 여부',
    model_used        VARCHAR(100)                              NOT NULL COMMENT '사용 AI',
    created_at        DATETIME NOT NULL                         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
    PRIMARY KEY (output_id) 
);

CREATE INDEX idx_ai_outputs_type
    ON ai_outputs(user_id, output_type);

ALTER TABLE ai_outputs
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE ai_outputs
    ADD CONSTRAINT  FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE SET NULL ON UPDATE RESTRICT;


CREATE TABLE chatbot_sessions
(
    cb_session_id    BIGINT   NOT NULL AUTO_INCREMENT COMMENT '세션 ID',
    cb_manager_id    BIGINT   NOT NULL COMMENT '관리자 ID',
    cb_curriculum_id BIGINT   NOT NULL COMMENT '커리큘럼 ID',
    cb_created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '세션 시작 일시',
    PRIMARY KEY (cb_session_id)
);

CREATE INDEX idx_chatbot_manager
    ON chatbot_sessions(cb_manager_id);

ALTER TABLE chatbot_sessions
    ADD CONSTRAINT  FOREIGN KEY (cb_manager_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE chatbot_sessions
    ADD CONSTRAINT  FOREIGN KEY (cb_curriculum_id)
        REFERENCES curriculum (cur_id) ON DELETE SET NULL ON UPDATE RESTRICT;

CREATE TABLE output_article_refs
(
    output_id       BIGINT       NOT NULL COMMENT '결과 ID',
    article_id      BIGINT       NOT NULL AUTO_INCREMENT COMMENT '아티클 ID',
    relevance_score DECIMAL(4,3) NOT NULL COMMENT 'RAG 유사도 점수',
    PRIMARY KEY (output_id, article_id)
);

ALTER TABLE output_article_refs
    ADD CONSTRAINT  FOREIGN KEY (output_id)
        REFERENCES ai_outputs (output_id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE output_article_refs
    ADD CONSTRAINT  FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE RESTRICT ON UPDATE RESTRICT;


CREATE TABLE task_submissions
(
    task_submission_id     BIGINT                                                    NOT NULL AUTO_INCREMENT COMMENT '제출 ID',
    task_curriculum_id     BIGINT                                                    NOT NULL COMMENT '커리큘럼 ID',
    task_learner_id        BIGINT                                                    NOT NULL COMMENT '학습자 ID',
    task_week_number       INT                                                       NOT NULL COMMENT '주차 번호',
    task_framework_type    VARCHAR(50)                                               NOT NULL COMMENT '프레임워크 유형',
    task_submitted_content JSON                                                      NOT NULL COMMENT '제출 내용',
    task_submitted_at      DATETIME                                                  NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '제출 일시',
    task_manager_feedback  TEXT                                                      NOT NULL COMMENT '관리자 피드백',
    task_feedback_at       DATETIME                                                  NOT NULL COMMENT '피드백 등록 일시',
    task_status            ENUM('submitted', 'feedback_given', 'resubmit_requested') NOT NULL DEFAULT 'submitted' COMMENT '제출 상태',
    PRIMARY KEY (task_submission_id)
);

CREATE INDEX idx_submissions_curriculum
    ON task_submissions(task_curriculum_id, task_learner_id);

ALTER TABLE task_submissions
    ADD CONSTRAINT  FOREIGN KEY (task_curriculum_id)
        REFERENCES curriculum (cur_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE task_submissions
    ADD CONSTRAINT  FOREIGN KEY (task_learner_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;


CREATE TABLE chatbot_messages
(
    message_id BIGINT                    NOT NULL AUTO_INCREMENT COMMENT '메시지 ID',
    session_id BIGINT                    NOT NULL COMMENT '세션 ID',
    role       ENUM('user', 'assistant') NOT NULL COMMENT '발화 주체',
    content    TEXT                      NOT NULL COMMENT '메시지 내용',
    created_at DATETIME                  NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '발화 일시',
    PRIMARY KEY (message_id)
);

CREATE INDEX idx_chatbot_msg_session
    ON chatbot_messages(session_id, created_at);

ALTER TABLE chatbot_messages
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES chatbot_sessions (cb_session_id) ON DELETE CASCADE ON UPDATE RESTRICT;