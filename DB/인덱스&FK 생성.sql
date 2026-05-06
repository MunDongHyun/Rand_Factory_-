CREATE INDEX idx_users_deleted
        ON users(user_deleted_at);

CREATE INDEX idx_users_role
        ON users(user_role);
        
CREATE INDEX idx_articles_category
    ON articles(article_category);

CREATE INDEX idx_articles_source
    ON articles(article_source);

CREATE INDEX idx_articles_src_cat
    ON articles(article_source, article_category);
    
CREATE INDEX idx_curriculum_creator
    ON curriculum(cur_creator_id);

CREATE INDEX idx_curriculum_status
    ON curriculum(cur_status, cur_deleted_at);

ALTER TABLE curriculum
    ADD CONSTRAINT  FOREIGN KEY (cur_creator_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
        
CREATE INDEX idx_ai_outputs_type
    ON ai_outputs(user_id, output_type);

ALTER TABLE ai_outputs
    ADD CONSTRAINT  FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE ai_outputs
    ADD CONSTRAINT  FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE SET NULL ON UPDATE RESTRICT;
	
ALTER TABLE chatbot_sessions
    ADD CONSTRAINT  FOREIGN KEY (cb_manager_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE chatbot_sessions
    ADD CONSTRAINT  FOREIGN KEY (cb_curriculum_id)
        REFERENCES curriculum (cur_id) ON DELETE SET NULL ON UPDATE RESTRICT;
        
ALTER TABLE output_article_refs
    ADD CONSTRAINT  FOREIGN KEY (output_id)
        REFERENCES ai_outputs (output_id) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE output_article_refs
    ADD CONSTRAINT  FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
        
CREATE INDEX idx_submissions_curriculum
    ON task_submissions(task_curriculum_id, task_learner_id);

ALTER TABLE task_submissions
    ADD CONSTRAINT  FOREIGN KEY (task_curriculum_id)
        REFERENCES curriculum (cur_id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE task_submissions
    ADD CONSTRAINT  FOREIGN KEY (task_learner_id)
        REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
        
CREATE INDEX idx_chatbot_msg_session
    ON chatbot_messages(session_id, created_at);

ALTER TABLE chatbot_messages
    ADD CONSTRAINT  FOREIGN KEY (session_id)
        REFERENCES chatbot_sessions (cb_session_id) ON DELETE CASCADE ON UPDATE RESTRICT;