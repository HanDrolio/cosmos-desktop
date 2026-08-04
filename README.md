# COSM.OS Desktop

**A private, local-first Windows AI journal and conversation system powered by Ollama.**

COSM.OS Desktop runs an installed language model on your own computer, stores chats locally, and routes conversation through nine distinct cognitive personas. The current release is **v0.7.0**.

> The system may help the operator think. It may never replace the operator's judgment.

## Download

Get the latest Windows installer from the repository's **Releases** page:

**[Download COSM.OS Desktop](../../releases/latest)**

The installer is unsigned, so Windows SmartScreen may display a warning. The application does not bundle an AI model; Ollama and a local model must be installed separately.

## What it includes

- Native Windows desktop application built with Electron
- Local Ollama connection through `127.0.0.1:11434`
- Automatic detection of installed models
- Automatic preference for the largest installed Qwen model
- Manual model selection and refresh
- Multi-chat local sidebar
- Separate Chat and Log modes
- JSON import and export
- Generation presets and basic model tuning
- Nine compact persona prompts
- Deterministic `remember`, `summary`, and `plan` commands
- No account, cloud database, or internet connection required after setup

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

## v0.7 architecture

COSM.OS v0.7 removes the prompt machinery that made small local models overthink.

### Chat Mode

```text
selected persona prompt
      ↓
last three raw exchanges
      ↓
current user message
      ↓
local Ollama model
```

When no persona is selected, Chat Mode defaults to **Flux**.

### Log Mode

```text
selected persona prompt
      ↓
current log entry only
      ↓
local Ollama model
```

Log Mode receives no chat history and no retrieved memories. When no persona is selected, it defaults to **Ripple**.

### Explicit commands

These run deterministic local logic only when typed directly:

```text
remember <exact note>
summary
plan <goal>
```

## Requirements

- Windows 10 or newer
- Ollama installed and running
- At least one local chat model

Recommended for the original ThinkCentre build:

```powershell
ollama pull qwen2.5:3b
```

Confirm Ollama can see the model:

```powershell
ollama list
```

Then install and open COSM.OS Desktop.

## Run from source

```powershell
npm install
npm start
```

## Build the installer

```powershell
npm run dist
```

The installer is written to:

```text
dist/COSM.OS-Setup-0.7.0.exe
```

## Security boundary

```text
COSM.OS renderer
      ↓ secure preload API
Electron main process
      ↓ localhost only
Ollama API
      ↓
installed local model
```

The renderer has no Node.js or shell access. Chats and logs stay in local browser storage on the machine.

## Project history

COSM.OS evolved across three hardware stages:

```text
iPhone Shortcut → Chromebook web app → Windows ThinkCentre desktop app
```

The first fully offline Windows milestone was completed on August 3, 2026. See [CHANGELOG.md](./CHANGELOG.md) for the version history.
