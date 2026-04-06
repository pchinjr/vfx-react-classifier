# VFX React Classifier Engine

Transcript-first semantic retrieval for Corridor Crew "VFX Artists React"
episodes.

This repository is the retrieval foundation for a future classifier system. The
current version does not try to decide which movie a segment belongs to. It
focuses on collecting transcript-aligned windows, embedding them, and returning
the most semantically similar windows for a text query.

## What This Does

For each ingested YouTube episode, the pipeline:

1. fetches video metadata with `yt-dlp`
2. fetches the explicit English subtitle track or English auto-captions with
   `yt-dlp`
3. normalizes the caption stream into cleaner cues
4. segments the cues into overlapping time windows
5. embeds each segment with OpenAI embeddings
6. stores metadata, cues, segments, and embeddings in SQLite
7. answers semantic queries by embedding the query text and ranking segment
   embeddings by cosine similarity

## What This Does Not Do Yet

- no OCR
- no frame or multimodal embeddings
- no movie database integration
- no title extraction into a canonical movie catalog
- no UI
- no segment merge / collapse pass on overlapping search hits
- no classifier training or active learning

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
- network access for `yt-dlp` and the OpenAI API

## Quick Start

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Edit `.env` and set `OPENAI_API_KEY`.

3. Initialize the SQLite database:

```bash
deno task db:init
```

4. Ingest one episode:

```bash
deno task ingest "https://www.youtube.com/watch?v=D7Cv7x6jjYQ"
```

5. Query the corpus:

```bash
deno task query "punisher"
```

## Setup

The application reads configuration from `.env`. The most important values are:

- `OPENAI_API_KEY`: required for embeddings and search queries
- `OPENAI_EMBEDDING_MODEL`: defaults to `text-embedding-3-small`
- `DATABASE_URL`: SQLite file path
- `YTDLP_BINARY`: path to `yt-dlp`

Safety and boundedness settings:

- `YTDLP_TIMEOUT_MS`: max runtime for a `yt-dlp` subprocess
- `OPENAI_TIMEOUT_MS`: max runtime for one embeddings request
- `INGEST_TIMEOUT_MS`: cap for one full ingest call
- `MAX_TRANSCRIPT_CUES`: hard cap on accepted caption cues
- `MAX_SEGMENTS_PER_EPISODE`: hard cap on generated transcript windows

These limits exist to keep the process practically bounded under bad network
conditions or malformed inputs.

## Commands

```bash
deno task ingest "https://www.youtube.com/watch?v=VIDEO_ID"
deno task ingest:batch ./urls.txt
deno task spans:build --episode ep_123
deno task spans:list --episode ep_123
deno task query "Jurassic Park T-Rex"
deno task reembed
deno task db:init
deno task check
deno task test
deno task lint
deno task fmt
```

### Command Notes

`deno task ingest <url>`

- fetches metadata and captions
- normalizes and segments the transcript
- writes episode, cues, and segments
- embeds any missing segments for the configured model

`deno task ingest <url> --transcript <file>`

- bypasses YouTube subtitle download
- loads cues from a local `.vtt`, `.json3`, or cue-array `.json` file
- reuses the same normalization, segmentation, persistence, and embedding path
- useful when YouTube subtitle fetch is rate-limited

`deno task ingest:batch <file>`

- reads newline-separated URLs from a file
- ingests them sequentially

`deno task spans:build --episode <episode-id>`

- merges existing overlapping transcript segments into discussion spans
- uses a deterministic time-gap merge rule, defaulting to `15s`
- caps span duration at `180s` by default so sliding-window segments do not
  chain into one whole-episode span
- upserts spans by stable IDs so reruns do not create duplicates
- accepts `--force` to replace stale spans for an episode after segmentation
  settings change

`deno task spans:list --episode <episode-id>`

- prints stored discussion spans with timestamps, source segment counts, and
  text
- intended as the first human-review checkpoint before movie resolution

`deno task query <text>`

- embeds the query text
- scores every stored segment embedding with cosine similarity
- prints the top results with timestamps and scores

`deno task reembed`

- finds segments that do not yet have embeddings for the active model
- embeds only those missing segments

`deno task reembed --force`

- re-embeds every stored segment for the active model
- useful after changing models or re-running a full embedding pass

## Data Model

### Episode

Represents one YouTube video and its metadata.

### TranscriptCue

Represents one caption cue with a start time, end time, and text.

### Segment

Represents one overlapping transcript window, usually `30s` wide with a `15s`
stride.

### DiscussionSpan

Represents a larger reviewable transcript region produced by merging adjacent or
overlapping segments for one episode. This is the first Phase 2 primitive for
movie-aware resolution.

### SegmentEmbedding

Represents one embedding vector for one segment for one embedding model.

### SearchResult

Represents one ranked retrieval hit enriched with episode title and timestamps.

## Storage

The default database is SQLite at `./data/vfx-react-engine.sqlite`.

Tables:

