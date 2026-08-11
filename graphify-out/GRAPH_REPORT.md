# Graph Report - tsewa  (2026-08-11)

## Corpus Check
- 117 files · ~192,945 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4497 nodes · 5365 edges · 365 communities (77 shown, 288 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `94c051dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/worker-configuration.d.ts
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
- Q: Remove redundant profile edit controls, add document and photo upload, naming, replacement and removal, and verify whether R2 migration is complete
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
- After v0: real historical use, but not recent use
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
- r2-relay/worker-configuration.d.ts
- person-files-dry-run.mjs
- School Operations vertical slice
- import-school-operations.mjs
- sqlLiteral
- Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?
- import-student-enrollments.mjs
- student-enrollment-dry-run.mjs
- enrollment-change-sheet.tsx
- Q: So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?
- Q: Okay whats next?
- Q: what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?
- Q: How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?
- Q: why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application.
- Product language
- class-master-reconciliation.md
- Q: can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely.
- @fontsource-variable/dm-sans
- import-historical-results.mjs
- Q: whats next slice? while the migration is ongoing?
- Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that.
- Message
- ServiceWorkerGlobalScope
- Event
- Console
- TransformStream
- URL
- compilerOptions
- URLSearchParams
- DurableObjectStorage
- Container
- Element
- Headers
- SubtleCrypto
- Blob
- Body
- FormData
- URLPattern
- DurableObjectState
- WorkerEntrypoint
- StreamError
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
- Ai
- AiSearchNamespace
- ReadableStreamBYOBReader
- VectorizeIndex
- WorkflowInstance
- index.ts
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
- MessageBatch
- NodeStyleServer
- historical-results.tsx
- RequestInitCfPropertiesVaryHeader
- SqlStorage
- ToMarkdownService
- Tracing
- WorkerLoader
- WorkerStub
- WorkflowStep
- WritableStreamDefaultController
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
- Practice school
- PipelineTransformationEntrypoint

## God Nodes (most connected - your core abstractions)
1. `cn()` - 50 edges
2. `getRuntimeEnv()` - 37 edges
3. `organization` - 32 edges
4. `scripts` - 32 edges
5. `fetch()` - 29 edges
6. `methodNotAllowed()` - 28 edges
7. `getMembershipContext()` - 26 edges
8. `Event` - 25 edges
9. `Event` - 25 edges
10. `unauthorized()` - 24 edges

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

## Communities (365 total, 288 thin omitted)

### Community 0 - "web/worker-configuration.d.ts"
Cohesion: 0.00
Nodes (847): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+839 more)

### Community 1 - "server.ts"
Cohesion: 0.07
Nodes (104): AuthOptions, createAuth(), getRuntimeEnv(), SecretBindings, acceptInvitation(), acceptInvitationForCurrentUser(), addHomePlacement(), addPersonFile() (+96 more)

### Community 2 - "ServiceWorkerGlobalScope"
Cohesion: 0.04
Nodes (7): AbortSignal, EventSource, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 3 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 4 - "index.tsx"
Cohesion: 0.14
Nodes (18): AccountSettings(), AccountSettingsProps, Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader() (+10 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (43): devDependencies, vite-plus, engines, node, license, name, packageManager, private (+35 more)

### Community 6 - "cn"
Cohesion: 0.12
Nodes (18): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+10 more)

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
Cohesion: 0.14
Nodes (14): emptyRegistry, formatDate(), PeopleResults(), PersonKind, PersonRow, PersonStatus, RegistryResponse, readTheme() (+6 more)

### Community 14 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, better-auth, class-variance-authority, clsx, @fontsource-variable/inter, lucide-react, radix-ui, react (+15 more)

### Community 15 - "person-profile-sheet.tsx"
Cohesion: 0.12
Nodes (22): capitalize(), FamilyProfileSection(), fileCategoryLabel(), formatBytes(), formatDate(), initials(), isFutureSourceDate(), localDateInput() (+14 more)

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
Cohesion: 0.09
Nodes (17): AcademicSession, CountOption, emptyStudents, EnrollmentStatusBadge(), enrollmentStatusLabel(), handleLoadError(), OverviewResponse, parseResponse() (+9 more)

### Community 60 - "Tsewa"
Cohesion: 0.29
Nodes (6): Cloudflare resources, License, Local development, THF deployment, Tsewa, Workspace

### Community 111 - "class-master-dry-run.mjs"
Cohesion: 0.24
Nodes (11): candidateScore(), canonicalName(), clean(), cleanSection(), compareCandidates(), database, options, outputPath (+3 more)

### Community 113 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 126 - "Q: Remove redundant profile edit controls, add document and photo upload, naming, replacement and removal, and verify whether R2 migration is complete"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Remove redundant profile edit controls, add document and photo upload, naming, replacement and removal, and verify whether R2 migration is complete, Source Nodes

### Community 130 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

### Community 138 - "Family and relationship migration"
Cohesion: 0.29
Nodes (6): Deployment record, Editing policy, Family and relationship migration, Local workflow, Remote gate, Source tables

### Community 139 - "After v0: real historical use, but not recent use"
Cohesion: 0.08
Nodes (23): Academic marks and results, After v0: real historical use, but not recent use, Data completion before v0 sign-off, Do not build without confirmation, Evidence snapshot, Health and dispensary, How to read this checklist, Legacy feature parity (+15 more)

### Community 142 - "import-person-files.mjs"
Cohesion: 0.09
Nodes (25): chunkSize, concurrency, confirmedDatabaseId, database, delay(), executeD1Import(), expectedFileCount, hashR2Object() (+17 more)

### Community 178 - "organization"
Cohesion: 0.11
Nodes (38): academic_session, "account", audit_event, organization, organization_member, "session", "user", user_preference (+30 more)

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

### Community 189 - "r2-relay/worker-configuration.d.ts"
Cohesion: 0.00
Nodes (847): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+839 more)

### Community 190 - "person-files-dry-run.mjs"
Cohesion: 0.12
Nodes (14): database, options, outputPath, repositoryRoot, sourcePath, DEFAULT_SOURCE_DATABASE, parseArguments(), assertAggregateOnly() (+6 more)

### Community 191 - "School Operations vertical slice"
Cohesion: 0.29
Nodes (6): Academic-session behavior, API boundary, Import result, School Operations vertical slice, Slice 1: read-only students, Slice 2: session enrollments and class rosters

### Community 192 - "import-school-operations.mjs"
Cohesion: 0.11
Nodes (19): buildImportSql(), buildUpsert(), chunkedUpserts(), confirmedDatabaseId, database, optionalInteger(), optionalText(), options (+11 more)

### Community 193 - "sqlLiteral"
Cohesion: 0.29
Nodes (10): add(), buildSql(), sqlValue(), buildImportSql(), readImportedFiles(), buildImportSql(), buildUpsert(), chunkedUpserts() (+2 more)

### Community 194 - "Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?, Source Nodes

### Community 195 - "import-student-enrollments.mjs"
Cohesion: 0.12
Nodes (23): confirmedDatabaseId, database, offeringId(), optionalText(), options, organizationSlug, readEnrollments(), readOfferings() (+15 more)

### Community 196 - "student-enrollment-dry-run.mjs"
Cohesion: 0.18
Nodes (8): sha256File(), assertAggregateOnly(), database, options, outputPath, repositoryRoot, sourcePath, visit()

### Community 197 - "enrollment-change-sheet.tsx"
Cohesion: 0.10
Nodes (22): AdmissionSheet(), Option, Setup, Action, actions, Change, changeDescription(), changeLabel() (+14 more)

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

### Community 207 - "import-historical-results.mjs"
Cohesion: 0.12
Nodes (16): confirmedDatabaseId, database, id(), optionalNumber(), optionalText(), options, organizationSlug, readData() (+8 more)

### Community 208 - "Q: whats next slice? while the migration is ongoing?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: whats next slice? while the migration is ongoing?, Source Nodes

### Community 209 - "Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that., Source Nodes

### Community 211 - "ServiceWorkerGlobalScope"
Cohesion: 0.04
Nodes (7): AbortSignal, EventSource, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 212 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 214 - "TransformStream"
Cohesion: 0.10
Nodes (7): CompressionStream, DecompressionStream, FixedLengthStream, IdentityTransformStream, TextDecoderStream, TextEncoderStream, TransformStream

### Community 216 - "compilerOptions"
Cohesion: 0.11
Nodes (18): src/**/*.ts, ./worker-configuration.d.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleResolution, noEmit (+10 more)

### Community 224 - "Body"
Cohesion: 0.15
Nodes (3): Body, Request, Response

### Community 229 - "StreamError"
Cohesion: 0.18
Nodes (11): AlreadyUploadedError, BadRequestError, ForbiddenError, InternalError, InvalidURLError, MaxFileSizeError, NotFoundError, QuotaReachedError (+3 more)

### Community 233 - "ByteLengthQueuingStrategy"
Cohesion: 0.22
Nodes (3): ByteLengthQueuingStrategy, CountQueuingStrategy, QueuingStrategy

### Community 250 - "index.ts"
Cohesion: 0.53
Nodes (5): CopyInstruction, fetch(), hasValidToken(), hexToBytes(), parseInstruction()

### Community 302 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 318 - "historical-results.tsx"
Cohesion: 0.08
Nodes (27): formatMark(), HistoricalResults(), message(), Option, Overview, parse(), ResultRow, Results (+19 more)

### Community 319 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

### Community 360 - "Practice school"
Cohesion: 0.50
Nodes (3): Editing a person, Editing family and siblings, Practice school

## Knowledge Gaps
- **2135 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+2130 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **288 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `student_enrollment` (6× useful, score=5.931049444)
- `TODO.md` (4× useful, score=3.955665637) _(code changed — re-verify)_
- `person_academic_record` (4× useful, score=3.947584026)
- `school-operations.tsx` (3× useful, score=2.961771949)
- `academic_session` (2× useful, score=1.981849698)
- `progressReportPath` (2× useful, score=1.974720874)
- `academic_class_master` (2× useful, score=1.974534583)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FormData` connect `FormData` to `web/worker-configuration.d.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `FormData` connect `FormData` to `r2-relay/worker-configuration.d.ts`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `URL` connect `URL` to `web/worker-configuration.d.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _2135 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0023501762632197414 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06593977154724819 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._