-- Central, transaction-bound reward ledger. Entity tombstones survive domain deletion.
CREATE TABLE user_progress(userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, companion TEXT NOT NULL DEFAULT 'fox' CHECK(companion IN ('fox','cat','hare')), enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), suppress INTEGER NOT NULL DEFAULT 0 CHECK(suppress IN (0,1))) STRICT;
INSERT INTO user_progress(userId) SELECT id FROM users;
CREATE TRIGGER progress_signup AFTER INSERT ON users BEGIN INSERT INTO user_progress(userId) VALUES(NEW.id); END;
CREATE TABLE reward_rules(type TEXT PRIMARY KEY, xp INTEGER NOT NULL, dailyLimit INTEGER NOT NULL) STRICT;
INSERT INTO reward_rules VALUES ('APPLICATION_SUBMITTED',30,5),('CONTACT_ADDED',10,5),('INTERVIEW_SCHEDULED',25,4),('INTERVIEW_PREPARED',40,3),('INTERVIEW_COMPLETED',60,3),('FOLLOWUP_COMPLETED',25,5),('TASK_COMPLETED',15,5);
CREATE TABLE reward_events(id INTEGER PRIMARY KEY AUTOINCREMENT,userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,type TEXT NOT NULL REFERENCES reward_rules(type),entityId TEXT NOT NULL,fingerprint TEXT NOT NULL,xp INTEGER NOT NULL CHECK(xp>=0),source TEXT NOT NULL CHECK(source IN ('action','backfill','import')),createdAt TEXT NOT NULL, UNIQUE(userId,type,entityId),UNIQUE(userId,type,fingerprint)) STRICT;
CREATE INDEX reward_user_time ON reward_events(userId,createdAt DESC);
CREATE INDEX reward_user_type_time ON reward_events(userId,type,createdAt);
CREATE TABLE user_achievements(userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,id TEXT NOT NULL,unlockedAt TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(userId,id)) STRICT;
CREATE VIEW reward_candidates AS SELECT userId,type,entityId,fingerprint,source,createdAt FROM reward_events WHERE 0;
CREATE TRIGGER award_candidate INSTEAD OF INSERT ON reward_candidates BEGIN
 INSERT INTO reward_events(userId,type,entityId,fingerprint,xp,source,createdAt)
 SELECT NEW.userId,NEW.type,NEW.entityId,lower(trim(NEW.fingerprint)),
 CASE WHEN p.suppress=1 THEN 0 WHEN NEW.source='backfill' THEN r.xp WHEN (SELECT count(*) FROM reward_events e WHERE e.userId=NEW.userId AND e.type=NEW.type AND e.source='action' AND e.xp>0 AND e.createdAt>=strftime('%Y-%m-%d','now'))<r.dailyLimit THEN r.xp ELSE 0 END,
 CASE WHEN p.suppress=1 THEN 'import' ELSE NEW.source END,NEW.createdAt
 FROM reward_rules r JOIN user_progress p ON p.userId=NEW.userId WHERE r.type=NEW.type ON CONFLICT DO NOTHING;
END;
CREATE TRIGGER unlock_achievements AFTER INSERT ON reward_events WHEN NEW.xp>0 BEGIN
 INSERT INTO user_achievements SELECT NEW.userId,'first-step',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='APPLICATION_SUBMITTED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='APPLICATION_SUBMITTED' AND xp>0)>=1 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'in-motion',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='APPLICATION_SUBMITTED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='APPLICATION_SUBMITTED' AND xp>0)>=10 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'open-horizons',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='APPLICATION_SUBMITTED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='APPLICATION_SUBMITTED' AND xp>0)>=50 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'conversation',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='INTERVIEW_SCHEDULED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='INTERVIEW_SCHEDULED' AND xp>0)>=1 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'ready',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='INTERVIEW_PREPARED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='INTERVIEW_PREPARED' AND xp>0)>=1 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'showed-up',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='INTERVIEW_COMPLETED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='INTERVIEW_COMPLETED' AND xp>0)>=1 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'seasoned',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='INTERVIEW_COMPLETED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='INTERVIEW_COMPLETED' AND xp>0)>=10 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'connection',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='CONTACT_ADDED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='CONTACT_ADDED' AND xp>0)>=1 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'network',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='CONTACT_ADDED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='CONTACT_ADDED' AND xp>0)>=5 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'loop',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='FOLLOWUP_COMPLETED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='FOLLOWUP_COMPLETED' AND xp>0)>=1 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'persistent',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='FOLLOWUP_COMPLETED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='FOLLOWUP_COMPLETED' AND xp>0)>=10 ON CONFLICT DO NOTHING;
 INSERT INTO user_achievements SELECT NEW.userId,'small-steps',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.source WHERE NEW.type='TASK_COMPLETED' AND (SELECT count(*) FROM reward_events WHERE userId=NEW.userId AND type='TASK_COMPLETED' AND xp>0)>=10 ON CONFLICT DO NOTHING;
