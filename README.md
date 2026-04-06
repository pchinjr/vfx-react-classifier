# VFX React Classifier Engine

Transcript-first semantic retrieval for Corridor Crew "VFX Artists React"
episodes.

This repository is the retrieval and movie-resolution foundation for a future
classifier system. It ingests transcript-aligned windows, embeds them for
semantic search, groups them into reviewable discussion spans, resolves
candidate movies through TMDb, and supports a first optional learned reranker on
top of manually confirmed labels.

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
8. builds discussion spans from overlapping segments
9. resolves movie candidates from TMDb for eligible spans
10. allows manual span labels and offline reranker experiments

## What This Does Not Do Yet

- no OCR
- no frame or multimodal embeddings
- no UI
- no fully automated labeling without human review
- no raw transcript-to-movie classifier
- no active learning dashboard
- no franchise, cast, director, or visual-evidence fusion

## Scope

The current implementation covers the retrieval, canonical-candidate, manual
labeling, and first reranker scaffolding layers:

- ingest one or more YouTube episode URLs
- fetch metadata and captions
- normalize transcripts
- segment transcripts into overlapping windows
- generate embeddings for segments
- persist episodes, cues, segments, and embeddings
- run semantic search from a CLI query
- merge segment windows into discussion spans
- cache canonical TMDb movie records
- store ranked span movie candidates with evidence
- store manual movie labels
- build feature vectors and train/evaluate a small reranker

Non-goals remain OCR, multimodal embeddings, UI work, end-to-end automatic
classification, and active learning.

## Implementation Phases and Learnings

### Phase 1: Transcript Retrieval and Embeddings

Built the core ingestion pipeline: YouTube metadata/caption fetch, transcript
normalization, overlapping segment generation, OpenAI embeddings, SQLite
persistence, and CLI semantic search.

Challenge: broad subtitle matching with `en.*,en` caused `yt-dlp` to select
translated English variants such as `en-it` and `en-pt-BR`, which were noisier
and more likely to hit YouTube subtitle `429` failures.

Solution: request only the explicit English subtitle track with `--sub-langs en`
and prefer `json3/vtt/best`. The manual workaround that succeeded for early
episodes became the default caption path and is covered by regression tests.

### Phase 2: Canonical Movie Resolution MVP

Added discussion spans, TMDb movie catalog caching, span resolution runs, ranked
span movie candidates, manual span labels, and episode-level reports. The result
is a reviewable movie-resolution workflow rather than a black-box classifier.

Challenge: overlapping 30-second segment windows can chain together into a
whole-episode span if merged only by overlap/gap.

Solution: discussion span generation uses deterministic overlap/gap merging with
a max-span guard, so episode 4’s 58 segments become 6 reviewable spans instead
of one giant span.

Challenge: canonical title matching can pick the wrong version of a title
family. Episode 10 exposed this with candidates like `Independence Day` and
`Mortal Kombat`, where the right title family appeared but the top canonical
version was not necessarily the intended film.

Solution: keep all candidates with transparent evidence and confidence, store
manual labels separately, and preserve labels across resolver reruns. This
created durable training data without pretending the heuristic resolver is fully
reliable.

### Phase 3: Learned Candidate Reranking

Added a training dataset exporter, stable feature vectors, a dependency-free
logistic-regression reranker, optional model-backed candidate reranking, and
evaluation metrics comparing model ranking to the heuristic baseline.

Challenge: model inference should not replace candidate generation. If the
heuristic resolver produces no candidates, the model has nothing to rerank.
Episode 1 failed this way because the transcript is lowercase and repetitive,
even though it contains obvious mentions like `game of thrones`, `dragon heart`,
`sonic`, and `davey jones`.

Solution: make the reranker additive and optional. The resolver still generates
TMDb candidates first, then `--model <path>` reranks those candidates under a
model-specific resolver version. The fallback heuristic path remains unchanged.

Challenge: once model-specific candidate sets exist, reports and datasets can
accidentally mix heuristic and model-ranked candidates.

Solution: model-ranked outputs are stored under resolver versions such as
`span-movie-resolver-v1+candidate-reranker@<version>`. Reports scope to the
latest resolver version, dataset export defaults to the base heuristic resolver,
and labeling commands accept `--resolver-version` for deliberate review.

### Phase 4: Robust Candidate Generation

Refactored candidate query generation into explicit stages: precision
extraction, lowercase fallback extraction, alias expansion, query filtering, and
final resolver query orchestration. The resolver version advanced to
`span-movie-resolver-v2`.

