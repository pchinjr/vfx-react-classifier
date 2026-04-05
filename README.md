# VFX React Classifier Engine

Transcript-first semantic retrieval for Corridor Crew "VFX Artists React"
episodes.

## Scope

This v1 builds the retrieval foundation:

- ingest one or more YouTube episode URLs
- fetch metadata and captions
- normalize transcripts
- segment transcripts into overlapping windows
- generate embeddings for segments
- persist episodes, cues, segments, and embeddings
- run semantic search from a CLI query

Non-goals for v1 include OCR, multimodal embeddings, movie metadata enrichment,
and classifier training.

## Requirements

- Deno 2.x
- `yt-dlp` available on `PATH`
- OpenAI API key for embeddings

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `OPENAI_API_KEY`.
3. Initialize the database:

```bash
deno task db:init
```

## Commands

```bash
deno task ingest "https://www.youtube.com/watch?v=VIDEO_ID"
deno task ingest:batch ./urls.txt
deno task query "Jurassic Park T-Rex"
deno task reembed
deno task test
deno task lint
```

## Storage

The default database is SQLite at `./data/vfx-react-engine.sqlite`.

Tables:

- `episodes`
- `transcript_cues`
- `segments`
- `segment_embeddings`

Embeddings are stored as JSON for v1 simplicity. The repository layer keeps the
storage boundary explicit so a vector database or Postgres can be added later.

## Architecture

```text
src/
  config/
  domain/
  services/
    youtube/
    transcript/
    embeddings/
    storage/
    search/
  cli/
  lib/
  tests/
scripts/
```

## Notes

- Caption availability varies by video and locale. Ingestion surfaces clear
  failures for missing captions.
- Search is retrieval-first: query embedding + cosine similarity against stored
  segment embeddings.
- The code keeps transcript normalization, segmentation, and similarity as pure
  functions for testability.
