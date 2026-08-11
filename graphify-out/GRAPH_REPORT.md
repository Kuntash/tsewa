# Graph Report - tsewa  (2026-08-11)

## Corpus Check
- 103 files · ~114,697 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2629 nodes · 3230 edges · 211 communities (61 shown, 150 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb8dcef8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- worker-configuration.d.ts
- server.ts
- ServiceWorkerGlobalScope
- Event
- index.tsx
- scripts
- cn
- import-academic-history.mjs
- import-family-relationships.mjs
- import-people-registry.mjs
- devDependencies
- compilerOptions
- import-placement-history.mjs
- people-registry.tsx
- dependencies
- person-profile-sheet.tsx
- components.json
- Console
- routeTree.gen.ts
- TransformStream
- URL
- people-registry-dry-run.mjs
- URLSearchParams
- DurableObjectStorage
- Container
- Element
- Headers
- SubtleCrypto
- academic-history-dry-run.mjs
- family-relationships-dry-run.mjs
- placement-history-dry-run.mjs
- Blob
- Body
- FormData
- URLPattern
- DurableObjectState
- WorkerEntrypoint
- StreamError
- People Registry migration map
- Flagship
- R2ObjectBody
- AgentMemoryProfile
- ByteLengthQueuingStrategy
- WritableStream
- DurableObject
- DurableObjectTransaction
- ReadableStream
- Socket
- WritableStreamDefaultWriter
- AiSearchInstance
- DurableObjectNamespace
- R2Bucket
- SqlStorageCursor
- Vectorize
- school-operations.tsx
- Ai
- AiSearchNamespace
- ReadableStreamBYOBReader
- VectorizeIndex
- WorkflowInstance
- Tsewa
- AiSearchItem
- AiSearchItems
- Artifacts
- ArtifactsRepo
- D1Database
- D1PreparedStatement
- KVNamespace
- ReadableByteStreamController
- ReadableStreamDefaultReader
- TextDecoder
- AiGateway
- Comment
- DurableObjectFacets
- ForwardableEmailMessage
- HTMLRewriter
- HTMLRewriterDocumentContentHandlers
- ImageHandle
- ReadableStreamBYOBRequest
- ReadableStreamDefaultController
- StreamScopedCaptions
- StreamVideoHandle
- StreamWatermarks
- SyncKvStorage
- Table
- Text
- TextEncoder
- TransformStreamDefaultController
- AbortController
- AiSearchJob
- AiSearchJobs
- AutoRAG
- Cache
- Crypto
- D1DatabaseSession
- EndTag
- HostedImagesBinding
- HTMLRewriterElementContentHandlers
- ImageTransformationResult
- ImageTransformer
- MediaTransformationResult
- Module
- Performance
- Queue
- R2MultipartUpload
- Span
- StreamBinding
- StreamScopedDownloads
- WebSocketRequestResponsePair
- Workflow
- WorkflowEntrypoint
- class-master-dry-run.mjs
- AgentMemoryNamespace
- BasicImageTransformations
- BrowserRun
- ColoLocalActorNamespace
- StubBase
- DOMException
- DurableObjectId
- ExecProcess
- ExecutionContext
- Global
- HelloWorldBinding
- ImagesBinding
- MediaTransformer
- Memory
- Message
- MessageBatch
- NodeStyleServer
- PipelineTransformationEntrypoint
- RequestInitCfPropertiesVaryHeader
- SqlStorage
- ToMarkdownService
- Tracing
- WorkerLoader
- WorkerStub
- WorkflowStep
- WritableStreamDefaultController
- Family and relationship migration
- Tsewa TODO
- Vite+ workspace
- web
- import-person-files.mjs
- web/vite.config.ts
- AnalyticsEngineDataset
- __BaseEnv_Env
- CacheContext
- CacheStorage
- CloudflareAccessContext
- CompileError
- DispatchNamespace
- DocumentEnd
- EventListenerObject
- Hyperdrive
- IncomingRequestCfPropertiesBotManagement
- Instance
- JsonWebKey
- MediaBinding
- MediaTransformationGenerator
- MessageChannel
- Navigator
- NonRetryableError
- Pipeline
- ProcessEnv
- R2Checksums
- RateLimit
- ResponseFunctionToolCall
- RpcTarget
- RuntimeError
- ScheduledController
- Scheduler
- SecretsStoreSecret
- SendEmail
- StreamVideos
- TraceItemFetchEventInfoRequest
- UnsafeTraceMetrics
- WebSearch
- organization
- scripts
- web/package.json
- Person files migration
- school-operations-dry-run.mjs
- @hugeicons/core-free-icons
- @hugeicons/react
- react-dom
- tailwind-merge
- pre-commit
- install-git-hooks.sh
- person-files.mjs
- person-files-dry-run.mjs
- School Operations vertical slice
- import-school-operations.mjs
- sqlLiteral
- Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?
- import-student-enrollments.mjs
- student-enrollment-dry-run.mjs
- button.tsx
- Q: So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?
- Q: Okay whats next?
- Q: what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?
- Q: How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?
- Q: why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application.
- Product language
- class-master-reconciliation.md
- Q: can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely.
- historical-results.tsx
- import-historical-results.mjs
- Q: whats next slice? while the migration is ongoing?
- Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that.
- better-auth

## God Nodes (most connected - your core abstractions)
1. `cn()` - 50 edges
2. `organization` - 31 edges
3. `scripts` - 30 edges
4. `getRuntimeEnv()` - 25 edges
5. `Event` - 25 edges
6. `Console` - 21 edges
7. `fetch()` - 19 edges
8. `methodNotAllowed()` - 18 edges
9. `compilerOptions` - 17 edges
10. `getMembershipContext()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/card.tsx → apps/web/src/lib/utils.ts
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/card.tsx → apps/web/src/lib/utils.ts
- `SelectGroup()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/select.tsx → apps/web/src/lib/utils.ts
- `SelectLabel()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/select.tsx → apps/web/src/lib/utils.ts
- `SelectSeparator()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/select.tsx → apps/web/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (211 total, 150 thin omitted)

### Community 0 - "worker-configuration.d.ts"
Cohesion: 0.00
Nodes (847): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+839 more)

