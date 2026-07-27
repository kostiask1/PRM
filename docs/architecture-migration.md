# Architecture Migration Roadmap

This document is the source of truth for the incremental migration from the
legacy component-oriented frontend to Feature-Sliced Design (FSD). Each phase
must leave the application usable, keep stable IDs and local filesystem data
unchanged, and add enforcement before the next slice is migrated.

## Target Architecture

Frontend dependencies flow downward:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Not every layer must exist for every domain. A slice exposes a small public API
from `index.js` or explicit segment entry points such as `api.js` and `ui.js`;
code outside that slice must not deep-import its implementation. Segment entry
points keep API-only consumers from initializing UI dependency graphs.
Legacy `src/components` and `src/utils` remain migration sources, not
destinations for new cross-domain coupling. The legacy `src/hooks` and
`src/services` folders have been retired.
`src/models` has been removed.

API ownership is split in two:

- `src/shared/api` owns HTTP transport, headers, response parsing, and errors.
- Domain slices such as `src/entities/bestiary/api` own endpoint paths and
  request/response operations.

## Phase Status

### Phase 0 — Baseline and dependency map (complete)

- Captured the legacy frontend and API dependency graph.
- Confirmed one monolithic `src/api.js`.
- Confirmed three circular dependencies, all sharing the edge
  `RulesReferenceModalContent -> Bestiary`.
- Established Fallow as the repeatable architecture health check.

Exit evidence: baseline contained three cycles and no configured import
boundaries.

### Phase 1 — Shared transport and Bestiary API split (complete)

- Moved HTTP request and blob handling to `src/shared/api`.
- Added the Bestiary domain API at `src/entities/bestiary/api`.
- Migrated all Bestiary endpoint consumers to `bestiaryApi`.
- Removed Bestiary endpoint ownership from the legacy `src/api.js` facade.

The legacy facade remains for unmigrated domains and delegates transport to the
shared client.

### Phase 2 — Bestiary FSD pilot (complete)

- Moved Bestiary screen orchestration to
  `src/features/bestiary/ui/Bestiary.jsx`.
- Added `src/features/bestiary/index.js` as its public API.
- Updated encounter integration to consume that public API.
- Kept leaf Bestiary components in their legacy locations temporarily; moving
  them is Phase 4 work.

### Phase 3 — Break cycles and enforce boundaries (complete)

- Replaced the rules modal's full Bestiary embedding with its existing
  lightweight creature list and `MonsterStatBlock` detail view.
- Preserved creature search, detailed search, selection history, insertion, and
  stat-block display.
- Removed all three known dependency cycles.
- Enabled Fallow's `feature-sliced` boundary preset.
- Added ESLint restrictions against deep imports into Bestiary, shared API, and
  feature UI internals.
- Added `npm run check:architecture` as the architecture gate.

Exit evidence: Fallow reports zero dead-code, unresolved-import, circular
dependency, re-export cycle, and boundary violations.

### Phase 4 — Finish Bestiary UI ownership (complete)

- Moved Bestiary list, AI modals, and action flows from
  `src/components/bestiary` to `src/features/bestiary/ui`.
- Moved the reusable monster field editor to `src/entities/bestiary/ui`.
- Kept the generic `MonsterStatBlock` renderer reusable in the legacy layer
  until its model dependencies can migrate together.
- Replaced external Bestiary UI imports with feature/entity public APIs.
- Updated source-level regression checks for the lightweight rules-reference
  browser and new slice paths.

Exit evidence:

- No Bestiary-owned implementation remains under
  `src/components/bestiary`.
- External consumers import only `src/features/bestiary/index.js`,
  `src/entities/bestiary/api.js`, or `src/entities/bestiary/ui.js`.
- Architecture, lint, and encoding gates pass.

### Phase 5 — Extract Bestiary model (complete)

- Moved monster type/search helpers and `MonsterStatBlockModel` into
  `src/entities/bestiary/model`.
- Added the Node-safe `src/entities/bestiary/model.js` public entry point.
- Migrated browser and regression-test consumers away from legacy
  `src/utils/bestiary.js` and `src/models/MonsterStatBlockModel.js`.
- Extended deep-import enforcement to entity model internals.

Exit criteria:

- Legacy Bestiary model files are removed.
- Tests can import the model public API without loading React UI.
- External consumers use `src/entities/bestiary/model.js`.

### Phase 6 — Split adjacent frontend domains (in progress)

Migrate one vertical slice at a time:

1. Spells and rules reference.
2. Images and image gallery.
3. Encounters.
4. Campaigns and sessions.
5. AI response/history operations.

For each slice: introduce domain API ownership, move pure model logic, expose a
public API, migrate consumers, remove obsolete legacy code, and pass the same
architecture gate.

#### Phase 6.1 — Spells and reference-data endpoints (complete)

- Added `src/entities/spell/api.js` and removed spell endpoint ownership from
  the legacy API facade.
- Added `src/entities/rules-reference/api.js` for conditions, diseases, variant
  rules, skills, and senses.
- Moved `SpellCardModel` and spell metadata into the spell entity.
- Moved read-only `SpellCard` UI into `src/entities/spell/ui`.
- Moved spell-browser orchestration into `src/features/spells/ui` with a public
  feature API.
- Migrated rules modal, settings, monster spell lookup, reference preview, and
  cached reference services to the new domain APIs.
- Updated regression mocks to patch domain APIs instead of the legacy facade.

#### Phase 6.2 — Reference lookup and resolution ownership (complete)

- Moved condition, disease, skill, sense, and variant-rule lookup caches into
  `src/entities/rules-reference/model`.
- Moved cross-domain creature/spell/reference preview and input resolution into
  `src/features/reference-navigation/model`.
- Added public model entry points and deep-import enforcement.
- Removed obsolete compatibility modules from `src/services` and `src/utils`.
- Migrated `RulesLink` and regression tests to the new public APIs.

