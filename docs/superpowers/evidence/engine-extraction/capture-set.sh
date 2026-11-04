#!/usr/bin/env bash
# Captures the engine-extraction still set into <outdir> (the same set for baseline/, baseline-b/, current/, final/).
# Usage, from the worktree root with the DEV server (the captures read window.__octoverse.world, which only development builds write)
# on :5191 (NOX_URL=http://localhost:<port> for another) and no browser pane open:
#   bash docs/superpowers/evidence/engine-extraction/capture-set.sh docs/superpowers/evidence/engine-extraction/baseline
# Writes 14 stage stills, each with its -mask.png, the panel-2 world still with its mask, and check_stage.txt.
# WORLD=<id> (or OCTO_WORLD=<id>, which wins) in the environment captures that world (the scripts add world=<id> to every query and read its review samples);
# unset, it is Nox.
# A failed capture aborts the run and names the still. A non-empty <outdir> is refused unless --force is given
# (a set must never mix stills of two runs).
set -eu
force=0
args=()
for a in "$@"; do if [ "$a" = "--force" ]; then force=1; else args+=("$a"); fi; done
out="${args[0]:?usage: capture-set.sh <outdir> [--force]}"
if [ -d "$out" ] && [ -n "$(ls -A "$out")" ] && [ "$force" != 1 ]; then
  echo "capture-set: $out is not empty; pass --force to write into it" >&2
  exit 2
fi
mkdir -p "$out"
# Each capture names itself when it fails, and the set stops there.
cap() { node scripts/stage-capture.mjs "$@" || { echo "capture-set: FAILED at 'stage-capture.mjs $*' (VIEW=${VIEW:-default}); the set is incomplete" >&2; exit 1; }; }
cap intro "$out/intro.png"
cap overview "$out/overview.png"
cap techFocus "$out/techFocus.png" tech=kali
cap detail "$out/detail.png"
cap entering "$out/entering-t2.png" t=2
cap entering "$out/entering-t4.png" t=4
cap intro "$out/intro-blow025.png" blow=0.25
cap intro "$out/intro-blow05.png" blow=0.5
cap intro "$out/intro-swell04.png" swell=0.4
cap intro "$out/intro-hold500-kali.png" "hold=500&tech=kali"
cap intro "$out/intro-swim-open.png" pose=swim-open
cap intro "$out/intro-swim-trail.png" pose=swim-trail
cap intro "$out/intro-yaw180.png" yaw=180
VIEW=390x844 cap intro "$out/intro-390x844.png"
node scripts/world-capture.mjs intro "$out/world-intro.png" tier=high || { echo "capture-set: FAILED at world-capture.mjs intro world-intro.png; the set is incomplete" >&2; exit 1; }
# Exits 1 by design (R46, R58, R66): the file holds the output only; the exit code is recorded in BASELINE.md.
status=0
python scripts/check_stage.py "$out/world-intro.png" --world --stage intro --world-id "${OCTO_WORLD:-${WORLD:-nox}}" > "$out/check_stage.txt" 2>&1 || status=$?
echo "check_stage exit $status"
