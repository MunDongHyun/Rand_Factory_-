CREATE TABLE certificates (
    cert_id                 BIGINT NOT NULL AUTO_INCREMENT COMMENT '수료증 ID',
    cert_no                 VARCHAR(50) NOT NULL COMMENT '수료증 번호',
    cert_curriculum_id      BIGINT NOT NULL COMMENT '커리큘럼 ID',
    cert_learner_id         BIGINT NOT NULL COMMENT '학습자 ID',
    cert_issuer_id          BIGINT NOT NULL COMMENT '발급 매니저 ID',
    cert_title              VARCHAR(255) NOT NULL COMMENT '수료증 제목',
    cert_curriculum_title   VARCHAR(255) NOT NULL COMMENT '수료 커리큘럼명',
    cert_learner_name       VARCHAR(50) NOT NULL COMMENT '발급 당시 학습자명',
    cert_issuer_name        VARCHAR(50) NOT NULL COMMENT '발급 당시 발급자명',
    cert_storage_key        VARCHAR(512) NOT NULL COMMENT '수료증 파일 저장 key',
    cert_issued_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '발급 일시',
    cert_completed_at       DATETIME NULL COMMENT '교육 완료 일시',
    cert_deleted_at         DATETIME NULL COMMENT '삭제 일시',
    PRIMARY KEY (cert_id),
    CONSTRAINT uq_certificates_no
        UNIQUE (cert_no),
    CONSTRAINT uq_certificates_curriculum_learner
        UNIQUE (cert_curriculum_id, cert_learner_id),
    CONSTRAINT fk_certificates_curriculum
        FOREIGN KEY (cert_curriculum_id)
        REFERENCES curriculum (cur_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_certificates_learner
        FOREIGN KEY (cert_learner_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_certificates_issuer
        FOREIGN KEY (cert_issuer_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    INDEX idx_certificates_learner (cert_learner_id, cert_issued_at),
    INDEX idx_certificates_curriculum (cert_curriculum_id, cert_issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