- `episodes`
- `transcript_cues`
- `segments`
- `segment_embeddings`
- `discussion_spans`

Embeddings are stored as JSON for v1 simplicity. The repository layer keeps the
storage boundary explicit so a vector database or Postgres can be added later.

## Ingest Flow

When you run `deno task ingest <url>`, the application does the following:

1. parse the YouTube video ID from the URL
2. ask `yt-dlp` for video metadata
3. ask `yt-dlp` for only the explicit English subtitle track or English
   auto-subtitles
4. parse VTT or JSON3 subtitles into `TranscriptCue[]`
5. normalize caption text and merge obvious repetition
6. generate overlapping transcript segments
7. upsert the episode row
8. replace caption rows for the episode
9. replace segment rows for the episode
10. embed any segments missing embeddings for the active model

If the embedding step fails, earlier persisted data remains in the database and
you can resume later with `deno task reembed`.

### Caption Selection

The ingest path intentionally requests only `--sub-langs en` from `yt-dlp`.
Earlier broad matching with `en.*,en` could select translated variants such as
`en-it` or `en-pt-BR`, which proved noisier and more likely to hit YouTube
subtitle `429` failures. The current path prefers `json3` subtitles, falls back
to `vtt`, and still allows YouTube English auto-captions when no authored
English subtitle track is available.

## Search Flow

When you run `deno task query <text>`, the application:

1. embeds the query text with the active embedding model
2. loads all stored segment embeddings for that model
3. computes cosine similarity in process
4. sorts the results descending
5. prints the top `5` results by default

Because transcript segmentation overlaps, nearby windows often appear together
in the output. That behavior is expected in the current version.

## Discussion Span Flow

When you run `deno task spans:build --episode <episode-id>`, the application:

1. loads stored segments for the episode
2. sorts them by time
3. merges segments that overlap or are within the configured gap
4. stores deterministic `discussion_spans` rows

The default max gap is `15s`; override it with `--max-gap-seconds <number>`. The
default max span duration is `180s`; override it with
`--max-span-seconds <number>`. Use `--force` when you want to delete and replace
existing spans for that episode. Manual movie labels are not implemented yet, so
there is nothing to preserve in this first Phase 2 slice.

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

### Directory Guide

`src/config`

- environment loading and configuration parsing

`src/domain`

- core application types shared across modules

`src/services/youtube`

- `yt-dlp` integration and subtitle parsing

`src/services/transcript`

- pure transcript cleanup and segmentation logic

`src/services/embeddings`

- OpenAI embeddings integration and batching

`src/services/storage`

- SQLite access, schema, and repository functions

`src/services/search`

- cosine similarity and retrieval ranking

`src/cli`

- command-line entrypoints and output formatting

`src/lib`

- small shared utilities and app-level error helpers

`src/tests`

- unit and integration-style tests

## Operational Limits

This code is designed to be practically bounded:

- segmentation rejects non-positive stride or window size
- segment generation has a hard max segment count
- transcript ingestion has a hard max cue count
- `yt-dlp` subprocesses time out
- OpenAI embedding requests time out
- the whole ingest flow has a wall-clock timeout

These protections are covered by tests and are intended to prevent common
runaway scenarios, but they are still operational safeguards rather than a
formal proof of termination.

## Failure Modes

Expected failures include:

- missing captions for a video
- malformed caption files
- YouTube rate limiting during subtitle fetch
- missing OpenAI API key
- OpenAI quota exhaustion
- transcript normalization producing no remaining text

Current behavior:

- metadata, cues, and segments may be persisted before embedding fails
- rerunning `ingest` or `reembed` should resume the missing embedding work

## Testing

Run the full verification suite with:

```bash
deno task check
deno task lint
deno task test
```

The test suite currently covers:

- transcript normalization
- transcript segmentation
- deterministic segment IDs
- cosine similarity
- repository upsert behavior
- integration-style search over fixture transcript data
- English-only `yt-dlp` caption argument selection
- deterministic discussion span generation and repository reruns
- boundedness protections for invalid segmentation config
- timeout protections for stalled subprocess and embedding calls

## Current Limitations

- Search quality depends heavily on subtitle quality.
- Some YouTube subtitles are noisy or repetitive.
- Raw search returns overlapping windows independently.
- Discussion spans are currently time-based only and do not yet infer movie
  boundaries.
- No movie extraction or catalog table exists yet.
- Query scoring is currently in-process over all embeddings, which is fine for
  small corpora but not intended as the final scaling strategy.

## Suggested Next Steps

- add movie catalog cache and external lookup
- add span candidate resolution with evidence JSON
- add manual span label confirmation
- add episode-level resolution reports
- move search candidates to a more scalable vector-aware backend when needed

## Notes

- Caption availability varies by video and locale. Ingestion surfaces clear
  failures for missing captions.
- Search is retrieval-first: query embedding + cosine similarity against stored
  segment embeddings.
- The code keeps transcript normalization, segmentation, and similarity as pure
  functions for testability.
