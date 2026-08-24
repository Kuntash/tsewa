# Graph Report - tsewa  (2026-08-24)

## Corpus Check
- 268 files · ~286,224 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5766 nodes · 8273 edges · 430 communities (128 shown, 302 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1db9593b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/worker-configuration.d.ts
- staff-repository.ts
- ServiceWorkerGlobalScope
- Event
- staff-operations.tsx
- scripts
- cn
- import-academic-history.mjs
- import-family-relationships.mjs
- import-people-registry.mjs
- devDependencies
- compilerOptions
- import-placement-history.mjs
- sponsorship-operations.tsx
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
- Q: lets do 1, and 3 first, then 2 and 5.
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
- api-handlers.ts
- Q: What is the next feature slice after printable school reports?
- relations.ts
- getRuntimeEnv
- pre-commit
- install-git-hooks.sh
- r2-relay/worker-configuration.d.ts
- DEFAULT_SOURCE_DATABASE
- School Operations vertical slice
- import-school-operations.mjs
- import-health-history.mjs
- Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?
- import-student-enrollments.mjs
- student-enrollment-dry-run.mjs
- school-master-data.tsx
- Q: So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?
- Q: Okay whats next?
- Q: what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?
- Q: How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?
- Q: why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application.
- Product language
- class-master-reconciliation.md
- Q: can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely.
- Q: Why are Save name, Replace, and Remove disabled on legacy data? They should be editable; test only in the other organization.
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
- scholarship-operations.tsx
- Crypto
- D1DatabaseSession
- historical-results.tsx
- academic-configuration.tsx
- HTMLRewriterElementContentHandlers
- ImageTransformationResult
- ImageTransformer
- import-sponsorship-history.mjs
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
- Q: whats next?
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
- Message
- import-scholarship-history.mjs
- Q: great, continue with the next parity slice?
- import-staff-operations.mjs
- Q: continue
- Q: continue
- index.tsx
- PerformanceResourceTiming
- Q: continue, make sure the printable design aligns and looks professional.
- writeRoute
- file-route.ts
- changeStudentEnrollment
- patchRoute
- ExtendableEvent
- ExtendableEvent
- getSchoolSessionScope
- clsx
- EventSource
- EventCounts
- AbortSignal
- readPatchRoute
- FileRoutesByPath
- router.tsx
- EventTarget
- WebSocket
- optionalString
- MessagePort
- PerformanceObserver
- Q: whats the current status, and what should be the next slice that we should work on?
- Q: Redefine v0 as full legacy operational parity; include database-backed features, RBAC, and Everlittle-style email invitations
- Route
- Immediate
- PerformanceObserverEntryList
- health-operations.tsx
- sqlLiteral
- @hugeicons/core-free-icons
- react
- react-day-picker
- enrollment-change-sheet.tsx
- settings.$tab.tsx
- api.organization.invitations.$invitationId.ts
- package.json
- person-files-dry-run.mjs
- EndTag
- HostedImagesBinding
- tailwind-merge
- Q: continue working on this
- Q: continue until you are done with all drizzle migration
- Q: continue to next
- Q: whats next
- invite.$token.tsx
- Cache
- MediaTransformationResult
- Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance
- Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance
- Q: what is next?
- AiSearchJobs
- zod

## God Nodes (most connected - your core abstractions)
1. `getRuntimeEnv()` - 82 edges
2. `organization` - 78 edges
3. `FileRoutesByPath` - 76 edges
4. `forbidden()` - 72 edges
5. `hasPermission()` - 68 edges
6. `methodNotAllowed()` - 63 edges
7. `getMembershipContext()` - 60 edges
8. `unauthorized()` - 58 edges
9. `cn()` - 56 edges
10. `scripts` - 42 edges

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

## Communities (430 total, 302 thin omitted)

### Community 0 - "web/worker-configuration.d.ts"
Cohesion: 0.00
Nodes (862): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+854 more)

### Community 1 - "staff-repository.ts"
Cohesion: 0.13
Nodes (17): createDatabase(), Database, person, personImportBatch, staffCategory, staffDepartment, staffDesignation, staffProfile (+9 more)

