-- Upgrade databases opened by the development watcher during the Journey rollout.
-- Explicit UPSERTs preserve idempotency inside an outer preparation UPSERT.
-- No reward history or backfill is replayed.
DROP TRIGGER award_candidate;
DROP TRIGGER unlock_achievements;
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
