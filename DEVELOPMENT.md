# FATHOM — Team Guide

A game you play with your breath. Five minutes to a measurably calmer body.

Hack for Humanity | Summer 2026 — target category: **Best Mental Health Tool**
(also chasing: Best Design, Best Use of AI/ML, Responsible AI, Innovation, Best
Use of Render, Public Voting). Deadline: **Sep 4, 2026, 11:45pm ET**.

## The concept (read this before writing any code)

You are a diver descending through a bioluminescent ocean. The only controller
is the microphone: a double inhale charges your dive light, a long slow exhale
propels you down. That input pattern IS cyclic sighing — the protocol from
Balban, Spiegel et al. 2023 (Cell Reports Medicine, RCT n=114). Longer,
smoother exhales literally make you better at the game.

Session arc: calibration + baseline respiratory rate → 3 zones (~5–7 min
total) → surface with an objective before/after RR delta + "downshift speed"
score → exportable dive log → the app tells you to leave. A 90-second Quick
Dive mode exists for right-before-the-race moments.

**What this app refuses to be:** no chat surface, no conversational features,
no accounts, no streaks, no feed, nothing stored server-side. All audio is
processed on-device (AudioWorklet). This is the whole strategy — the judging
rubric punishes chatbots/trackers and two judges are clinicians.

## Team

- **storm2928 (Max)** — lane TBD
- **cjasink** — lane TBD

Two lanes, one seam:
- **Signal engine** (`src/breath/`): AudioWorklet mic capture, DSP exhale
  detection (envelope + spectral features), calibration, respiratory-rate
  estimation, confidence gating.
- **Experience layer** (`src/game/`, `src/shell/`): dive scene (PixiJS),
  session arc/state machine, onboarding (scope + contraindications), crisis
  rail, dive-log export, accessibility, EN/FR strings.

The seam is `src/breath/types.ts`. The engine emits events; the game consumes
them. Neither lane edits the other's folders without asking in chat first.

## Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Typecheck: `npx tsc --noEmit` (wire into `npm run check` later)

## Working agreements (hard rules)

1. `git pull --rebase` before starting any task.
2. Stay inside your lane's folders. Shared files (`types.ts`, `package.json`,
   configs) change only after both of us agree in chat.
3. Small commits, pushed often. No end-of-day mega-commits.
4. Never rewrite/reformat files outside the task's scope.
5. Run the build + typecheck before calling a task done.
6. Changes to the breath-event contract require BOTH team members' sign-off.
7. Commit messages describe the code change, plain and specific.

## Claims & safety discipline (scored by clinician judges)

- Language everywhere (UI, README, comments): "trains arousal regulation,
  measured live" — NEVER "treats/cures/reduces anxiety."
- The adaptive difficulty may only ever SLOW breathing targets. The game must
  never reward fast breathing or breath-holds.
- Crisis resources (988 US · 9-8-8 Canada · findahelpline.com) persist on the
  surface screen. Scope screen at onboarding: "not therapy, not diagnosis,
  not for crisis."
- Every scientific claim traces to a citation in the README (primary: Balban
  et al. 2023, cyclic sighing RCT).
- The inhale phase is rhythm-prompted, not mic-sensed — say so honestly
  wherever fidelity is described.

## Rules compliance

- All code in this repo was written after Aug 7, 2026, 12:00pm EST (hackathon
  start). Do not vendor in pre-existing project code.
- Repo stays private during the build; flips public at submission.
