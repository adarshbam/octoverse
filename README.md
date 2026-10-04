# 🐙 OctoVerse

> A lightweight subscription-based platform for interactive developer portfolios centered around an expressive 2D SVG octopus character.

---

## 🌊 Overview

OctoVerse reimagines the developer portfolio as an immersive underwater world. Rather than generic card grids or heavyweight 3D engines, each portfolio experience is anchored by an animation-ready, pure 2D SVG octopus character whose tentacles showcase developer projects, systems architecture, and core proficiencies.

The visual direction is guided strictly by approved character references (`docs/design/references/`):
- **Foundational Character DNA:** `girlfriend-reference.jpg` (original hand-drawn octopus personality, proportions, eye expression, and cuteness).
- **Current Milestone World:** `Nox.jpeg`, Panel 2 (`x=512, y=0, width=507, height=505`) representing the **Security Lab** world.

---

## 📍 Current Development Status (Milestone A00 / A01)

The application currently renders a **static 2D SVG study** of **Nox** within the Security Lab underwater ruin corridor:

- **Character Geometry:** **APPROVED** (User sign-off 2026-10-03).
  - Silhouette, mantle, facial proportions, complete eye artwork, 8 independently authored tentacles (T1–T8), suction cup lobes, and placement in the 507×505 coordinate space are locked.
  - Frozen geometry source: `src/components/nox/introductionGeometry.ts` (SHA-256 `5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E`).
- **Environment & Integrated Lighting:** **PENDING HUMAN REVIEW**.
  - Current candidate is recorded in `docs/design/reviews/nox-environment/browser-final.jpg` (Candidate E0).
  - Underwater corridor masonry, soft light shafts, distant ruins, seabed, static bubbles, and crimson runic illumination.
  - Scoped environment corrections (A02) are authorized following A01 verification; human visual approval is strictly required before A03+ and any new visual poses.
- **A01 Test Harness & ID Namespacing:** **IMPLEMENTED (PENDING VERIFICATION)**.
  - Non-visual SVG ID/ARIA namespacing, stable data selectors, multi-instance collision fixture, and Playwright verification suite.
- **A03+ Work Gated:**
  - Material polish, technology orbs, cursor tracking, motion/animation, and portfolio drawers are gated behind human review of the environment candidate and completion of packet A02.
  - The current build contains **0 animation elements**, **0 technology orbs**, and **no product interaction handlers** (no hover, click, drag, pet, wink, or cursor tracking handlers).

For the complete approval status and gating ledger, see [docs/execution/APPROVALS.md](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/docs/execution/APPROVALS.md).  
For the execution state and snapshot tracking, see [docs/execution/STATUS.md](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/docs/execution/STATUS.md).  
For recovery and rollback procedures, see [docs/execution/RECOVERY.md](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/docs/execution/RECOVERY.md).  
For verification instructions and harness documentation, see [docs/execution/A01-VERIFICATION.md](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/docs/execution/A01-VERIFICATION.md).

> [!NOTE]
> **Preservation of Snapshot Archive:**  
> Prior to execution, a complete state snapshot was saved in `artifacts.local/a00-before-execution/`. This snapshot preserves the 28 excluded deletions from the legacy prototype separately from scoped commit `ac7f987`.

---

## 🛠️ Tech Stack & Architecture

- **Core Technologies:** React 19, TypeScript, Pure 2D SVG, Vanilla CSS / Tailwind CSS v4, Vite.
- **Component Architecture:**
  - `src/App.tsx`: Top-level scene container with namespaced SVG defs, semantic data selectors, and a development fixture route gated by `import.meta.env.DEV` (`?fixture=two-instance`).
  - `src/components/nox/NoxCharacter.tsx`: 2D SVG character anatomy (mantle, eight tentacles, eyes, cheeks, mouth, and bioluminescent rim/bounce lighting) using unconditional top-level `useId`.
  - `src/components/nox/NoxEnvironment.tsx`: Layered background and foreground underwater architecture using unconditional top-level `useId`.
  - `src/components/nox/introductionGeometry.ts`: Frozen canonical path contours and cup transforms.
  - `src/components/nox/sceneLighting.ts`: Unified scene lighting definitions.
  - `src/data/nox.ts`: Security Lab character metadata.

---

## 🚀 Running Locally

```bash
# 1. Start Vite development server
npm run dev

# 2. Build for production verification
npm run build

# 3. Run linter
npm run lint

# 4. Run visual regression tests (orchestrated by Codex)
npm run test:visual
```

To view the deterministic two-instance collision fixture in development:
`http://localhost:5178/?fixture=two-instance`

---

## 📝 Worker Record

- **Execution Date:** 2026-10-04 (Asia/Calcutta)
- **Active Worker:** Gemini 3.8 Flash (High reasoning), Antigravity IDE
- **Orchestrator:** Codex
- **Independent Review:** Astra
