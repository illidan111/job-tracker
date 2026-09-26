CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  passwordHash TEXT NOT NULL,
  name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  weeklyGoal INTEGER NOT NULL DEFAULT 8 CHECK (weeklyGoal BETWEEN 1 AND 100),
  appearance TEXT NOT NULL DEFAULT 'light' CHECK (appearance IN ('light','dark','system')),
  interviewReminders INTEGER NOT NULL DEFAULT 1 CHECK (interviewReminders IN (0,1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
) STRICT;

CREATE TABLE sessions (
  tokenHash TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_expiry ON sessions(expiresAt);
CREATE INDEX sessions_user ON sessions(userId);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 100),
  position TEXT NOT NULL CHECK (length(position) BETWEEN 1 AND 150),
  location TEXT NOT NULL DEFAULT '',
  salary REAL CHECK (salary >= 0 AND salary <= 100000000),
  employmentType TEXT NOT NULL CHECK (employmentType IN ('Full-time','Part-time','Contract','Internship')),
  workMode TEXT NOT NULL DEFAULT 'Not specified' CHECK (workMode IN ('Not specified','Remote','Hybrid','Onsite')),
  status TEXT NOT NULL CHECK (status IN ('APPLIED','SCREENING','INTERVIEW','OFFER','REJECTED')),
  dateApplied TEXT NOT NULL,
  jobUrl TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  followUpDate TEXT NOT NULL DEFAULT '',
  followUpCompletedAt TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (id,userId)
) STRICT;
CREATE INDEX applications_user_date ON applications(userId,dateApplied DESC);
CREATE INDEX applications_user_status ON applications(userId,status);
CREATE INDEX applications_user_followup ON applications(userId,followUpDate);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  linkedInUrl TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (id,userId)
) STRICT;
CREATE INDEX contacts_user ON contacts(userId);

CREATE TABLE application_contacts (
  applicationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  linkedAt TEXT NOT NULL,
  PRIMARY KEY (applicationId,contactId),
  FOREIGN KEY (applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE,
  FOREIGN KEY (contactId,userId) REFERENCES contacts(id,userId) ON DELETE CASCADE
) STRICT;
CREATE INDEX application_contacts_user ON application_contacts(userId,applicationId);
CREATE INDEX application_contacts_contact ON application_contacts(contactId);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  UNIQUE (userId,name),
  UNIQUE (id,userId)
) STRICT;
CREATE TABLE application_tags (
  applicationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  PRIMARY KEY (applicationId,tagId),
  FOREIGN KEY (applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE,
  FOREIGN KEY (tagId,userId) REFERENCES tags(id,userId) ON DELETE CASCADE
) STRICT;
CREATE INDEX application_tags_user ON application_tags(userId,applicationId);
CREATE INDEX application_tags_tag ON application_tags(tagId);

CREATE TABLE interviews (
  id TEXT PRIMARY KEY,
  applicationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  scheduledAt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Phone','Video','Technical','Behavioral','Onsite')),
  interviewer TEXT NOT NULL DEFAULT '',
  meetingUrl TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL CHECK (outcome IN ('Scheduled','Completed','Next round','Not moving forward','Cancelled')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE
) STRICT;
CREATE INDEX interviews_app ON interviews(userId,applicationId);
CREATE INDEX interviews_upcoming ON interviews(userId,outcome,scheduledAt);

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  applicationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('created','updated','status','contact','interview_scheduled','interview_updated','interview_completed','interview_cancelled','interview_deleted','followup_scheduled','followup_completed')),
  at TEXT NOT NULL,
  status TEXT CHECK (status IN ('APPLIED','SCREENING','INTERVIEW','OFFER','REJECTED')),
  description TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE
) STRICT;
CREATE INDEX timeline_application ON timeline_events(userId,applicationId,at DESC);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  applicationId TEXT NOT NULL,
  sourceKey TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('interview','followup')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  dueAt TEXT NOT NULL,
  readAt TEXT,
  FOREIGN KEY (applicationId,userId) REFERENCES applications(id,userId) ON DELETE CASCADE,
  UNIQUE (userId,sourceKey)
) STRICT;
CREATE INDEX notifications_user ON notifications(userId,readAt,dueAt);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL
) STRICT;
CREATE INDEX rate_limits_expiry ON rate_limits(expiresAt);
