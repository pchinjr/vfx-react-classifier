import type {
  CandidateFeatureValues,
  CandidateFeatureVector,
} from '../../domain/candidateFeatureVector.ts'
import { CANDIDATE_FEATURE_SCHEMA_VERSION } from '../../domain/candidateFeatureVector.ts'
import type { DatabaseClient } from '../storage/db.ts'

export type CandidateFeatureInput = {
  spanId: string
  movieId: string
  spanText: string
  movieTitle: string
  movieOriginalTitle?: string
  movieOverview?: string
  releaseYear?: number
  popularity?: number
  voteCount?: number
  rank: number
  confidence: number
  evidenceJson: string
  candidateCount?: number
  sameNormalizedTitleCount?: number
}

type CandidateFeatureDbRow = CandidateFeatureInput & {
  normalizedTitle: string
  metadataJson?: string
  candidateCount: number
  sameNormalizedTitleCount: number
}

type CandidateEvidence = {
  titleSimilarity?: number
  overviewOverlap?: number
  releaseYearMentioned?: number
}

type TmdbMetadata = {
  popularity?: number
  vote_count?: number
}

export const CANDIDATE_FEATURE_ORDER: Array<keyof CandidateFeatureValues> = [
  'heuristicRank',
  'heuristicConfidence',
  'queryTitleSimilarity',
  'queryOverviewOverlap',
  'exactTitleInSpan',
  'titleMentionCount',
  'titleTokenOverlap',
  'overviewTokenOverlap',
  'releaseYearMentioned',
  'comparativeContext',
  'popularity',
  'logVoteCount',
  'candidateCount',
  'sameNormalizedTitleCount',
]

const COMPARATIVE_TERMS = [
  'a year after',
  'before',
  'compared',
  'comparison',
  'later',
  'new one',
  'old one',
  'original',
  'remake',
]

export function normalizeFeatureText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenSet(value: string) {
  return new Set(normalizeFeatureText(value).split(/\s+/).filter(Boolean))
}

function overlapScore(left: string, right: string) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) {
    return 0
  }

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

function phraseMentionCount(haystack: string, needle: string) {
  const normalizedHaystack = ` ${normalizeFeatureText(haystack)} `
  const normalizedNeedle = normalizeFeatureText(needle)
  if (!normalizedNeedle) {
    return 0
  }

  return normalizedHaystack.split(` ${normalizedNeedle} `).length - 1
}

function evidenceFromJson(evidenceJson: string): CandidateEvidence {
  try {
    return JSON.parse(evidenceJson) as CandidateEvidence
  } catch {
    return {}
  }
}

export function movieMetadataFromJson(metadataJson?: string) {
  if (!metadataJson) {
    return {}
  }

  try {
    const parsed = JSON.parse(metadataJson) as TmdbMetadata
    return {
      popularity: typeof parsed.popularity === 'number'
        ? parsed.popularity
        : undefined,
      voteCount: typeof parsed.vote_count === 'number'
        ? parsed.vote_count
        : undefined,
    }
  } catch {
    return {}
  }
}

function hasComparativeContext(spanText: string) {
  const normalizedSpan = normalizeFeatureText(spanText)
  return COMPARATIVE_TERMS.some((term) => normalizedSpan.includes(term)) ? 1 : 0
}

export function buildCandidateFeatureVector(
  input: CandidateFeatureInput,
): CandidateFeatureVector {
  const evidence = evidenceFromJson(input.evidenceJson)
  const titleMentionCount = Math.max(
    phraseMentionCount(input.spanText, input.movieTitle),
    input.movieOriginalTitle
      ? phraseMentionCount(input.spanText, input.movieOriginalTitle)
      : 0,
  )
  const releaseYearMentioned = input.releaseYear &&
      input.spanText.includes(String(input.releaseYear))
    ? 1
    : evidence.releaseYearMentioned
    ? 1
    : 0

  return {
    schemaVersion: CANDIDATE_FEATURE_SCHEMA_VERSION,
    featureOrder: CANDIDATE_FEATURE_ORDER,
    values: {
      heuristicRank: input.rank,
      heuristicConfidence: input.confidence,
      queryTitleSimilarity: evidence.titleSimilarity ?? 0,
      queryOverviewOverlap: evidence.overviewOverlap ?? 0,
      exactTitleInSpan: titleMentionCount > 0 ? 1 : 0,
      titleMentionCount,
      titleTokenOverlap: overlapScore(input.spanText, input.movieTitle),
      overviewTokenOverlap: input.movieOverview
        ? overlapScore(input.spanText, input.movieOverview)
        : 0,
      releaseYearMentioned,
      comparativeContext: hasComparativeContext(input.spanText),
      popularity: input.popularity ?? 0,
      logVoteCount: Math.log1p(input.voteCount ?? 0),
      candidateCount: input.candidateCount ?? 1,
      sameNormalizedTitleCount: input.sameNormalizedTitleCount ?? 1,
    },
  }
}

export function buildCandidateFeatureVectorsForSpan(
  db: DatabaseClient,
  spanId: string,
) {
  const rows = db.queryEntries<CandidateFeatureDbRow>(
    `
    WITH candidate_context AS (
      SELECT
        smc.id,
        smc.span_id,
        LOWER(mc.title) AS normalized_title,
        COUNT(*) OVER (PARTITION BY smc.span_id) AS candidate_count,
        COUNT(*) OVER (PARTITION BY smc.span_id, LOWER(mc.title))
          AS same_normalized_title_count
      FROM span_movie_candidates smc
      INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
      WHERE smc.span_id = ?
    )
    SELECT
      ds.id AS spanId,
      smc.movie_id AS movieId,
      ds.text AS spanText,
      mc.title AS movieTitle,
      mc.original_title AS movieOriginalTitle,
      mc.overview AS movieOverview,
      mc.release_year AS releaseYear,
      mc.metadata_json AS metadataJson,
      smc.rank,
      smc.confidence,
      smc.evidence_json AS evidenceJson,
      candidate_context.normalized_title AS normalizedTitle,
      candidate_context.candidate_count AS candidateCount,
      candidate_context.same_normalized_title_count AS sameNormalizedTitleCount
    FROM span_movie_candidates smc
    INNER JOIN discussion_spans ds ON ds.id = smc.span_id
    INNER JOIN movie_catalog mc ON mc.id = smc.movie_id
    INNER JOIN candidate_context ON candidate_context.id = smc.id
    WHERE smc.span_id = ?
    ORDER BY smc.rank ASC, smc.confidence DESC
    `,
    [spanId, spanId],
  )

  return rows.map((row) => {
    const metadata = movieMetadataFromJson(row.metadataJson)
    return {
      spanId: row.spanId,
      movieId: row.movieId,
      movieTitle: row.movieTitle,
      rank: row.rank,
      features: buildCandidateFeatureVector({
        ...row,
        popularity: metadata.popularity,
        voteCount: metadata.voteCount,
      }),
    }
  })
}
