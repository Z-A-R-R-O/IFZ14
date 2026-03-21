# IFZ14 -- 0.1 Ready

Date: 2026-03-20
Status: Working checkpoint

## Current Product State

IFZ14 is now structured as a layered system experience:

1. Intro
   `EVOLVE` entry screen over raw starfield video, with cinematic transition into auth.
2. Auth
   Minimal centered access module with sign-in/create in one evolving card.
3. Core App
   Dashboard, Daily, Work, Analytics, Goals, Reports, and system control surfaces aligned to the same system UI language.

## Core Identity Locked

- Heading font: `Aquire`
- UI font: `Satoshi`
- Body font: `Inter`
- Numeric/data font: `IBM Plex Mono`
- Brand watermark/identity: `IFZ14`

## Major Systems Completed

### 1. Intro + Auth Flow

- Intro now lands first before auth.
- `EVOLVE` is the primary center command.
- Cinematic handoff runs before auth:
  - message transition
  - starfield acceleration
  - subtle rumble
  - soft flash
- Auth includes:
  - back to intro
  - stable single-card sign-in/create flow
  - reduced lag from CSS-driven form morph instead of heavier layout animation

Relevant files:

- `src/App.tsx`
- `src/components/IntroScreen.tsx`
- `src/components/LoginScreen.tsx`
- `src/index.css`

### 2. Dashboard

- Heading now reflects real mode instead of static text.
- Hero hierarchy hardened into control-panel style.
- Score core, diagnostics, HUD, active goals, and signal states were reworked.
- Motion simplified to feel lighter and more controlled.

Relevant files:

- `src/pages/Dashboard.tsx`
- `src/ui/components/SystemSurface.tsx`
- `src/ui/motion/presets.ts`
- `src/index.css`

### 3. Daily

- Heading now reflects selected or custom mode.
- Day builder and auto-day flows are integrated into the mode system.
- Wake, body, execution, production, reflection now follow a more system-based design.
- Reflection was stabilized after the broken initiation flow.
- Session timeline was converted away from repeated cards.
- Session locking/unlocking was added.
- Focus, score, energy, and custom numeric values now use bar/tick controls.
- Custom toggles now match Body System dot-toggle design.
- Wake time uses a custom inline selector instead of the browser popup.

Relevant files:

- `src/pages/Daily.tsx`
- `src/components/DayBuilder.tsx`
- `src/components/AutoDayOverlay.tsx`
- `src/index.css`

### 4. Work / Tasks

- Work page is now an execution console instead of a generic list.
- Task creation flow became a guided system sequence.
- Task selector styling was refit to system theme.

Relevant files:

- `src/pages/Tasks.tsx`
- `src/index.css`

### 5. Analytics / Goals / Reports

- Analytics rebuilt into a causation and prediction surface.
- Goals rebuilt into target-definition and structure flow.
- Reports rebuilt into system archive/history mode.

Relevant files:

- `src/pages/Analytics.tsx`
- `src/pages/Goals.tsx`
- `src/pages/Reports.tsx`
- `src/index.css`

### 6. Shared Presence Roles

Two system identities are now defined:

- `ZETRO`
  - guide
  - onboarding
  - execution guidance
  - slightly human, still controlled
- `NEOT`
  - authority
  - warnings
  - system enforcement
  - popup-only

Implemented so far:

- `ZETRO` uses inline/floating guidance panel.
- `NEOT` uses:
  - top-right floating notice
  - centered blocking modal for destructive actions

Relevant files:

- `src/components/SystemPresencePanel.tsx`
- `src/components/NeotNotice.tsx`
- `src/components/ConfirmOverlay.tsx`
- `src/components/LoginScreen.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Daily.tsx`
- `src/pages/Tasks.tsx`
- `src/components/ControlPanel.tsx`
- `src/pages/Settings.tsx`
- `src/index.css`

## Stability / Architecture Fixes Already Done

### Auth + Store Hydration

Scoped store hydration was fixed so pages do not initialize under the wrong namespace before auth is ready.

Relevant files:

- `src/stores/rehydrateScopedStores.ts`
- `src/App.tsx`

### Route Blank-Page Mitigation

The route shell was adjusted to avoid blank render handoff caused by wait-mode transitions.

Relevant file:

- `src/components/Layout.tsx`

## Mode Name Rules

Custom mode names now normalize correctly:

- if user already types `Mode`, it is not duplicated
- if user omits it, `MODE` is appended
- custom raw input is capped to tighter naming

Relevant files:

- `src/lib/modeName.ts`
- `src/components/DayBuilder.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Daily.tsx`

## Build State

Last verified command:

```bash
npm run build
```

Result:

- build passes
- remaining warning: Vite chunk size warning only

## Current Working Files

These files were part of the latest active surface:

- `src/components/ControlPanel.tsx`
- `src/components/LoginScreen.tsx`
- `src/components/NeotNotice.tsx`
- `src/components/SystemPresencePanel.tsx`
- `src/components/ConfirmOverlay.tsx`
- `src/pages/Daily.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Tasks.tsx`
- `src/index.css`

## Recommended Next Session Priorities

1. Make route/page rendering fully fault-tolerant
   - add route-level error boundary around app pages
   - catch first-render crashes directly instead of relying on refresh symptoms

2. Unify `SystemControlPanel` and `ControlPanel`
   - there are still overlapping control concepts in the codebase

3. Continue `NEOT / ZETRO` rollout
   - use `NEOT` only for meaningful state changes
   - use `ZETRO` for onboarding and structure guidance
   - avoid creating chat UI

4. Performance pass
   - split large chunks
   - reduce CSS/JS weight in `AuthenticatedApp`

5. Final polish
   - audit remaining browser-default controls
   - tighten any encoding artifacts like malformed arrow/bullet glyphs still lingering in source comments or strings

## Notes

- This checkpoint is a handoff document only.
- No commit was created in this step.
- `dist/` currently contains generated build assets from the latest successful build.

