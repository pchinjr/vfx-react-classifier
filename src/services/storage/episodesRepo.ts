import type { Episode } from '../../domain/episode.ts'
import type { TranscriptCue } from '../../domain/transcript.ts'
import type { DatabaseClient } from './db.ts'

export function upsertEpisode(db: DatabaseClient, episode: Episode) {
  db.query(
    `
    INSERT INTO episodes (
      id, youtube_video_id, title, description, channel_title, published_at,
      duration_seconds, source_url, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(youtube_video_id) DO UPDATE SET
      id = excluded.id,
      title = excluded.title,
      description = excluded.description,
      channel_title = excluded.channel_title,
      published_at = excluded.published_at,
      duration_seconds = excluded.duration_seconds,
      source_url = excluded.source_url
    `,
    [
      episode.id,
      episode.youtubeVideoId,
      episode.title,
      episode.description ?? null,
      episode.channelTitle ?? null,
      episode.publishedAt ?? null,
      episode.durationSeconds ?? null,
      episode.sourceUrl,
      episode.createdAt,
    ],
  )

  return episode
}

export function replaceTranscriptCuesForEpisode(
  db: DatabaseClient,
  episodeId: string,
  cues: TranscriptCue[],
) {
  db.execute('BEGIN')

  try {
    db.query('DELETE FROM transcript_cues WHERE episode_id = ?', [episodeId])

    cues.forEach((cue, index) => {
      db.query(
        `
        INSERT INTO transcript_cues (episode_id, cue_index, start, end, text)
        VALUES (?, ?, ?, ?, ?)
        `,
        [episodeId, index, cue.start, cue.end, cue.text],
      )
    })

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function getEpisodeByYouTubeVideoId(
  db: DatabaseClient,
  youtubeVideoId: string,
) {
  const rows = db.queryEntries<Episode & { youtube_video_id: string }>(
    `
    SELECT
      id,
      youtube_video_id,
      title,
      description,
      channel_title AS channelTitle,
      published_at AS publishedAt,
      duration_seconds AS durationSeconds,
      source_url AS sourceUrl,
      created_at AS createdAt
    FROM episodes
    WHERE youtube_video_id = ?
    LIMIT 1
    `,
    [youtubeVideoId],
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    ...row,
    youtubeVideoId: row.youtube_video_id,
  }
}