Challenge: loosening query extraction globally creates junk TMDb lookups. A
first repeated-phrase fallback recovered episode 1 candidates, but it also
produced false positives such as `How Much` and `The Sack`.

Solution: keep the fallback constrained to explicit media alias hints for now.
The seed hints cover known episode 1 failures: `game of thrones`,
`dragon heart`, `sonic`, `davey jones`, and `pirates of the caribbean`.
Filtering still blocks generic phrases such as `welcome`, `camera`,
`united states`, `guys`, and `visual effects`.

Challenge: TMDb movie search is not the same as general media search.
`Game of Thrones` is a TV reference, so the movie-only lookup can return weak
movie-adjacent records rather than the canonical TV series.

Solution: preserve evidence fields including `querySource`, `normalizedPhrase`,
and `lookupQuery`, so weak alias outcomes are visible in review. Phase 5 starts
the catalog expansion by adding media-type-aware lookup and pre-lookup query
hygiene.

### Phase 5: Media-Type-Aware Catalog Hygiene

Extended the catalog layer toward work-based resolution without renaming the
movie tables yet. `movie_catalog` now stores a `media_type` column and enforces
TMDb identity by `(source, media_type, source_movie_id)`, which lets movie and
TV IDs coexist safely while existing movie records remain valid.

Challenge: alias hints already knew that `game of thrones` is TV, but the
resolver dropped that hint and always queried TMDb movie search.

Solution: resolver queries now carry `mediaTypeHint`, alias expansion preserves
TV/movie intent, and live episode resolution calls a unified TMDb work search.
Movie hints search the movie endpoint, TV hints search the TV endpoint, and
unknown hints choose a conservative plan from the query quality tier.

Challenge: the full 9-episode run showed that some precision phrases, such as
`Will Smith Budapest` and `Stick Around`, still leaked into TMDb and polluted
the local cache.

Solution: added a pre-lookup query-hygiene pass. Alias-backed queries are kept,
known noisy precision phrases are blocked before TMDb calls, and kept candidates
store hygiene evidence such as `queryHygieneScore` and `queryHygieneReason`.

Post-implementation validation: rerunning resolver v3 across all 9 existing
episodes produced 54 discussion spans, 19 spans with candidates, 59 total
candidates, and 1 preserved manual label. Candidate media types were 56 movie
and 3 TV. The known episode 1 `Game of Thrones` span now resolves to a TV
candidate, and the episode 2 `Will Smith` / `Budapest` noise no longer persists
as a v3 candidate.

Follow-up: unknown media-type queries now get deterministic `high`, `medium`, or
`low` quality tiers before catalog lookup. High-quality unknown queries can
search both movie and TV, medium-quality unknown queries search movie first and
only fall back to TV when movie results are empty, and low-quality unknown
queries stay movie-only. The chosen search plan is stored in candidate evidence
as `catalogSearchPlan`, alongside `queryQualityTier` and `tvSearchAllowed`.

Candidate persistence now has a named pre-persistence quality gate. Weak
cross-media TV candidates from unknown queries are dropped before
`span_movie_candidates` is written unless they have stronger title agreement and
confidence, while explicit TV hints such as `Game of Thrones` are preserved.

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
- `OPENAI_INFERENCE_MODEL`: defaults to `gpt-5-mini` for V2 work inference
- `TMDB_API_KEY`: required for canonical movie search
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
deno task movies:search "Jurassic Park"
deno task resolve:episode --episode ep_123 --force
deno task v2:windows --episode ep_123 --force --inspect
deno task v2:infer --episode ep_123 --force --limit 3 --inspect
deno task spans:candidates --span span_123
deno task spans:label --span span_123 --candidate-rank 1
deno task episode:report --episode ep_123
deno task ml:build-dataset --out artifacts/ml/candidate-training.jsonl
deno task ml:features --span span_123
deno task ml:train --dataset artifacts/ml/candidate-training.jsonl --out artifacts/ml/reranker-baseline.json
deno task ml:score-span --span span_123 --model artifacts/ml/reranker-baseline.json
deno task ml:evaluate --dataset artifacts/ml/candidate-training.jsonl --model artifacts/ml/reranker-baseline.json
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

`deno task movies:search <query>`

- searches TMDb for canonical movie records
- caches returned records in `movie_catalog`
- upserts by TMDb movie ID so reruns update records without duplicating them

`deno task resolve:episode --episode <episode-id>`

- resolves stored discussion spans against TMDb movie candidates
- writes one `span_resolution_runs` row for auditability
- stores ranked candidates in `span_movie_candidates`
- records confidence and evidence JSON for each candidate
- accepts `--force` to replace existing candidates for the current resolver
  version before rerunning
