# Alloomi

> **Proactive AI workspace** — understands your intent, orchestrates execution, and gets things done.

Alloomi is a **proactive AI workspace** that monitors business signals, orchestrates tasks autonomously, and tracks and validates results end-to-end. Unlike traditional AI assistants that are passive workflow tools, Alloomi acts as a **proactive digital partner** that watches, learns, remembers, and acts on your behalf.

## Features

### Core Capabilities

- **📡 Proactive Awareness** — monitors signals across Slack, Email, Calendar, Documents and alerts you proactively before issues escalate
- **🧠 Long-Term Memory (Context Atlas)** — persistent knowledge graphs of people, projects, and decisions; remembers context even months later
- **🎯 95% Noise Filtering** — hundreds of daily messages refined into one focused panel; tells you what you should act on
- **⚡ Autonomous Execution** — drafts replies, schedules meetings, generates reports, tracks and validates results end-to-end
- **💬 Natural Chat** — assign tasks in plain language; no complex commands to learn

### Multi-Platform Access

- **Messaging Apps** — Telegram, WhatsApp, iMessage, QQ, Feishu integrations
- **Desktop Apps** — Native apps for Windows, macOS, and Linux with keyboard shortcuts and system tray
- **Web App** — Always accessible in your browser

### Enterprise-Grade Security

- AES-256 end-to-end encryption
- Hardware-isolated processing environments (no public gateways)
- Zero training commitments — your data never trains public AI models
- Local-first architecture

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

## Screenshots

- Chat

![Chat Interface](screenshots/chat.png)

- Connector

![Connector](screenshots/connector.png)

- Automation

![Automation](screenshots/automation.png)

- Library

![Library](screenshots/library.png)

- Skill

![Skill](screenshots/skill.png)

- Message Apps

![Message App](screenshots/message-app.png)

See [alloomi.ai](https://alloomi.ai) for more information.

## Developing

Requirements: Node.js 18+, pnpm 9+, Rust Cargo 1.88+

```bash
# Install dependencies
pnpm install --ignore-scripts=false

# Setup database (only once or when schema changes)
cd apps/web && pnpm db:generate && pnpm db:migrate && pnpm db:push && cd ../..

# Start desktop app (requires Rust)
pnpm tauri:dev

# Start web app
pnpm dev
```

Web app runs at [localhost:3415](http://localhost:3415).

## Build & Test

```bash
pnpm tsc          # Type check
pnpm format       # Format code
pnpm lint         # Lint
pnpm lint:fix     # Fix lint issues
pnpm test         # Run tests
```

## Note

This is the **open-source core** of Alloomi. It includes the core infrastructure and modules, but requires you to configure your own LLM API Key, authentication, authorization, AI MCPs and skills. For the full ready-to-use product with all features enabled, please download from the official website: **[alloomi.ai](https://alloomi.ai)**
