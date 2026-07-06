# Live Showcase URLs

This file is the single source of truth for all live deployment URLs. Update it each time a new version is deployed or a URL changes.

## Production URLs

| Version | URL | Status | Notes |
|---|---|---|---|
| MVP | _(to be added after deployment)_ | 🔴 Not yet deployed | Baseline demo |
| V1 | _(to be added after deployment)_ | 🔴 Not yet deployed | First full release |
| V2 | _(to be added after deployment)_ | 🔴 Not yet deployed | Enhanced accessibility |
| V3 | _(to be added after deployment)_ | 🔴 Not yet deployed | Hackathon submission |

## Demo Day Instructions

When presenting to judges or stakeholders:

1. Open V3 first as the lead demo — it represents the full vision
2. Use the map view to show Kowloon coverage and accessibility data overlays
3. Demonstrate the decision intelligence / recommendation flow
4. Switch to V1 or MVP to show the evolution of the platform
5. QR codes (to be generated from the URLs above) should be printed or displayed on a slide

## QR Code Generation

Once URLs are confirmed, generate QR codes using:
- [qr-code-generator.com](https://www.qr-code-generator.com)
- Or the `qrcode` npm package: `npx qrcode <url> -o qr-v3.png`

Save generated QR codes in this folder as `qr-mvp.png`, `qr-v1.png`, `qr-v2.png`, `qr-v3.png`.

## Hackathon Submission Notes

- Primary submission URL: V3 production deployment
- Backup URL: V2 production deployment
- GitHub repo: https://github.com/tototofu123/inclusive-tourism-decision-platform
