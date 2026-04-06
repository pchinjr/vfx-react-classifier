import { loadSync } from '@std/dotenv'

// AppEnv centralizes every runtime knob so CLI commands and services resolve
// configuration from one place instead of reaching into process env directly.
export type AppEnv = {
  openAiApiKey: string
  openAiEmbeddingModel: string
  openAiInferenceModel: string
  databaseUrl: string
  ytDlpBinary: string
  ytDlpTimeoutMs: number
  openAiTimeoutMs: number
  tmdbApiKey: string
  ingestTimeoutMs: number
  maxTranscriptCues: number
  maxSegmentsPerEpisode: number
}

let cachedEnv: AppEnv | null = null

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  loadSync({ export: true, envPath: '.env' })

  // These values are intentionally parsed once and cached to keep configuration
  // deterministic for the life of the process.
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim() ?? ''
  const openAiEmbeddingModel = Deno.env.get('OPENAI_EMBEDDING_MODEL')?.trim() ||
    'text-embedding-3-small'
  const openAiInferenceModel = Deno.env.get('OPENAI_INFERENCE_MODEL')?.trim() ||
    'gpt-5-mini'
  const databaseUrl = Deno.env.get('DATABASE_URL')?.trim() ||
    './data/vfx-react-engine.sqlite'
  const ytDlpBinary = Deno.env.get('YTDLP_BINARY')?.trim() || 'yt-dlp'
  const ytDlpTimeoutMs = Number(Deno.env.get('YTDLP_TIMEOUT_MS') ?? '30000')
  const openAiTimeoutMs = Number(Deno.env.get('OPENAI_TIMEOUT_MS') ?? '30000')
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY')?.trim() ?? ''
  const ingestTimeoutMs = Number(Deno.env.get('INGEST_TIMEOUT_MS') ?? '120000')
  const maxTranscriptCues = Number(
    Deno.env.get('MAX_TRANSCRIPT_CUES') ?? '20000',
  )
  const maxSegmentsPerEpisode = Number(
    Deno.env.get('MAX_SEGMENTS_PER_EPISODE') ?? '10000',
  )

  cachedEnv = {
    openAiApiKey,
    openAiEmbeddingModel,
    openAiInferenceModel,
    databaseUrl,
    ytDlpBinary,
    ytDlpTimeoutMs,
    openAiTimeoutMs,
    tmdbApiKey,
    ingestTimeoutMs,
    maxTranscriptCues,
    maxSegmentsPerEpisode,
  }

  return cachedEnv
}

export function requireEnv<K extends keyof AppEnv>(key: K): AppEnv[K] {
  const env = getEnv()
  const value = env[key]

  if (!value) {
    throw new Error(`Missing required environment value: ${key}`)
  }

  return value
}
