# Breath recordings

Real captures from the debug meter, kept as fixtures. Each file stores **raw
frames only** — no detector output — so any of them can be replayed through the
detector at any threshold setting. That is what makes them useful: a threshold
question can be answered against a real person without anyone breathing again.

All three were captured on the same microphone, a Blue Yeti X (`046d:0aaf`) at
48kHz, in a quiet room, on Chrome. All three report `processingVerdict: clean`
— the browser confirmed echo cancellation, noise suppression and automatic gain
control were all off.

## How to use one

Open `debug.html`, click **Load recording**, pick a file, then **Replay at
current thresholds**. Move the sliders and replay again to sweep. Replay is
deterministic: the same file at the same settings gives the same answer.

## The files

| file | length | peak | clipped | detections | median | notes |
|---|---|---|---|---|---|---|
| `01-low-gain-normal-breathing.json` | 47s | 0.022 | 0 | 11 | 1.32s | normal resting breathing, very low input level |
| `02-clipped-hot-gain.json` | 86s | 1.000 | 15 | 16 | 1.96s | gain far too hot — keep it, clipping is a case worth testing |
| `03-corrected-gain-slow-breathing.json` | 50s | 0.024 | 0 | 10 | 2.48s | gain corrected, slower deliberate exhales |
| `04-cyclic-sighing.json` | 58s | 0.017 | 0 | 19 | 1.70s | **the protocol itself** — double inhale, extended exhale |

Counts above are at the defaults current when this was written: open 9dB, close
6dB over the adaptive floor, 250ms release hangover.

`04` is the reference sample. It is the only one of the four that contains the
input pattern FATHOM is actually built on, and it is the one to reach for when
judging whether a change helps or hurts.

## What each one caught

These are not decorative. Each has already falsified a change:

- **01** showed that a close threshold of 3dB sits *underneath the room*. The
  level never returned to the noise floor between breaths — it sat 2–8dB above
  it — so exhales stopped closing and one span ran 14.5s still open. That is
  what moved the close threshold to 6dB.
- **02** showed that a 700ms release hangover does not bridge a stumble
  mid-breath, it swallows the gap *between* two breaths. Nine of fourteen
  reported breaths in it were really pairs. That is what moved the hangover to
  250ms.
- **02 and 03 together** killed the idea of closing an exhale a fixed number of
  dB below its own peak. It looked good on paper — the threshold would scale
  with input level instead of sitting a fixed distance above the floor — but it
  split a long smooth tapering sigh into two breaths at every value tried, which
  would halve the measured duration of exactly the breath the protocol asks for.
- **04 showed the respiratory rate is inflated when the inhale is audible.**
  Detections alternate long/short — `LLLsLsLLLsLsLsLsLsL`, cleanly alternating
  once the rhythm settles. The twelve long events average 2.15s and are the
  exhales; the seven short ones average 1.16s and are the double inhale being
  heard. Counting every detection gives **19.7 breaths/min**. Measuring
  exhale-onset to exhale-onset gives a median cycle of 5.44s, or **11.0**. The
  estimator reported 18.1. The before/after delta is the outcome claim, so an
  inflation of that size is not cosmetic — see issue #27.

## Reading the numbers honestly

Respiratory-rate confidence comes out at 0–0.08 on all three, because the
breath-to-breath intervals genuinely vary (2.3s to 8.1s in 01). That is the
estimator reporting what it sees, not a fault. It does mean a calibration read
on breathing this irregular produces a baseline the estimator itself does not
trust, which matters before the surface screen leans on a before/after delta.

None of these is yet a clean sample of **cyclic sighing** specifically — a
double inhale followed by an extended exhale. That is still worth capturing.
