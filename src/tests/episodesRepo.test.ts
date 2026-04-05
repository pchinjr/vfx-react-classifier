import { assertEquals } from '@std/assert'

import { nowIso } from '../lib/time.ts'
import { createTestDatabase } from '../services/storage/testDb.ts'
import {
  getEpisodeByYouTubeVideoId,
  upsertEpisode,
} from '../services/storage/episodesRepo.ts'

Deno.test('upsertEpisode updates an existing episode instead of duplicating it', () => {
  const { db } = createTestDatabase('episodes-repo')

  try {
    const createdAt = nowIso()
    upsertEpisode(db, {
      id: 'ep_one',
      youtubeVideoId: 'abc123',
      title: 'Original Title',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt,
    })

    upsertEpisode(db, {
      id: 'ep_two',
      youtubeVideoId: 'abc123',
      title: 'Updated Title',
      sourceUrl: 'https://youtube.com/watch?v=abc123',
      createdAt,
    })

    const episode = getEpisodeByYouTubeVideoId(db, 'abc123')
    assertEquals(episode?.title, 'Updated Title')
    assertEquals(
      db.queryEntries<{ count: number }>(
        'SELECT COUNT(*) AS count FROM episodes WHERE youtube_video_id = ?',
        ['abc123'],
      )[0]?.count,
      1,
    )
  } finally {
    db.close()
  }
})
