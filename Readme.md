# D&D Session Manager

A local-first campaign and session manager for Dungeons & Dragons. The app is built for preparing and running tabletop sessions from one workspace: campaign notes, session scenes, characters, NPCs, locations, encounters, images, dice, reference material, and optional Gemini AI assistance.

All campaign data is stored locally as files. There is no external database.

## Features

### Campaign Workspace

- Create, rename, complete, reopen, delete, export, and import campaigns.
- Keep campaign story, reusable notes, player characters, NPCs, locations, and factions together.
- Auto-save campaign edits with undo and redo support.
- Collapse long campaign sections while keeping data available.
- Reorder sessions from the campaign sidebar.
- Switch between campaign notes list view and graph view.
- Use mentions like `[Character Name]` to connect notes, scenes, entities, and graph nodes.
- Rename entities with an option to update bracketed mentions across the campaign.

### Sessions

- Create sessions manually or with an automatic date-based name.
- Rename, complete, reopen, delete, and auto-save sessions.
- Plan session scenes with structured fields:
  - scene summary
  - player goal
  - location
  - risk and pressure
  - success or failure outcome
- Add, collapse, and delete scenes.
- Keep session-level notes and scene-level notes.
- Track preparation checklist progress.
- Open or create linked combat encounters from scenes.
- Undo and redo session edits with keyboard shortcuts.

### Notes and Rich Text Editing

- Editable notes support lightweight markdown-style formatting.
- Supported note shortcuts:
  - `Ctrl+K` - add a character, NPC, or location mention
  - `Ctrl+B` - bold
  - `Ctrl+I` - italic
  - `Ctrl+]` - list
  - `Ctrl+[` - remove list
  - `Ctrl+1` to `Ctrl+6` - headings
  - `Ctrl+Q` - quote
- Mentions are rendered as inline links.
- `Ctrl+click` a mention to open the related entity in a modal.
- Multiple consecutive line breaks are preserved in editable fields.
- Copy formatted text for Word from supported note areas.
- Optional simplified notes mode hides note titles and focuses on plain note text.

### Characters, NPCs, Locations, and Factions

- Create and edit player characters, NPCs, locations, and factions.
- Store names, levels, race, class, motivation, traits, descriptions, notes, and images.
- Move entities between player characters and NPCs.
- Attach portraits or images from the image gallery.
- Collapse cards and note sections to keep large campaigns manageable.
- Open linked entities from mentions without leaving the current view.

### Campaign Graph

- Visualize campaign relationships generated from bracketed mentions.
- See campaign, session, scene, note, character, NPC, location, and unresolved mention nodes.
- Inspect node details and edit notes from the graph.
- Search the graph and switch between list and graph views.

### Combat Encounters

- Create encounter records linked to session scenes.
- Add monsters from the bestiary.
- Duplicate or delete monsters.
- Roll monster HP from available formulas.
- Track hit points, initiative, and combat participants.
- View encounters as a grid or focused monster preview.
- Import and export encounter data.

### Bestiary

- Browse local bestiary data from `database/bestiary`.
- Search monsters by name, type, and tags.
- Filter by source and favorites.
- Sort by challenge rating.
- View full monster stat blocks with traits, actions, reactions, legendary content, spells, saves, skills, speed, AC, HP, and ability modifiers.
- Open monster token images when available.
- Add monsters directly to an encounter.

### Spells, Conditions, and Statuses

- Browse local spell data from `database/spells`.
- Search spells by name, level, school, and source.
- View spell cards with level, school, casting time, range, components, duration, source, and formatted entries.
- Resolve spell links inside monster and condition content.
- Browse conditions and statuses in a modal.
- Hover or click condition references from monster and spell text.

### Dice Tools

- Roll dice formulas from inline roll links and the dice calculator.
- Supports common dice expressions, modifiers, keep-highest syntax, averages, and critical indicators.

### Image Gallery

- Store campaign and general image assets locally.
- Supported categories include maps, scenes, tokens, characters, props, notes, and attachments.
- Upload images by selecting files or dragging them into the app.
- Create, rename, move, and delete subfolders.
- Rename, move, and delete images.
- Move selected files and folders between image categories or campaigns.
- Use protected `npc` and `players` folders for token and character categories.
- Attach gallery images to campaigns, characters, NPCs, locations, and scenes.

### AI Assistance

Optional Gemini integration can help generate and update campaign or session content.

- Save a Gemini API key from the app. It is written to the local `.env` file.
- Generate campaign story updates, notes, plot branches, scenes, outcomes, characters, NPCs, locations, and encounter suggestions.
- Configure which context is sent to AI.
- Choose whether AI responses should be parsed back into app fields.
- Keep AI response history locally in `data/aiResponses.json`.
- Generate visual prompts for scenes.

AI features require a `GEMINI_API_KEY`.

### Import, Export, and Backups

- Export a single campaign as a JSON bundle.
- Export a single campaign archive with image assets.
- Export a full local backup archive.
- Import campaign bundles or archives.
- Choose import strategies when importing full data.
- Campaign image assets can be moved to General or deleted when campaigns are removed, depending on settings.

### Settings

- Light and dark theme switching.
- Language selection.
- Simplified notes mode.
- Encounter view preferences.
- Persistent settings stored in `data/settings.json`.

## Requirements

- Node.js
- npm

## Running the App

The easiest way on Windows is:

```bat
run_project.bat
```

You can also run:

```bash
npm install
npm run project
```

The project script starts the local server and the Vite client for development use.

## Useful Commands

```bash
npm test
npm run lint
npm run check:uk
```

`npm test` runs the Node-based regression suite in `tests/run-tests.mjs`.

`npm run lint` runs ESLint and the Ukrainian encoding check.

`npm run check:uk` verifies that UTF-8 files with Ukrainian text were not damaged by replacement characters.

## Data Storage

Local data is stored under:

```text
data/
```

Important paths:

```text
data/campaigns/       Campaign metadata, sessions, and entity JSON files
data/images/          General and campaign image assets
data/settings.json    UI and app settings
data/favorites.json   Bestiary favorites
data/aiResponses.json Saved AI response history
```

Reference databases are stored under:

```text
database/bestiary/
database/spells/
```

Because the app stores plain files, you can back up the workspace by copying `data/` and any customized database files.

## Project Structure

```text
server/      Express API, storage layer, imports, exports, AI routes
src/         React application
src/api.js   Client API wrapper
src/components/
src/hooks/
src/models/
src/services/
src/utils/
tests/       Node-based regression tests
scripts/     Local helper scripts
database/    Local D&D reference data
data/        Local user data
```

## Technology

- React
- Vite
- Node.js
- Express
- JSON file storage
- Local filesystem image assets
- Gemini API integration through `@google/generative-ai`

## Notes

This is a local workspace tool. It is designed to be customized for a DM's own campaign workflow, local reference data, and table-prep style.
