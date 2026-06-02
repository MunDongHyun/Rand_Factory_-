-- Task submission schema migration for the 2026-05-18 attachment refactor.
-- Run this against an existing database before using the table-backed
-- attachment endpoints. New databases can use the full CREATE TABLE DDL.

ALTER TABLE task_submissions
    ADD COLUMN task_submission_type ENUM('text', 'file', 'mixed')
        NOT NULL DEFAULT 'text' COMMENT '제출 형태(텍스트/첨부파일/혼합)'
        AFTER task_week_number,
    MODIFY COLUMN task_submitted_content JSON NULL COMMENT '제출 내용',
    ADD COLUMN task_score INT(3) NULL COMMENT '담당자 평가 점수(0~100)'
        AFTER task_manager_feedback,
    ADD COLUMN task_resubmit_requested CHAR(1)
        NOT NULL DEFAULT 'N' COMMENT '재제출 요청 여부(Y/N)'
        AFTER task_score;

ALTER TABLE task_submissions
    ADD CONSTRAINT chk_task_score_range
    CHECK (task_score IS NULL OR (task_score >= 0 AND task_score <= 100));

ALTER TABLE task_submissions
    ADD CONSTRAINT chk_resubmit_requested
    CHECK (task_resubmit_requested IN ('Y', 'N'));

CREATE TABLE IF NOT EXISTS task_submission_attachments
(
    task_attachment_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '첨부파일 ID',
    task_submission_id BIGINT NOT NULL COMMENT '과제 제출 ID',
    file_original_name VARCHAR(255) NOT NULL COMMENT '사용자가 업로드한 원본 파일명',
    file_storage_key VARCHAR(1000) NOT NULL COMMENT '서버 저장 파일 key/path',
    file_mime_type VARCHAR(100) NOT NULL COMMENT '파일 MIME 타입',
    file_size_bytes BIGINT NOT NULL COMMENT '파일 크기(byte)',
    file_sha256 CHAR(64) NULL COMMENT '파일 무결성 확인용 SHA-256 해시',
    file_uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '파일 업로드 일시',
    file_deleted_at DATETIME NULL COMMENT '파일 삭제 일시',
    PRIMARY KEY (task_attachment_id),
    CONSTRAINT fk_task_attach_submission
        FOREIGN KEY (task_submission_id)
        REFERENCES task_submissions(task_submission_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT chk_task_attach_size
        CHECK (file_size_bytes > 0)
);

CREATE INDEX idx_task_attach_submission
    ON task_submission_attachments(task_submission_id, file_deleted_at);
