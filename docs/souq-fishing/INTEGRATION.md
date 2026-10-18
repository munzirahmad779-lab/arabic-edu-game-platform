# Souq & Fishing Game Module — Magguru Core Integration Architecture (Phase 5)

## Overview
This document specifies the integration architecture connecting the "Ekspedisi Pasar dan Dermaga Pancing" (Souq & Fishing) educational game module to the Magguru platform (`magguru.web.id`).

The integration strictly follows **Zero-Regression & Additive-Only** design principles:
1. When feature flag `NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE=true` is set, the module is exposed in teacher game selection, projector displays, student mobile controllers, and self-paced rooms.
2. When the feature flag is OFF or unset, all core routes render identically to original production code, with zero runtime overhead or bundle contamination.

---

## The 5 Core Mount Points (Strictly Additive-Only)

1. **Game Engine Registry (`src/lib/game-engine/registry.ts`)**
   - Exposes `GameRegistry.souq_fishing` and `GameRegistry.SOUQ_FISHING`.
   - `GameRegistry.resolve("souq_fishing")` returns `"souq_fishing"` only when flag is active.
   - `GameRegistry.get("souq_fishing")` returns the module's definition.
   - All 15 existing games (`quiz`, `runner`, `kahoot`, etc.) remain identical and untampered.

2. **Game Mode Selector (`src/app/dashboard/games/game-mode-selector.tsx`)**
   - Conditionally renders the "Ekspedisi Pasar & Dermaga Pancing" game card.
   - Does not alter the original `NATIVE_GAME_ENGINES` list.

3. **Projector Screen (`src/app/dashboard/games/[gameId]/projector/projector-screen.tsx`)**
   - Mounts `<SouqFishingProjectorShell worldState={...} />` when `initialGameTheme === 'souq_fishing'` or `activeEngine === 'souq_fishing'`.
   - Renders 58/42 split screen (`ProjectorWorldMap` + `ProjectorFourTeamTables`).

4. **Student HP Controller (`src/app/controller/page.tsx`)**
   - Mounts `<SouqFishingControllerShell ... />` when `searchParams.theme === 'souq_fishing'`.
   - Respects 4-state mobile controller UX (`PRE_GAME`, `WALKING`, `GATE_QUESTION`, `FISHING_QUESTION`).

5. **Student Self-Paced Room (`src/app/join/room/page.tsx`)**
   - Mounts `<SouqFishingSelfPacedView ... />` when room theme is `souq_fishing`.

---

## Server-Authoritative Checkpoint API (`/api/souq-fishing/checkpoint`)

- **POST**:
  - Validates projector token.
  - Enforces strict ≤64 KB size limit guard (returns `413 Payload Too Large` on overflow).
  - Performs atomic JSONB merge into `rooms.snapshot.souq_fishing.checkpoint_v1`.
  - Preserves `snapshot.questions` and all other fields without overwrite.
- **GET**:
  - Validates token.
  - Returns `{ checkpoint: ... }` or `{ checkpoint: null }` if not present.
- **Security**:
  - Answers (`correctOptionId`, `correctOptionKey`, `explanation`) are stripped via `sanitizeQuestionForClient()` before leaving server/host context.
  - Client state writes are restricted through the server-side API.
