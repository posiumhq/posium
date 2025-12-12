<!-- Markdown with HTML -->
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://posium.ai/posium-cover-color-small-1.png">
  <source media="(prefers-color-scheme: light)" srcset="https://posium.ai/posium-cover-color-small-1.png">
  <img alt="Posium" src="https://posium.ai/posium-cover-color-small-1.png">
</picture>
</div>

<p align="center">
  <a href="https://posium.ai">Website</a> - <a href="https://posium.ai/docs">Docs</a> - <a href="https://posium.ai/community">Discord</a> - <a href="https://github.com/posiumhq/posium/issues/new?assignees=&labels=bug&template=bug_report.md">Bug reports</a>
</p>

## Table of Contents

- [🎯 Overview](#-overview)
- [✨ Features](#-features)
- [🛠️ Use Cases](#-use-cases)
- [⚙️ How It Works](#-how-it-works)
- [🧱 Tech Stack](#-tech-stack)
- [🤝 Collaborate](#-collaborate)
- [📄 License](#-license)

## 🎯 Overview

**🧪 Generate and deploy end-to-end tests using just a prompt**

Posium is an open-source AI testing platform that lets you generate end-to-end tests in minutes.

It's a full platform, from generation → execution → scheduling → debugging → maintenance.

- ✅ Browser testing: available now
- 📅 Mobile app testing: coming soon
- 🧩 BYOM (Bring Your Own Model): use your preferred LLM/VLM providers (or self-hosted models)

## ✨ Features

- End-to-end platform: generate, run, schedule, monitor, debug, and maintain tests
- AI-powered test generation (with human oversight): discover flows, plan scenarios, and write tests from real user journeys
- Flake-resistant by design: agents optimized for stability, accuracy, and repeatability
- Auth-ready workflows: supports passwordless flows like magic links and TOTP/OTP
- Run anywhere: CI/CD pipelines + scheduled runs
- Rich debugging artifacts: logs, screenshots, traces, videos, and step-level context
- Suite maintenance: update/repair tests as your UI evolves
- MCP + agent-native: Claude Code, Codex, Cursor, Gemini, etc. can create/update/run tests via MCP

## 🛠️ Use Cases

If it runs in a browser, Posium can test it - any tech stack, fully end-to-end:

- SaaS products: onboarding, billing upgrades, role-based access, invite flows
- E-commerce: search → product details → cart → checkout → refunds/returns flows
- Marketing websites: forms, funnels, gated content, analytics-critical paths
- AI products & agents: chat workflows, tool-calls through a UI, long multi-step sessions, eval-style user journeys
- Internal tools: admin consoles, dashboards, ops workflows, CRUD-heavy apps
- Cross-app journeys: login → third-party auth → emails/OTPs → back to app

## ⚙️ How It Works

Posium generates tests by using your app like a real user in a browser:

1. You describe scenarios (e.g., “sign up → upgrade plan → invite teammate → logout”).
2. Posium launches a browser and navigates the app, observing the UI via:
   - Screenshots + Vision models (VLMs)
   - DOM + accessibility tree signals for reliable element targeting
3. AI agents plan steps, execute them, validate outcomes, and convert the flow into a robust, repeatable test.
4. Tests run in CI or on a schedule, and failures come with built-in debugging (traces, screenshots, video, logs) so you can quickly pinpoint what broke.

## 🧱 Tech Stack

- 🧑‍💻 [TypeScript](https://www.typescriptlang.org/)
- ☘️ [Next.js](https://nextjs.org/)
- 🤖 [Vercel AI SDK](https://sdk.vercel.ai/)
- 🎨 [TailwindCSS](https://tailwindcss.com/)
- 🧑🏼‍🎨 [shadcn/ui](https://ui.shadcn.com/)
- 🧪 [Vitest](https://vitest.dev/)
- 🎭 [Playwright](https://playwright.dev/)
- 🚀 [Fastify](https://fastify.dev/)
- 🔒 [Better-Auth](https://better-auth.com/)
- 🧘‍♂️ [Zod](https://zod.dev/)
- 📚 [Fumadocs](https://github.com/fuma-nama/fumadocs)
- 🌀 [Turborepo](https://turbo.build/)

## 🤝 Collaborate

We'd love to connect with you!

- **💬 [Join the Community](https://posium.ai/community)**: Chat with us on Discord
- **🐛 [Report an Issue][issues]**: Found a bug? Let us know!
- **📬 [Contact Us](https://posium.ai/contact)**: Have questions or want to partner? Reach out!

## 📄 License

Released under [AGPL-3.0][license].

<!-- REFERENCE LINKS -->

[license]: https://github.com/posiumhq/posium/blob/main/LICENSE
[issues]: https://github.com/posiumhq/posium/issues