- accepts `--model <path>` to rerank generated candidates with a trained
  logistic reranker artifact

`deno task v2:windows --episode <episode-id>`

- builds V2 inference windows directly from stored normalized transcript cues
- defaults to `45s` windows with a `15s` stride
- stores windows in `v2_inference_windows`
- accepts `--force` to replace stale V2 windows for the episode
- accepts `--inspect` or `--list` to print stored window text after writing
- accepts `--window-size-seconds <number>` and `--stride-seconds <number>`

`deno task v2:infer --episode <episode-id>`

- runs the V2 semantic work inference prompt over stored V2 inference windows
- writes versioned rows to `v2_work_inferences`
- uses `OPENAI_INFERENCE_MODEL`, defaulting to `gpt-5-mini`
- stores title guesses, media-type guesses, primary/secondary role, confidence,
  transcript evidence snippets, rationale, model version, and prompt version
- accepts `--force` to replace inferences for the current model and prompt
- accepts `--limit <number>` for bounded smoke tests
- accepts `--inspect` or `--list` to print persisted inferences after writing
- accepts `--model <model>` and `--prompt-version <version>` for deliberate
  version comparisons

`deno task spans:candidates --span <span-id>`

- prints ranked movie candidates for one discussion span
- includes confidence, resolver version, and evidence JSON highlights
- accepts `--refresh` to rerun candidate resolution for that span before
  printing
- accepts `--model <path>` when refreshing or inspecting model-ranked candidates
- accepts `--resolver-version <version>` when inspecting a specific persisted
  resolver output

`deno task spans:label --span <span-id> --candidate-rank <rank>`

- confirms one ranked candidate as the current manual label for a span
- stores the label in `span_movie_labels`
- upserts by span ID so changing a manual label is deliberate and idempotent
- accepts `--resolver-version <version>` to label from a non-default candidate
  set

`deno task episode:report --episode <episode-id>`

- summarizes spans, candidate coverage, confirmed labels, and unlabeled spans
- prints the latest resolver run status and notes
- lists each span with its candidate count, top candidate, and confirmed label

`deno task ml:build-dataset`

- exports one JSONL row per `(span, candidate)` pair for manually labeled spans
- assigns positive rows when the candidate matches the confirmed label
- assigns negative rows for the other candidates attached to the same span
- includes deterministic `train`, `validation`, or `test` splits by span ID
- accepts `--out <path>`, defaulting to `artifacts/ml/candidate-training.jsonl`
- accepts `--resolver-version <version>`, defaulting to the base heuristic
  resolver so model-ranked candidates are not exported by accident

`deno task ml:features --span <span-id>`

- builds the stable Phase 3 feature vector for each candidate attached to a span
- prints schema version, feature order, and numeric feature values
- is read-only and intended for debugging candidate reranking inputs

`deno task ml:train`

- trains a small offline logistic-regression reranker from exported JSONL rows
- defaults to `artifacts/ml/candidate-training.jsonl` as input
- defaults to `artifacts/ml/reranker-baseline.json` as output
- reports top-1 accuracy, top-3 recall, MRR, and heuristic baseline metrics
- accepts `--dataset <path>`, `--out <path>`, `--iterations <number>`, and
  `--learning-rate <number>`

`deno task ml:score-span --span <span-id>`

- loads an existing model artifact
- computes model scores for already stored span candidates
- prints model-ranked candidates without writing to the database
- accepts `--model <path>`, defaulting to `artifacts/ml/reranker-baseline.json`

`deno task ml:evaluate`

- evaluates exported candidate training rows without mutating the database
- compares model ranking metrics against heuristic baseline rank metrics
- reports accuracy, top-1 accuracy, top-3 recall, and MRR
- accepts `--dataset <path>`, `--model <path>`,
  `--split <all|train|validation|test>`, and `--resolver-version <version>`

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

### MovieCatalogRecord

Represents one canonical movie record cached from TMDb. The local ID is stable,
while `source` and `sourceMovieId` keep the external catalog identity explicit.

### SpanMovieCandidate

Represents one ranked movie candidate for a discussion span. Candidates are
resolver output and can be safely replaced with `resolve:episode --force`.

### SpanMovieLabel

Represents one confirmed movie association for a discussion span. Labels are
stored separately from candidates so resolver reruns do not erase manual review.

### CandidateTrainingRow

Represents one Phase 3 training example for a span-candidate pair. Rows are
derived only from manually labeled spans and exported as JSONL for offline model
training.

### CandidateFeatureVector

