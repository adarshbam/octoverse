# Morning review list

Items the owner must look at. Written overnight by the Nox/engine session; each item says what to check and where the evidence is. Nothing here blocked the build; everything was ruled provisionally.

## Job 1 (Nox frame rate), done before the night
- **Live check** of Nox at http://localhost:5191/ (the perf fixes changed how the face texture is uploaded and the draw order of seabed and water sky; stills say identical, your eye is the last gate).
- **Decision:** tier high `renderScale` 1 -> 0.9 gives 28-30 fps instead of ~23 with slightly softer rims and lashes. Not committed. Face crop: `side-session-notes/.../nox-perf-rs09-vs-tip-face.png`; numbers in `.superpowers/sdd/2026-11-03-nox-perf/task-1-report.md` (git-ignored; a copy is in the shared notes folder).

## E02 engine extraction
(filled as the plan runs)
