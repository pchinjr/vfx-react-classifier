import { loadSync } from '@std/dotenv'

export type AppEnv = {
  openAiApiKey: string
  openAiEmbeddingModel: string
  databaseUrl: string
  ytDlpBinary: string
}

let cachedEnv: AppEnv | null = null

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  loadSync({ export: true, envPath: '.env', examplePath: null })

  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim() ?? ''
  const openAiEmbeddingModel = Deno.env.get('OPENAI_EMBEDDING_MODEL')?.trim() ||
    'text-embedding-3-small'
  const databaseUrl = Deno.env.get('DATABASE_URL')?.trim() ||
    './data/vfx-react-engine.sqlite'
  const ytDlpBinary = Deno.env.get('YTDLP_BINARY')?.trim() || 'yt-dlp'

  cachedEnv = {
    openAiApiKey,
    openAiEmbeddingModel,
    databaseUrl,
    ytDlpBinary,
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
