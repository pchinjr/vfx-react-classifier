import { formatTimestamp } from '../lib/time.ts'
import { initializeDatabase, openDatabase } from '../services/storage/db.ts'
import { getDiscussionSpansForEpisode } from '../services/storage/discussionSpansRepo.ts'
import { handleCliError, parseStringFlag } from './shared.ts'

const args = [...Deno.args]
const episodeId = parseStringFlag(args, '--episode')
const db = openDatabase()

try {
  initializeDatabase(db)

  if (!episodeId) {
    throw new Error('Usage: deno task spans:list --episode <episode-id>')
  }

  const spans = getDiscussionSpansForEpisode(db, episodeId)
  if (!spans.length) {
    console.log('No discussion spans found.')
  }

  for (const span of spans) {
    console.log(
      `${span.id} | ${formatTimestamp(span.start)}-${
        formatTimestamp(span.end)
      } | segments=${span.sourceSegmentCount}`,
    )
    console.log(span.text)
    console.log('')
  }
} catch (error) {
  handleCliError(error)
} finally {
  db.close()
}
