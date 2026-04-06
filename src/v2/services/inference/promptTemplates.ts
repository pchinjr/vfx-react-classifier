export const V2_WORK_INFERENCE_PROMPT_VERSION = 'v2-work-inference-prompt-v1'

export function buildWorkInferenceSystemPrompt() {
  return [
    'You infer movie and TV works discussed in transcript excerpts.',
    'Return structured JSON only.',
    'Identify works only when the transcript gives concrete evidence.',
    'Prefer no works over weak or hallucinated guesses.',
    'Use role=primary for the work being actively discussed.',
    'Use role=secondary for comparisons, examples, or passing references.',
    'Use mediaType=unknown when the excerpt does not support movie vs TV.',
    'Evidence must be short verbatim snippets from the transcript excerpt.',
  ].join(' ')
}

export function buildWorkInferenceUserPrompt(input: {
  episodeTitle?: string
  start: number
  end: number
  text: string
}) {
  return [
    `Episode title: ${input.episodeTitle ?? 'unknown'}`,
    `Window: ${input.start.toFixed(3)}-${input.end.toFixed(3)} seconds`,
    'Transcript excerpt:',
    input.text,
  ].join('\n')
}
