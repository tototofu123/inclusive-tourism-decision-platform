# Environment Variables Guide

This folder contains `.env.example` files for each version of the platform. These files document the required environment variables but do **not** contain real values.

## How to Use

1. Copy the relevant `.env.example` file to `.env.local` inside the version folder on your local machine.
2. Fill in the real values.
3. In Vercel, navigate to **Project Settings → Environment Variables** and add each variable there.
4. Never commit `.env.local` or any file with real API keys — the `.gitignore` at the root already excludes `.env.local`.

## Scope

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All others are server-side only and safe for API keys.

## Versions Covered

- `mvp.env.example` — Minimal set for the MVP demo
- `v1.env.example` — First full release variables
- `v2.env.example` — V2 additions (AI features, enhanced data endpoints)
- `v3.env.example` — Full platform variables including decision intelligence layer