Remaining before the reference slice is complete:

#### Phase 6.3 — Rules-reference composition widget (complete)

- Moved multi-domain rules-reference composition into
  `src/widgets/rules-reference`.
- Added a widget public API and deep-import enforcement.
- Removed the entity-to-modal dependency from `MonsterFieldEditModal`.
- Injected rules-reference rendering from encounter/AI composition points, so
  the Bestiary entity and feature continue to depend only downward.
- Kept the global modal host as a temporary app-shell adapter.

The Spells and rules-reference slice is now complete. Next migrate images and
image gallery, followed by encounters, campaigns/sessions, and AI operations.

#### Phase 6.4 — Images and Image Gallery (complete)

- Added `src/entities/image/api.js` and removed image endpoint ownership and
  query construction from the legacy API facade.
- Moved the image category model to `src/entities/image/model`.
- Moved gallery state/orchestration to `src/features/images/model`.
- Moved gallery, upload, target settings, and asset-field UI to
  `src/features/images/ui`.
- Added the feature public API and migrated campaign cards, scenes, sidebar,
  monster tokens, and AI attachment consumers.
- Removed legacy image components, hook, and configuration ownership.
- Updated regression imports to use the Node-safe image model public API.

The next frontend target is Encounters, followed by campaigns/sessions and AI
operations.

#### Phase 6.5 — Encounters (complete)

- Moved pure encounter participant, HP, and stable-ID logic to
  `src/entities/encounter/model`.
- Moved stateful encounter orchestration to
  `src/features/encounter/model`.
- Moved the routed composition screen to `src/pages/encounter`, where it can
  legally compose Bestiary, rules-reference, AI, image, and character flows.
- Updated `MainContent` to consume the page public API.
- Preserved the core persistence invariant: encounters remain nested inside
  session data and continue using session API operations.
- Removed legacy encounter view, hook, and utility ownership.
- Extended deep-import enforcement to page UI internals.

#### Phase 6.6 — Campaigns and Sessions (complete)

- Added separate campaign and session domain APIs at
  `src/entities/campaign/api.js` and `src/entities/session/api.js`.
- Removed campaign, entity, and session endpoint ownership from the legacy
  `src/api.js` facade and migrated all consumers to the new APIs.
- Moved campaign/session view models and pure campaign state helpers into
  entity model slices with Node-safe public entry points.
- Moved stateful campaign/session orchestration into feature model slices.
- Moved both routed screens into `src/pages/campaign` and
  `src/pages/session`; `MainContent` now consumes their public APIs.
- Removed the superseded legacy views, hooks, models, and campaign-state
  helper paths.
- Preserved autosave timing, stable IDs, nested encounter persistence, entity
  scope moves, archive flows, and route behavior.

Exit evidence:

- The legacy API facade contains no campaign, entity, or session methods.
- External consumers use only campaign/session public segment entry points.
- Fallow reports zero issues, cycles, unresolved imports, and boundary
  violations; lint and UTF-8 checks pass.

The next frontend target is AI response/history operations.

#### Phase 6.7 — AI response/history operations (complete)

Completed foundation:

- Added `src/entities/ai/api.js` and removed all AI endpoint ownership from the
  legacy API facade.
- Migrated assistant, Bestiary, Encounter, and model-loading consumers to
  `aiApi`.
- Moved attachment validation, diff construction, draft-resource transforms,
  history summaries, and route-visibility rules into
  `src/entities/ai/model` with a Node-safe public API.
- Moved AI model-option loading into `src/features/ai/model`.
- Removed superseded legacy AI API and pure-model utility ownership.

- Moved assistant, attachment, history, draft-response, model, and context UI
  into `src/widgets/ai-assistant`.
- Added a widget public API and migrated `MainContent` and Encounter page
  composition to it.
- Removed upward Bestiary dependencies by injecting assistant, attachment, and
  response-modal renderers from the Encounter page.
- Injected the rules-reference renderer into the AI widget, avoiding a
  widget-to-widget implementation dependency.
- Preserved parsed-operation schema, draft/apply/undo transitions, campaign
  scoping, retry payloads, and modal reachability.

Exit evidence:

- No AI-owned UI remains in `src/components/ai`.
- External consumers use the AI entity, feature-model, or widget public APIs.
- Fallow, lint, UTF-8, and focused AI model/API contract checks pass.

The frontend vertical-slice migration is complete. The next target is Phase 7
backend modularization.

### Phase 7 — Backend modularization

- Keep route handlers thin.
- Extract domain services from `server/storage.js` behind explicit interfaces.
- Centralize filesystem primitives and path safety in infrastructure modules.
- Separate validation, use-case orchestration, persistence, and HTTP concerns.
- Add contract tests before moving archive, scope, image-reference, or AI apply
  behavior.

#### Phase 7.1 — JSON filesystem infrastructure (complete)

- Extracted generic directory, existence, file-size, and recursive-size
  operations into `server/infrastructure/jsonFileStore.js`.
- Moved UTF-8 JSON reads, recursive `updatedAt` stripping, per-path queued
  atomic writes, temporary-file cleanup, and retrying rename behavior into the
  infrastructure module.
- Kept `server/storage.js` exports stable so routes and domain callers do not
  need compatibility adapters.
- Added a focused contract smoke covering concurrent writes, atomic final
  state, UTF-8 data, obsolete-field stripping, size traversal, and facade
  identity.

#### Phase 7.2 — Storage path policy (complete)

- Centralized storage roots and campaign, session, AI-history, and image path
  construction in `server/infrastructure/storagePaths.js`.
- Moved name sanitization, campaign slug generation, session filenames, URL
  segment encoding, and normalized relative path segments into the same policy
  module.
- Preserved the storage facade exports and exact existing path shapes.
- Added focused contracts for root parity, basename confinement, traversal
  segment removal, Ukrainian URL encoding, and facade identity.

