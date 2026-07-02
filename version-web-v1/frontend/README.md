# Frontend – Web v1

This document describes frontend changes for Web v1.

## New UI Elements
- **Preferences panel** on the chat page:
  - Sliders or dropdowns for walking speed and budget.
  - Checkboxes or chips for category preferences.
  - Toggle for crowd tolerance.

## Behaviour
- Preferences are saved locally (context or local storage) and included in `POST /plan`.
- UI should clearly show which preferences are active when planning.

## Components
- `PreferencesForm`
- Minor updates to `ChatInput` to show when preferences are applied.

Web v1 keeps the same general layout as MVP but exposes basic personalisation controls.
