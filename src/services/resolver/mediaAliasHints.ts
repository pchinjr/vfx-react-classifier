export type MediaAliasHint = {
  normalizedPhrase: string
  lookupQueries: string[]
  mediaTypeHint?: 'movie' | 'tv' | 'franchise' | 'character'
  confidenceBoost?: number
  enabled: boolean
}

export const MEDIA_ALIAS_HINTS: MediaAliasHint[] = [
  {
    normalizedPhrase: 'game of thrones',
    lookupQueries: ['Game of Thrones'],
    mediaTypeHint: 'tv',
    confidenceBoost: 0.1,
    enabled: true,
  },
  {
    normalizedPhrase: 'dragon heart',
    lookupQueries: ['Dragonheart'],
    mediaTypeHint: 'movie',
    confidenceBoost: 0.12,
    enabled: true,
  },
  {
    normalizedPhrase: 'sonic',
    lookupQueries: ['Sonic the Hedgehog'],
    mediaTypeHint: 'movie',
    confidenceBoost: 0.1,
    enabled: true,
  },
  {
    normalizedPhrase: 'davey jones',
    lookupQueries: [
      'Davy Jones Pirates of the Caribbean',
      'Pirates of the Caribbean',
    ],
    mediaTypeHint: 'character',
    confidenceBoost: 0.08,
    enabled: true,
  },
  {
    normalizedPhrase: 'pirates of the caribbean',
    lookupQueries: ['Pirates of the Caribbean'],
    mediaTypeHint: 'franchise',
    confidenceBoost: 0.1,
    enabled: true,
  },
]