#### Phase 7.3 — AI response repository (complete)

- Extracted AI response/resource normalization, campaign-scoped history
  ordering, legacy Bestiary-history fallback, storage stats, and CRUD into
  `server/domains/ai/aiResponseRepository.js`.
- Made the repository dependency-injectable so behavior can be verified
  without touching user-owned `data/`.
- Migrated AI routes, `AiHistoryWriter`, and AI response-history orchestration
  away from the legacy storage facade for history operations.
- Kept repository functions re-exported by `server/storage.js` for archive
  flows and temporary compatibility.
- Added an in-memory contract smoke covering normalization, sorting, fallback,
  add/update/delete/clear, missing IDs, path confinement, and facade identity.

#### Phase 7.4 — Settings repository (complete)

- Extracted application defaults, prompt-map normalization, source-list
  normalization, recovery from missing/corrupt files, and settings updates into
  `server/domains/settings/settingsRepository.js`.
- Made the repository dependency-injectable for contract checks without
  touching `data/settings.json`.
- Migrated settings routes and AI generation settings reads away from the
  legacy storage facade.
- Kept `readSettings`, `updateSettings`, and `normalizeSourceList` re-exported
  temporarily for remaining storage and campaign consumers.
- Added an in-memory contract smoke covering defaults, clamping, localization,
  source deduplication, prompt maps, normalization-on-read, and facade identity.

#### Phase 7.5 — Reference-data repositories (complete)

- Extracted spell loading, index fallback, source filtering, search matching,
  and named rules normalization into
  `server/domains/reference/referenceDataRepository.js`.
- Extracted official Bestiary source discovery, monster indexing, bundled-file
  fallback, source normalization, and legendary-group loading into
  `server/domains/bestiary/bestiaryReferenceRepository.js`.
- Reduced spell and Bestiary routes to HTTP/query orchestration; custom
  monsters and favorites remain separate from the read-only official dataset.
- Reused the Bestiary repository from the legacy storage facade so AI patching
  and route searches share one official-monster index implementation.
- Added dependency-injected repository contracts for spell search/source
  filtering, rules deduplication, source precedence, and Bestiary
  normalization without reading bundled databases.

#### Phase 7.6 — Session aggregate repository (complete)

- Extracted session listing, reads, creation, unique filenames, stable-ID
  updates/renames, deletion, and reorder persistence into
  `server/domains/session/sessionRepository.js`.
- Made filesystem, path, clock, and ID dependencies injectable so the complete
  lifecycle can be checked without touching user campaign data.
- Reduced `server/routes/sessions.js` to HTTP status handling and repository
  orchestration; it no longer imports filesystem or the legacy storage facade.
- Reused the repository's read/list/default/unique-file contracts from
  `server/storage.js` so archive, AI, and compatibility consumers retain their
  existing interface while sharing the new implementation.
- Added an in-memory lifecycle contract covering order assignment, custom data,
  filename changes, stable IDs, reorder, and delete.

#### Phase 7.7 — Campaign metadata and entity repositories (complete)

- Extracted campaign discovery, metadata reads/writes, creation, slug
  uniqueness, detailed listing, session counts, and reorder persistence into
  `server/domains/campaign/campaignRepository.js`.
- Extracted campaign-entity list/read/write/create/update/delete/bulk-replace,
  unique slugs, character/NPC moves, and display-name rules into
  `server/domains/entity/entityRepository.js`.
- Moved cross-aggregate mention rewriting into the entity repository while
  preserving updates across campaign metadata, all three entity collections,
  and every session.
- Preserved stable campaign/entity IDs, location and character defaults,
  ordering rules, basename confinement, and collision suffixes.
- Reduced campaign route persistence orchestration for list/create/reorder and
  all entity endpoints. Campaign rename/delete/export remain on the legacy
  facade until image and archive services are isolated.
- Reused both repositories from `server/storage.js`, removing the superseded
  metadata/entity implementations while retaining compatibility exports for AI
  and archive consumers.
- Added dependency-injected contracts for campaign creation/list/reorder and
  entity stable-ID updates with cross-aggregate mention changes.

#### Phase 7.8 — Image mutations and campaign lifecycle (complete)

- Extracted recursive image-reference rewriting into
  `server/domains/image/imageReferenceService.js`, covering campaign metadata,
  entities, sessions, and campaign AI history.
- Extracted image listing, upload-name collision handling, subcategories,
  file/folder move, rename, delete, move-to-general, and campaign image
  detection into `server/domains/image/imageAssetRepository.js`.
- Extracted campaign rename/delete coordination into
  `server/domains/campaign/campaignLifecycleService.js`; campaign directory,
  image directory, moved-image references, and delete options now use explicit
  domain contracts.
- Migrated image mutation/list routes and campaign lifecycle endpoints away
  from the storage facade. Bestiary-token browsing, global image search, and
  storage statistics remain queued as read-model extraction.
- Removed superseded image mutation, reference, and campaign lifecycle
  implementations from `server/storage.js`, retaining compatibility exports
  for archive and AI consumers.
- Added dependency-injected contracts for cross-aggregate reference changes,
  asset rename/list behavior, and campaign/image lifecycle coordination.

#### Phase 7.9 — Image-gallery read models (complete)

- Extracted Bestiary-token browsing, ignored-source filtering, recursive asset
  search, combined user/official image search, and storage-size aggregation
  into `server/domains/image/imageGalleryReadService.js`.
- Kept filesystem traversal, path normalization, URL construction, search
  labels, readonly metadata, and size calculations behind an injectable
  read-only contract.
- Migrated the remaining image endpoints away from `server/storage.js`; the
  image route now depends only on image-domain services and shared
  infrastructure policy.
- Removed the superseded read-model implementations from the storage monolith
  while retaining delegated compatibility exports for existing archive and
  regression consumers.
