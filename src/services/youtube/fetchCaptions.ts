import { basename, join } from '@std/path'

import { getEnv } from '../../config/env.ts'
import type { TranscriptCue } from '../../domain/transcript.ts'
import { MissingCaptionsError, ValidationError } from '../../lib/errors.ts'
import { parseYouTubeVideoId } from './fetchVideoMetadata.ts'
import { runYtDlp } from './runYtDlp.ts'

function parseVttTimestamp(value: string) {
  const cleaned = value.trim().replace(',', '.')
  const parts = cleaned.split(':').map(Number)

  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid VTT timestamp: ${value}`)
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }

  throw new Error(`Unsupported VTT timestamp: ${value}`)
}

// The captions parser strips simple markup because retrieval quality is better
// when the transcript text resembles spoken language instead of subtitle tags.
function stripVttMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseVtt(content: string): TranscriptCue[] {
  const lines = content.replace(/\r/g, '').split('\n')
  const cues: TranscriptCue[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? ''
    if (!line || line === 'WEBVTT') {
      index += 1
      continue
    }

    const timeLine = line.includes('-->')
      ? line
      : lines[index + 1]?.trim() ?? ''
    if (!timeLine.includes('-->')) {
      index += 1
      continue
    }

    const [startRaw, endRawWithSettings] = timeLine.split('-->')
    const endRaw = endRawWithSettings.split(' ')[1]
      ? endRawWithSettings.trim().split(' ')[0]
      : endRawWithSettings.trim()
    index += line.includes('-->') ? 1 : 2

    const textLines: string[] = []
    while (index < lines.length && lines[index].trim()) {
      textLines.push(lines[index])
      index += 1
    }

    const text = stripVttMarkup(textLines.join(' '))
    if (text) {
      cues.push({
        start: parseVttTimestamp(startRaw),
        end: parseVttTimestamp(endRaw),
        text,
      })
    }
  }

  return cues
}

type Json3Event = {
  tStartMs?: number
  dDurationMs?: number
  segs?: Array<{ utf8?: string }>
}

type Json3Transcript = {
  events?: Json3Event[]
}

export function parseJson3(content: string): TranscriptCue[] {
  const data = JSON.parse(content) as Json3Transcript

  return (data.events ?? [])
    .map((event) => {
      const text = (event.segs ?? [])
        .map((segment) => segment.utf8 ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        start: (event.tStartMs ?? 0) / 1000,
        end: ((event.tStartMs ?? 0) + (event.dDurationMs ?? 0)) / 1000,
        text,
      }
    })
    .filter((cue) => cue.text)
}

async function findSubtitleFile(tempDir: string, videoId: string) {
  const candidates: string[] = []

  for await (const entry of Deno.readDir(tempDir)) {
    if (!entry.isFile) {
      continue
    }

    if (
      entry.name.startsWith(videoId) &&
      (entry.name.endsWith('.vtt') || entry.name.endsWith('.json3'))
    ) {
      candidates.push(join(tempDir, entry.name))
    }
  }

  return candidates.sort((left, right) => left.localeCompare(right))[0]
}

// Caption fetch prefers YouTube subtitles because they are cheap and aligned.
// A hard cue cap prevents extreme files from being accepted silently.
export async function fetchCaptions(
  urlOrVideoId: string,
): Promise<TranscriptCue[]> {
  const { ytDlpBinary, maxTranscriptCues } = getEnv()
  const tempDir = await Deno.makeTempDir({ prefix: 'vfx-react-captions-' })
  const videoId = parseYouTubeVideoId(urlOrVideoId) || urlOrVideoId

  try {
    await runYtDlp(ytDlpBinary, [
      '--skip-download',
      '--no-warnings',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      'en.*,en',
      '--sub-format',
      'vtt/json3/best',
      '--output',
      join(tempDir, '%(id)s.%(ext)s'),
      urlOrVideoId,
    ])

    const subtitlePath = await findSubtitleFile(tempDir, videoId)
    if (!subtitlePath) {
      throw new MissingCaptionsError()
    }

    const content = await Deno.readTextFile(subtitlePath)
    if (basename(subtitlePath).endsWith('.json3')) {
      const cues = parseJson3(content)
      if (cues.length > maxTranscriptCues) {
        throw new ValidationError(
          `Transcript cue count ${cues.length} exceeded maxTranscriptCues=${maxTranscriptCues}`,
        )
      }
      return cues
    }

    const cues = parseVtt(content)
    if (cues.length > maxTranscriptCues) {
      throw new ValidationError(
        `Transcript cue count ${cues.length} exceeded maxTranscriptCues=${maxTranscriptCues}`,
      )
    }

    return cues
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => undefined)
  }
}