### Community 1 - "server.ts"
Cohesion: 0.09
Nodes (68): AuthOptions, createAuth(), getRuntimeEnv(), SecretBindings, acceptInvitation(), acceptInvitationForCurrentUser(), auditAccountAction(), auditStatement() (+60 more)

### Community 2 - "ServiceWorkerGlobalScope"
Cohesion: 0.04
Nodes (7): AbortSignal, EventSource, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 3 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 4 - "index.tsx"
Cohesion: 0.13
Nodes (20): AccountSettings(), AccountSettingsProps, Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader() (+12 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (41): devDependencies, vite-plus, engines, node, license, name, packageManager, private (+33 more)

### Community 6 - "cn"
Cohesion: 0.13
Nodes (17): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+9 more)

### Community 7 - "import-academic-history.mjs"
Cohesion: 0.10
Nodes (19): buildImportSql(), confirmedDatabaseId, database, optionalInteger(), optionalText(), options, organizationSlug, rawSql() (+11 more)

### Community 8 - "import-family-relationships.mjs"
Cohesion: 0.10
Nodes (19): buildImportSql(), confirmedDatabaseId, database, familyProfilePredicate(), optionalText(), options, organizationSlug, rawSql() (+11 more)

### Community 9 - "import-people-registry.mjs"
Cohesion: 0.10
Nodes (19): buildImportSql(), confirmedDatabaseId, database, mapGender(), optionalText(), options, organizationSlug, rawSql() (+11 more)

### Community 10 - "devDependencies"
Cohesion: 0.08
Nodes (25): devDependencies, @cloudflare/vite-plugin, tailwindcss, @tailwindcss/vite, @tanstack/router-cli, tw-animate-css, @types/node, @types/react (+17 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+16 more)

### Community 12 - "import-placement-history.mjs"
Cohesion: 0.10
Nodes (18): buildImportSql(), confirmedDatabaseId, database, optionalText(), options, organizationSlug, rawSql(), readPlacements() (+10 more)

### Community 13 - "people-registry.tsx"
Cohesion: 0.15
Nodes (11): emptyRegistry, formatDate(), PeopleRegistry(), PeopleResults(), PersonKind, PersonRow, PersonStatus, RegistryResponse (+3 more)