END;
-- Existing evidence is marked as a migration backfill, never as activity today.
INSERT INTO reward_candidates SELECT userId,'APPLICATION_SUBMITTED',id,company||'|'||position,'backfill',createdAt FROM applications ORDER BY createdAt;
INSERT INTO reward_candidates SELECT userId,'CONTACT_ADDED',id,name||'|'||email||'|'||company,'backfill',createdAt FROM contacts ORDER BY createdAt;
INSERT INTO reward_candidates SELECT userId,'INTERVIEW_SCHEDULED',id,applicationId||'|'||type||'|'||scheduledAt,'backfill',createdAt FROM interviews WHERE outcome<>'Cancelled' ORDER BY createdAt;
INSERT INTO reward_candidates SELECT userId,'INTERVIEW_COMPLETED',id,applicationId||'|'||type||'|'||scheduledAt,'backfill',updatedAt FROM interviews WHERE outcome='Completed';
INSERT INTO reward_candidates SELECT userId,'TASK_COMPLETED',id,coalesce(applicationId,'personal')||'|'||title,'backfill',completedAt FROM tasks WHERE status='COMPLETED';
INSERT INTO reward_candidates SELECT userId,'INTERVIEW_PREPARED',interviewId,interviewId,'backfill',updatedAt FROM interview_preparations WHERE json_array_length(topics)>0 AND length(trim(questionsToAsk))>0 AND NOT EXISTS(SELECT 1 FROM json_each(topics) WHERE json_extract(value,'$.done')<>1);
INSERT INTO reward_candidates SELECT userId,'FOLLOWUP_COMPLETED',id,company||'|'||position,'backfill',followUpCompletedAt FROM applications WHERE followUpCompletedAt<>'';

CREATE TRIGGER reward_application AFTER INSERT ON applications BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'APPLICATION_SUBMITTED',NEW.id,NEW.company||'|'||NEW.position,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_contact AFTER INSERT ON contacts BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'CONTACT_ADDED',NEW.id,NEW.name||'|'||NEW.email||'|'||NEW.company,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_interview_scheduled_insert AFTER INSERT ON interviews WHEN NEW.outcome='Scheduled' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'INTERVIEW_SCHEDULED',NEW.id,NEW.applicationId||'|'||NEW.type||'|'||NEW.scheduledAt,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_interview_completed_insert AFTER INSERT ON interviews WHEN NEW.outcome='Completed' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'INTERVIEW_COMPLETED',NEW.id,NEW.applicationId||'|'||NEW.type||'|'||NEW.scheduledAt,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_task_insert AFTER INSERT ON tasks WHEN NEW.status='COMPLETED' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'TASK_COMPLETED',NEW.id,coalesce(NEW.applicationId,'personal')||'|'||NEW.title,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_prepared_insert AFTER INSERT ON interview_preparations WHEN json_array_length(NEW.topics)>0 AND NOT EXISTS(SELECT 1 FROM json_each(NEW.topics) WHERE json_extract(value,'$.done')<>1) AND length(trim(NEW.questionsToAsk))>0 BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'INTERVIEW_PREPARED',NEW.interviewId,NEW.interviewId,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_interview_scheduled_update AFTER UPDATE ON interviews WHEN NEW.outcome='Scheduled' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'INTERVIEW_SCHEDULED',NEW.id,NEW.applicationId||'|'||NEW.type||'|'||NEW.scheduledAt,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_interview_completed_update AFTER UPDATE ON interviews WHEN NEW.outcome='Completed' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'INTERVIEW_COMPLETED',NEW.id,NEW.applicationId||'|'||NEW.type||'|'||NEW.scheduledAt,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_task_update AFTER UPDATE ON tasks WHEN NEW.status='COMPLETED' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'TASK_COMPLETED',NEW.id,coalesce(NEW.applicationId,'personal')||'|'||NEW.title,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_prepared_update AFTER UPDATE ON interview_preparations WHEN json_array_length(NEW.topics)>0 AND NOT EXISTS(SELECT 1 FROM json_each(NEW.topics) WHERE json_extract(value,'$.done')<>1) AND length(trim(NEW.questionsToAsk))>0 BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'INTERVIEW_PREPARED',NEW.interviewId,NEW.interviewId,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER reward_followup AFTER UPDATE ON applications WHEN NEW.followUpCompletedAt<>'' AND OLD.followUpCompletedAt='' BEGIN INSERT INTO reward_candidates VALUES(NEW.userId,'FOLLOWUP_COMPLETED',NEW.id,NEW.company||'|'||NEW.position,'action',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
