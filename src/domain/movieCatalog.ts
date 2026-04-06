export type MovieCatalogSource = 'tmdb'

export type MovieCatalogRecord = {
  id: string
  source: MovieCatalogSource
  sourceMovieId: string
  title: string
  originalTitle?: string
  releaseDate?: string
  releaseYear?: number
  overview?: string
  metadataJson?: string
  createdAt: string
  updatedAt: string
}
