# OctoVerse A01 Visual Verification & Test Harness Guide

**Recorded Date:** 2026-10-04 (Asia/Calcutta)  
**Worker:** Gemini 3.8 Flash (High reasoning), Antigravity IDE  
**Orchestrator:** Codex  
**Independent Review:** Astra  
**Milestone:** Packet A01 — Fresh Browser Verification & Instance Namespacing  
**Status:** Implemented (Pending Verification by Orchestrator)  

---

## 1. Orchestrator Execution Commands

The following commands are prepared for the orchestrator (Codex) to execute through approved tools. Do not execute these within Antigravity:

### Step 1: Verify Dev Dependency
```bash
npm list @playwright/test
```
*(Codex installed `@playwright/test` 1.63.0. Optionally run `npx playwright install chromium` if Chromium binary is not present).*

### Step 2: Validate TypeScript Compilation & Build
```bash
npm run build
```
*Confirms `tsc -b` and `vite build` pass cleanly with no type or bundler errors.*

### Step 3: Run Linter
```bash
npm run lint
```
*Confirms oxlint passes cleanly across active source files.*

### Step 4: Run Fresh Browser Visual Regression Suite
```bash
npx playwright test
```
*Starts a dedicated loopback Vite server on strict port 5178 (`http://127.0.0.1:5178`, `reuseExistingServer: false`) and runs all specs in `tests/visual/`.*

---

## 2. Verification Suite Breakdown: What Each Check Proves and Does NOT Prove

| Test Suite / Check | Implementation File | What It Proves | What It DOES NOT Prove |
| :--- | :--- | :--- | :--- |
| **Source Geometry Hash & Line Ending Check** | `tests/visual/nox-canonical.spec.ts`<br>`tests/visual/helpers/geometry-extractor.ts` | Proves that `src/components/nox/introductionGeometry.ts` matches SHA-256 `5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E` and preserves Unix LF line endings without silent CRLF corruption. | Does not prove reference fidelity to `Nox.jpeg`; only confirms byte-identity to the frozen character baseline. |
| **Authority Baseline Hash & Canonical DOM Geometry** | `tests/visual/nox-canonical.spec.ts` | Proves `approved-geometry.json` matches authority SHA-256 `FE906FB9D72E11C8B456FA89404A5AE91CE7917C377961984084B082FF682E35`. Proves live rendered SVG geometry deep-equals `approved-geometry.json` across: `arms` (all 8 contours, cup lobes, and transforms), `characterTransform` (`null`), `face` (34 eye/cheek/mouth shapes), `nameplate` (5 direct children), `title` (6 direct children), and `viewBox` (`"0 0 507 505"`). | Does not prove pixel identity or material shading accuracy; does not evaluate lighting, textures, or color grades. |
| **Arm DOM Paint Order & Depths** | `tests/visual/nox-canonical.spec.ts` | Proves live DOM arm order is strictly `T1, T2, T3, T4, T5, T6, T7, T8` with exact depth assignments `rear, rear, middle, middle, middle, middle, front, front` without sorting away paint order differences. | Does not prove tentacle flexibility or motion readiness under dynamic rigging. |
| **Live Mantle & Ancestor Transforms** | `tests/visual/nox-canonical.spec.ts` | Proves rendered mantle path matches frozen authored `mantleContour` from `introductionGeometry.ts`. Proves scene root, character container, and arm root groups have zero unexpected transforms. | Does not evaluate GPU rendering performance of mantle filters or gradients. |
| **Animation Invariant** | `tests/visual/nox-canonical.spec.ts` | Proves the scene is 100% static: 0 `<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>` elements, and 0 active Web Animations. | Does not test future motion subsystems (A03+). |
| **Embedded Image Invariant** | `tests/visual/nox-canonical.spec.ts` | Proves zero raster `<image>` or `<img>` elements are embedded in the scene; the artwork is rendered purely in vector SVG geometry. | Does not assess quality or artistic expression of the vector rendering. |
| **Console & Page Error Monitor** | `tests/visual/nox-canonical.spec.ts`<br>`tests/visual/nox-responsive.spec.ts` | Proves zero JavaScript runtime exceptions, React warnings, or console errors occur during clean load. | Does not evaluate performance under low-end hardware throttling. |
| **Local SVG Reference Integrity** | `tests/visual/nox-canonical.spec.ts`<br>`tests/visual/nox-multi-instance.spec.ts` | Proves all `url(#...)` and `href="#..."` references point to existing `<filter>`, `<linearGradient>`, `<radialGradient>`, `<clipPath>`, or `<mask>` definitions within the instance. | Does not measure rendering speed or GPU shader complexity of filters. |
| **Responsive Viewport Centering & Overflow** | `tests/visual/nox-responsive.spec.ts` | Proves that at phone dimensions (390×844), the scene fits a centered 390×388.46 stage without horizontal or vertical document scrollbar overflow. | Does not prove a mobile-optimized UI; only confirms fixed-proportion layout stability. |
| **Multi-Instance Isolation & ARIA IDREF Ownership** | `tests/visual/nox-multi-instance.spec.ts` | Proves two `<NoxScene />` instances mounted on the same page have 0 duplicate IDs, isolated SVG references (including masks), and isolated ARIA IDREF ownership (`aria-labelledby`, `aria-describedby`) without foreign or missing targets. | Does not evaluate performance of rendering dozens of instances simultaneously. |

---

## 3. Fresh Evidence Artifacts (Preserving Historical Review Files)

All test runs output evidence into the ignored directory `test-output/visual/`:
- `canonical-507x505.png`: Fresh unretouched screenshot of the canonical stage.
- `narrow-390x844.png`: Fresh screenshot of the mobile layout at 390×844.
- `two-instance-fixture.png`: Screenshot proving dual-instance collision avoidance.
- `fresh-geometry.json`: Full live DOM geometry snapshot extracted from the browser.
- `provenance.json`: Metadata linking the test run to actual commit, dirty-tree status, task A01, browser name and version, viewport, scene introduction, static motion setting, reference/crop, and source file hashes.

> [!WARNING]
> Historical approval artifacts in `docs/design/reviews/nox-introduction/` and `docs/design/reviews/nox-environment/` remain frozen and immutable. The test suite strictly writes to `test-output/` and never overwrites previous milestone captures.

---

## 4. Acceptance Gate Notice

Passing automated tests establishes regression protection; **it does not constitute human visual approval**. The candidate environment in `docs/design/reviews/nox-environment/browser-final.jpg` remains pending human visual review. A02 environment corrections are authorized after A01 verification; human approval is required before A03+ and any new visual poses.
