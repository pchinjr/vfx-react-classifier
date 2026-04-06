import type { DiscussionSpan } from '../../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../../domain/movieCatalog.ts'
import type {
  SpanMovieCandidate,
  SpanMovieCandidateEvidence,
} from '../../domain/spanResolution.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'

export const SPAN_MOVIE_RESOLVER_VERSION = 'span-movie-resolver-v1'
const MIN_TITLE_SIMILARITY = 0.6

export type MovieSearchFn = (
  query: string,
) => Promise<MovieCatalogRecord[]> | MovieCatalogRecord[]

export type ResolveSpanMoviesOptions = {
  searchMovies: MovieSearchFn
  resolverVersion?: string
  now?: string
  maxQueries?: number
  maxCandidates?: number
  minTextLength?: number
}

type ScoredCandidate = {
  movie: MovieCatalogRecord
  confidence: number
  evidence: SpanMovieCandidateEvidence
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'alright',
  'are',
  'boom',
  'but',
  'camera',
  'even',
  'for',
  'from',
  'hey',
  'honestly',
  'i',
  'if',
  'into',
  "it's",
  'its',
  'just',
  'like',
  'maybe',
  'mine',
  'no',
  'oh',
  'so',
  'that',
  "that's",
  'the',
  'there',
  'they',
  'this',
  'wait',
  'watch',
  'we',
  'welcome',
  'what',
  'when',
  'where',
  'with',
  'yeah',
  'yes',
  'you',
])

const NON_MOVIE_PHRASES = new Set([
  'internet alright',
  'oval office',
  'united states',
  'video copilot',
])

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(/\s+/).filter(Boolean))
}

function isStopWord(value: string) {
  return STOP_WORDS.has(
    value.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim(),
  )
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

function titleSimilarity(query: string, movie: MovieCatalogRecord) {
  const titleScore = overlapScore(query, movie.title)
  const originalTitleScore = movie.originalTitle
    ? overlapScore(query, movie.originalTitle)
    : 0
  return Math.max(titleScore, originalTitleScore)
}

function mentionedReleaseYear(spanText: string, movie: MovieCatalogRecord) {
  if (!movie.releaseYear) {
    return undefined
  }

  return spanText.includes(String(movie.releaseYear))
    ? movie.releaseYear
    : undefined
}

function confidenceFor(
  span: DiscussionSpan,
  query: string,
  movie: MovieCatalogRecord,
): ScoredCandidate {
  const titleScore = titleSimilarity(query, movie)
  const overviewScore = movie.overview
    ? overlapScore(span.text, movie.overview)
    : 0
  const releaseYearMentioned = mentionedReleaseYear(span.text, movie)
  const releaseYearBoost = releaseYearMentioned ? 0.15 : 0
  const confidence = Math.min(
    1,
    Number(
      (titleScore * 0.7 + overviewScore * 0.15 + releaseYearBoost).toFixed(4),
    ),
  )

  return {
    movie,
    confidence,
    evidence: {
      searchQuery: query,
      matchedTitle: movie.title,
      titleSimilarity: Number(titleScore.toFixed(4)),
      overviewOverlap: Number(overviewScore.toFixed(4)),
      releaseYearMentioned,
    },
  }
}

export function extractMovieSearchQueries(text: string, maxQueries = 3) {
  const matches = text.matchAll(
    /\b(?:[A-Z][A-Za-z0-9'&:-]*|[0-9]+)(?:\s+(?:[A-Z][A-Za-z0-9'&:-]*|[0-9]+)){0,2}/g,
  )
  const queries: string[] = []

  for (const match of matches) {
    const words = match[0].trim().split(/\s+/)
    while (words.length && isStopWord(words[0])) {
      words.shift()
    }
    while (words.length && isStopWord(words.at(-1) ?? '')) {
      words.pop()
    }

    const query = words.join(' ').trim()
    const normalizedQuery = normalize(query)
    // Single capitalized words in transcripts are often sentence starts or
    // filler ("Welcome", "Even", "Camera"). Requiring two meaningful tokens is
    // a precision-first tradeoff for this MVP; one-word titles can be added as
    // an explicit alias pass later.
    if (
      query.length < 4 ||
      NON_MOVIE_PHRASES.has(normalizedQuery) ||
      words.length < 2 ||
      words.every((word) => isStopWord(word))
    ) {
      continue
    }

    if (!queries.includes(query)) {
      queries.push(query)
    }

    if (queries.length >= maxQueries) {
      break
    }
  }

  return queries
}

export function isResolvableSpan(span: DiscussionSpan, minTextLength = 80) {
  return span.text.length >= minTextLength &&
    extractMovieSearchQueries(span.text, 1).length > 0
}

export async function resolveSpanMovieCandidates(
  span: DiscussionSpan,
  options: ResolveSpanMoviesOptions,
): Promise<{ movies: MovieCatalogRecord[]; candidates: SpanMovieCandidate[] }> {
  const resolverVersion = options.resolverVersion ?? SPAN_MOVIE_RESOLVER_VERSION
  const maxCandidates = options.maxCandidates ?? 5
  const now = options.now ?? nowIso()

  if (!isResolvableSpan(span, options.minTextLength)) {
    return { movies: [], candidates: [] }
  }

  const scoredByMovieId = new Map<string, ScoredCandidate>()
  const queries = extractMovieSearchQueries(span.text, options.maxQueries ?? 3)

  for (const query of queries) {
    const movies = await options.searchMovies(query)
    for (const movie of movies) {
      const scored = confidenceFor(span, query, movie)
      const existing = scoredByMovieId.get(movie.id)
      if (!existing || scored.confidence > existing.confidence) {
        scoredByMovieId.set(movie.id, scored)
      }
    }
  }

  const ranked = [...scoredByMovieId.values()]
    .filter((candidate) =>
      candidate.confidence > 0 &&
      candidate.evidence.titleSimilarity >= MIN_TITLE_SIMILARITY
    )
    .sort((left, right) =>
      right.confidence - left.confidence ||
      left.movie.title.localeCompare(right.movie.title)
    )
    .slice(0, maxCandidates)

  return {
    movies: ranked.map((candidate) => candidate.movie),
    candidates: ranked.map((candidate, index) => ({
      id: makeId(
        'cand',
        span.id,
        candidate.movie.id,
        resolverVersion,
      ),
      spanId: span.id,
      movieId: candidate.movie.id,
      rank: index + 1,
      confidence: candidate.confidence,
      resolverVersion,
      evidenceJson: JSON.stringify(candidate.evidence),
      createdAt: now,
    })),
  }
}