- Added an in-memory contract covering combined user/official results,
  ignored Bestiary sources, and storage statistics without reading user data.

#### Phase 7.10 — Archive import/export services (complete)

- Extracted full campaign bundles, image materialization, archive bundles, and
  selected partial exports into
  `server/domains/archive/archiveExportService.js`.
- Extracted append, replace-by-ID, wipe-and-replace, partial imports, AI history
  normalization, image URL remapping, and traversal-confined image restoration
  into `server/domains/archive/archiveImportService.js`.
- Centralized the allowed partial-archive section policy in
  `server/domains/archive/archiveSections.js`.
- Migrated backup routes and campaign JSON export away from the storage facade;
  transport remains responsible only for gzip parsing/serialization, download
  headers, selection, and HTTP status handling.
- Removed the superseded archive implementations and helpers from
  `server/storage.js`, retaining delegated compatibility exports for AI and
  regression consumers.
- Added dependency-injected contracts for full/partial export composition,
  aggregate restoration, slug/image rewrites, AI path normalization, and image
  path confinement.

#### Phase 7.11 — Custom Bestiary and facade retirement (complete)

- Extracted custom-monster reads, normalization, ID deduplication, HP average
  normalization, favorites, and combined official/custom indexing into
  `server/domains/bestiary/customBestiaryRepository.js`.
- Migrated Bestiary routes, AI custom-monster flows, AI patching, AI context,
  history restoration, static assets, and server initialization to their
  owning domain or infrastructure modules.
- Removed every production import of `server/storage.js`; it is now a
  compatibility barrel for regression and transition consumers only.
- Reduced `server/storage.js` to delegated exports with no persistence or
  orchestration implementation.
- Added an ESLint `no-restricted-modules` backend rule that rejects new
  `./storage` and `../storage` CommonJS dependencies outside the compatibility
  file.
- Added a dependency-injected custom-Bestiary contract covering normalization,
  duplicate IDs, favorites, and official/custom index composition.

Next: migrate regression helpers away from the compatibility barrel and remove
`server/storage.js`, then continue splitting AI apply orchestration by campaign,
session, entity, encounter, and custom-monster use case.

#### Phase 7.12 — Compatibility facade removal and AI apply split (complete)

- Moved the regression suite's aggregate backend imports to
  `tests/support/backendTestFacade.js`; this adapter is now explicitly test-only.
- Deleted `server/storage.js`, so production has no broad persistence facade to
  depend on.
- Kept the backend ESLint restriction for legacy `./storage` and `../storage`
  imports, preventing the removed dependency shape from returning.
- Extracted custom-monster AI create/update/delete orchestration into
  `server/domains/ai/customMonsterPatchService.js`.
- Made the extracted service dependency-injectable so operation behavior can be
  tested without writing user-owned runtime data.

Next: extract encounter operation handling and its Bestiary lookup from
`server/aiPatchService.js`, then separate aggregate loading/persistence from the
campaign, session, entity, and note operation dispatch.

#### Phase 7.13 — Encounter AI patch extraction (complete)

- Extracted encounter create/update/delete handling into
  `server/domains/ai/encounterPatchService.js`.
- Moved Bestiary monster resolution, encounter normalization, HP/AC projection,
  and monster-instance creation with the encounter use case.
- Injected Bestiary index and identity providers, enabling deterministic
  in-memory verification without touching `database/` or `data/`.
- Kept scene-to-encounter client-ID linking in the top-level AI coordinator,
  where cross-operation ordering is owned.

Next: separate campaign/session aggregate loading and persistence from
`server/aiPatchService.js`, then extract entity and note dispatch while
preserving scope moves and stable IDs.

#### Phase 7.14 — AI aggregate boundary and operation dispatcher (complete)

- Extracted campaign/session aggregate loading and persistence into
  `server/domains/ai/aiApplyAggregateService.js`.
- Removed JSON writer and persistence-path knowledge from
  `server/aiPatchService.js`.
- Added injectable aggregate readers, writers, and path providers so bestiary,
  campaign-only, and session update result selection can be verified in memory.
- Extracted operation classification, routing, and campaign/session dirty-state
  tracking into the pure `server/domains/ai/aiOperationDispatcher.js`.
- Kept cross-operation client-ID resolution and cleanup in the coordinator,
  preserving scene/encounter ordering and entity scope semantics.

Next: move note targeting and mutations into an AI note patch service, then
split campaign/session entity operations from scope-move orchestration.

#### Phase 7.15 — AI note patch service and entity seams (complete)

- Extracted note normalization, append/update/delete behavior, and target
  resolution into `server/domains/ai/notePatchService.js`.
- Preserved campaign, session, scene, session-entity, and campaign-entity note
  semantics, including numeric note IDs and simplified-note titles.
- Extracted shared entity type/identity/scope matching into
  `server/domains/ai/entityOperationUtils.js`.
- Extracted campaign entity listing, stable-slug selection, and persistence
  into `server/domains/ai/campaignEntityGateway.js`.
- Removed the superseded note, identity, scope, and campaign-entity helper
  implementations from `server/aiPatchService.js`.
- Added regression contracts for every supported note target and for stable
  campaign entity slugs.

Next: split campaign and session entity operations from move-scope
orchestration, keeping duplicate resolution, mention rewriting, permissions,
client IDs, and stable entity IDs intact.

#### Phase 7.16 — AI entity mutation and scope orchestration (complete)

- Extracted campaign and session entity create/update/delete handling into
  `server/domains/ai/entityPatchService.js`.
- Moved `moveScope`, cross-scope duplicate replacement, client-ID mapping,
  permission checks, and mention rewrites with the entity use case.
- Preserved stable entity IDs and slugs when replacing duplicates or moving
  between campaign and session scope.
- Extracted character/location and ignored-note normalization into
  `server/domains/ai/aiContentNormalizer.js`, shared with scene content.