Represents the stable numeric Phase 3 feature schema for one span-candidate
pair. The current schema is `candidate-features-v1`.

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
- `movie_catalog`
- `span_resolution_runs`
- `span_movie_candidates`
- `span_movie_labels`

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
existing spans for that episode. If you already have manual labels for those
spans, rebuild carefully because replacing span IDs can orphan the review work.

## Movie Catalog Flow

When you run `deno task movies:search <query>`, the application:

1. searches TMDb's movie catalog
2. maps returned movies into stable local `MovieCatalogRecord` rows
3. stores the records in `movie_catalog`
4. prints the ranked TMDb candidates with title, year, source ID, and overview

## Span Resolution Flow

When you run `deno task resolve:episode --episode <episode-id>`, the
application:

1. creates a `span_resolution_runs` row with resolver version and status
2. loads stored discussion spans for the episode
3. extracts title-like search queries from each eligible span
4. assigns query quality tiers and a media-type-aware TMDb search plan
5. caches returned movies in `movie_catalog`
6. ranks candidates with transparent confidence and evidence JSON
7. filters weak candidates before persistence
8. upserts `span_movie_candidates` by span, movie, and resolver version

This is a pragmatic first resolver, not a classifier. It is intentionally
weighted and inspectable so bad matches can be debugged before manual labeling
and training data collection are added.

Use `--force` when resolver heuristics change and you want to delete stale
candidates for the current resolver version before writing fresh results. Manual
labels are stored separately, so this command only manages candidate rows.

## Manual Label Flow

When you run `deno task spans:candidates --span <span-id>`, the application:

1. loads ranked candidates for the span
2. prints confidence and resolver version
3. prints evidence fields such as search query, title similarity, and overview
   overlap
4. prints the current confirmed label if one exists

When you run `deno task spans:label --span <span-id> --candidate-rank <rank>`,
the application:

1. looks up the candidate for the current resolver version and rank
2. writes a `span_movie_labels` row with `labelSource = "manual"`
3. upserts by span ID so rerunning the command keeps one primary label per span

Resolver reruns preserve manual labels because candidate rows and label rows are
separate tables.

## Episode Report Flow

When you run `deno task episode:report --episode <episode-id>`, the application:

1. loads episode metadata
2. counts discussion spans, candidate rows, and confirmed labels
3. prints the latest resolution run for operational visibility
4. prints a compact row for each span with candidate and label status

This command is read-only and is intended as the checkpoint after span
resolution and manual labeling.

## ML Dataset Flow

When you run `deno task ml:build-dataset`, the application:

1. loads spans with manual labels
2. joins each labeled span to its stored candidate movies
3. marks the confirmed candidate as `label = 1`
4. marks the other candidates for that span as `label = 0`
5. writes deterministic JSONL rows to the output path

This is the first Phase 3 primitive. It prepares labeled data for a candidate
reranker. By default, export is scoped to the base heuristic resolver version so
model-ranked candidates do not become circular training data.

## ML Feature Flow

When you run `deno task ml:features --span <span-id>`, the application:

1. loads the span's stored movie candidates
2. joins each candidate to TMDb cache metadata
3. computes a stable numeric feature vector for each candidate
4. prints the feature schema version and feature order

The feature vector includes heuristic rank/confidence, title and overview
overlap, exact title mentions, comparative-context flags, popularity, vote
count, candidate-set size, and duplicate normalized-title counts.

## ML Training Flow

When you run `deno task ml:train`, the application:

1. reads exported candidate training rows from JSONL
2. uses `train` split rows when the dataset contains split metadata
3. parses each row's versioned feature vector
4. trains a dependency-free logistic-regression reranker
5. writes a versioned model artifact with weights, normalization parameters,
   feature order, and metrics

The current trainer is intentionally small and offline. It validates the
training/evaluation plumbing before any heavier ML dependency is introduced.
With the current local data volume, metrics mostly prove the command path and
artifact format rather than real model quality.

## ML Inference Flow

When you run `deno task resolve:episode --episode <episode-id> --model <path>`,
the application:

1. generates TMDb candidates with the existing rule-based resolver
2. builds Phase 3 feature vectors for the candidate set
3. scores each candidate with the trained logistic reranker
4. reranks candidates by model score
5. stores model-ranked candidates under a model-specific resolver version

The resolver version is derived from the base resolver and model metadata, such
as `span-movie-resolver-v1+candidate-reranker@<version>`. If `--model` is not
provided, the existing heuristic ranking path is used unchanged.

## ML Evaluation Flow

When you run `deno task ml:evaluate`, the application:

