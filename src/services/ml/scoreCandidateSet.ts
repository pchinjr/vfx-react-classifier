import type { DiscussionSpan } from '../../domain/discussionSpan.ts'
import type { LogisticRerankerModel } from '../../domain/mlModel.ts'
import type { MovieCatalogRecord } from '../../domain/movieCatalog.ts'
import type { SpanMovieCandidate } from '../../domain/spanResolution.ts'
import {
  buildCandidateFeatureVector,
  movieMetadataFromJson,
  normalizeFeatureText,
} from './buildCandidateFeatures.ts'
import { scoreWithLogisticReranker } from './trainReranker.ts'

type CandidateEvidenceJson = Record<string, unknown>

function evidenceFromJson(evidenceJson: string): CandidateEvidenceJson {
  try {
    return JSON.parse(evidenceJson) as CandidateEvidenceJson
  } catch {
    return {}
  }
}

function countSameTitles(movies: MovieCatalogRecord[]) {
  const counts = new Map<string, number>()
  for (const movie of movies) {
    const normalizedTitle = normalizeFeatureText(movie.title)
    counts.set(normalizedTitle, (counts.get(normalizedTitle) ?? 0) + 1)
  }
  return counts
}

export function scoreCandidateSetWithModel(
  span: DiscussionSpan,
  candidates: SpanMovieCandidate[],
  movies: MovieCatalogRecord[],
  model: LogisticRerankerModel,
) {
  if (!candidates.length) {
    return []
  }

  const moviesById = new Map(movies.map((movie) => [movie.id, movie]))
  const sameTitleCounts = countSameTitles(movies)

  const scored = candidates.map((candidate) => {
    const movie = moviesById.get(candidate.movieId)
    if (!movie) {
      throw new Error(`Missing movie record for candidate ${candidate.movieId}`)
    }

    const metadata = movieMetadataFromJson(movie.metadataJson)
    const features = buildCandidateFeatureVector({
      spanId: span.id,
      movieId: movie.id,
      spanText: span.text,
      movieTitle: movie.title,
      movieOriginalTitle: movie.originalTitle,
      movieOverview: movie.overview,
      releaseYear: movie.releaseYear,
      popularity: metadata.popularity,
      voteCount: metadata.voteCount,
      rank: candidate.rank,
      confidence: candidate.confidence,
      evidenceJson: candidate.evidenceJson,
      candidateCount: candidates.length,
      sameNormalizedTitleCount:
        sameTitleCounts.get(normalizeFeatureText(movie.title)) ?? 1,
    })

    return {
      candidate,
      modelScore: scoreWithLogisticReranker(model, features),
      features,
    }
  })

  return scored
    .sort((left, right) =>
      right.modelScore - left.modelScore ||
      left.candidate.rank - right.candidate.rank
    )
    .map((item, index) => {
      const evidence = evidenceFromJson(item.candidate.evidenceJson)
      return {
        ...item.candidate,
        rank: index + 1,
        confidence: Number(item.modelScore.toFixed(4)),
        evidenceJson: JSON.stringify({
          ...evidence,
          heuristicRank: item.candidate.rank,
          heuristicConfidence: item.candidate.confidence,
          model: {
            id: model.id,
            name: model.name,
            version: model.version,
            modelType: model.modelType,
            score: Number(item.modelScore.toFixed(6)),
            featureSchemaVersion: item.features.schemaVersion,
          },
        }),
      }
    })
}
