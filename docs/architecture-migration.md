# Architecture Migration Plan

This document is the source of truth for the incremental architecture migration. The project remains a working modular monolith throughout the migration; phases are completed through vertical workflows rather than a repository-wide rewrite.

## Status legend

- **Complete** — acceptance criteria are met and validation is green.
- **In progress** — actively being migrated; new code must follow the target rules.
- **Planned** — sequenced work that has not started.
- **Optional** — evaluate only after the structural phases are stable.

## Target architecture

Frontend dependency direction:

`app -> pages -> widgets -> features -> entities -> shared`

Backend dependency direction inside a domain module:

`http -> application -> domain`

Infrastructure implements ports required by application/domain code. Express, filesystem storage, Gemini, archives, and realtime transport stay at boundaries.

## Phase 0 — Baseline and guardrails

Status: **Complete**

Delivered:

- Fallow architecture zones and dependency-direction rules in `.fallowrc.jsonc`.
- `npm run check:architecture` for cycles and boundary violations.
- UTF-8/Ukrainian encoding validation remains part of lint.
- Transitional policy documented in `AGENTS.md`.

Acceptance criteria:

- No circular dependencies.
- No FSD boundary violations.
- Tests, lint, and encoding checks pass.

## Phase 1 — API ownership and transport separation

Status: **Complete**

Delivered:

- HTTP mechanics moved to `src/shared/api/httpClient.js`.
- Domain clients created for campaigns, sessions, Bestiary, and spells.
- Use-case clients created for AI, backups, images, and settings.
- All production consumers migrated to their owning clients.
- Transitional `src/api.js` compatibility facade removed.
- Existing regression tests now mock the owning client instead of a global facade.

Follow-up rule:

- Add focused client contract tests when introducing non-trivial request construction or response mapping.

Acceptance criteria:

- No production import of `src/api.js`.
- Transport contains no domain endpoints.
- Every endpoint has one clear frontend owner.

## Phase 2 — Bestiary FSD pilot

Status: **Complete**

Delivered:

- Browser composition moved to `src/widgets/bestiary-browser`.
- Monster editing moved to `src/features/edit-monster`.
- AI monster editing/draft UI moved to `src/features/ai-edit-monster`.
- Bestiary API ownership moved to `src/entities/bestiary`.
- Rules reference uses its own lightweight creature list/detail view instead of embedding the complete Bestiary widget.
- Three Bestiary/AI/rules-reference import cycles removed.

Follow-up improvements belong to later phases: split the large Bestiary orchestration component by workflow and move stable monster presentation/model code into an entity slice.

## Phase 3 — Reference-data vertical slice

Status: **Complete**

Delivered:

- Spells, conditions, diseases, skills, senses, variant rules, creature previews, and rules-reference browsing now use owned domain clients.
- `MonsterStatBlock`, `Spells`, settings source selection, and reference preview no longer import the compatibility API facade.
- Rules-reference browsing uses `entities/spell` and `entities/bestiary` directly.
- Inline-tag parsing remains independent from React UI and API access.

Deferred intentionally:

- Introduce a dedicated reference-data entity/widget only when it provides clearer ownership than the current focused services. Avoid a speculative wrapper layer.

Acceptance criteria:

- Reference-data code does not import `src/api.js`.
- Rules-reference UI does not import page-level or Bestiary widget code.
- Parser and reference resolver regression tests pass.

## Phase 4 — AI workflow decomposition

Status: **In progress**

Delivered:

- Pure token-estimation and context-compaction logic moved to `src/features/ai/model/tokenEstimation.js`.
- AI history change detection and retry-payload reconstruction moved to `src/features/ai/model/historyWorkflow.js`.
- AI request-mode resolution, payload construction, and removal of heavy session data moved to `src/features/ai/model/generationRequest.js`.
- Focused regression tests cover ignored context, mode selection, retry reconstruction, generated entity types, and campaign-change detection.
- `AiAssistantPanel` now consumes these feature model APIs instead of owning their implementations.

Frontend scope:

- Split `AiAssistantPanel` into context selection, prompt editing, generation, history, draft review, apply/undo, and image-prompt workflows.
- Replace boolean combinations with explicit workflow statuses.
- Keep campaign/session/bestiary adapters outside reusable AI workflow UI.

Next checkpoint:

- Extract request construction and generation lifecycle from `AiAssistantPanel` behind an explicit workflow status model.
- Then split history UI orchestration and apply/undo synchronization before moving visual subcomponents.

Backend scope:

- Create `server/modules/ai/{domain,application,infrastructure,http}`.
- Split context collection, prompt construction, Gemini invocation, response parsing, validation, history, apply, and undo.
- Introduce explicit ports for Gemini and AI history persistence.

Acceptance criteria:

- AI use cases can be tested without Gemini or real campaign files.
- Route handlers only map HTTP requests/responses.
- Parsed-operation schema and apply/undo behavior remain regression-tested.

## Phase 5 — Campaign, session, and encounter slices

Status: **Planned**

Migrate one complete workflow at a time:

1. Campaign entity create/edit/delete.
2. NPC/location scope movement.
3. Session and scene editing.
4. Encounter creation, linking, and persistence.
5. Encounter participant synchronization with custom Bestiary monsters.

Acceptance criteria:

- IDs and scope rules stay stable.
- Persistent state is server-owned; workflow state stays feature-local.
- Hooks stop acting as page-wide service locators.
- Each migrated workflow has domain/application tests.

## Phase 6 — Backend repositories and storage decomposition

Status: **Planned**

Introduce focused repositories over the existing filesystem storage:

- `CampaignRepository`
- `SessionRepository`
- `EntityRepository`
- `BestiaryRepository`
- `ImageRepository`
- `AiHistoryRepository`
- `SettingsRepository`

Initially, adapters may delegate to `server/storage.js`. Move implementation only after callers depend on repository contracts, then remove obsolete storage exports.

Acceptance criteria:

- Routes do not construct filesystem paths or manipulate JSON files directly.
- Path normalization and atomic UTF-8 JSON writes remain centralized.
- Archive/import and image-reference behavior remains covered by regression tests.

## Phase 7 — Shared UI and legacy-folder retirement

Status: **Planned**

- Move only truly generic controls into `shared/ui`.
- Move domain-aware cards and models into entity slices.
- Retire legacy `components`, `hooks`, `models`, `services`, and `utils` paths as their final owners migrate.
- Tighten Fallow zones so legacy-to-FSD exceptions disappear.

Acceptance criteria:

- No generic dumping-ground directories.
- Cross-slice imports use public `index.js` APIs.
- Legacy folders contain no production code.

## Phase 8 — TypeScript at contracts

Status: **Optional**

Start only after module ownership stabilizes. Prioritize API contracts, AI operation schemas, repository ports, identifiers, and workflow events. Do not combine TypeScript conversion with domain moves in the same change unless required by that slice.

## Validation required for every phase

Run:

```text
npm test
npm run lint
npm run check:architecture
```

Do not use the production build as routine validation. Check changed Ukrainian text for valid UTF-8 and replacement characters.
