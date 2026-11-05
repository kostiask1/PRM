# PRM data structures

`data/` is the local runtime store. It is ignored by Git and holds user content as UTF-8 JSON plus image files. This reference describes the file format, not the contents of a particular installation. The bundled D&D reference catalog lives in `database/`, outside this store.

## Directory map

```text
data/
  campaigns/
    <campaignSlug>/
      _campaign.json
      _changeHistory.json
      _aiResponses.json
      sessions/<sessionFileName>.json
      characters/<entitySlug>/info.json
      npc/<entitySlug>/info.json
      locations/<entitySlug>/info.json
  images/
    <campaignSlug or shared source>/<category>/[<subcategory>/]<file>
  custom-bestiary.json
  favorites.json
  settings.json
  _aiResponses-bestiary.json
  _applicationChangeHistory.json
  _history-pending/
  _history-tombstones/
  _schema.json                  (legacy migration receipt, if present)
  _migration-backups/           (legacy migration backups, if present)
```

The suffix in the tree is illustrative: in code and API calls, `fileName` means the full name, including `.json`. Empty collections and auxiliary files may be absent on disk. JSON writers may briefly create temporary files beside the destination.

## Authoring content outside Gemini

1. Confirm the intended campaign and scope. Inspect only the relevant local records. For a new campaign, choose a unique directory slug and set `_campaign.json.slug` to match. Slugs and filenames can contain Ukrainian characters. Keep each path segment free of separators and traversal components.
2. Prefer app commands or their API endpoints where they support the requested change. If the user asks for direct file authoring, create or update only the requested content. Keep existing IDs, slugs, timestamps, and unrelated fields. Use a fresh UUID for each new record or instance, and ISO 8601 timestamps where the record calls for them. Existing record IDs may be numeric, including zero, or strings.
3. Write valid UTF-8 JSON. In editable campaign text, use bracketed display names such as `[Ілара Вельн]` for entity mentions. Use the actual display name from the intended scope. Brackets are not entity IDs and should not be used for PRM entity mentions in custom Bestiary fields.
4. Keep internal links consistent. A scene links to an encounter in the same session by ID. Image references are URLs, and need the corresponding file. Use the app's rename, move, delete, and import commands when references or history must follow the change.
5. Verify new or changed records with the relevant storage reader or API. Check UTF-8 decoding, filename and slug consistency, encounter targets, and HTTP image responses when applicable. Leave settings, generated history, recovery files, and unrelated campaigns alone.

## Campaigns, entities, and sessions

### Campaign metadata

`campaigns/<slug>/_campaign.json` stores campaign metadata: `id`, `slug`, `name`, `createdAt`, `order`, `completed`, and `completedAt` (null when active). Add `description` for the campaign overview and `notes` for structured notes. Optional UI preferences include section collapse flags, `simplifiedNotes`, and `ignoreSourcesList`. Sessions and campaign entities are stored separately. A detailed campaign read may include derived collections or counts.

The note shape in the campaign, session, scene, and entity collections is `{ id, title, text, collapsed }`. `title` and `text` are strings and may be empty. `collapsed` controls presentation. Preserve authored line breaks in text and let the JSON serializer escape them. Preserve existing `_aiIgnored` flags on notes and entities. Omit editor placeholders such as `__virtual_note__:*`, `_isVirtual`, and `_renderKey` from authored records.

### Characters, NPCs, and locations

| Scope | Storage | Content |
| --- | --- | --- |
| Campaign player character | `characters/<slug>/info.json` | `firstName`, `lastName`, optional `race`, `class`, `level`, and character details |
| Campaign NPC | `npc/<slug>/info.json` | Same person fields, with `motivation`, `trait`, and other NPC details as applicable |
| Campaign location or faction | `locations/<slug>/info.json` | `name`, `description`, and notes. The location collection also holds factions |
| Session NPC or location | Session `data.npcs[]` or `data.locations[]` | Inline entity with its own `id` and the corresponding person or location fields |

