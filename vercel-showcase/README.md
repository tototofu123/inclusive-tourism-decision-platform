# Vercel Showcase — Inclusive Tourism Decision Platform

## Purpose

This folder defines the Vercel deployment strategy for the Inclusive Tourism & Accessibility Decision Intelligence Platform for Kowloon and Hong Kong. It covers how each version of the platform is deployed, previewed, and demonstrated to stakeholders, judges, and the public.

This is the canonical reference for any agent or developer managing deployments, environment configuration, or showcase URLs.

---

## Project Overview

| Field | Value |
|---|---|
| GitHub Repo | `tototofu123/inclusive-tourism-decision-platform` |
| Language | TypeScript |
| Versions | `version-mvp-web`, `version-v1-web`, `version-web-v2`, `version-web-v3` |
| Deployment Target | Vercel (Hobby or Pro tier) |
| Primary Region | Hong Kong / Asia Pacific (`hkg1`) |

---

## Deployment Architecture

Each version directory is a self-contained web application. The showcase strategy maps each version to either:

1. **A dedicated Vercel Project** — for versions that need their own domain, environment variables, and independent CI/CD.
2. **A preview branch deployment** — for versions still in development or used for demo comparison only.

### Version → Deployment Map

| Version Folder | Deployment Type | Suggested Subdomain | Notes |
|---|---|---|---|
| `version-mvp-web` | Vercel Project (Production) | `mvp.inclusive-tourism-hk.vercel.app` | Earliest working demo; always stable |
| `version-v1-web` | Vercel Project (Production) | `v1.inclusive-tourism-hk.vercel.app` | First full feature release |
| `version-web-v2` | Vercel Project (Production) | `v2.inclusive-tourism-hk.vercel.app` | Enhanced accessibility layer |
| `version-web-v3` | Vercel Project (Production) | `v3.inclusive-tourism-hk.vercel.app` | Latest / hackathon submission version |

---

## Folder Structure

```
vercel-showcase/
├── README.md                  ← This file: overall strategy and map
├── vercel.json                ← Root-level Vercel config (if monorepo routing needed)
├── env-config/
│   ├── README.md              ← Environment variables guide per version
│   ├── mvp.env.example        ← Example .env for MVP
│   ├── v1.env.example         ← Example .env for V1
│   ├── v2.env.example         ← Example .env for V2
│   └── v3.env.example         ← Example .env for V3
├── deployment-guide/
│   ├── README.md              ← Step-by-step Vercel deployment instructions
│   ├── connect-github.md      ← How to link each version folder to a Vercel project
│   ├── monorepo-setup.md      ← If using a single Vercel project with root directory override
│   └── custom-domain.md       ← Optional: mapping a custom .hk or .com.hk domain
├── preview-strategy/
│   ├── README.md              ← How preview deployments work per PR/branch
│   └── branch-map.md          ← Which branches trigger which preview URLs
└── showcase-links/
    └── README.md              ← Live URLs, QR codes, and demo scripts for judges
```

---

## Vercel Project Setup (Per Version)

Because your versions live in subdirectories (not separate repos), you must set the **Root Directory** override in Vercel for each project:

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import `tototofu123/inclusive-tourism-decision-platform`
2. Under **Root Directory**, set it to the version folder (e.g. `version-web-v3`)
3. Vercel will detect the framework automatically (Next.js, Vite, etc.)
4. Set environment variables from `env-config/v3.env.example`
5. Deploy — your URL will be assigned automatically

Repeat for each version you want a live showcase deployment.

---

## Environment Variables

Each version may require different API keys, feature flags, or backend URLs. The `env-config/` subfolder contains `.env.example` files for each version. These are **never committed with real values** — populate them in the Vercel dashboard under **Project Settings → Environment Variables**.

Typical variables needed:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_API_BASE_URL=
OPENAI_API_KEY=
NEXT_PUBLIC_ACCESSIBILITY_DATA_ENDPOINT=
VERCEL_ENV=production
```

---

## Preview Deployments

Vercel automatically creates a preview URL for every push to a non-main branch. Use this for:

- Sharing work-in-progress with team members before a merge
- Demonstrating a new accessibility feature to a domain expert before it goes live
- A/B testing UI changes between v2 and v3 for hackathon judges

Preview URLs follow the pattern: `https://<repo>-<branch>-<owner>.vercel.app`

See `preview-strategy/branch-map.md` for the branch naming convention used in this project.

---

## Showcase Strategy for Judges / Demo Day

The `showcase-links/` folder contains the canonical list of live demo URLs, QR codes (to be generated), and a short demo script for each version. The recommended demo flow for judges is:

1. **MVP** — Show the baseline: map + accessibility data display
2. **V1** — Show first full user journey: search → filter by accessibility need → view place
3. **V2** — Show enhanced layer: AI-assisted recommendations, multi-modal accessibility flags
4. **V3** — Show full platform: decision intelligence, real-time data, Kowloon coverage

Each version should be independently accessible via its own URL so judges can compare them side-by-side.

---

## Region & Performance

Vercel's Hong Kong edge node (`hkg1`) is the primary region for all deployments to minimise latency for local users and demo participants in Hong Kong. Set this in `vercel.json` at the version root:

```json
{
  "regions": ["hkg1"]
}
```

For serverless functions (API routes), also specify `hkg1` to ensure data residency and low-latency calls to local data sources.

---

## Monorepo Note

This repository is a spec monorepo — each `version-*` folder is a standalone deployable app. Vercel supports this natively via the **Root Directory** setting per project. You do **not** need Turborepo or a workspace setup unless you want shared packages across versions.

If you add shared components (e.g. a common accessibility icon library), create a `packages/` folder at the root and reference it with a workspace config. Document this in `deployment-guide/monorepo-setup.md`.

---

## Next Steps

- [ ] Create one Vercel project per version using the Root Directory override
- [ ] Populate `env-config/` with real `.env.example` files for each version
- [ ] Confirm framework detection (Next.js / Vite / other) for each version folder
- [ ] Add live URLs to `showcase-links/README.md` once deployments are live
- [ ] Generate QR codes for each live URL for demo day
- [ ] Set region to `hkg1` in each version's `vercel.json`