### Community 14 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, class-variance-authority, clsx, @fontsource-variable/dm-sans, @fontsource-variable/inter, lucide-react, radix-ui, react (+15 more)

### Community 15 - "person-profile-sheet.tsx"
Cohesion: 0.12
Nodes (17): capitalize(), FamilyProfileSection(), formatBytes(), formatDate(), initials(), isFutureSourceDate(), PersonFilesSection(), PersonProfileSheet() (+9 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "routeTree.gen.ts"
Cohesion: 0.14
Nodes (16): getRouter(), Register, @tanstack/react-router, Route, Route, FileRoutesByFullPath, FileRoutesById, FileRoutesByPath (+8 more)

### Community 19 - "TransformStream"
Cohesion: 0.10
Nodes (7): CompressionStream, DecompressionStream, FixedLengthStream, IdentityTransformStream, TextDecoderStream, TextEncoderStream, TransformStream

### Community 21 - "people-registry-dry-run.mjs"
Cohesion: 0.15
Nodes (15): analyzeSource(), argumentsByName, assertAggregateOnly(), beneficiaryDefinition(), database, dateIssues(), issue(), outputPath (+7 more)

### Community 28 - "academic-history-dry-run.mjs"
Cohesion: 0.16
Nodes (9): assertAggregateOnly(), database, options, outputPath, repositoryRoot, row(), scalar(), sourcePath (+1 more)

### Community 29 - "family-relationships-dry-run.mjs"
Cohesion: 0.16
Nodes (9): assertAggregateOnly(), database, options, outputPath, repositoryRoot, row(), scalar(), sourcePath (+1 more)

### Community 30 - "placement-history-dry-run.mjs"
Cohesion: 0.16
Nodes (9): assertAggregateOnly(), database, options, outputPath, repositoryRoot, row(), scalar(), sourcePath (+1 more)

### Community 32 - "Body"
Cohesion: 0.15
Nodes (3): Body, Request, Response

### Community 37 - "StreamError"
Cohesion: 0.18
Nodes (11): AlreadyUploadedError, BadRequestError, ForbiddenError, InternalError, InvalidURLError, MaxFileSizeError, NotFoundError, QuotaReachedError (+3 more)

### Community 38 - "People Registry migration map"
Cohesion: 0.12
Nodes (16): Academic-history dry run, Academic import policy, Academic import result, Core import policy, Core import result, Core record counts, Data-quality gates, Delivery order (+8 more)

### Community 42 - "ByteLengthQueuingStrategy"
Cohesion: 0.22
Nodes (3): ByteLengthQueuingStrategy, CountQueuingStrategy, QueuingStrategy

### Community 54 - "school-operations.tsx"
Cohesion: 0.08
Nodes (14): AcademicSession, CountOption, emptyStudents, handleLoadError(), OverviewResponse, parseResponse(), RosterRow, SchoolOperations() (+6 more)

### Community 60 - "Tsewa"
Cohesion: 0.29
Nodes (6): Cloudflare resources, License, Local development, THF deployment, Tsewa, Workspace

### Community 111 - "class-master-dry-run.mjs"
Cohesion: 0.24
Nodes (11): candidateScore(), canonicalName(), clean(), cleanSection(), compareCandidates(), database, options, outputPath (+3 more)

### Community 113 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 130 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

### Community 138 - "Family and relationship migration"
Cohesion: 0.33
Nodes (5): Deployment record, Family and relationship migration, Local workflow, Remote gate, Source tables

### Community 139 - "Tsewa TODO"
Cohesion: 0.25
Nodes (7): Account and email follow-ups, Documents and media migration, Invitation UX follow-ups, People Registry migration, Product foundations, School Operations, Tsewa TODO

### Community 142 - "import-person-files.mjs"
Cohesion: 0.09
Nodes (24): chunkSize, concurrency, confirmedDatabaseId, database, delay(), executeD1Import(), expectedFileCount, hashR2Object() (+16 more)

### Community 178 - "organization"
Cohesion: 0.11
Nodes (37): academic_session, "account", audit_event, organization, organization_member, "session", "user", user_preference (+29 more)

### Community 179 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, cf-typegen, db:migrate:local, db:migrate:remote, deploy, dev, generate-routes (+2 more)

### Community 180 - "web/package.json"
Cohesion: 0.33
Nodes (5): imports, license, name, private, type

### Community 181 - "Person files migration"
Cohesion: 0.29
Nodes (6): Access control, Dry run, One-person pilot, Person files migration, Preservation policy, Resumable bulk import

### Community 182 - "school-operations-dry-run.mjs"
Cohesion: 0.18
Nodes (7): assertAggregateOnly(), database, options, outputPath, repositoryRoot, sourcePath, visit()

### Community 189 - "person-files.mjs"
Cohesion: 0.54
Nodes (7): objectExtension(), optionalText(), readPersonFiles(), requiredText(), stablePersonId(), stableUuid(), withExtension()

### Community 190 - "person-files-dry-run.mjs"
Cohesion: 0.12
Nodes (14): database, options, outputPath, repositoryRoot, sourcePath, DEFAULT_SOURCE_DATABASE, parseArguments(), assertAggregateOnly() (+6 more)

### Community 191 - "School Operations vertical slice"
Cohesion: 0.29
Nodes (6): Academic-session behavior, API boundary, Import result, School Operations vertical slice, Slice 1: read-only students, Slice 2: session enrollments and class rosters

### Community 192 - "import-school-operations.mjs"
Cohesion: 0.11
Nodes (20): buildImportSql(), buildUpsert(), chunkedUpserts(), confirmedDatabaseId, database, optionalInteger(), optionalText(), options (+12 more)

### Community 193 - "sqlLiteral"
Cohesion: 0.29
Nodes (10): add(), buildSql(), sqlValue(), buildImportSql(), readImportedFiles(), buildImportSql(), buildUpsert(), chunkedUpserts() (+2 more)

### Community 194 - "Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?, Source Nodes

### Community 195 - "import-student-enrollments.mjs"
Cohesion: 0.13
Nodes (15): confirmedDatabaseId, database, offeringId(), optionalText(), options, organizationSlug, readEnrollments(), readOfferings() (+7 more)

### Community 196 - "student-enrollment-dry-run.mjs"
Cohesion: 0.18
Nodes (8): sha256File(), assertAggregateOnly(), database, options, outputPath, repositoryRoot, sourcePath, visit()

### Community 197 - "button.tsx"
Cohesion: 0.43
Nodes (5): readTheme(), Theme, ThemeToggle(), Button(), buttonVariants

### Community 198 - "Q: So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?, Source Nodes

### Community 199 - "Q: Okay whats next?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Okay whats next?, Source Nodes

### Community 200 - "Q: what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?, Source Nodes

### Community 201 - "Q: How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?, Source Nodes

### Community 202 - "Q: why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application., Source Nodes

### Community 203 - "Product language"
Cohesion: 0.50
Nodes (3): Preferred words, Product language, Rules

### Community 205 - "Q: can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely., Source Nodes

### Community 206 - "historical-results.tsx"
Cohesion: 0.12
Nodes (18): formatMark(), HistoricalResults(), message(), Option, Overview, parse(), ResultRow, Results (+10 more)

### Community 207 - "import-historical-results.mjs"
Cohesion: 0.12
Nodes (16): confirmedDatabaseId, database, id(), optionalNumber(), optionalText(), options, organizationSlug, readData() (+8 more)

### Community 208 - "Q: whats next slice? while the migration is ongoing?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: whats next slice? while the migration is ongoing?, Source Nodes

### Community 209 - "Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that., Source Nodes

## Knowledge Gaps
- **1226 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+1221 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **150 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `student_enrollment` (5× useful, score=4.967525581)
- `person_academic_record` (4× useful, score=3.971866718)
- `school-operations.tsx` (3× useful, score=2.979990636)
- `TODO.md` (3× useful, score=2.979990636)
- `progressReportPath` (2× useful, score=1.986867934) _(code changed — re-verify)_
- `academic_class_master` (2× useful, score=1.986680497)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `URLPattern` connect `URLPattern` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `R2ObjectBody` connect `R2ObjectBody` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `ReadableStreamBYOBRequest` connect `ReadableStreamBYOBRequest` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _1226 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0023501762632197414 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0909456740442656 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._