### Community 3 - "Event"
Cohesion: 0.06
Nodes (6): CloseEvent, CustomEvent, ErrorEvent, Event, MessageEvent, PromiseRejectionEvent

### Community 4 - "staff-operations.tsx"
Cohesion: 0.11
Nodes (17): CatalogItem, dateInput(), Designation, emptyState, legacyLabel(), nullable(), nullableChoice(), StaffEditor() (+9 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (42): scripts, build, cf-typegen, db:migrate:local, db:migrate:remote, deploy, dev, graph:update (+34 more)

### Community 6 - "cn"
Cohesion: 0.11
Nodes (25): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Button(), buttonVariants (+17 more)

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
Cohesion: 0.07
Nodes (29): devDependencies, @cloudflare/vite-plugin, drizzle-kit, tailwindcss, @tailwindcss/vite, @tanstack/router-cli, tw-animate-css, @types/node (+21 more)

### Community 11 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+16 more)

### Community 12 - "import-placement-history.mjs"
Cohesion: 0.10
Nodes (18): buildImportSql(), confirmedDatabaseId, database, optionalText(), options, organizationSlug, rawSql(), readPlacements() (+10 more)

### Community 13 - "sponsorship-operations.tsx"
Cohesion: 0.09
Nodes (36): Allocation, AssignmentFields(), CorrespondenceFields(), csvCell(), displayDate(), downloadCsv(), emptyList, field() (+28 more)

### Community 14 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, better-auth, class-variance-authority, drizzle-orm, @fontsource-variable/dm-sans, @fontsource-variable/inter, @hugeicons/react, lucide-react (+17 more)

### Community 15 - "person-profile-sheet.tsx"
Cohesion: 0.07
Nodes (36): emptyFamily, FamilyForm, familyToForm(), PersonFamilyEditor(), PersonOption, writeSibling(), academicRecordMatchesEnrollment(), capitalize() (+28 more)

### Community 16 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "routeTree.gen.ts"
Cohesion: 0.02
Nodes (116): ApiAuthSplatRoute, ApiDashboardRoute, ApiFilesFileIdRoute, ApiHealthAdvancesRoute, ApiHealthHistoryRoute, ApiHealthTbRoute, ApiInvitationsAcceptRoute, ApiInvitationsPreviewRoute (+108 more)

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
Nodes (22): EditableSchool, SchoolEditorSheet(), AcademicSession, CountOption, emptyStudents, EnrollmentStatusBadge(), enrollmentStatusLabel(), handleLoadError() (+14 more)

### Community 60 - "Tsewa"
Cohesion: 0.29
Nodes (6): Cloudflare resources, License, Local development, THF deployment, Tsewa, Workspace

### Community 90 - "Q: lets do 1, and 3 first, then 2 and 5."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: lets do 1, and 3 first, then 2 and 5., Source Nodes

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

### Community 139 - "Tsewa TODO"
Cohesion: 0.08
Nodes (24): Academic marks and results, Data completion before v0 sign-off, Do not build without confirmation, Evidence snapshot, Health and dispensary, How to read this checklist, Legacy feature parity, People and current records (+16 more)

### Community 142 - "import-person-files.mjs"
Cohesion: 0.09
Nodes (25): chunkSize, concurrency, confirmedDatabaseId, database, delay(), executeD1Import(), expectedFileCount, hashR2Object() (+17 more)

### Community 178 - "organization"
Cohesion: 0.06
Nodes (87): academic_session, "account", audit_event, organization, organization_member, "session", "user", user_preference (+79 more)

### Community 179 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, cf-typegen, db:migrate:local, db:migrate:remote, deploy, dev, generate-routes (+3 more)

### Community 180 - "web/package.json"
Cohesion: 0.33
Nodes (5): imports, license, name, private, type

### Community 181 - "Person files migration"
Cohesion: 0.29
Nodes (6): Access control, Dry run, One-person pilot, Person files migration, Preservation policy, Resumable bulk import

### Community 182 - "school-operations-dry-run.mjs"
Cohesion: 0.18
Nodes (7): assertAggregateOnly(), database, options, outputPath, repositoryRoot, sourcePath, visit()

### Community 183 - "api-handlers.ts"
Cohesion: 0.02
Nodes (112): AccessGroupKey, AccessRoleKey, groupCatalog, groupLabel(), groupRoleDefaults, permissionCatalog, PermissionKey, roleCatalog (+104 more)

### Community 184 - "Q: What is the next feature slice after printable school reports?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: What is the next feature slice after printable school reports?, Source Nodes

### Community 185 - "relations.ts"
Cohesion: 0.02
Nodes (134): academicAssessmentRelations, academicClassMasterRelations, academicSessionRelations, academicSubjectRelations, academicTermRelations, accessGroupRelations, accessGroupRoleRelations, accessPermissionRelations (+126 more)

### Community 186 - "getRuntimeEnv"
Cohesion: 0.12
Nodes (89): getRuntimeEnv(), acceptInvitationForCurrentUser(), addHomePlacement(), addPersonFile(), addSiblingRelationship(), auditInsert(), changeMarkSheetStatus(), correctEnrollmentEndDetails() (+81 more)

### Community 189 - "r2-relay/worker-configuration.d.ts"
Cohesion: 0.00
Nodes (847): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+839 more)