- Made repositories, gateways, normalizers, ID generation, and slug generation
  injectable for filesystem-free regression tests.
- Reduced `server/aiPatchService.js` to approximately 420 lines by deleting the
  superseded normalization and entity-operation implementations.
- Added regression contracts for duplicate migration, stable IDs/slugs,
  mention updates, permissions, and campaign-to-session moves.

Next: extract scene mutation and scene/encounter link finalization, then reduce
`server/aiPatchService.js` to the top-level apply state coordinator.

#### Phase 7.17 — Scene patch extraction and thin AI coordinator (complete)

- Extracted scene normalization, create/update/delete behavior, permission
  handling, and empty-scene validation into
  `server/domains/ai/scenePatchService.js`.
- Moved encounter client-ID collection, deferred scene linking, unresolved-link
  warnings, and newly-created orphan encounter cleanup into the scene use case.
- Preserved partial scene content, ignored notes, existing encounter links when
  encounter changes are disabled, and stable scene IDs.
- Extracted campaign description updates into
  `server/domains/ai/campaignPatchService.js`.
- Reduced `server/aiPatchService.js` to approximately 128 lines with a single
  `applyAiOperations` coordinator function.
- Added regression contracts for link resolution, orphan cleanup, permission
  handling, ignored notes, partial scenes, and empty-scene rejection.

Next: audit the completed Phase 7 backend decomposition and begin Phase 8 with
schema validation at the highest-risk API boundaries and targeted performance
budgets.

### Phase 8 — Scale and operational hardening

- Add request cancellation and consistent query state for large reference
  datasets.
- Introduce schema validation at API boundaries.
- Add targeted performance budgets for Bestiary, Spells, global search, and
  encounter rendering.
- Record architecture decisions in short ADRs under `docs/adr/`.
- Track migration debt explicitly; do not add permanent compatibility adapters.

#### Phase 8.1 — Archive import validation boundary (complete)

- Added the shared `server/http/requestValidation.js` contract for validation
  middleware, `400 INVALID_REQUEST` errors, and structured issue details.
- Added archive-owned structural schemas for campaign bundles, archive
  envelopes, partial archives, sessions, entities, AI history, and image
  records.
- Applied validation to JSON and multipart archive imports before any domain
  mutation runs.
- Closed the destructive empty-import gap: an empty collection can no longer
  reach `wipe_and_replace` and clear campaign data.
- Standardized missing, invalid JSON, and invalid gzip archive failures on the
  same API error contract.
- Added regression contracts for accepted archive shapes, field-level issues,
  malformed uploaded files, and validation-before-deletion ordering.

Next: extend the same shared validation contract to campaign/session mutation
routes, beginning with identity, scope-move, and reorder payloads; then add
request cancellation for large reference-data queries.

#### Phase 8.2 — Campaign/session mutation contracts (complete)

- Added reusable structural schema helpers without moving domain enums or
  business fields into the HTTP layer.
- Added campaign-owned schemas for creation, partial updates, character/NPC
  moves, and campaign reorder maps.
- Added session-owned schemas for creation/updates and session reorder maps.
- Applied middleware before campaign/session rename, move, and reorder
  handlers, so invalid input cannot reach filesystem mutations.
- Standardized supplied names as non-empty strings, session `data` as an
  object, move targets as `characters` or `npc`, and order values as
  non-negative integers.
- Removed superseded route-local empty-name responses; those failures now use
  the shared structured validation contract.
- Added schema and route-stack regression contracts proving validation precedes
  mutation handlers.

Next: add cancellation and stale-response protection to large Bestiary and
Spells reference queries, then establish measurable query/render performance
budgets.

#### Phase 8.3 — Reference-query cancellation and race safety (complete)

- Extended Bestiary, Spells, and rules-reference domain read APIs with optional
  native fetch options while preserving their endpoint ownership.
- Added a shared `isAbortError` classifier without coupling transport to React.
- Gave Bestiary source, full-data, custom reload, and favorite-sync requests
  owned `AbortController` lifecycles.
- Gave Spells source and full-data requests the same cancellation lifecycle.
- Added per-tab request-controller tracking to the rules-reference widget,
  including concurrent global-search loads and teardown cancellation.
- Guarded state and loading commits with the active signal, so a superseded or
  unmounted request cannot overwrite newer UI state even if a fetch adapter
  resolves after cancellation.
- Added domain API forwarding contracts and source-level lifecycle regression
  checks.

Next: establish measurable performance budgets around reference filtering and
rendered list size, then move expensive detailed-search work behind indexed or
deferred query models where the baseline exceeds those budgets.

#### Phase 8.4 — Executable performance budgets (complete)

- Extracted pure Bestiary and Spells filter models from their React views.
- Replaced Bestiary's per-monster source-array and linear favorite scans with
  precomputed source and favorite sets.
- Extracted the global-search query model and made its 80-result render cap an
  explicit exported contract.
- Extracted encounter grid grouping and representative lookup into the
  encounter entity model.
- Added `npm run check:performance`, using median warm-run measurements,
  bundled Bestiary/Spells data, a 20,000-record search index, and a
  10,000-participant encounter fixture.
- Established budgets of 200ms for detailed Bestiary filtering, 50ms for
  detailed spell filtering, 25ms for worst-case 20k global search, and 40ms for
  10k encounter grouping.
- Added functional regression contracts for filters, the search render cap,
  character exclusion, local overrides, and representative identity.

Next: record the main FSD/backend/validation decisions as ADRs and create an
explicit migration-debt register before completing the Phase 8 audit.

#### Phase 8.5 — ADRs, debt register, and facade closure (complete)

- Recorded accepted decisions for FSD dependency direction, backend
  domain/infrastructure boundaries, validated mutation boundaries, and
  reference-query lifecycle/performance budgets under `docs/adr/`.
- Added `docs/migration-debt.md` with evidence, removal conditions, and target
  phases for every known temporary exception.
