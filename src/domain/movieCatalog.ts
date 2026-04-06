export type MovieCatalogSource = 'tmdb'
export type CatalogMediaType = 'movie' | 'tv'

export type MovieCatalogRecord = {
  id: string
  source: MovieCatalogSource
  sourceMovieId: string
  mediaType: CatalogMediaType
  title: string
  originalTitle?: string
  releaseDate?: string
  releaseYear?: number
  overview?: string
  metadataJson?: string
  createdAt: string
  updatedAt: string
}
