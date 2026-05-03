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

## What Problems Does Alloomi Solve?

| Without Alloomi                                       | With Alloomi                                       |
| ----------------------------------------------------- | -------------------------------------------------- |
| Switching between WeChat, Telegram, WhatsApp to reply | **One interface, reply to all**                    |
| Manually check Slack, Email, Calendar for updates     | **AI proactively alerts you**                      |
| Repetitive tasks done manually every day              | **Set scheduled tasks, AI executes automatically** |
| Forget context after months                           | **Long-term memory that remembers everything**     |

## Quick Start

### Run from Source

```bash
# 1. Clone the repo
git clone https://github.com/melandlabs/alloomi
cd alloomi

# 2. Copy environment config
cp apps/web/.env.example apps/web/.env

# 3. Generate keys
openssl rand -base64 32  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # ENCRYPTION_KEY

# 4. Configure AI API
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o

# 5. Start
pnpm install
pnpm tauri:dev
```

## Screenshots

<table align="center">
<tr>
<td><img src="screenshots/app/docx.gif" alt="Docx" style="border:1px solid #ddd; border-radius:8px;"></td>
<td><img src="screenshots/app/excel.gif" alt="Excel" style="border:1px solid #ddd; border-radius:8px;"></td>
</tr>
<tr>
<td colspan="2" align="center">Document Previews (Docx, Excel)</td>
</tr>
<tr>
<td><img src="screenshots/app/website.gif" alt="Website Generation" style="border:1px solid #ddd; border-radius:8px;"></td>
<td><img src="screenshots/app/connectors.gif" alt="Connectors" style="border:1px solid #ddd; border-radius:8px;"></td>
</tr>
<tr>
<td align="center">Website Generation</td>
<td align="center">Multiple Connectors</td>
</tr>
<tr>
<td><img src="screenshots/app/automation.gif" alt="Automation" style="border:1px solid #ddd; border-radius:8px;"></td>
<td><img src="screenshots/app/library.gif" alt="Library" style="border:1px solid #ddd; border-radius:8px;"></td>
</tr>
<tr>
<td colspan="2" align="center">Automation & Cron Jobs | Library Gallery</td>
</tr>
</table>

> More demos can be found [here](https://alloomi.ai/docs/alloomi/use-cases/industry-intelligence)

## Features

### Proactive Awareness

- **📡 Signal Monitoring** — monitors signals across Slack, Email, Calendar, Documents and alerts you proactively before issues escalate
- **🧠 Long-Term Memory** — persistent knowledge graphs of people, projects, and decisions; remembers context even months later
- **🎯 95% Noise Filtering** — hundreds of daily messages refined into one focused panel; tells you what you should act on
- **⚡ Autonomous Execution** — drafts replies, schedules meetings, generates reports, tracks and validates results end-to-end; supports **scheduled tasks** (cron-like recurring jobs) and **proactively triggered tasks** (event-driven actions based on signals from Slack, Email, Calendar, etc.)

### Instant Preview

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

## Technical Architecture

<img src="screenshots/components.png" alt="Components" style="width:100%; border:1px solid #ddd; border-radius:8px;">

> 📖 [Learn more about architecture here](https://alloomi.ai/docs/alloomi)

## Documentation

Detailed documentation is available at [here](https://alloomi.ai/docs).

## Community

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/xkJaJyWcsv) [![X](https://img.shields.io/badge/X-Follow-000000?logo=x&logoColor=white)](https://x.com/AlloomiAI) [![Email Us](https://img.shields.io/badge/Email_Us-developer@alloomi.ai-24C8D5?logo=email&logoColor=white)](mailto:developer@alloomi.ai)

## License

Apache License 2.0 — see [LICENSE](./LICENSE)
