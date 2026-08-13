CREATE INDEX ingestion_org_version_idx ON ingestion_job(organization_id,version_id);
CREATE INDEX document_org_id_idx ON document(organization_id,id);
CREATE INDEX invitation_org_email_idx ON invitation(organization_id,email,status);
ALTER TABLE usage_daily ADD COLUMN ocr_pages INTEGER NOT NULL DEFAULT 0;