1. reads exported candidate rows from JSONL
2. filters by resolver version and split
3. optionally loads a trained reranker artifact
4. scores each candidate row with the model or heuristic confidence
5. compares top-1, top-3, and MRR against the heuristic rank baseline

This is the Phase 3 regression harness entrypoint. With the current tiny labeled
dataset, it mainly validates the evaluation path; it becomes more meaningful as
more manual labels are added.

## V2 Semantic Inference Foundations

V2 is being added alongside V1 rather than replacing it in place. V1 remains the
baseline resolver and review workflow. V2 starts by reusing ingestion and
transcript storage, then creating smaller inference windows that are intended
for later semantic work-inference calls.

When you run `deno task v2:windows --episode <episode-id>`, the application:

1. loads stored normalized transcript cues for the episode
2. creates deterministic overlapping inference windows
3. writes `v2_inference_windows` rows
4. optionally prints the stored windows for inspection

The second V2 slice adds model-backed semantic inference over those windows.
Inference uses a versioned prompt and structured JSON output to persist:

- title guess
- media type: `movie`, `tv`, or `unknown`
- role: `primary` or `secondary`
- confidence
- transcript evidence snippets
- optional rationale
- model and prompt versions

This still does not canonicalize guesses to TMDb or aggregate neighboring
windows. Those are separate milestones so V2 can be evaluated stage by stage.

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
    catalog/
  v2/
    domain/
    services/
    storage/
    cli/
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

`src/services/catalog`

- media-type-aware catalog search planning

`src/v2`

- semantic inference engine foundations, starting with transcript inference
  windows

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
- TMDb movie and TV search mapping plus catalog cache upserts
- span movie candidate ranking and resolution run persistence
- manual span label confirmation and rerun preservation
- episode-level reporting
- Phase 3 candidate training dataset export
- Phase 3 candidate feature vector generation
- Phase 3 baseline reranker training and metric calculation
- Phase 3 model scoring, reranking, and heuristic fallback behavior
- Phase 3 evaluation filtering and baseline metric comparison
- Phase 4 query extraction stages, alias fallback, filtering, and episode 1
  regressions
- Phase 5 media-type hint propagation, TMDb work search routing, and pre-lookup
  query hygiene
- Phase 5.1 resolver query quality tiers, conservative unknown-type search
  planning, and weak unknown-TV candidate filtering
- V2 inference-window generation and persistence
- V2 structured semantic work inference parsing and persistence
- boundedness protections for invalid segmentation config
- timeout protections for stalled subprocess and embedding calls

## Current Limitations

- Search quality depends heavily on subtitle quality.
- Some YouTube subtitles are noisy or repetitive.
- Raw search returns overlapping windows independently.
- Discussion spans are currently time-based only and do not yet infer movie
  boundaries.
- Span resolution is heuristic and title-phrase driven; it is expected to need
  human review before labels are accepted.
- Manual movie labels currently support one primary movie per span.
- Phase 3 training data only includes spans with manual labels.
- The baseline reranker is only as useful as the available manual labels; with a
  tiny dataset, trainer metrics are not a trustworthy quality signal yet.
- Model-ranked candidates are stored under model-specific resolver versions, so
  manual labeling commands need `--resolver-version` when confirming from a
  non-default candidate set.
- Lowercase fallback currently uses a small explicit alias set rather than broad
  fuzzy phrase extraction.
- The catalog tables are still named `movie_*` for compatibility, even though
  records now carry `media_type` and can represent TV works.
- Query hygiene is intentionally conservative and denylist-backed; it blocks
  known noisy precision phrases but is not a general title-quality model.
- Unknown media-type TV lookup is intentionally conservative; medium-quality
  unknown queries only try TV as an empty-movie-results fallback, and
  low-quality unknown queries do not broaden to TV.
- V2 currently builds inference windows and raw semantic work inferences;
  canonicalization, aggregation, and review decisions are not implemented yet.
- Query scoring is currently in-process over all embeddings, which is fine for
  small corpora but not intended as the final scaling strategy.

## Suggested Next Steps

- finish the work-catalog rename when the schema is ready for a larger migration
- add richer candidate resolution heuristics for person names and one-word
  titles
- add corpus-level fixtures for more weak unknown-TV false positives
- add more manual labels and known-failure fixtures for episode 1 and episode 10
- add V2 canonicalization from inferred title guesses to TMDb works
- move search candidates to a more scalable vector-aware backend when needed

## Notes

- Caption availability varies by video and locale. Ingestion surfaces clear
  failures for missing captions.
- Search is retrieval-first: query embedding + cosine similarity against stored
  segment embeddings.
- The code keeps transcript normalization, segmentation, and similarity as pure
  functions for testability.