### Community 190 - "DEFAULT_SOURCE_DATABASE"
Cohesion: 0.05
Nodes (33): db, options, outputPath, root, sourcePath, database, options, outputPath (+25 more)

### Community 191 - "School Operations vertical slice"
Cohesion: 0.29
Nodes (6): Academic-session behavior, API boundary, Import result, School Operations vertical slice, Slice 1: read-only students, Slice 2: session enrollments and class rosters

### Community 192 - "import-school-operations.mjs"
Cohesion: 0.11
Nodes (19): buildImportSql(), buildUpsert(), chunkedUpserts(), confirmedDatabaseId, database, optionalInteger(), optionalText(), options (+11 more)

### Community 193 - "import-health-history.mjs"
Cohesion: 0.12
Nodes (22): add(), buildSql(), confirmedDatabaseId, database, gender(), optionalDate(), optionalInteger(), optionalNumber() (+14 more)

### Community 194 - "Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: I believe the marks sections is not that useful as its old data and no edits has been done after that. anyways what is the next steps?, Source Nodes

### Community 195 - "import-student-enrollments.mjs"
Cohesion: 0.11
Nodes (24): id(), id(), confirmedDatabaseId, database, offeringId(), optionalText(), options, organizationSlug (+16 more)

### Community 196 - "student-enrollment-dry-run.mjs"
Cohesion: 0.20
Nodes (7): assertAggregateOnly(), database, options, outputPath, repositoryRoot, sourcePath, visit()

### Community 197 - "school-master-data.tsx"
Cohesion: 0.08
Nodes (26): AssignmentData, AssignmentOption, filterOptions(), SchoolAssignmentsSheet(), AcademicClass, classStage(), Editor, House (+18 more)

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

### Community 206 - "Q: Why are Save name, Replace, and Remove disabled on legacy data? They should be editable; test only in the other organization."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why are Save name, Replace, and Remove disabled on legacy data? They should be editable; test only in the other organization., Source Nodes

### Community 207 - "import-historical-results.mjs"
Cohesion: 0.11
Nodes (19): add(), buildSql(), confirmedDatabaseId, database, id(), optionalNumber(), optionalText(), options (+11 more)

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
Cohesion: 0.06
Nodes (6): CloseEvent, CustomEvent, ErrorEvent, Event, MessageEvent, PromiseRejectionEvent

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

### Community 282 - "scholarship-operations.tsx"
Cohesion: 0.12
Nodes (25): AnnualEditor(), csvCell(), Detail, downloadCsv(), emptyList, formatDate(), formText(), ListData (+17 more)

### Community 285 - "historical-results.tsx"
Cohesion: 0.09
Nodes (29): formatMark(), HistoricalResults(), message(), Option, Overview, parse(), ResultRow, Results (+21 more)

