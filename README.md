<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/images/logo-dark-light.svg">
  <img src="apps/web/public/images/logo-full-light.svg" alt="Alloomi Logo">
</picture>

</br>
</br>

[![Node.js Version](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org) [![Tauri](https://img.shields.io/badge/Tauri-Desktop-24C8D5?logo=tauri)](https://tauri.app) [![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-4B4B4B?logo=linux&logoColor=white)](https://alloomi.ai) [![License](https://img.shields.io/badge/License-Apache%202.0-F8D52A?logo=apache)](https://www.apache.org/licenses/LICENSE-2.0) [![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/xkJaJyWcsv) [![X](https://img.shields.io/badge/X-Follow-000000?logo=x&logoColor=white)](https://x.com/AlloomiAI)

#### _Proactive AI workspace — understands your intent, orchestrates execution, and gets things done._

  <a href="https://github.com/melandlabs/release">
    <img src="https://img.shields.io/github/v/tag/melandlabs/release?logo=github&label=Download&color=24C8D5" alt="Download" height="30" style="transform:scale(1);">
  </a>
</div>

Alloomi is a **proactive AI workspace** that monitors business signals, orchestrates tasks autonomously, and tracks and validates results end-to-end. Unlike traditional AI assistants that are passive workflow tools, Alloomi acts as a **proactive AI workspace** that watches, learns, remembers, and acts on your behalf.

> This is the **open-source core** of Alloomi. It includes the core infrastructure and modules, but requires you to configure your own LLM API Key, authentication, authorization, AI MCPs and skills. For the full ready-to-use product with all features enabled, please download from the official website: **[alloomi.ai](https://alloomi.ai)**

<p align="center">
<a href="#features">Features</a>&nbsp;|&nbsp;
<a href="#what-makes-alloomi-different">Difference</a>&nbsp;|&nbsp;
<a href="#use-cases">Use Cases</a>&nbsp;|&nbsp;
<a href="#installation">Installation</a>&nbsp;|&nbsp;
<a href="#documentation">Documentation</a>&nbsp;|&nbsp;
<a href="#developing">Developing</a>
</p>

## Features

### Core Capabilities

- **📡 Proactive Awareness** — monitors signals across Slack, Email, Calendar, Documents and alerts you proactively before issues escalate
- **🧠 Long-Term Memory (Context Atlas)** — persistent knowledge graphs of people, projects, and decisions; remembers context even months later
- **🎯 95% Noise Filtering** — hundreds of daily messages refined into one focused panel; tells you what you should act on
- **⚡ Autonomous Execution** — drafts replies, schedules meetings, generates reports, tracks and validates results end-to-end; supports **scheduled tasks** (cron-like recurring jobs) and **proactively triggered tasks** (event-driven actions based on signals from Slack, Email, Calendar, etc.)
- **💬 Natural Chat** — assign tasks in plain language; no complex commands to learn with powerful skills and MCP tools

### Built-in File Preview

- **Documents** — Docx, DOC, ODT, RTF
- **Spreadsheets** — Xlsx, XLS, CSV, ODS
- **Presentations** — PPTx, PPT, ODP
- **PDF** — PDF files with full rendering
- **Images** — JPG, PNG, GIF, SVG, WebP, BMP
- **Code** — Syntax-highlighted preview for JS, TS, Python, Go, Rust, and 20+ languages and HTML preview with live rendering

### Multi-Platform Access

- **Messaging Apps** — Telegram, WhatsApp, iMessage, QQ, Feishu, Weixin, Dingtalk integrations with message fetching, sending, file attachments, and real-time sync
- **Desktop Apps** — Native apps for Windows, macOS, and Linux with keyboard shortcuts and system tray

### Enterprise-Grade Security

- AES-256 end-to-end encryption
- Hardware-isolated processing environments (no public gateways)
- Zero training commitments — your data never trains public AI models
- Local-first architecture

### Agent Runtime Integrations

- **Claude Code** — Anthropic's coding agent (auto-inherits `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` from environment & [skills](https://code.claude.com/docs/en/skills) in `~/.claude/skills`) _(Default)_
- **Codex** — OpenAI's code generation agent _(Coming Soon)_
- **Gemmi** — General-purpose AI agent _(Coming Soon)_
- **Pi** — Inflection AI's personal agent _(Coming Soon)_
- **OpenClaw** — Open agent protocol & ecosystem _(Coming Soon)_
- **Hermes Agent** — NousResearch's agent framework _(Coming Soon)_

### Hybrid Model Architecture (Coming Soon)

- **🤖 Hybrid Model Routing** — dynamically routes tasks to optimal models (Claude, GPT, Gemini, open-source) based on complexity, cost, and latency requirements
- **🧪 Reinforcement Learning from Feedback (RLHF) & LoRA** — continuously improves task execution quality through human feedback signals
- **🔄 Multi-Agent Debate** — multiple specialized agents collaborate and debate to reach higher-quality decisions
- **📊 Outcome Validation** — end-to-end result verification with automated checks and human-in-the-loop approval workflows
- **🧬 Adaptive Personalization** — learns your communication style, preferences, and workflows over time

## What Makes Alloomi Different?

Most AI assistants are **workflow tools**—you give commands, they execute tasks, with no knowledge of
who you are. Sometimes they surprise you in ways you didn't expect. But usually, most of the time, they
frustrate you, filled with uncertainty, and accompanied by issues of context, memory, cost, and security.

Alloomi is different: it's a **proactive digital partner** that watches, learns, remembers, and acts on
your behalf. The difference is architectural.

When you connect your messaging platforms and integrations to Alloomi, you don't just chat with it through
Telegram, WhatsApp, and other apps—you also sync everything with your permission: raw messages, meetings,
emails, tweets, calendar events, voice calls, and any notes or ideas you've captured. All of this—including
your conversations with Alloomi itself—becomes the **single source of truth** for Alloomi's brain.

Behind the scenes, Alloomi runs a background agent on a continuous sync loop, actively gathering information
from all your connected sources. An agent without this loop can only respond based on stale context. With it,
every conversation—and every moment—makes Alloomi smarter and more aligned with you. When you create a custom
agent role in Alloomi to handle one-off or scheduled tasks, this brain acts as the orchestrator, dramatically
improving execution quality.

<img src="screenshots/arch.png" alt="Architecture" style="width:100%; border:1px solid #ddd; border-radius:8px;">

Alloomi implements a complete **"Receive → Process → Remember → Understand → Serve"** loop:

| Layer             | What It Does                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **📡 Receive**    | Multi-platform, multi-modal ingestion — IM, email, documents, files, web data, voice calls           |
| **⚙️ Process**    | Noise reduction at scale — deduplication, OCR, ASR, intent extraction, semantic clustering           |
| **🧠 Remember**   | Persistent knowledge graph — people, projects, decisions — survives conversations and months of time |
| **🎯 Understand** | Deep semantic intent, cross-modal understanding, emotional tone, contextual relevance                |
| **🚀 Serve**      | Proactive delivery — smart summaries, auto-replies, scheduled reports, personalized alerts           |

### Layered Memory Architecture

- **Raw information** — original messages, files, transcripts
- **Information insights** — extracted entities, decisions, key events, timeline, execution diff
- **Contextual memory** — recent conversation state, temporary context
- **Knowledge-base memory** — long-term people/projects/preferences knowledge graph

## Use Cases

- **🌍 Global Managers** — Filter time zone and language noise, capture high-value opportunities 24/7
- **🧑‍💻 Engineers & Product Teams** — Team memory that never decays, auto-generate weekly reports, eliminate context rot
- **🚀 Founders & Salespeople** — Maintain hundreds of client relationships, auto follow-ups, personalized proposals at scale
- **🧑‍💻 Engineering Teams** — Automated dev reports, issue triaging, GitHub-Linear sync
- **📱 Social Media Managers** — Autopilot X (Twitter) account with approval workflow

See [here](https://alloomi.ai/docs) for more features and use cases.

## Screenshots

- Document Previews — Docx, PPTx & Xlsx

<table align="center">
<tr>
<td><img src="screenshots/app/docx.gif" alt="Docx" style="border:1px solid #ddd; border-radius:8px;"></td>
<td><img src="screenshots/app/excel.gif" alt="Excel" style="border:1px solid #ddd; border-radius:8px;"></td>
</tr>
</table>

- Website Generation

<img src="screenshots/app/website.gif" alt="Website Generation" style="width:100%; border:1px solid #ddd; border-radius:8px;">

- Mutliple Connectors

<img src="screenshots/app/connector.png" alt="Connector" style="width:100%; border:1px solid #ddd; border-radius:8px;">

- Automation & Cron Jobs

<img src="screenshots/app/automation.png" alt="Automation" style="width:100%; border:1px solid #ddd; border-radius:8px;">

- Library

<img src="screenshots/app/library.png" alt="Library" style="width:100%; border:1px solid #ddd; border-radius:8px;">

- Skills

<img src="screenshots/app/skill.png" alt="Skill" style="width:100%; border:1px solid #ddd; border-radius:8px;">

- Message Apps

<img src="screenshots/app/message-app.png" alt="Message App" style="width:100%; border:1px solid #ddd; border-radius:8px;">

See [alloomi.ai](https://alloomi.ai) for more information.

## Installation

For more information about installation, please check the Installation Guide on the [Alloomi GitHub Releases](https://github.com/melandlabs/release).

## Documentation

Detailed documentation is available at [Alloomi Website](https://alloomi.ai/docs).

## Developing

### Environment Setup

Download Node.js 22+, pnpm 9+, Rust Cargo 1.88+

Copy the example environment file and configure your credentials:

```bash
git clone https://github.com/melandlabs/alloomi
cd alloomi
cp apps/web/.env.example apps/web/.env
```

#### Required Variables

Set required variables in `apps/web/.env`

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

| Variable         | Description                           |
| ---------------- | ------------------------------------- |
| `AUTH_SECRET`    | Authentication secret (32+ chars)     |
| `ENCRYPTION_KEY` | AES-256 encryption key for local data |

#### AI Configuration

Choose your AI provider (Anthropic, OpenAI, or OpenRouter):

```bash
# Anthropic Compatible API
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# OpenAI Compatible API
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

For **embeddings** (RAG / Knowledge Base), an OpenAI-compatible API key is required:

```bash
OPENAI_EMBEDDINGS_API_KEY=sk-...
LLM_EMBEDDING_BASE_URL=https://api.openai.com/v1
LLM_EMBEDDING_MODEL=text-embedding-3-small
```

#### Optional Integrations

| Variable                        | Description                  |
| ------------------------------- | ---------------------------- |
| `BRAVE_SEARCH_API_KEY`          | Brave Search for web content |
| `TG_BOT_TOKEN`                  | Telegram bot token           |
| `SLACK_BOT_TOKEN`               | Slack bot token              |
| `DISCORD_BOT_TOKEN`             | Discord bot token            |
| `TWITTER_CLIENT_ID` / `_SECRET` | Twitter OAuth                |
| `GOOGLE_CLIENT_ID` / `_SECRET`  | Google OAuth                 |
| `GMAIL_CLIENT_ID` / `_SECRET`   | Gmail OAuth                  |
| `AUTH_SMTP_*`                   | Email SMTP server            |

Requirements: Node.js 22+, pnpm 9+, Rust Cargo 1.88+

## Install

```bash
# Install dependencies
pnpm install

# Start desktop app (requires Rust)
pnpm tauri:dev
```

## Build & Test

```bash
pnpm tsc          # Type check
pnpm format       # Format code
pnpm lint         # Lint
pnpm lint:fix     # Fix lint issues
pnpm test         # Run tests
```
