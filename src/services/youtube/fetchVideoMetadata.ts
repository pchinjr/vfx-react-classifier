import { getEnv } from '../../config/env.ts'
import type { Episode } from '../../domain/episode.ts'
import { nowIso } from '../../lib/time.ts'
import { makeId } from '../../lib/ids.ts'
import { runYtDlp } from './runYtDlp.ts'

type YtDlpMetadata = {
  id?: string
  title?: string
  description?: string
  channel?: string
  channel_id?: string
  upload_date?: string
  duration?: number
  webpage_url?: string
}

// URL parsing is intentionally narrow to the common YouTube forms used by the
// CLI. Failed parsing is treated as invalid user input upstream.
export function parseYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return parsed.pathname.slice(1)
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v') ?? ''
      }

      const parts = parsed.pathname.split('/').filter(Boolean)
      const embedIndex = parts.findIndex((part) =>
        part === 'embed' || part === 'shorts'
      )
      if (embedIndex >= 0) {
        return parts[embedIndex + 1] ?? ''
      }
    }
  } catch {
    return ''
  }

  return ''
}

function normalizeUploadDate(input?: string) {
  if (!input || input.length !== 8) {
    return undefined
  }

  return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`
}

// Metadata fetch is a separate step from caption fetch so partial ingests can
// still keep a useful catalog row even if subtitles are unavailable.
export async function fetchVideoMetadata(url: string): Promise<Episode> {
  const youtubeVideoId = parseYouTubeVideoId(url)
  if (!youtubeVideoId) {
    throw new Error(`Unable to parse YouTube video ID from URL: ${url}`)
  }

  const { ytDlpBinary } = getEnv()
  const { stdout } = await runYtDlp(ytDlpBinary, [
    '--dump-single-json',
    '--no-warnings',
    url,
  ])
  const metadata = JSON.parse(stdout) as YtDlpMetadata

  return {
    id: makeId('ep', youtubeVideoId),
    youtubeVideoId,
    title: metadata.title?.trim() || youtubeVideoId,
    description: metadata.description?.trim() || undefined,
    channelTitle: metadata.channel?.trim() || metadata.channel_id?.trim() ||
      undefined,
    publishedAt: normalizeUploadDate(metadata.upload_date),
    durationSeconds: metadata.duration,
    sourceUrl: metadata.webpage_url?.trim() || url,
    createdAt: nowIso(),
  }
}
