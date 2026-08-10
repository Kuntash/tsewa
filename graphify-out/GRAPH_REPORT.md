# Graph Report - tsewa  (2026-08-11)

## Corpus Check
- 71 files · ~95,355 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2371 nodes · 2761 edges · 189 communities (39 shown, 150 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c867aaaf`
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
- button.tsx
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
- badge.tsx
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
- better-auth
- @hugeicons/core-free-icons
- @hugeicons/react
- react-dom
- tailwind-merge
- pre-commit
- install-git-hooks.sh

## God Nodes (most connected - your core abstractions)
1. `cn()` - 50 edges
2. `Event` - 25 edges
3. `scripts` - 22 edges
4. `Console` - 21 edges
5. `getRuntimeEnv()` - 18 edges
6. `organization` - 17 edges
7. `compilerOptions` - 17 edges
8. `URLSearchParams` - 16 edges
9. `People Registry migration map` - 16 edges
10. `DurableObjectStorage` - 15 edges

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

## Communities (189 total, 150 thin omitted)

### Community 0 - "worker-configuration.d.ts"
Cohesion: 0.00
Nodes (847): AgentMemoryGetSummaryOptions, AgentMemoryGetSummaryResponse, AgentMemoryIncomingMemory, AgentMemoryIngestOptions, AgentMemoryListMemoriesOptions, AgentMemoryListMemoriesResult, AgentMemoryMemory, AgentMemoryMemoryListEntry (+839 more)

### Community 1 - "server.ts"
Cohesion: 0.11
Nodes (54): AuthOptions, createAuth(), getRuntimeEnv(), SecretBindings, acceptInvitation(), acceptInvitationForCurrentUser(), auditAccountAction(), auditStatement() (+46 more)

### Community 2 - "ServiceWorkerGlobalScope"
Cohesion: 0.04
Nodes (7): AbortSignal, EventSource, EventTarget, MessagePort, ServiceWorkerGlobalScope, WebSocket, WorkerGlobalScope

### Community 3 - "Event"
Cohesion: 0.04
Nodes (12): CloseEvent, CustomEvent, EmailEvent, ErrorEvent, Event, ExtendableEvent, FetchEvent, MessageEvent (+4 more)

### Community 4 - "index.tsx"
Cohesion: 0.12
Nodes (20): AccountSettings(), AccountSettingsProps, Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader() (+12 more)

### Community 5 - "scripts"
Cohesion: 0.06
Nodes (33): devDependencies, vite-plus, engines, node, license, name, packageManager, private (+25 more)

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
Cohesion: 0.11
Nodes (19): emptyRegistry, formatDate(), PeopleRegistry(), PeopleResults(), PersonKind, PersonRow, PersonStatus, RegistryResponse (+11 more)

### Community 14 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, class-variance-authority, clsx, @fontsource-variable/dm-sans, @fontsource-variable/inter, lucide-react, radix-ui, react (+15 more)

### Community 15 - "person-profile-sheet.tsx"
Cohesion: 0.12
Nodes (17): capitalize(), FamilyProfileSection(), formatBytes(), formatLegacyDate(), formatTimestamp(), initials(), isFutureSourceDate(), PersonFilesSection() (+9 more)

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

### Community 54 - "button.tsx"
Cohesion: 0.43
Nodes (5): readTheme(), Theme, ThemeToggle(), Button(), buttonVariants

### Community 60 - "Tsewa"
Cohesion: 0.29
Nodes (6): Cloudflare resources, License, Local development, THF deployment, Tsewa, Workspace

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
Cohesion: 0.33
Nodes (5): Account and email follow-ups, Documents and media migration, Invitation UX follow-ups, People Registry migration, Tsewa TODO

### Community 142 - "import-person-files.mjs"
Cohesion: 0.07
Nodes (40): buildImportSql(), confirmedDatabaseId, database, expectedFileCount, hashR2Object(), identifier, options, organizationSlug (+32 more)

### Community 178 - "organization"
Cohesion: 0.13
Nodes (23): academic_session, "account", audit_event, organization, organization_member, "session", "user", user_preference (+15 more)

### Community 179 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, cf-typegen, db:migrate:local, db:migrate:remote, deploy, dev, generate-routes (+2 more)

### Community 180 - "web/package.json"
Cohesion: 0.33
Nodes (5): imports, license, name, private, type

### Community 181 - "Person files migration"
Cohesion: 0.33
Nodes (5): Access control, Dry run, One-person pilot, Person files migration, Preservation policy

## Knowledge Gaps
- **1110 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+1105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **150 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `URLSearchParams` connect `URLSearchParams` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `Container` connect `Container` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Table` connect `Table` to `worker-configuration.d.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _1110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker-configuration.d.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0023501762632197414 - nodes in this community are weakly interconnected._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `ServiceWorkerGlobalScope` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._