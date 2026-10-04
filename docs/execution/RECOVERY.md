# OctoVerse Recovery Procedure & Snapshot Guide

**Recorded Date:** 2026-10-04 (Asia/Calcutta)  
**Worker:** Gemini 3.8 Flash (High reasoning), Antigravity IDE  
**Orchestrator:** Codex  
**Snapshot Root:** `artifacts.local/a00-before-execution/`  

---

## 1. Snapshot Inventory & Authoritative Manifests

Prior to the execution of packet A00/A01, the orchestrator generated a complete, non-destructive snapshot of the repository state in `artifacts.local/a00-before-execution/`. The orchestrator independently verified all 55 preserved files and 28 recorded deletions ([verification.json](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/artifacts.local/a00-before-execution/verification.json)).

| Artifact | Format / Source | Authoritative Description |
| :--- | :--- | :--- |
| `base-branch.txt` | Text | Records authoritative base branch name: `main` |
| `base-commit.txt` | Text | Records base commit: `898376730f0cb823ebcf80b0ca3aaed619c632c3` |
| `base-head.zip` | Zip archive | Clean archive of base commit HEAD (`main`) |
| `nox-checkpoint.zip` | Zip archive | Clean archive of scoped checkpoint commit `ac7f987bbb7719efb5087f2f059f1743288dd036` (builds cleanly in an isolated archive) |
| `git-status.txt` | Text | Working tree status records preserving pre-execution modifications and deletions |
| `unstaged.patch` | Patch | Unified diff containing unstaged working-tree changes and 28 legacy deletions |
| `working-tree/` | Directory | Exact file-for-file byte mirror of all 55 active files at execution start |
| `working-tree-manifest.json` | JSON | Authoritative manifest recording `path`, `state`, and `sha256` for all 55 active files |
| `verification.json` | JSON | Independent orchestrator verification confirming 55 present files, 28 deleted paths, and checkpoint commit |

Authoritative reference image metadata and sha256 digests are recorded in [docs/execution/reference-manifest.json](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/docs/execution/reference-manifest.json).

---

## 2. Invariant: Preservation of Excluded Deletions

> [!CAUTION]
> **Do not restore deleted legacy files into the active working tree.**  
> The 28 deletions recorded in [git-status.txt](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/artifacts.local/a00-before-execution/git-status.txt) represent generic prototype files (e.g. `src/components/octopus/*`, `src/components/ocean/*`, `src/utils/useAudioSynth.ts`) that were superseded by the approved Nox architecture.  
> The scoped checkpoint `ac7f987` was constructed to exclude both pre-existing README edits and these 28 deletions. Older unused tracked files exist in the committed archive `base-head.zip`; **they must not be restored into the active working tree.**

---

## 3. Recovery Procedures

### Scenario A: Clean Recovery into a New Isolated Directory (Recommended)
To reconstruct the exact pre-A00 working state without risking dirty workspace files or uncommitted user work:
1. Create a fresh, separate destination directory outside this workspace (e.g. `../OctoVerse-pre-a00/`).
2. Extract `artifacts.local/a00-before-execution/base-head.zip` into the new directory.
3. Copy the saved working-tree bytes from `artifacts.local/a00-before-execution/working-tree/` over the extracted tree.
4. Verify file integrity against [artifacts.local/a00-before-execution/working-tree-manifest.json](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/artifacts.local/a00-before-execution/working-tree-manifest.json), confirming all 55 present file SHA-256 hashes match.
5. Verify that the 28 legacy files listed as deleted in `git-status.txt` remain absent.

### Scenario B: Scoped Active-Tree Rollback of A00/A01 Edits
If only the files modified or created during milestone A00/A01 must be reverted in place, the operation must be strictly scoped to reviewed paths to preserve any unrelated or later user work:

1. **Restore specifically modified pre-existing files** from `artifacts.local/a00-before-execution/working-tree/`:
   - `README.md`
   - `package.json`
   - `src/App.tsx`
   - `src/components/nox/NoxCharacter.tsx`
   - `src/components/nox/NoxEnvironment.tsx`
   *(Do NOT run blanket `git checkout .` or `git reset --hard`, which could wipe unrelated changes).*

2. **Remove only the specific files added during A00/A01**:
   - `playwright.config.ts`
   - `.gitattributes`
   - `docs/execution/APPROVALS.md`
   - `docs/execution/STATUS.md`
   - `docs/execution/RECOVERY.md`
   - `docs/execution/A01-VERIFICATION.md`
   - `tests/visual/nox-canonical.spec.ts`
   - `tests/visual/nox-multi-instance.spec.ts`
   - `tests/visual/nox-responsive.spec.ts`
   - `tests/visual/helpers/geometry-extractor.ts`
   *(Do NOT perform recursive folder deletions such as `rm -rf tests/`, which could remove pre-existing or unrelated tests).*

3. **Verify hash integrity**:
   Re-verify the restored files against [working-tree-manifest.json](file:///c:/Users/Dell/Desktop/Vibe-coding/OctoVerse/artifacts.local/a00-before-execution/working-tree-manifest.json).

### Scenario C: Inspection of Verified Runtime Checkpoint Commit `ac7f987`
Checkpoint commit `ac7f987bbb7719efb5087f2f059f1743288dd036` captures the working Nox runtime and historical review baselines while excluding the 28 prototype deletions. If needed for isolated inspection:
1. Extract `artifacts.local/a00-before-execution/nox-checkpoint.zip` into a separate review folder.
2. Note that an isolated archive of `ac7f987` has been verified by the orchestrator to build cleanly (`tsc -b && vite build`) under existing dependencies.
3. Do NOT check out `ac7f987` over a dirty active tree or use commands that would un-delete legacy prototype files in the working directory.
