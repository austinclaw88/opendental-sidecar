# OpenDental Sidecar — Knowledge Base

Welcome. Start here to understand the project.

## 📋 Overview

| | |
|---|---|
| **Project** | OpenDental Sidecar — Modern read-only web interface for OpenDental |
| **Phase** | 1 (Viewer) |
| **Status** | Active |
| **Repo** | [github.com/austinclaw88/opendental-sidecar](https://github.com/austinclaw88/opendental-sidecar) |

## 🗺️ Navigation

| Section | Description |
|---------|-------------|
| [[01 - Architecture Overview\|Architecture Overview]] | System design, layers, principles |
| [[02 - Backend API\|Backend API]] | All public endpoints, DTOs, status codes |
| [[03 - Frontend\|Frontend]] | Next.js app structure, components, design system |
| [[04 - Repository Layer\|Repository Layer]] | Interfaces, implementations, data flow |
| [[05 - Docker and CI\|Docker and CI]] | Containers, compose, build, GitHub Actions |
| [[06 - Known Issues\|Known Issues]] | Active bugs, technical debt, risks |
| [[07 - Roadmap\|Roadmap]] | Planned features and phases |
| [[08 - Decisions\|Decisions]] | Architecture Decision Records (ADRs) |
| [[09 - Graphify Notes\|Graphify Notes]] | Code graph analysis and dependency tracking |

## 🔑 Key Principles

1. **Read-only** — No writes to the OpenDental database
2. **Business domains over tables** — Think Patient Profile, not `patient`
3. **Security first** — CORS locked, SSN excluded, audit logging, env-based config
4. **Docker-built** — `docker compose up` should just work
5. **Docs as code** — This vault stays in sync with the codebase

## 🚀 Getting Started

```bash
# Clone
git clone https://github.com/austinclaw88/opendental-sidecar.git

# With demo data (no real OpenDental needed)
docker compose --profile demo up

# With real OpenDental DB
cp .env.example .env
# edit .env
docker compose up

# Open
open http://localhost:3000
```
