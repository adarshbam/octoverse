#!/usr/bin/env bash
# Captures the engine-extraction still set into <outdir> (the same set for baseline/, baseline-b/, current/, final/).
# Usage, from the worktree root with the dev server on :5191 and no browser pane open:
#   bash docs/superpowers/evidence/engine-extraction/capture-set.sh docs/superpowers/evidence/engine-extraction/baseline
# Writes 14 stage stills, each with its -mask.png, the panel-2 world still with its mask, and check_stage.txt.
set -u
out="${1:?usage: capture-set.sh <outdir>}"
mkdir -p "$out"
cap() { node scripts/stage-capture.mjs "$@"; }
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
node scripts/world-capture.mjs intro "$out/world-intro.png" tier=high
# Exits 1 by design (R46, R58, R66): the file holds the output only; the exit code is recorded in BASELINE.md.
python scripts/check_stage.py "$out/world-intro.png" --world --stage intro > "$out/check_stage.txt" 2>&1
echo "check_stage exit $?"
