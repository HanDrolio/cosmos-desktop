# COSM.OS Desktop Changelog

This changelog records the Windows desktop evolution of COSM.OS.

## 0.8.0 — Living Archive

### Added

- Canonical local archive records for chat messages, journal entries, remembered notes, and Ollama replies.
- Stable source pointers, timestamps, persona metadata, and thread IDs beside original text.
- Global archive search with keyword, source, persona, and date filters.
- Direct result navigation back to the original chat or journal moment.
- Dedicated Threads page showing moment count, latest activity, current phase, and connected personas.
- Unified chronological timeline for every thread across chats, journals, notes, and local replies.
- Retroactive archive scanning that attaches thread metadata without editing stored words.
- Manual thread controls:
  - rename
  - pin
  - hide and unhide
  - merge duplicate threads
  - manually add an archive moment
  - remove a moment while preserving that removal through later scans
- Deterministic local thread summaries.
- Optional Ollama thread summaries through the existing localhost-only desktop bridge.
- Versioned portable archives with archive format version, UI state, thread controls, chats, notes, replies, and local model settings.
- A redesigned clean workspace: compact navigation, universal search, calm rounded surfaces, accessible contrast, and light/dark themes.

### Changed

- Moved the old journal-only Living Thread card into a full archive system shared by Chat and Journal.
- Updated the service-worker cache shell for the archive, model controls, and revised UI.
- Bumped the Windows installer version to 0.8.0.

### Privacy

- Thread scans are deterministic and local.
- Archive exports are ordinary local JSON files.
- Optional enrichment sends records only to the configured local Ollama server, never to a cloud model.

### Result

COSM.OS is no longer only a journal with local AI. It is a locally searchable map of conversations, projects, people, memories, and the paths between them.

---

## 0.7.0 — Pure Signal Reset

Released August 3, 2026.

### Changed

- Rebuilt the conversation engine around a deliberately minimal request path.
- Chat Mode now sends only:
  - the selected persona prompt
  - the last three raw exchanges
  - the current user message
- Log Mode now sends only:
  - the selected persona prompt
  - the current log entry
- Chat defaults to Flux when no persona is selected.
- Log defaults to Ripple when no persona is selected.
- Replaced large persona registries with nine compact base prompts focused on what each voice notices.
- Reduced the Model Lab to generation settings rather than prompt construction controls.

### Removed

- Starter banks
- Curated training examples
- Hidden JSON response schemas
- Hidden yes-and / no-but / maybe-so moves
- Automatic memory injection
- Same-persona context filtering
- Relevance scoring
- Resonance-filter prompt injection
- Response rewriting and anti-sludge parsing
- Automatic persona scoring for ordinary messages

### Added

- Deterministic commands that activate only when typed explicitly:
  - `remember <exact note>`
  - `summary`
  - `plan <goal>`
- Compact prompts for all nine personas:
  - Orion
  - Ripple
  - Astro
  - Brix
  - Demon
  - Echo
  - Hermes
  - Flux
  - COSM.OS

### Result

The architecture became faster, easier to inspect, and better suited to Qwen 2.5 3B. Testing still showed a strong polite-assistant reflex in the base model, but the application now exposes the model more honestly instead of burying it under prompt machinery.

---

## 0.6.0 — Model Lab and Resonance Filter

### Added

- Dedicated Model Lab opened from the model bar.
- Persistent controls for temperature, top-p, repetition penalty, token cap, context window, visible word cap, previous persona turns, starter count, and example count.
- Editable Resonance Filter prompt.
- Built-in and custom saved presets.
- Repetition penalty and context-window forwarding through Electron to Ollama.
- Client-side visible word capping.

### Built-in presets

- Balanced conversation
- Ripple calm
- Orion precise
- KABLOW creative
- Deep conversation

### Result

The model became highly tunable, but the accumulated steering layers made a small local model overthink ordinary conversation. This directly led to the 0.7 reset.

