import type { DiscussionSpan } from '../../domain/discussionSpan.ts'
import type { MovieCatalogRecord } from '../../domain/movieCatalog.ts'
import type {
  SpanMovieCandidate,
  SpanMovieCandidateEvidence,
} from '../../domain/spanResolution.ts'
import { makeId } from '../../lib/ids.ts'
import { nowIso } from '../../lib/time.ts'
import { buildResolverQueries } from '../resolver/buildResolverQueries.ts'
import { filterResolverQueriesForLookup } from '../resolver/filterResolverQueriesForLookup.ts'
import type { ResolverQuery } from '../resolver/queryTypes.ts'
import { normalizeResolverText } from '../resolver/text.ts'

export const SPAN_MOVIE_RESOLVER_VERSION = 'span-movie-resolver-v3'
const MIN_TITLE_SIMILARITY = 0.6

export type MovieSearchFn = (
  query: string,
) => Promise<MovieCatalogRecord[]> | MovieCatalogRecord[]

export type WorkSearchFn = (
  query: ResolverQuery,
) => Promise<MovieCatalogRecord[]> | MovieCatalogRecord[]

export type ResolveSpanMoviesOptions = {
  searchMovies?: MovieSearchFn
  searchWorks?: WorkSearchFn
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

function normalize(value: string) {
  return normalizeResolverText(value)
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(/\s+/).filter(Boolean))
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
  query: ResolverQuery,
  movie: MovieCatalogRecord,
  resolverVersion: string,
): ScoredCandidate {
  const titleScore = titleSimilarity(query.query, movie)
  const overviewScore = movie.overview
    ? overlapScore(span.text, movie.overview)
    : 0
  const releaseYearMentioned = mentionedReleaseYear(span.text, movie)
  const releaseYearBoost = releaseYearMentioned ? 0.15 : 0
  const fallbackBoost = query.source === 'fallback_alias'
    ? query.confidenceHint ?? 0
    : 0
  const confidence = Math.min(
    1,
    Number(
      (
        titleScore * 0.7 + overviewScore * 0.15 + releaseYearBoost +
        fallbackBoost * 0.05
      ).toFixed(4),
    ),
  )

  return {
    movie,
    confidence,
    evidence: {
      searchQuery: query.query,
      matchedTitle: movie.title,
      titleSimilarity: Number(titleScore.toFixed(4)),
      overviewOverlap: Number(overviewScore.toFixed(4)),
      releaseYearMentioned,
      resolverVersion,
      querySource: query.source,
      normalizedPhrase: query.normalizedPhrase,
      lookupQuery: query.query,
      filterPassed: true,
      mediaType: movie.mediaType,
      mediaTypeHint: query.mediaTypeHint,
      queryHygieneScore: query.hygieneScore,
      queryHygieneReason: query.hygieneReason,
    },
  }
}

export function extractMovieSearchQueries(text: string, maxQueries = 3) {
  return buildResolverQueries(text, { maxQueries }).map((query) => query.query)
}

export function isResolvableSpan(span: DiscussionSpan, minTextLength = 80) {
  return span.text.length >= minTextLength &&
    buildResolverQueries(span.text, { maxQueries: 1 }).length > 0
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
  const queries = filterResolverQueriesForLookup(
    buildResolverQueries(span.text, {
      maxQueries: options.maxQueries ?? 3,
    }),
  )

  for (const query of queries) {
    const movies = await searchForQuery(options, query)
    for (const movie of movies) {
      const scored = confidenceFor(span, query, movie, resolverVersion)
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

async function searchForQuery(
  options: ResolveSpanMoviesOptions,
  query: ResolverQuery,
) {
  if (options.searchWorks) {
    return await options.searchWorks(query)
  }

  if (options.searchMovies) {
    return await options.searchMovies(query.query)
  }

  throw new Error(
    'resolveSpanMovieCandidates requires searchWorks or searchMovies',
  )
}
