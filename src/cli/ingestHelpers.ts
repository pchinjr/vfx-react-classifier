import type { Episode } from '../domain/episode.ts'
import { EmptyTranscriptError } from '../lib/errors.ts'
import { withTimeout } from '../lib/async.ts'
import { logger } from '../lib/logger.ts'
import { getEnv } from '../config/env.ts'
import { batchEmbedSegments } from '../services/embeddings/batchEmbedSegments.ts'
import {
  getEpisodeByYouTubeVideoId,
  replaceTranscriptCuesForEpisode,
  upsertEpisode,
} from '../services/storage/episodesRepo.ts'
import {
  getSegmentsMissingEmbeddings,
  replaceSegmentsForEpisode,
} from '../services/storage/segmentsRepo.ts'
import type { DatabaseClient } from '../services/storage/db.ts'
import type { TranscriptCue } from '../domain/transcript.ts'
import { loadTranscriptFile } from '../services/transcript/loadTranscriptFile.ts'
import { normalizeTranscript } from '../services/transcript/normalizeTranscript.ts'
import { segmentTranscript } from '../services/transcript/segmentTranscript.ts'
import { fetchCaptions } from '../services/youtube/fetchCaptions.ts'
import {
  fetchVideoMetadata,
  parseYouTubeVideoId,
} from '../services/youtube/fetchVideoMetadata.ts'

export type IngestEpisodeSummary = {
  episode: Episode
  cueCount: number
  segmentCount: number
  embeddedCount: number
}

async function persistTranscriptPipeline(
  db: DatabaseClient,
  episode: Episode,
  rawCues: TranscriptCue[],
) {
  const env = getEnv()
  const cues = normalizeTranscript(rawCues)
  if (!cues.length) {
    throw new EmptyTranscriptError()
  }

  const segments = segmentTranscript(cues, {
    episodeId: episode.id,
    maxSegments: env.maxSegmentsPerEpisode,
  })
  replaceTranscriptCuesForEpisode(db, episode.id, cues)
  replaceSegmentsForEpisode(db, episode.id, segments)

  const missingEmbeddings = getSegmentsMissingEmbeddings(
    db,
    env.openAiEmbeddingModel,
    episode.id,
  )
  await batchEmbedSegments(missingEmbeddings, { db })

  return {
    episode,
    cueCount: cues.length,
    segmentCount: segments.length,
    embeddedCount: missingEmbeddings.length,
  }
}

// ingestEpisodeUrl coordinates the full v1 pipeline for one video. It is wrapped
// in a global timeout because it combines subprocess, network, DB, and API work.
export async function ingestEpisodeUrl(
  db: DatabaseClient,
  url: string,
): Promise<IngestEpisodeSummary> {
  const env = getEnv()

  return await withTimeout(
    (async () => {
      logger.info('ingest.start', { url })
      // Order matters here: metadata first, then transcript-derived state, then
      // embeddings. A later failure can be resumed with reembed.
      const episode = await fetchVideoMetadata(url)
      upsertEpisode(db, episode)
      const summary = await persistTranscriptPipeline(
        db,
        episode,
        await fetchCaptions(url),
      )

      logger.info('ingest.complete', {
        url,
        episodeId: episode.id,
        cueCount: summary.cueCount,
        segmentCount: summary.segmentCount,
        embeddedCount: summary.embeddedCount,
      })

      return summary
    })(),
    env.ingestTimeoutMs,
    `Ingest timed out after ${env.ingestTimeoutMs}ms`,
  )
}

// Manual transcript ingest bypasses YouTube subtitle download while still using
// the standard normalization, segmentation, persistence, and embedding flow.
export async function ingestEpisodeFromTranscriptFile(
  db: DatabaseClient,
  url: string,
  transcriptPath: string,
): Promise<IngestEpisodeSummary> {
  const env = getEnv()

  return await withTimeout(
    (async () => {
      logger.info('ingest.manual_transcript.start', { url, transcriptPath })
      const videoId = parseYouTubeVideoId(url)
      if (!videoId) {
        throw new Error(`Unable to parse YouTube video ID from URL: ${url}`)
      }

      const existingEpisode = getEpisodeByYouTubeVideoId(db, videoId)
      const episode = existingEpisode ?? await fetchVideoMetadata(url)
      upsertEpisode(db, episode)

      const summary = await persistTranscriptPipeline(
        db,
        episode,
        await loadTranscriptFile(transcriptPath),
      )

      logger.info('ingest.manual_transcript.complete', {
        url,
        transcriptPath,
        episodeId: episode.id,
        cueCount: summary.cueCount,
        segmentCount: summary.segmentCount,
        embeddedCount: summary.embeddedCount,
      })

      return summary
    })(),
    env.ingestTimeoutMs,
    `Manual transcript ingest timed out after ${env.ingestTimeoutMs}ms`,
  )
}

export function printIngestSummary(summary: IngestEpisodeSummary) {
  console.log(`Ingested: ${summary.episode.title}`)
  console.log(`Video ID: ${summary.episode.youtubeVideoId}`)
  console.log(`Cues: ${summary.cueCount}`)
  console.log(`Segments: ${summary.segmentCount}`)
  console.log(`Embeddings: ${summary.embeddedCount}`)
}

// Batch ingest is deliberately sequential to reduce API pressure and make rate
// limit behavior easier to reason about.
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