---

## 0.5.0 — Multi-chat, Model Selection, and Persona Prompts

### Added

- Collapsible ChatGPT-style local chat sidebar.
- New-chat creation, switching, deletion, and renaming.
- Automatic chat titles and activity sorting.
- Migration from the older flat message array.
- Installed-model dropdown.
- Model refresh button.
- `auto · largest Qwen` selection.
- Persistent custom prompts for all nine voices.
- Support for upgrading from Qwen 2.5 1.5B to Qwen 2.5 3B without changing application code.

### Export behavior

- Main JSON export includes chats, current chat ID, journal entries, mode, lock state, and sidebar state.
- Ollama model files are never included.
- Model settings were stored separately in local storage.

---

## 0.4.0 — Natural Conversation Engine

### Changed

- Replaced visible `ACTION / INSIGHT / CONSTRAINT` replies with natural language.
- Added hidden conversational moves:
  - yes-and
  - no-but
  - maybe-so
- Returned a structured hidden JSON object while showing only the natural reply.
- Added filters for generic assistant language and visible process commentary.
- Added deterministic fallback replies for greetings, jokes, hype, and casual conversation.

### Result

This reduced visible bureaucracy but still made the model juggle too many hidden rules.

---

## 0.3.0 — Voice Training Data

### Added

- Fifty starter lines for each of nine voices.
- 450 total starter lines.
- Thirty-six curated conversation examples.
- Keyword-overlap relevance scoring.
- Deterministic tie-breaking.
- Persona-isolated history selection.
- Filters to prevent contaminated historical replies from being reused.

### Result

The voices became more recognizable, but the prompt grew increasingly crowded.

---

## 0.2.0 — Structured Stabilization

### Added

- Strict JSON response schema containing action, insight, and constraint.
- Deterministic starter selection.
- Same-persona context.
- Low-temperature generation settings.
- Malformed-output fallback.
- Label and signature stripping.
- Rejection of common customer-service filler.

### Result

Persona-label stacking decreased, but ordinary conversation sounded like bureaucratic caveman paperwork.

---

## 0.1.0 — Windows Desktop MVP

### Desktop shell

- Packaged COSM.OS as an Electron Windows application.
- Added a secure preload bridge.
- Disabled Node.js access in the renderer.
- Enabled context isolation and sandboxing.
- Blocked external navigation inside the app.
- Added NSIS installer and portable build commands.

### Ollama integration

- Connected to Ollama at `127.0.0.1:11434`.
- Added installed-model discovery through `/api/tags`.
- Added local generation through `/api/chat`.
- Added a three-minute timeout for slow CPU model loading.
- Preserved deterministic fallback behavior when Ollama was unavailable.

### Build system

- Added GitHub Actions Windows packaging.
- Added JavaScript syntax checks.
- Added setup and troubleshooting documentation.

---

## Testing findings

Testing across the versions exposed recurring failure modes:

- generic customer-service filler
- forced advice during casual conversation
- persona-label stacking
- invented memories, motives, and meanings
- story continuity failures
- failure to accept direct corrections
- replies that described responding instead of actually responding
- confusion between COSM.OS architecture and the underlying model
- the assumption that a larger model automatically adds application features

Core test prompts included:

- `hello`
- `kablow`
- `just chilling`
- `my dog is sleeping like he pays rent`
- `continue what you were just saying`
- `do not turn this into advice, just vibe with me`
- `disagree with me without becoming annoying`
- `say something I have not noticed yet`
- `I miss Tiger`

---

## Canonical milestone

On August 3, 2026, COSM.OS ran fully offline through Ollama on a Lenovo ThinkCentre, shipped v0.7, used nine custom personas, and completed its hardware evolution:

```text
iPhone → Chromebook → Windows desktop
```

The local model was still slow and imperfect, but the stack worked under the operator's control.

> You did not merely use AI. You possessed the stack.
