-- NULL 관련 수정
ALTER TABLE users 
MODIFY user_deleted_at DATETIME NULL DEFAULT NULL;

ALTER TABLE curriculum
MODIFY cur_deleted_at DATETIME NULL DEFAULT NULL;

ALTER TABLE ai_outputs
MODIFY article_id BIGINT NULL;

ALTER TABLE ai_outputs
MODIFY summary_text TEXT NULL;

ALTER TABLE ai_outputs
MODIFY result_json JSON NULL;

ALTER TABLE ai_outputs
MODIFY image_url VARCHAR(500) NULL;

ALTER TABLE ai_outputs
MODIFY framework_type VARCHAR(50) NULL;

ALTER TABLE ai_outputs
MODIFY user_input TEXT NULL;

ALTER TABLE ai_outputs
MODIFY generated_content JSON NULL;

ALTER TABLE ai_outputs
MODIFY model_used VARCHAR(100) NULL;

ALTER TABLE task_submissions
MODIFY task_manager_feedback TEXT NULL;

ALTER TABLE task_submissions
MODIFY task_feedback_at DATETIME NULL;

ALTER TABLE chatbot_sessions
MODIFY cb_curriculum_id BIGINT NULL;

ALTER TABLE articles
MODIFY article_author VARCHAR(200) NULL;

ALTER TABLE articles
MODIFY article_source_url VARCHAR(500) NULL;