- Added archive and settings domain APIs and migrated all consumers.
- Deleted the final frontend `src/api.js` compatibility facade.
- Moved the root React component into `src/app` and exposed a real app-layer
  entry instead of leaving the Fallow app zone empty.
- Kept the Bestiary AI-history fallback and test-only backend facade explicit
  as migration debt; neither is a permitted pattern for new production code.

Phase 8 exit evidence:

- Request validation precedes destructive and identity-changing mutations.
- Large reference requests are cancellable and stale-response safe.
- Executable performance budgets pass on bundled and synthetic scale fixtures.
- Fallow reports zero cycles, boundary violations, unresolved imports, and
  dead-code findings.
- The frontend and production backend compatibility facades are removed.
- Remaining exceptions have named removal phases.

### Phase 9 — Legacy frontend ownership closure

1. Move app-only providers, actions, and store composition into `src/app`.
2. Move reusable entity cards and stat blocks into entity UI entry points.
3. Move global search and remaining modal workflows into widgets/features.
4. Classify generic controls/utilities under `shared` and delete superseded
   legacy paths.
5. Migrate legacy Bestiary AI-history files through a safe read-through path,
   then remove the fallback.
6. Replace the test-only backend facade with direct domain fixtures.

The authoritative exception list and closure evidence are in
`docs/migration-debt.md`.

#### Phase 9.1 — Global-search widget ownership (complete)

- Moved campaign global search from `src/components/campaign` into
  `src/widgets/global-search` with a public widget API.
- Migrated Campaign and Session pages to the widget entry point and deleted the
  legacy component path.
- Extended campaign entity and session read APIs with optional native fetch
  options.
- Replaced the boolean-only teardown guard with an owned `AbortController` and
  signal checks before state commits.
- Added a generic ordered concurrency pool under `shared/lib`.
- Limited session-detail fan-out to six requests while preserving source order.
- Added regression contracts for API signal forwarding, concurrency limits,
  widget ownership, teardown cancellation, and legacy-file removal.

Next: move reusable Character, Location, and Monster stat-block UI into entity
UI entry points, then migrate page/widget consumers away from the legacy card
paths.

#### Phase 9.2 — Campaign card model ownership (complete)

- Moved Character, Location, and shared card-note models from `src/models` into
  `src/entities/campaign/model`.
- Exposed all three models through the Node-safe campaign model public API.
- Migrated card UI and regression consumers to the entity entry point.
- Removed the obsolete `src/models` files and the old dynamic test import/skip.
- Audited the card UI boundary: editable cards currently compose the Images
  feature and global UI settings, so moving them directly into `entities`
  would create forbidden upward dependencies.

Next: split pure card presentation from image-selection and settings
orchestration. Move the pure views into campaign entity UI, keep composition in
an appropriate higher layer, then remove the legacy card component paths.

#### Phase 9.3 — Campaign card view dependency inversion (complete)

- Moved full Character and Location rendering/edit behavior into
  `src/entities/campaign/ui`.
- Added a separate campaign entity UI entry point, keeping model-only Node
  consumers independent from React.
- Removed Images-feature and app-store imports from entity views.
- Made `ImageAssetFieldComponent` and `simplifiedNotesEnabled` explicit injected
  dependencies.
- Reduced legacy Character/Location card files to small composition adapters
  that provide those higher-layer dependencies.
- Updated regression ownership checks to inspect entity views and verify they
  cannot regain feature/store imports.

Next: relocate the two temporary card composition adapters into an appropriate
feature/widget composition API and migrate consumers, then delete their legacy
component paths.

#### Phase 9.4 — Campaign card composition ownership (complete)

- Migrated campaign, session, encounter, AI-response, entity-modal, and
  create-entity consumers to the campaign entity UI entry point.
- Made each higher-layer consumer inject the Images capability and current
  simplified-note setting explicitly.
- Deleted the temporary `src/components/CharacterCard.jsx` and
  `src/components/LocationCard.jsx` adapters.
- Replaced adapter-presence regression checks with ownership contracts covering
  all composition sites and requiring both legacy paths to remain absent.
- Closed migration debt MD-006 and added the permanent no-adapter rule to
  `AGENTS.md`.

Next: migrate legacy Bestiary AI-history files through the repository's safe
read-through path, verify canonical persistence, and remove the fallback.

#### Phase 9.5 — Bestiary AI-history canonical migration (complete)

- Replaced permanent readable-path fallback selection with an explicit
  read-through migration from
  `data/campaigns/bestiary/_aiResponses.json` to
  `data/_aiResponses-bestiary.json`.
- Made canonical history authoritative whenever it exists.
- Deduplicated concurrent migration attempts within the repository instance.
- Normalized and atomically persisted readable legacy entries while retaining
  the legacy source file as a non-destructive backup.
- Kept a failed migration retryable: the current read can use the already-read
  in-memory history, but later operations retry canonical persistence instead
  of adopting the legacy path as permanent storage.
- Added focused contracts for preservation, ordering, concurrent idempotency,
  canonical precedence, source retention, and write-failure recovery.
- Added a case-insensitive `TEST_FILTER` to the regression runner so focused
  contracts can execute without weakening or replacing the full-suite gate.
- Closed migration debt MD-003 and documented the permanent storage rule in
  `AGENTS.md`.

Next: migrate regression setup from the test-only backend compatibility facade
to direct domain fixtures, then delete the facade.

#### Phase 9.6 — Backend regression facade retirement (complete)

- Replaced the regression suite's aggregate `storage.*` dependency with explicit
  imports from the owning infrastructure, AI, archive, Bestiary, campaign,
  entity, image, and session modules.
- Limited the migrated surface to the 42 symbols actually used by the suite
  instead of reproducing the facade's larger export set.
