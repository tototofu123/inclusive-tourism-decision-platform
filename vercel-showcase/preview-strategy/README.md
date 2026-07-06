# Preview Deployment Strategy

Vercel automatically generates a unique preview URL for every push to a non-production branch. This section documents how the team uses preview deployments for this project.

## Why Preview Deployments Matter

For a hackathon project with multiple evolving versions, preview deployments let you:

- Share a work-in-progress feature with a teammate without merging to `main`
- Show an accessibility consultant a specific UI change for feedback
- Let judges compare a feature branch against the production build
- Catch regressions before they reach the live showcase URL

## Branch Naming Convention

Use descriptive branch names so preview URLs are self-explanatory:

```
feature/<version>-<description>
fix/<version>-<description>
experiment/<version>-<description>
```

Examples:
- `feature/v3-wheelchair-filter`
- `fix/v2-map-loading`
- `experiment/v3-ai-recommendation-ui`

## Preview URL Pattern

Vercel preview URLs follow this structure:

```
https://<project-name>-<branch-slug>-<vercel-username>.vercel.app
```

Share these links directly with stakeholders. They are live as long as the branch exists.

## Protected Previews

If the platform contains sensitive data or unpublished accessibility data, enable **Vercel Authentication** on preview deployments in **Project Settings → Deployment Protection**. This requires viewers to log in with Vercel before accessing a preview URL.
