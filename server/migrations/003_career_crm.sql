CREATE TABLE companies (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 100),
  website TEXT NOT NULL DEFAULT '', industry TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  UNIQUE(userId,name), UNIQUE(id,userId)
) STRICT;
CREATE TABLE application_companies (
  applicationId TEXT PRIMARY KEY, userId TEXT NOT NULL, companyId TEXT NOT NULL,
  FOREIGN KEY(applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE,
  FOREIGN KEY(companyId,userId) REFERENCES companies(id,userId)
) STRICT;
CREATE INDEX application_companies_company ON application_companies(userId,companyId);
INSERT INTO companies(id,userId,name,createdAt,updatedAt)
SELECT lower(hex(randomblob(16))),userId,trim(company),min(createdAt),max(updatedAt)
FROM applications GROUP BY userId,trim(company) COLLATE NOCASE;
INSERT INTO application_companies(applicationId,userId,companyId)
SELECT a.id,a.userId,c.id FROM applications a JOIN companies c ON c.userId=a.userId AND c.name=trim(a.company) COLLATE NOCASE;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, applicationId TEXT,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160), description TEXT NOT NULL DEFAULT '', dueDate TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','COMPLETED')), completedAt TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY(applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE,
  CHECK((status='OPEN' AND completedAt='') OR (status='COMPLETED' AND completedAt<>''))
) STRICT;
CREATE INDEX tasks_user_due ON tasks(userId,status,dueDate);
CREATE INDEX tasks_application ON tasks(userId,applicationId);
CREATE TABLE application_notes (
  id TEXT PRIMARY KEY, userId TEXT NOT NULL, applicationId TEXT NOT NULL, body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  FOREIGN KEY(applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE
) STRICT;
CREATE INDEX notes_application ON application_notes(userId,applicationId,createdAt DESC);
CREATE TABLE application_materials (
  applicationId TEXT PRIMARY KEY, userId TEXT NOT NULL,
  jobDescription TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(skills)),
  resumeVersion TEXT NOT NULL DEFAULT '', resumeUrl TEXT NOT NULL DEFAULT '', coverLetter TEXT NOT NULL DEFAULT '',
  portfolioUrl TEXT NOT NULL DEFAULT '', assignmentUrl TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), updatedAt TEXT NOT NULL,
  FOREIGN KEY(applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE
) STRICT;
CREATE UNIQUE INDEX interviews_identity_owner ON interviews(id,userId);
CREATE TABLE interview_preparations (
  interviewId TEXT PRIMARY KEY, userId TEXT NOT NULL,
  topics TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(topics)), questionsToAsk TEXT NOT NULL DEFAULT '', expectedQuestions TEXT NOT NULL DEFAULT '',
  reflection TEXT NOT NULL DEFAULT 'Pending' CHECK(reflection IN ('Pending','Positive','Neutral','Negative')),
  reflectionNotes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), updatedAt TEXT NOT NULL,
  FOREIGN KEY(interviewId,userId) REFERENCES interviews(id,userId) ON DELETE CASCADE
) STRICT;
CREATE INDEX materials_user ON application_materials(userId);
CREATE INDEX preparations_user ON interview_preparations(userId);

CREATE TABLE timeline_events_new (
  id TEXT PRIMARY KEY, applicationId TEXT NOT NULL, userId TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('created','updated','status','contact','interview_scheduled','interview_updated','interview_completed','interview_cancelled','interview_deleted','followup_scheduled','followup_completed','task_created','task_completed','task_updated','note_added','note_updated','note_deleted','materials_updated','preparation_updated')),
  at TEXT NOT NULL, status TEXT CHECK(status IN ('APPLIED','SCREENING','INTERVIEW','OFFER','REJECTED')), description TEXT NOT NULL DEFAULT '',
  FOREIGN KEY(applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE
) STRICT;
INSERT INTO timeline_events_new SELECT * FROM timeline_events;
DROP TABLE timeline_events;
ALTER TABLE timeline_events_new RENAME TO timeline_events;
CREATE INDEX timeline_application ON timeline_events(userId,applicationId,at DESC);
CREATE INDEX applications_user_created ON applications(userId,createdAt DESC);