Campaign entity records include `id`, `slug`, and `order`. The directory name is authoritative for the returned slug. Both scopes can have `notes`, `imageUrl` (string or null), `collapsed`, and `isNotesCollapsed`. Person display names use first and last name, with a legacy `name` or `title` fallback. Locations use `name` with a `title` fallback. An empty string is supported for a person whose level is unspecified.

### Session and scene records

A session lives at `campaigns/<slug>/sessions/<fileName>`. Its outer record has `id`, `name`, `order`, `createdAt`, and `data`. If a `fileName` field is present, it must match the actual filename. A new empty session can start with `data: {}`. A prepared session can use:

```json
{
  "notes": [],
  "scenes": [
    {
      "id": "scene-bridge",
      "texts": {
        "summary": "Перехоплення біля мосту",
        "goal": "Наздогнати потяг",
        "stakes": "Затримка скорочує час до прибуття",
        "location": "Кам’яний міст"
      },
      "notes": [],
      "collapsed": false,
      "isNotesCollapsed": false,
      "imageUrl": null,
      "encounterId": null
    }
  ],
  "encounters": [],
  "npcs": [],
  "locations": [],
  "result_text": ""
}
```

`texts.location` is display text, not a foreign key. Put the scene heading in `texts.summary` or a note title so it appears in the session UI. Optional `scene.npcs[]` can hold lightweight `{ name, description }` context for the scene. Use `data.npcs[]` for full session NPC cards. `result_text` stores session outcome text. Session `data` can also contain section collapse state and goal, conflict, social, exploration, and combat checklist flags. Preserve optional or legacy fields already present when editing a session.

### Encounters and participants

`data.encounters[]` contains `{ id, name, monsters: [] }`. The `monsters` list includes all participant types, including player characters and NPCs. Each participant is an inline snapshot with a unique `instanceId` for that combatant. Multiple copies of a Bestiary monster can share a source identity and must have distinct instance IDs.

For an authored monster participant, include `name`, `source`, `ac`, `hp`, and any stat block fields needed to run it. Track the initial/current combat state with `armor_class`, `hit_points` (maximum), and `currentHp`. Bestiary-derived snapshots can retain `originalBestiaryName` for source matching. Character snapshots use `participantType: "character"` and can reference `originalCharacterId` and `originalCharacterSlug`. Keep existing source/link metadata, `_localOverride`, and instance state when making targeted edits. `scene.encounterId` is null or the ID of an encounter in that session. Give each linked encounter one owning scene because deleting a scene also deletes its linked encounter.

Relevant contracts: [storage](server/storage.js), [campaign entity commands](server/modules/campaign/application/campaignEntityCommands.js), [session view model](src/entities/session/model/SessionViewModel.ts), [scene encounter creation](server/modules/session/application/createSceneEncounter.js), and [participant synchronization](src/features/encounter-editor/model/participantSynchronization.ts).

## Images

Image files are stored under `images/<source>/<category>/[<subcategory>/]<filename>`. The source is normally the campaign slug or `general` for shared assets. Bundled Bestiary tokens live outside `data/` and are served separately at `/api/bestiary/tokens/…`.

| Used for | Standard path relative to the source |
| --- | --- |
| Player character portrait | `characters/players/<file>` |
| NPC portrait | `characters/npc/<file>` |
| Location or scene illustration | `scenes/<file>` |
| Attachment | `attachments/<file>` |
| Map | `maps/<file>` |
| Token | `tokens/[<subcategory>/]<file>` |
| Prop or note image | `props/<file>` or `notes/<file>` |

Save a relative HTTP URL in the record, for example `/api/images/example/characters/npc/guide.png`. Percent-encode each path segment separately, including Ukrainian filenames or spaces. Keep raw names on disk. The gallery recognizes JPG, JPEG, PNG, WebP, GIF, and SVG. The image routes and repository own upload naming, collisions, moves, and reference propagation. See [image routes](server/routes/images.js) and [image gallery presets](src/features/images/model/imageAssetField.ts).

## Application data

### Custom Bestiary and favorites

