# COSM.OS Desktop

**A private, local-first desktop archive for conversations, journals, local AI replies, and the threads that connect them.**

COSM.OS Desktop runs on your Windows computer, talks to Ollama only through localhost at port 11434, and stores its archive in local browser storage. It has no account, cloud database, telemetry pipeline, or remote archive sync.

> The system may help the operator think. It may never replace the operator's judgment.

## v0.8.0 — Living Archive

### Search your past. Follow the thread. Open the original moment.

- Search every stored chat message, journal entry, remembered note, and local Ollama reply.
- Filter results by keyword, source, persona, and date.
- Jump from a result directly back to the original chat or journal moment.
- Scan the existing archive retroactively without changing the original words.
- Browse a dedicated Threads page with moment count, latest activity, phase, and connected personas.
- Open a chronological timeline that combines related chats, notes, and local replies.
- Rename, pin, hide, merge, and manually add or remove moments from threads.
- Generate deterministic thread summaries by default.
- Optionally ask the installed local Ollama model for a richer summary; archive data never goes to a cloud model.
- Export and import a versioned portable archive containing chats, journal entries, thread IDs, thread controls, and model/UI settings.

## Download

Get the newest installer from [the latest release](../../releases/latest).

- [COSM.OS Desktop v0.8.0](../../releases/tag/v0.8.0)
- [COSM.OS Desktop v0.7.0 — Pure Signal Reset](../../releases/tag/v0.7.0)

The installer is unsigned, so Windows SmartScreen may display a warning. COSM.OS does not bundle a model; install Ollama and at least one local chat model separately.

## The archive boundary

Every archive moment receives a stable local ID and source pointer:

~~~text
chat message ──┐
journal entry ─┼─→ record ID + timestamp + source + persona + thread IDs
local reply ───┤
remembered note┘
~~~

Thread scans add relationships beside the original records. They do not rewrite chat text, journal text, or Ollama replies. Manual removals are preserved across future scans.

Portable exports use a versioned JSON envelope:

~~~json
{
  "format": "cosmos.desktop.archive",
  "archiveVersion": 2,
  "appVersion": "0.8.0"
}
~~~

Import merges stable archive records and relationships instead of treating the file as a disposable transcript.

## Local model architecture

~~~text
COSM.OS renderer
      ↓ secure preload API
Electron main process
      ↓ localhost only
Ollama API at 127.0.0.1:11434
      ↓
installed local model
~~~

The renderer has no Node.js or shell access. The optional thread-summary action uses the same local Ollama path; normal chats remain compact:

~~~text
selected persona prompt
      ↓
last three raw exchanges
      ↓
current user message
      ↓
local Ollama model
~~~

Log mode uses the selected persona prompt and the one current journal entry only.

## The nine personas

| Persona | Function |
|---|---|
| 🔵🧭 Orion | logic, structure, planning |
| 🟢🌊 Ripple | presence, journaling, ordinary moments |
| 🟡💛 Astro | emotion, tenderness, meaning |
| 🟤🧱 Brix | body, discipline, practical action |
| 🔴🪞 Demon | friction, contradiction, roast |
| 🟠📡 Echo | memory and continuity |
| ⚪🪽 Hermes | metaphor, naming, storytelling |
| 🟣🌀 Flux | natural conversation and synthesis |
| 🟦🌌🟨 COSM.OS | architecture and system explanation |

## Explicit commands

These remain deterministic local utilities. They only run when typed directly:

~~~text
remember <exact note>
summary
plan <goal>
~~~

## Requirements

- Windows 10 or newer
- Ollama installed and running
- At least one local chat model

For the original ThinkCentre build:

~~~powershell
ollama pull qwen2.5:3b
ollama list
~~~

## Run from source

~~~powershell
npm install
npm start
~~~

## Build the Windows installer

~~~powershell
npm run dist
~~~

The installer is written to:

~~~text
dist/COSM.OS-Setup-0.8.0.exe
~~~

## Release history

COSM.OS moved through three hardware stages:

~~~text
iPhone Shortcut → Chromebook web app → Windows ThinkCentre desktop app
~~~

The first fully offline Windows milestone shipped as v0.7.0 on August 3, 2026. v0.8.0 turns that local journal into a searchable map of life and projects. See [CHANGELOG.md](./CHANGELOG.md) for the full history.
