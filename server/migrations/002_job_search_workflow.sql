ALTER TABLE applications ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN deadline TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN archivedAt TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN followUpReason TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN followUpNote TEXT NOT NULL DEFAULT '';
CREATE INDEX applications_user_archive ON applications(userId,archivedAt);

ALTER TABLE interviews ADD COLUMN round TEXT NOT NULL DEFAULT '';
ALTER TABLE interviews ADD COLUMN location TEXT NOT NULL DEFAULT '';

CREATE TABLE saved_jobs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 100),
  position TEXT NOT NULL CHECK (length(position) BETWEEN 1 AND 150),
  location TEXT NOT NULL DEFAULT '',
  jobUrl TEXT NOT NULL DEFAULT '',
  salary REAL CHECK (salary >= 0 AND salary <= 100000000),
  source TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (id,userId)
) STRICT;
CREATE INDEX saved_jobs_user_created ON saved_jobs(userId,createdAt DESC);
