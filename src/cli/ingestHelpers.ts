import type { Episode } from '../domain/episode.ts'
import { EmptyTranscriptError } from '../lib/errors.ts'
import { logger } from '../lib/logger.ts'
import { getEnv } from '../config/env.ts'
import { batchEmbedSegments } from '../services/embeddings/batchEmbedSegments.ts'
import {
  replaceTranscriptCuesForEpisode,
  upsertEpisode,
} from '../services/storage/episodesRepo.ts'
import {
  getSegmentsMissingEmbeddings,
  replaceSegmentsForEpisode,
} from '../services/storage/segmentsRepo.ts'
import type { DatabaseClient } from '../services/storage/db.ts'
import { normalizeTranscript } from '../services/transcript/normalizeTranscript.ts'
import { segmentTranscript } from '../services/transcript/segmentTranscript.ts'
import { fetchCaptions } from '../services/youtube/fetchCaptions.ts'
import { fetchVideoMetadata } from '../services/youtube/fetchVideoMetadata.ts'

export type IngestEpisodeSummary = {
  episode: Episode
  cueCount: number
  segmentCount: number
  embeddedCount: number
}

export async function ingestEpisodeUrl(
  db: DatabaseClient,
  url: string,
): Promise<IngestEpisodeSummary> {
  logger.info('ingest.start', { url })
  const episode = await fetchVideoMetadata(url)
  upsertEpisode(db, episode)

  const rawCues = await fetchCaptions(url)
  const cues = normalizeTranscript(rawCues)
  if (!cues.length) {
    throw new EmptyTranscriptError()
  }

  replaceTranscriptCuesForEpisode(db, episode.id, cues)
  const segments = segmentTranscript(cues, { episodeId: episode.id })
  replaceSegmentsForEpisode(db, episode.id, segments)

  const missingEmbeddings = getSegmentsMissingEmbeddings(
    db,
    getEnv().openAiEmbeddingModel,
    episode.id,
  )
  await batchEmbedSegments(missingEmbeddings, { db })

  logger.info('ingest.complete', {
    url,
    episodeId: episode.id,
    cueCount: cues.length,
    segmentCount: segments.length,
    embeddedCount: missingEmbeddings.length,
  })

  return {
    episode,
    cueCount: cues.length,
    segmentCount: segments.length,
    embeddedCount: missingEmbeddings.length,
  }
}

export function printIngestSummary(summary: IngestEpisodeSummary) {
  console.log(`Ingested: ${summary.episode.title}`)
  console.log(`Video ID: ${summary.episode.youtubeVideoId}`)
  console.log(`Cues: ${summary.cueCount}`)
  console.log(`Segments: ${summary.segmentCount}`)
  console.log(`Embeddings: ${summary.embeddedCount}`)
}

export async function ingestMany(
  db: DatabaseClient,
  urls: string[],
) {
  const summaries: IngestEpisodeSummary[] = []

  for (const url of urls) {
    const summary = await ingestEpisodeUrl(db, url)
    summaries.push(summary)
  }

  return summaries
}

export function parseBatchFile(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}
