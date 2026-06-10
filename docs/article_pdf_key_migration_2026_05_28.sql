-- Add object-storage key for article source PDFs.
-- Required for existing databases because SQLAlchemy create_all does not add
-- columns to already-created tables.

ALTER TABLE articles
    ADD COLUMN article_pdf_key VARCHAR(512) NULL;