### Community 286 - "academic-configuration.tsx"
Cohesion: 0.10
Nodes (14): AcademicConfiguration(), AcademicConfigurationProps, blankSubject(), Catalog, CatalogWorkspace(), Data, formText(), Grade (+6 more)

### Community 290 - "import-sponsorship-history.mjs"
Cohesion: 0.11
Nodes (28): add(), addCatalog(), booleanNumber(), buildSql(), catalog(), confirmedDatabaseId, database, displayName() (+20 more)

### Community 302 - "BasicImageTransformations"
Cohesion: 0.67
Nodes (3): BasicImageTransformations, RequestInitCfPropertiesImage, RequestInitCfPropertiesImageDraw

### Community 318 - "Q: whats next?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: whats next?, Source Nodes

### Community 319 - "RequestInitCfPropertiesVaryHeader"
Cohesion: 0.67
Nodes (3): RequestInitCfPropertiesVaryAcceptHeader, RequestInitCfPropertiesVaryAcceptLanguageHeader, RequestInitCfPropertiesVaryHeader

### Community 360 - "Practice school"
Cohesion: 0.50
Nodes (3): Editing a person, Editing family and siblings, Practice school

### Community 366 - "import-scholarship-history.mjs"
Cohesion: 0.11
Nodes (26): add(), booleanNumber(), buildSql(), confirmedDatabaseId, database, gender(), id(), optionalDate() (+18 more)

### Community 367 - "Q: great, continue with the next parity slice?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: great, continue with the next parity slice?, Source Nodes

### Community 368 - "import-staff-operations.mjs"
Cohesion: 0.12
Nodes (19): addRows(), buildSql(), confirmedDatabaseId, database, id(), optionalDate(), optionalText(), options (+11 more)

### Community 369 - "Q: continue"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: continue, Source Nodes

### Community 370 - "Q: continue"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: continue, Source Nodes

### Community 372 - "index.tsx"
Cohesion: 0.05
Nodes (52): AccountSettings(), AccountSettingsProps, emptyRegistry, formatDate(), PeopleFilters, PeopleResults(), PersonKind, PersonRow (+44 more)

### Community 373 - "PerformanceResourceTiming"
Cohesion: 0.06
Nodes (5): PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceNodeTiming, PerformanceResourceTiming

### Community 374 - "Q: continue, make sure the printable design aligns and looks professional."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: continue, make sure the printable design aligns and looks professional., Source Nodes

### Community 375 - "writeRoute"
Cohesion: 0.09
Nodes (12): writeRoute, Route, Route, Route, Route, Route, Route, Route (+4 more)

### Community 376 - "file-route.ts"
Cohesion: 0.06
Nodes (24): handleApiRequest(), readPutRoute, readRoute, readWriteDeleteRoute, Route, Route, Route, Route (+16 more)

### Community 377 - "changeStudentEnrollment"
Cohesion: 0.60
Nodes (5): changeStudentEnrollment(), getStudentEnrollment(), handleStudentEnrollment(), isOpenEnrollment(), readStudentEnrollment()

### Community 378 - "patchRoute"
Cohesion: 0.12
Nodes (9): patchRoute, Route, Route, Route, Route, Route, Route, Route (+1 more)

### Community 379 - "ExtendableEvent"
Cohesion: 0.17
Nodes (6): EmailEvent, ExtendableEvent, FetchEvent, QueueEvent, ScheduledEvent, TailEvent

### Community 380 - "ExtendableEvent"
Cohesion: 0.17
Nodes (6): EmailEvent, ExtendableEvent, FetchEvent, QueueEvent, ScheduledEvent, TailEvent

### Community 381 - "getSchoolSessionScope"
Cohesion: 0.20
Nodes (21): academicClassName(), academicClassRowName(), buildSchoolStudentFilters(), canonicalMasterName(), classDisplayName(), createAcademicClassMaster(), getSchoolAssignments(), getSchoolMasterData() (+13 more)

### Community 386 - "readPatchRoute"
Cohesion: 0.18
Nodes (6): readPatchRoute, Route, Route, Route, Route, Route

