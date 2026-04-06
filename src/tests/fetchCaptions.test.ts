import { assertEquals } from '@std/assert'

import { buildYtDlpCaptionArgs } from '../services/youtube/fetchCaptions.ts'

Deno.test('buildYtDlpCaptionArgs requests only the explicit English subtitle track', () => {
  // Regression coverage for YouTube 429s seen when broad matching selected
  // translated caption tracks instead of the explicit English track.
  const args = buildYtDlpCaptionArgs(
    '/tmp/vfx-react-captions-test',
    'https://www.youtube.com/watch?v=video-id',
  )
  const subLangsIndex = args.indexOf('--sub-langs')
  const subFormatIndex = args.indexOf('--sub-format')

  assertEquals(args[subLangsIndex + 1], 'en')
  assertEquals(args[subFormatIndex + 1], 'json3/vtt/best')
  assertEquals(args.includes('en.*,en'), false)
  assertEquals(args.includes('en.*'), false)
  assertEquals(args.includes('--write-subs'), true)
  assertEquals(args.includes('--write-auto-subs'), true)
})
