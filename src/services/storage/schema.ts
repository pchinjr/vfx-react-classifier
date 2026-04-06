// Schema is kept in one file so database initialization is deterministic and
// easy to diff as the project evolves.
export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  youtube_video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  channel_title TEXT,
  published_at TEXT,
  duration_seconds INTEGER,
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript_cues (
  episode_id TEXT NOT NULL,
  cue_index INTEGER NOT NULL,
  start REAL NOT NULL,
  end REAL NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (episode_id, cue_index),
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcript_cues_episode_id
  ON transcript_cues (episode_id);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  start REAL NOT NULL,
  end REAL NOT NULL,
  text TEXT NOT NULL,
  token_estimate INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segments_episode_id
  ON segments (episode_id);

CREATE TABLE IF NOT EXISTS segment_embeddings (
  segment_id TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  embedding_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (segment_id, model),
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segment_embeddings_segment_id
  ON segment_embeddings (segment_id);

CREATE TABLE IF NOT EXISTS discussion_spans (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  start REAL NOT NULL,
  end REAL NOT NULL,
  text TEXT NOT NULL,
  source_segment_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discussion_spans_episode_id
  ON discussion_spans (episode_id);
`