- Replaced the facade-only ID helper with the Node `crypto.randomUUID` owner.
- Deleted `tests/support/backendTestFacade.js`.
- Added a regression ownership contract requiring direct module imports and
  the legacy facade path to remain absent.
- Closed migration debt MD-004 and prohibited new backend test aggregation in
  `AGENTS.md`.
- The ownership contract and in-memory repository checks pass. Filesystem
  storage cases remain covered by the full suite but cannot write protected
  `data/` in the current sandbox; this existing verification limitation remains
  registered as MD-005.

Next: move app-only state/actions/providers into `src/app`, then continue
classifying generic legacy UI and utilities under `shared`.

#### Phase 9.7a — App shell and provider ownership (complete)

- Moved route composition and the project-guide empty state into
  `src/app/router`.
- Moved the sidebar shell, global MessageBox and dice overlays, and the
  rules-reference modal host into `src/app/ui`.
- Moved campaign entity-modal provider composition into `src/app/providers`.
- Moved realtime synchronization bootstrap into `src/app/services`.
- Updated `App.jsx` to consume local app-shell modules for those concerns.
- Deleted nine superseded paths under `src/components` and `src/services`.
- Added ownership regression coverage requiring the new paths and prohibiting
  all removed paths.
- Kept the store and action contracts outside `app` temporarily because
  features/widgets/pages consume them; moving them directly would reverse the
  FSD dependency direction.

Next: introduce lower-layer store/runtime ports, move the configured reducer
and app-only action orchestration into `src/app`, then delete `src/store` and
the remaining app-global portion of `src/actions`.

#### Phase 9.7b1 — Configured store ownership and downward port (complete)

- Added a domain-neutral bound-store port under `src/shared/lib` with validated
  binding plus selector, dispatch, and store-access contracts.
- Moved the configured reducer, initial state, subscriptions, and dispatch
  implementation into `src/app/store/appStore.js`.
- Bound the configured store during app entry initialization.
- Migrated every lower-layer hook consumer to the shared public API, preventing
  features/widgets/pages from importing `app`.
- Separated imperative modal, navigation, and rules-reference commands into
  `src/services/applicationRuntime.js`, where they access state only through
  the shared port.
- Kept realtime synchronization inside `app` as the only intentional direct
  configured-store consumer.
- Deleted `src/store/appStore.js` and added a regression contract covering
  ownership, shared-port neutrality, binding failure, and a real dispatch/read
  round trip.

Next: distribute action constants/creators and imperative commands to owning
domain or UI slices, then delete `src/actions/app.js` and the temporary
`src/services/applicationRuntime.js` boundary.

#### Phase 9.7b2 — Application action and command ownership (complete)

- Split generic modal, message-box, dice, mention-picker, navigation,
  entity-refresh, and realtime-sync contracts into concern-specific modules
  under `src/shared/model`.
- Moved campaign collection/active state, active session, active encounter, and
  settings/localization action contracts into their owning entity model public
  APIs.
- Moved rules-reference navigation, modal, and history state plus imperative
  commands into the reference-navigation feature model API.
- Moved modal and navigation imperative commands next to their generic shared
  state contracts; both access configured state only through the neutral store
  port.
- Updated the configured app reducer and every consumer to import the owning
  public API.
- Deleted `src/actions/app.js` and
  `src/services/applicationRuntime.js`.
- Extended regression coverage to require both obsolete paths to remain absent
  while exercising a real settings action through the bound configured store.
- Closed migration debt MD-002 and prohibited replacement catch-all action or
  runtime catalogs in `AGENTS.md`.

Next: begin Phase 9.8 by inventorying the remaining legacy frontend folders,
move the first coherent generic control/utility group into `shared`, and
tighten public-API enforcement as each legacy path is removed.

#### Phase 9.8a — Generic helper ownership (complete)

- Inventoried the remaining migration sources: 45 component files, 3 service
  files, 22 utility files, and one hook before this subphase.
- Moved eight dependency-free, cross-layer helpers into focused public modules
  under `src/shared/lib`: class-name composition, deep object search, DOM
  target navigation, browser downloads, byte formatting, stable ID
  comparison, JSON shape checks, and undo/redo transitions.
- Migrated every app, page, widget, feature, entity, component, and regression
  consumer to the shared paths.
- Deleted the eight superseded `src/utils` files, reducing that migration
  source from 22 files to 14.
- Added ESLint restrictions prohibiting imports through all eight retired
  utility paths.
- Added an ownership regression requiring the shared files, the absence of
  legacy files, representative cross-layer consumer migration, and boundary
  enforcement.
- Kept these helpers as focused public files rather than one barrel so pure
  model consumers do not initialize the React-backed app-store port or
  browser-only helpers they do not use.

Next: migrate generic localization and UI-theme configuration from
`src/services` into a focused shared configuration API, then retire those two
legacy service paths.

#### Phase 9.8b — Shared localization and theme configuration (complete)

- Moved language-pack discovery, language normalization, template
  interpolation, and the shared `lang` instance into
  `src/shared/config/localization.js`.
- Updated the Vite language-pack glob for the new depth while preserving eager
  UTF-8 JSON loading and the Node-safe fallback used by regression tests.
- Moved theme constants, normalization, and document theme application into
  `src/shared/config/theme.js`.
- Added `src/shared/config/index.js` as the only public configuration API and
  migrated every app, page, widget, feature, entity, shared transport, and
  legacy-component consumer.
- Deleted `src/services/localization.js` and
  `src/services/uiSettings.js`, reducing the legacy services folder from three
  files to one.
- Added ESLint restrictions for both retired paths and for direct imports of
  the two shared implementation modules.
- Added a focused ownership/behavior contract for public exports, theme
  constants, server-side theme safety, localization fallback, language-pack
  discovery, representative consumer migration, and legacy-file absence.

Next: move the remaining domain-specific `src/services/entities.js` behavior
into the campaign entity model API and retire the legacy services folder
entirely.

