import type { DatabaseClient } from '../../services/storage/db.ts'
import type { WorkInference } from '../domain/workInference.ts'

export function upsertWorkInferences(
  db: DatabaseClient,
  inferences: WorkInference[],
) {
  db.execute('BEGIN')

  try {
    for (const inference of inferences) {
      db.query(
        `
        INSERT INTO v2_work_inferences (
          id, window_id, title_guess, media_type, role, confidence,
          evidence_json, rationale, model_version, prompt_version, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title_guess = excluded.title_guess,
          media_type = excluded.media_type,
          role = excluded.role,
          confidence = excluded.confidence,
          evidence_json = excluded.evidence_json,
          rationale = excluded.rationale,
          model_version = excluded.model_version,
          prompt_version = excluded.prompt_version,
          created_at = excluded.created_at
        `,
        [
          inference.id,
          inference.windowId,
          inference.titleGuess,
          inference.mediaType,
          inference.role,
          inference.confidence,
          JSON.stringify(inference.evidence),
          inference.rationale ?? null,
          inference.modelVersion,
          inference.promptVersion,
          inference.createdAt,
        ],
      )
    }

    db.execute('COMMIT')
  } catch (error) {
    db.execute('ROLLBACK')
    throw error
  }
}

export function deleteWorkInferencesForEpisode(
  db: DatabaseClient,
  episodeId: string,
  modelVersion?: string,
  promptVersion?: string,
) {
  const filters = [
    'window_id IN (SELECT id FROM v2_inference_windows WHERE episode_id = ?)',
  ]
  const params: string[] = [episodeId]

  if (modelVersion) {
    filters.push('model_version = ?')
    params.push(modelVersion)
  }

  if (promptVersion) {
    filters.push('prompt_version = ?')
    params.push(promptVersion)
  }

  db.query(
    `
    DELETE FROM v2_work_inferences
    WHERE ${filters.join(' AND ')}
    `,
    params,
  )
}

export function getWorkInferencesForEpisode(
  db: DatabaseClient,
  episodeId: string,
  options: { modelVersion?: string; promptVersion?: string } = {},
) {
  const filters = ['w.episode_id = ?']
  const params: string[] = [episodeId]

  if (options.modelVersion) {
    filters.push('wi.model_version = ?')
    params.push(options.modelVersion)
  }

  if (options.promptVersion) {
    filters.push('wi.prompt_version = ?')
    params.push(options.promptVersion)
  }

  return db.queryEntries<
    WorkInference & {
      windowStart: number
      windowEnd: number
      evidenceJson: string
    }
  >(
    `
    SELECT
      wi.id,
      wi.window_id AS windowId,
      wi.title_guess AS titleGuess,
      wi.media_type AS mediaType,
      wi.role,
      wi.confidence,
      wi.evidence_json AS evidenceJson,
      wi.rationale,
      wi.model_version AS modelVersion,
      wi.prompt_version AS promptVersion,
      wi.created_at AS createdAt,
      w.start AS windowStart,
      w.end AS windowEnd
    FROM v2_work_inferences wi
    INNER JOIN v2_inference_windows w ON w.id = wi.window_id
    WHERE ${filters.join(' AND ')}
    ORDER BY w.start ASC, wi.confidence DESC, wi.title_guess ASC
    `,
    params,
  ).map((row) => ({
    ...row,
    evidence: JSON.parse(row.evidenceJson) as string[],
  }))
}
