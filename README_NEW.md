<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/images/logo-dark-light.svg">
  <img src="apps/web/public/images/logo-full-light.svg" alt="Alloomi Logo" width="300">
</picture>

</br>

[![Node.js Version](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Tauri](https://img.shields.io/badge/Tauri-Desktop-24C8D5?logo=tauri)](https://tauri.app)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-4B4B4B?logo=linux&logoColor=white)](https://alloomi.ai)
[![License](https://img.shields.io/badge/License-Apache%202.0-F8D52A?logo=apache)](https://www.apache.org/licenses/LICENSE-2.0)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/xkJaJyWcsv)
[![X](https://img.shields.io/badge/X-Follow-000000?logo=x&logoColor=white)](https://x.com/AlloomiAI)

#### _Proactive AI workspace — understands your intent, orchestrates execution, and gets things done._

<a href="https://github.com/melandlabs/release">
  <img src="https://img.shields.io/github/v/tag/melandlabs/release?logo=github&label=Download&color=24C8D5" alt="Download" height="30">
</a>
</div>

**Alloomi** is a proactive AI workspace that monitors business signals, orchestrates tasks autonomously, and tracks results end-to-end. Unlike passive AI assistants, Alloomi acts as your **digital partner** that watches, learns, remembers, and acts on your behalf.

> ⚠️ **Open-source vs Full Product**: This is the open-source core. For the full ready-to-use product, download from **[alloomi.ai](https://alloomi.ai)**

---

## 🎯 What Problems Does Alloomi Solve?

| Without Alloomi | With Alloomi |
|-----------------|--------------|
| Switching between WeChat, Telegram, WhatsApp to reply | **One interface, reply to all** |
| Manually check Slack, Email, Calendar for updates | **AI proactively alerts you** |
| Repetitive tasks done manually every day | **Set scheduled tasks, AI executes automatically** |
| Forget context after months | **Long-term memory that remembers everything** |

---

## 🚀 Quick Start (2 Minutes)

### Option 1: Desktop Client (Recommended)

```bash
# Download desktop client (macOS / Windows / Linux)
# Visit: https://github.com/melandlabs/release
# Or: https://alloomi.ai
```

### Option 2: Run from Source

```bash
# 1. Clone the repo
git clone https://github.com/melandlabs/alloomi
cd alloomi

# 2. Copy environment config
cp apps/web/.env.example apps/web/.env

# 3. Generate keys
openssl rand -base64 32  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"  # ENCRYPTION_KEY

# 4. Configure AI (at least one required)
export ANTHROPIC_API_KEY=sk-ant-...   # Anthropic
export LLM_API_KEY=sk-...             # OpenAI / OpenRouter

# 5. Start
pnpm install
pnpm tauri:dev
```

> ⚠️ **Open Source vs Full Version**
> - **Open Source**: Core modules + bring your own API keys + configure MCPs
> - **Full Version**: [alloomi.ai](https://alloomi.ai) — download and use immediately

---

## 📸 Demo

<table align="center">
<tr>
<td><img src="screenshots/app/docx.gif" alt="Docx" style="border:1px solid #ddd; border-radius:8px;"></td>
<td><img src="screenshots/app/excel.gif" alt="Excel" style="border:1px solid #ddd; border-radius:8px;"></td>
</tr>
<tr>
<td><img src="screenshots/app/pptx.gif" alt="PPTx" style="border:1px solid #ddd; border-radius:8px;"></td>
<td><img src="screenshots/app/automation.gif" alt="Automation" style="border:1px solid #ddd; border-radius:8px;"></td>
</tr>
</table>

More demos: [alloomi.ai](https://alloomi.ai)

---

## ✨ Core Features

### 📡 Smart Awareness

- Cross-platform monitoring: Slack, Email, Calendar, Documents
- Proactive alerts — catches issues before you do

### 🧠 Super Memory

- Long-term memory system — remembers context from months ago
- Knowledge graph of relationships, projects, decisions

### ⚡ Auto Execution

- Schedule tasks in natural language, no complex commands needed
- Support for scheduled tasks (Cron) + event-driven triggers
- Automatic execution result tracking

### 💬 Natural Conversation

- Assign tasks in plain language
- 200+ built-in Skills + MCP tools

### 📄 Document Preview (Built-in)

| Type | Supported Formats |
|------|------------------|
| Documents | Docx, DOC, ODT, RTF |
| Spreadsheets | Xlsx, XLS, CSV, ODS |
| Presentations | PPTx, PPT, ODP |
| PDF | Full rendering |
| Images | JPG, PNG, GIF, SVG, WebP |
| Code | JS, TS, Python, Go, Rust and 20+ more |

### 📱 Multi-Platform Access

- **IM**: Telegram, WhatsApp, iMessage, QQ, Feishu, WeChat, DingTalk
- **Desktop**: Windows, macOS, Linux (native apps)

### 🔐 Enterprise-Grade Security

- AES-256 end-to-end encryption
- Hardware-level isolated processing environment
- Zero-training commitment — your data is never used for AI training
- Local-first architecture

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Alloomi Core                          │
├─────────────────────────────────────────────────────────────┤
│  📥 Receive  │  ⚙️ Process  │  🧠 Remember  │  🎯 Understand │
│  Multi-platform │  Denoise   │  Knowledge   │   Semantic    │
│    input      │  processing │   Graph      │  Understanding│
├─────────────────────────────────────────────────────────────┤
│  🚀 Serve                                                   │
│  Proactive: Summary / Auto-reply / Scheduled Reports       │
├─────────────────────────────────────────────────────────────┤
│  Packages: ai · api · billing · hooks · i18n · integrations│
│            indexeddb · insights · rag · storage · ...       │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Function |
|-------|----------|
| **Receive** | Multi-platform, multi-modal message input |
| **Process** | Deduplication, OCR, ASR, intent extraction |
| **Remember** | Persistent knowledge graph |
| **Understand** | Deep semantic understanding |
| **Serve** | Proactive service delivery |

> 📖 [Learn more about architecture](./docs/architecture.md)

---

## 🤖 Supported AI Runtimes

| Runtime | Status | Description |
|---------|--------|-------------|
| Claude Code | ✅ Available | Anthropic's official coding agent |
| Codex | 🔜 Coming Soon | OpenAI code generation |
| Gemini | 🔜 Coming Soon | Google's general AI |
| OpenClaw | 🔜 Coming Soon | Open agent protocol |
| Hermes Agent | 🔜 Coming Soon | NousResearch framework |

---

## 👥 Join the Community

<div align="center">

**Be among the first to use Alloomi** → [Join the waitlist](mailto:hello@alloomi.ai)

<a href="https://discord.com/invite/xkJaJyWcsv" style="display:inline-block; margin: 10px; padding: 10px; background: #5865F2; color: white; border-radius: 8px; text-decoration: none;">
  Join Discord
</a>

</div>

---

## 🤝 Contributing (For Developers)

### Contributing Code

```bash
# 1. Fork the project
# 2. Create a branch
git checkout -b feature/your-feature

# 3. Commit
git commit -m "feat: add something"

# 4. Push and create PR
git push origin feature/your-feature
```

See [CONTRIBUTING](./docs/CONTRIBUTING.md) for details.

### Getting Help

- 🐛 Report bugs → [GitHub Issues](https://github.com/melandlabs/alloomi/issues)
- 💡 Feature requests → [Feature Requests](https://github.com/melandlabs/alloomi/discussions)
- 💬 Discuss → [Discord](https://discord.com/invite/xkJaJyWcsv)

---

## 📄 License

Apache License 2.0 — see [LICENSE](./LICENSE)

---

## 🔗 Links

| Resource | Link |
|----------|------|
| Website | [alloomi.ai](https://alloomi.ai) |
| Docs | [alloomi.ai/docs](https://alloomi.ai/docs) |
| Downloads | [GitHub Releases](https://github.com/melandlabs/release) |
| Discord | [discord.com/invite/xkJaJyWcsv](https://discord.com/invite/xkJaJyWcsv) |
| X (Twitter) | [x.com/AlloomiAI](https://x.com/AlloomiAI) |