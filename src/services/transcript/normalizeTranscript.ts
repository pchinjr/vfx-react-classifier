import type { TranscriptCue } from '../../domain/transcript.ts'

function normalizeCueText(text: string) {
  return text
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeTranscript(cues: TranscriptCue[]): TranscriptCue[] {
  const normalized: TranscriptCue[] = []

  for (const cue of cues) {
    const text = normalizeCueText(cue.text)
    if (!text) {
      continue
    }

    const lastCue = normalized[normalized.length - 1]
    if (lastCue && lastCue.text === text) {
      lastCue.end = Math.max(lastCue.end, cue.end)
      continue
    }

    normalized.push({
      start: cue.start,
      end: cue.end,
      text,
    })
  }

  return normalized
}