#### Phase 9.8c — Campaign entity resolution ownership (complete)

- Split the final legacy service by responsibility instead of moving its mixed
  dependency graph wholesale.
- Moved pure display-name construction and case-insensitive entity matching to
  `src/entities/campaign/model/entityIdentity.js`, exposed through the
  Node-safe campaign model API.
- Moved API-backed character/NPC/location lookup to
  `src/entities/campaign/api/resolveEntityByName.js`, exposed through the
  campaign API entry point.
- Preserved parallel entity loading, optional NPC/location failure tolerance,
  character failure propagation, lookup precedence, and Ukrainian display-name
  behavior.
- Migrated all component, feature, page, and regression consumers to the
  appropriate campaign entity public API.
- Deleted `src/services/entities.js`; the legacy frontend `src/services`
  folder now has no source files and is retired.
- Added ESLint enforcement for the retired service path and extended the
  existing behavior regression with ownership, public-export, and deletion
  contracts.

Next: migrate the remaining generic `useDebounce` hook into `shared/lib`, then
continue classifying the 14 remaining legacy utilities by domain or shared
ownership.

#### Phase 9.8d — Generic hook ownership (complete)

- Moved the only legacy hook from `src/hooks/useDebounce.js` to the focused
  public module `src/shared/lib/useDebounce.js`.
- Migrated Bestiary, Spells, Image Gallery, and Player Questions consumers to
  the shared path.
- Preserved the default 250 ms delay, immediate zero/negative-delay updates,
  timer replacement on value/delay changes, and cleanup cancellation on
  effect teardown.
- Deleted the legacy hook file; `src/hooks` now has no source files and is
  retired.
- Added ESLint enforcement for the retired path and a focused ownership/source
  contract covering all four consumers and the hook's timing/cleanup
  invariants.

Next: classify the 14 remaining files in `src/utils`, migrate the next coherent
shared or domain-owned group, and keep reducing MD-001 without introducing a
generic catch-all barrel.

#### Phase 9.8e — Shared interaction utility ownership (complete)

- Classified all 14 remaining utilities before moving code:
  - routing, mention editing/selection, and search highlighting are
    cross-cutting shared concerns;
  - campaign graph/layout, entity creation, and notes require campaign-domain
    ownership decisions;
  - dice mechanics remain a standalone domain candidate;
  - content tokens, parser/tag handling, and source metadata belong to the
    rules/reference migration group.
- Moved URL parsing/building and modifier-key navigation helpers to
  `src/shared/lib/navigation.js`.
- Moved Lexical mention-boundary and post-mention space mechanics to
  `src/shared/lib/mentionEditor.js`.
- Moved promise-based mention selection beside its action contract in
  `src/shared/model/mentionPickerSelection.js` and exposed it only through the
  shared model API.
- Moved React search highlighting to the focused public module
  `src/shared/ui/searchHighlight.jsx`.
- Migrated all app, page, widget, feature, entity, renderer, component, and
  regression consumers; deleted the four superseded `src/utils` paths.
- Added ESLint restrictions for all retired paths and the internal mention
  selection implementation.
- Added ownership coverage and retained focused behavior coverage for route
  parsing/building, modifier navigation, Lexical mention editing, and mention
  picker selected/cancelled outcomes.

Next: move campaign graph construction and layout/collision mechanics into the
campaign entity model API, migrate the graph UI and regressions, and retire
both legacy graph utility paths.

#### Phase 9.8f — Campaign graph model ownership (complete)

- Moved campaign graph node/edge construction, mention extraction, and name
  normalization into `src/entities/campaign/model/campaignGraph.js`.
- Moved deterministic `d3-force` layout, node sizing, and drag-collision
  resolution into
  `src/entities/campaign/model/campaignGraphLayout.js`.
- Added the focused public entry `src/entities/campaign/graph.js` and kept both
  graph modules out of the general `model.js` barrel, preventing ordinary
  campaign model consumers from eagerly initializing `d3-force`.
- Migrated `CampaignNotesGraph` and regression consumers to the focused entity
  API and deleted both legacy graph utility paths.
- Added ESLint enforcement plus ownership coverage for the focused public API,
  legacy-file absence, UI migration, and general-model isolation.
- Retained four focused graph contracts covering graph construction,
  deterministic finite layout, collision freedom, and visible dragged-node
  collision behavior.

Next: establish note-domain model ownership for the remaining shared
campaign/session note helpers, migrate their cross-layer consumers, and retire
`src/utils/noteUtils.js`.

## Development Principles

1. **Own behavior by domain.** Endpoint paths, domain models, and domain
   mutations belong to the relevant slice.
2. **Depend downward.** Lower FSD layers never import higher layers.
3. **Use public APIs.** Cross-slice imports go through `index.js` or an explicit
   segment entry point; deep imports are implementation details. Keep API and UI
   entry points separate when a combined barrel would introduce runtime edges.
4. **Keep shared truly generic.** `shared` must not know about campaigns,
   monsters, sessions, or other domain concepts.
5. **Prefer vertical migration.** Move one working flow end-to-end instead of
   creating empty layer folders.
6. **Separate orchestration from rendering.** Stateful workflows belong in
   features; reusable domain display and pure logic belong in entities.
7. **Make invalid architecture fail locally.** Run
   `npm run check:architecture` and lint before considering a phase complete.
8. **Delete superseded code.** Compatibility code is temporary and must have a
   named removal phase.
9. **Protect local-first behavior.** Architecture changes must not alter
   persisted IDs, filesystem paths, scope semantics, or user-owned `data/`.
10. **Preserve UTF-8.** Ukrainian text and source files must remain valid UTF-8
    without replacement characters.

## Required Validation Per Phase

- `npm run check:architecture`
- `npm run lint`
- Relevant regression tests for the changed domain
- Explicit UTF-8/replacement-character review for edited text

Do not use the production build as the routine validation step.
