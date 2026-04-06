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

CREATE TABLE IF NOT EXISTS movie_catalog (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_movie_id TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'movie',
  title TEXT NOT NULL,
  original_title TEXT,
  release_date TEXT,
  release_year INTEGER,
  overview TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS span_resolution_runs (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  resolver_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_span_resolution_runs_episode_id
  ON span_resolution_runs (episode_id);

CREATE TABLE IF NOT EXISTS span_movie_candidates (
  id TEXT PRIMARY KEY,
  span_id TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  confidence REAL NOT NULL,
  resolver_version TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (span_id) REFERENCES discussion_spans(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movie_catalog(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_span_movie_candidates_span_id
  ON span_movie_candidates (span_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_span_movie_candidates_span_movie_resolver
  ON span_movie_candidates (span_id, movie_id, resolver_version);

CREATE TABLE IF NOT EXISTS span_movie_labels (
  id TEXT PRIMARY KEY,
  span_id TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  label_source TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (span_id) REFERENCES discussion_spans(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movie_catalog(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_span_movie_labels_span_id
  ON span_movie_labels (span_id);

CREATE TABLE IF NOT EXISTS v2_inference_windows (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  start REAL NOT NULL,
  end REAL NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_v2_inference_windows_episode_id
  ON v2_inference_windows (episode_id);
`