`custom-bestiary.json` uses a Bestiary envelope with `_meta.sources[]` and `monster[]`. The source metadata is `{ "json": "CUSTOM", "abbreviation": "CUSTOM", "full": "Custom" }`. A custom monster has a stable `id`, a nonempty `name`, and `source: "CUSTOM"`. Typical stat blocks include `size`, `type`, `ac`, `hp: { average, formula }`, `speed`, `str`, `dex`, `con`, `int`, `wis`, `cha`, `cr`, and action or trait families. For structured actions and traits, use `{ name, entries: ["…"] }`. The writer normalizes supported families, strips app mention brackets, and derives the HP average from a valid formula when one is supplied. Keep one-off encounter stat blocks inline when they are meant to belong only to that encounter.

`favorites.json` is an array of `{ name, source }` references. The source distinguishes monsters with the same name. Use the custom Bestiary rename command to keep favorites synchronized. See [Bestiary commands](server/modules/bestiary/application/bestiaryCommands.js) and [storage](server/storage.js).

### Settings

`settings.json` is one normalized object:

| Keys | Values |
| --- | --- |
| `language`, `theme` | `uk` or `en`; `dark` or `light` |
| `encounterViewMode`, `encounterGridColumns` | `grid` or `single`; integer 1–4 with fallback 2 for an invalid column value |
| `simplifiedNotes`, `autoApplyAiChanges`, `useSearchDebounce` | Booleans. The last two remain enabled unless explicitly set to false |
| `aiBasePrompt`, `imagePromptBasePrompt` | Strings. An undefined image prompt receives the built-in default |
| `campaignAiBasePrompts`, `campaignImagePromptBasePrompts` | Objects mapping campaign slug to prompt string |
| `ignoreSourcesList` | Normalized array of unique uppercase source codes |

Settings storage owns defaults, recovery, and normalization. Individual campaign settings overrides live with the campaign or in the appropriate campaign prompt map.

## History, recovery, and archives

| Location | Purpose and structure |
| --- | --- |
| `campaigns/<slug>/_aiResponses.json`, `_aiResponses-bestiary.json` | Newest-first AI response arrays. The reader also accepts legacy `{ responses: [...] }`. Records include `id`, `text`, `status`, `createdAt`, target `path`, generation metadata, request context, optional `error` and `retryPayload`, and change/apply state. `changes.resources[]` holds typed resource identities and before/after snapshots for campaign, session, entity, custom Bestiary, and custom monster changes. The root Bestiary history is canonical. The old `campaigns/bestiary/_aiResponses.json` location is supported by migration. |
| `_applicationChangeHistory.json`, `campaigns/<slug>/_changeHistory.json` | Undo/redo journals separate from AI response history. Version 1 journals have `version`, `revision`, `limit` (100), `past`, `future`, `pending`, and `restoring`. Transactions capture identity, operation, affected resources, and changes. |
| `_history-pending/<scope>/` | Temporary transaction recovery snapshots. Gzip JSON files are keyed by transaction, with optional directory snapshots in `<transaction>.trees/`. |
| `_history-tombstones/<transaction>/` | Gzip JSON snapshots for lifecycle undo/redo. A tree archive stores version, location, existence, fingerprint, and typed relative entries, with base64 file bytes or a symlink target where applicable. |
| `_schema.json`, `_migration-backups/` | Optional legacy migration metadata and its recorded backups. The receipt has `version`, `appliedAt`, and `migrations[]` with version, name, backup paths, and timestamp. It does not define the content schema. |

These files are maintained by storage and recovery code. Leave them out of generated campaign content. See the [history repository](server/modules/history/infrastructure/fileHistoryRepository.js), [journal normalization](server/modules/history/application/historyStack.js), and [Bestiary AI history migration](server/modules/ai/infrastructure/bestiaryAiHistoryMigration.js).

Downloaded `.prma.gz` backups are gzip UTF-8 JSON interchange files, separate from the live layout. Full and campaign archives use a versioned envelope containing campaign bundles and image records. Full archives can also include application settings, custom Bestiary, favorites, Bestiary AI history, and shared images. Partial archives record the source campaign, selected sections, a bundle, and images. Archive image entries contain `relativePath` and `base64`. Use the [backup commands](server/modules/backups/application/backupCommands.js) for import and export.