### Community 387 - "FileRoutesByPath"
Cohesion: 0.09
Nodes (17): readWriteRoute, Route, Route, Route, Route, Route, Route, Route (+9 more)

### Community 388 - "router.tsx"
Cohesion: 0.33
Nodes (5): getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 391 - "optionalString"
Cohesion: 0.18
Nodes (12): optionalEnum(), optionalPage(), optionalString(), Route, Route, AuthenticatedApp(), Route, Route (+4 more)

### Community 394 - "Q: whats the current status, and what should be the next slice that we should work on?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: whats the current status, and what should be the next slice that we should work on?, Source Nodes

### Community 395 - "Q: Redefine v0 as full legacy operational parity; include database-backed features, RBAC, and Everlittle-style email invitations"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Redefine v0 as full legacy operational parity; include database-backed features, RBAC, and Everlittle-style email invitations, Source Nodes

### Community 399 - "health-operations.tsx"
Cohesion: 0.13
Nodes (20): emptyHealth, emptyMedicalAdvances, emptyTb, formatCurrency(), formatDate(), formatPeriod(), HealthFilters, HealthOperations() (+12 more)

### Community 400 - "sqlLiteral"
Cohesion: 0.13
Nodes (19): add(), buildSql(), db, options, report, reportPath, root, slug (+11 more)

### Community 404 - "enrollment-change-sheet.tsx"
Cohesion: 0.06
Nodes (42): AdmissionSheet(), Option, optionsForSchool(), Setup, Action, actions, Change, changeDescription() (+34 more)

### Community 407 - "settings.$tab.tsx"
Cohesion: 0.33
Nodes (4): RoutedAppSearch, SettingsTab, Route, tabs

### Community 410 - "api.organization.invitations.$invitationId.ts"
Cohesion: 0.18
Nodes (6): deleteRoute, patchDeleteRoute, Route, Route, Route, Route

### Community 411 - "package.json"
Cohesion: 0.17
Nodes (11): devDependencies, vite-plus, engines, node, license, name, packageManager, private (+3 more)

### Community 412 - "person-files-dry-run.mjs"
Cohesion: 0.25
Nodes (7): assertAggregateOnly(), database, options, outputPath, repositoryRoot, sourcePath, visit()

### Community 416 - "Q: continue working on this"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: continue working on this, Source Nodes

### Community 417 - "Q: continue until you are done with all drizzle migration"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: continue until you are done with all drizzle migration, Source Nodes

### Community 418 - "Q: continue to next"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: continue to next, Source Nodes

### Community 419 - "Q: whats next"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: whats next, Source Nodes

### Community 424 - "Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance, Source Nodes

### Community 425 - "Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance, Source Nodes

### Community 426 - "Q: what is next?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: what is next?, Source Nodes

## Knowledge Gaps
- **2574 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+2569 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **302 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `school-operations.tsx` (8× useful, score=6.358797023) _(code changed — re-verify)_
- `student_enrollment` (6× useful, score=4.704948802)
- `TODO.md` (4× useful, score=3.137927693) _(code changed — re-verify)_
- `person_academic_record` (4× useful, score=3.131516759)
- `FileRoutesByPath` (3× useful, score=2.995180934) _(code changed — re-verify)_
- `academic_class_master` (3× useful, score=2.360050127)
- `account-settings.tsx` (2× useful, score=1.996513728)
- `Practice school` (2× useful, score=1.628259017)
- `RosterRow` (2× useful, score=1.577209498) _(code changed — re-verify)_
- `academic_session` (2× useful, score=1.572150333)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AbortSignal` connect `AbortSignal` to `web/worker-configuration.d.ts`, `scholarship-operations.tsx`, `EventTarget`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `HistoricalResults()` connect `historical-results.tsx` to `scholarship-operations.tsx`, `school-operations.tsx`, `health-operations.tsx`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `ScholarshipOperations()` connect `scholarship-operations.tsx` to `index.tsx`, `health-operations.tsx`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _2574 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0023094688221709007 - nodes in this community are weakly interconnected._
- **Should `staff-repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12554112554112554 - nodes in this community are weakly interconnected._
- **Should `Event` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._