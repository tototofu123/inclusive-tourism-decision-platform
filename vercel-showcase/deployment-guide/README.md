# Deployment Guide

This guide walks through deploying each version of the Inclusive Tourism platform to Vercel.

## Prerequisites

- A [Vercel account](https://vercel.com) (Hobby tier is sufficient for hackathon showcase; Pro recommended for team collaboration)
- Access to the GitHub repo `tototofu123/inclusive-tourism-decision-platform`
- Environment variable values (see `../env-config/`)

## Step-by-Step: Deploy a Single Version

### 1. Import the Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select `tototofu123/inclusive-tourism-decision-platform`

### 2. Set the Root Directory

This is the critical step for a multi-version monorepo:

1. Under **Configure Project**, expand **Root Directory**
2. Set it to the version you are deploying, e.g. `version-web-v3`
3. Vercel will re-scan and detect the framework (Next.js, Vite, etc.)

### 3. Configure Environment Variables

1. Expand **Environment Variables**
2. Add each variable from the relevant `env-config/vX.env.example` file
3. Make sure sensitive keys (OpenAI, Google Maps) are set to **Production** scope only

### 4. Deploy

Click **Deploy**. Vercel will build the project from the specified root directory.

### 5. Record the URL

Once deployed, copy the production URL and add it to `../showcase-links/README.md`.

---

## Repeat for Each Version

Create a **separate Vercel project** for each version:

| Vercel Project Name | Root Directory |
|---|---|
| `inclusive-tourism-mvp` | `version-mvp-web` |
| `inclusive-tourism-v1` | `version-v1-web` |
| `inclusive-tourism-v2` | `version-web-v2` |
| `inclusive-tourism-v3` | `version-web-v3` |

---

## Setting the Region to Hong Kong

In each version folder, create or update `vercel.json`:

```json
{
  "regions": ["hkg1"]
}
```

This ensures all serverless functions run in Vercel's Hong Kong edge node for lowest latency to local users.

---

## Troubleshooting

- **Framework not detected**: Make sure the version folder contains a valid `package.json` with a `build` script.
- **Build fails**: Check that all required environment variables are set in the Vercel dashboard.
- **Wrong root directory**: Go to **Project Settings → General → Root Directory** and correct it, then redeploy.
