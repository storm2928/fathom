import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BreathConductor } from '../session/conductor';
import type { PromptStep } from '../session/conductor';
import { SessionMachine } from '../session/sessionMachine';
import type { SessionPlan, SessionResult, SessionState } from '../session/sessionMachine';
import { ScriptedBreathEngine } from '../input/scriptedEngine';
import { SpacebarBreathEngine } from '../input/spacebarEngine';
import { startInput } from '../input/inputSource';
import type { InputPlan, InputSource, StartedInput } from '../input/inputSource';
import { createBreathEngine } from '../../breath/engine';
import type { BreathEngine } from '../../breath/types';
import type { InputCode } from '../surface/diveLog';
import { DiveScene, createDiveRenderer } from './diveScene';
import { SurfaceScreen } from '../surface/SurfaceScreen';
import { useLanguage } from '../../shell/i18n';
import { fill } from '../../shell/strings';
import type { Strings } from '../../shell/strings';
import { formatDecimal, formatMetres, formatPercent } from '../../shell/format';
import {
  Button,
  Chip,
  Choice,
  ChoiceGroup,
  IconDive,
  IconLeave,
  IconMic,
  IconNumbers,
  IconSpacebar,
  IconTimer,
  Meter,
  Notice,
  ProgressRing,
} from '../../shell/ui';
import './DiveView.css';

/**
 * The dive, in three modes on one canvas: setup (choose an input and a
 * length), diving (the scene fills the viewport under a DOM HUD) and surface
 * (the settled scene sits above the results). The canvas is never unmounted
 * while this view is, so the renderer can be rebuilt on it dive after dive.
 */

type Source = InputSource;

/**
 * The scripted fixture and the speed control breathe for you, which is the
 * opposite of the product. They are compiled out of anything a visitor can
 * reach, so the deployed site offers the two real ways to play and nothing else.
 */
const DEV_TOOLS = import.meta.env.DEV;

const PLAYABLE_SOURCES: Source[] = ['mic', 'spacebar'];
const ALL_SOURCES: Source[] = ['mic', 'spacebar', 'scripted'];

/** How long the baseline read listens, for the inputs that measure one. */
const CALIBRATION_MS = 10_000;

/** Labels for the input that actually ran, on the surface screen and in the export. */
const CODE_LABEL: Record<InputCode, (t: Strings) => string> = {
  microphone: (t) => t.setup.inputMicrophone,
  keyboard: (t) => t.setup.inputKeyboard,
  scripted: (t) => t.setup.inputScripted,
};

/** Which visual zone each stage of the arc belongs to. */
const ZONE_INDEX: Partial<Record<SessionState, number>> = {
  calibrating: 0,
  'zone-1': 0,
  'zone-2': 1,
  'zone-3': 2,
  // Surfacing deliberately absent: it holds whatever zone the dive reached.
  // Mapping it to the deepest look turned a one-zone Quick Dive the colour of
  // zone three on its way out.
};

/** The dot on the stage chip. Calibrating and idle carry none; surfacing keeps the last. */
const CHIP_ZONE: Partial<Record<SessionState, 1 | 2 | 3>> = {
  'zone-1': 1,
  'zone-2': 2,
  'zone-3': 3,
};

const PROMPT_LABEL: Record<PromptStep, (t: Strings) => string> = {
  inhale: (t) => t.dive.prompt.inhale,
  'top-up': (t) => t.dive.prompt.topUp,
  exhale: (t) => t.dive.prompt.exhale,
  rest: (t) => t.dive.prompt.rest,
};

/** The exhale caption depends on what is actually listening, not what was chosen. */
const EXHALE_CAPTION: Record<InputCode, ((t: Strings) => string) | null> = {
  microphone: (t) => t.dive.prompt.exhaleMic,
  keyboard: (t) => t.dive.prompt.exhaleKey,
  scripted: null,
};

/** Segment of the reduced-motion ring lit for each step. */
const SEGMENT_INDEX: Record<PromptStep, number> = {
  inhale: 0,
  'top-up': 1,
  exhale: 2,
  rest: 3,
};

/** What the prompt ring is showing: the calibration countdown or a breath step. */
interface RingState {
  step: PromptStep | 'calibrating' | null;
  /** Wall-clock length of the sweep. */
  sweepMs: number;
  /** Bumped on every step so the sweep restarts. */
  seq: number;
}

const IDLE_RING: RingState = { step: null, sweepMs: 0, seq: 0 };

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const list = matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function DiveView() {
  const { t, language } = useLanguage();
  const stateLabel = (state: SessionState) => t.state[state];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<DiveScene | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  const engineRef = useRef<BreathEngine | null>(null);
  const conductorRef = useRef<BreathConductor | null>(null);
  const machineRef = useRef<SessionMachine | null>(null);

  const [running, setRunning] = useState(false);
  // Guards the async start: a second press while the microphone or the
  // renderer is still being awaited would otherwise tear down empty refs and
  // build a second engine, renderer and machine over the first.
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  // The microphone is the point of the thing, so it is what a visitor gets
  // first. The spacebar sits beside it as an equal choice rather than a
  // consolation: a loud room or a shared office is ordinary, not a failure.
  const [source, setSource] = useState<Source>('mic');
  const [plan, setPlan] = useState<SessionPlan>('full');
  const [speed, setSpeed] = useState(10);
  const [state, setState] = useState<SessionState>('idle');
  const [depth, setDepth] = useState(0);
  const [light, setLight] = useState(0);
  const [ring, setRing] = useState<RingState>(IDLE_RING);
  const [chipZone, setChipZone] = useState<1 | 2 | 3 | undefined>(undefined);
  const [result, setResult] = useState<SessionResult | null>(null);
  // Each dive draws on a fresh canvas element. Tearing a renderer down loses
  // the WebGL context on its canvas, and a renderer built over a lost context
  // never finishes initialising - so the canvas is keyed and swapped between
  // dives rather than reused.
  const [canvasSeq, setCanvasSeq] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  // What actually drove the dive, which is not always what was selected, and
  // why — the surface screen and the exported log both read this rather than
  // the button that was pressed.
  const [inputCode, setInputCode] = useState<InputCode>('scripted');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const phone = useMediaQuery('(max-width: 599px)');
  const landscape = useMediaQuery('(max-height: 480px)');

  const mode: 'setup' | 'diving' | 'surface' = running ? 'diving' : result !== null ? 'surface' : 'setup';

  const stopAll = () => {
    machineRef.current?.stop();
    machineRef.current = null;
    teardownRef.current?.();
    teardownRef.current = null;
    conductorRef.current?.stop();
    conductorRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    sceneRef.current?.destroy();
    sceneRef.current = null;
  };

  useEffect(() => stopAll, []);

  // The settled scene stays on the band for as long as the results are read.
  // It is destroyed here, on the way out, so the canvas it drew on is swapped
  // for a fresh one only after its last frame is no longer wanted.
  const leaveSurface = () => {
    sceneRef.current?.destroy();
    sceneRef.current = null;
    setResult(null);
    setCanvasSeq((n) => n + 1);
  };

  // Immersive while a dive runs: the navs hide and the page cannot scroll.
  // A layout effect, so the attribute is on the document before the first
  // frame is drawn rather than a paint later.
  useLayoutEffect(() => {
    if (!running) return;
    document.documentElement.setAttribute('data-diving', '1');
    return () => document.documentElement.removeAttribute('data-diving');
  }, [running]);

  // Focus lands on the HUD container, never on the canvas. From there Tab
  // reaches Dismiss (when present) and Leave; Space is free for the exhale.
  useEffect(() => {
    if (running) hudRef.current?.focus({ preventScroll: true });
  }, [running]);

  // Sampled rather than event-driven, so a 60Hz scene does not push 60 React
  // renders a second at the readout.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      setDepth(scene.depth);
      setLight(scene.light);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const handleStart = async (chosenPlan: SessionPlan) => {
    if (startingRef.current || running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    startingRef.current = true;
    setStarting(true);
    try {
      await startDive(canvas, chosenPlan);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const startDive = async (canvas: HTMLCanvasElement, chosenPlan: SessionPlan) => {
    stopAll();
    setDepth(0);
    setLight(0);
    setRing(IDLE_RING);
    setChipZone(undefined);
    setResult(null);
    setStartError(null);
    setFallbackReason(null);
    setNoticeDismissed(false);

    // Only the fixture can be fast-forwarded. A person breathing into a
    // microphone or holding a key runs in real time, whatever the dev control says.
    const timeScale = source === 'scripted' ? speed : 1;
    const conductor = new BreathConductor({ targetRR: 15, timeScale });

    // Built for the chosen source only. Constructing all three would spin up a
    // detector and an estimator nobody asked for on every dive.
    const planFor = (chosen: Source): InputPlan => {
      switch (chosen) {
        case 'mic':
          return {
            primary: createBreathEngine(),
            code: 'microphone',
            fallback: () => new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
          };
        case 'spacebar':
          return {
            primary: new SpacebarBreathEngine({ calibrationMs: CALIBRATION_MS }),
            code: 'keyboard',
          };
        case 'scripted':
          return {
            primary: new ScriptedBreathEngine({ follow: conductor, timeScale }),
            code: 'scripted',
          };
      }
    };

    // Started here, before the renderer is awaited, and not at the end of this
    // function where it used to sit. `capture.ts` has to construct its
    // AudioContext inside the gesture that opened it, and an await on the
    // render path in between is enough to lose that — Safari most strictly.
    let started: StartedInput;
    try {
      started = await startInput(planFor(source));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const message = fill(t.setup.startError, { reason });
      setStartError(message);
      setAnnouncement(message);
      return;
    }

    const engine = started.engine;
    // Held immediately so a failure further down this function still releases
    // the microphone rather than leaving it hot with no way to reach it.
    engineRef.current = engine;
    setInputCode(started.code);
    setFallbackReason(started.fellBack ? started.reason : null);
    conductor.attach(engine);

    const renderer = await createDiveRenderer(canvas);
    const scene = new DiveScene(renderer, canvas, { timeScale });
    const detachScene = scene.attach(engine, conductor);
    // The ring follows the conductor directly: the same windows the scene and
    // the engine get, in wall-clock time, restarted on every step.
    const detachRing = conductor.on((window) =>
      setRing((previous) => ({
        step: window.step,
        sweepMs: window.durationMs / timeScale,
        seq: previous.seq + 1,
      })),
    );
    teardownRef.current = () => {
      detachScene();
      detachRing();
    };

    const machine = new SessionMachine(engine, conductor, {
      plan: chosenPlan,
      timeScale,
      onState: (next) => {
        setState(next);
        // Calibrating is the first thing the machine says, in the same tick
        // as the dive starting, so the two announcements travel together.
        setAnnouncement(
          next === 'calibrating' ? `${t.dive.started} ${stateLabel(next)}` : stateLabel(next),
        );
        // The arc tells the scene which zone it is in; the scene does not guess
        // from depth, which is what contradicted it in #30.
        const zone = ZONE_INDEX[next];
        if (zone !== undefined) scene.setZone(zone);
        if (next === 'calibrating') {
          setChipZone(undefined);
          setRing((previous) => ({
            step: 'calibrating',
            sweepMs: CALIBRATION_MS / timeScale,
            seq: previous.seq + 1,
          }));
        }
        const chip = CHIP_ZONE[next];
        if (chip !== undefined) setChipZone(chip);
        // Level while reading the baseline and on the way up; descending
        // through the zones.
        if (next === 'calibrating' || next === 'surfacing') scene.setPose('level');
        else if (zone !== undefined) scene.setPose('descending');
      },
      onResult: (finished) => {
        // Sampling stops with `running`, so take a last reading here or the
        // readout freezes mid-glide while the canvas carries on easing down.
        setDepth(scene.depth);
        setLight(scene.light);
        // Let the descent come to rest, then the scene stops itself rather than
        // animating underneath the surface screen for as long as it is open.
        scene.settle();
        setResult(finished);
        setRunning(false);
        // Stated as the two measurements rather than as a verdict, so the
        // announcement stays true whether breathing slowed, held steady or
        // sped up. The full wording is on the surface screen below it. A lost
        // signal has no measurements to state, so it announces that instead.
        setAnnouncement(
          finished.ending === 'signal-lost'
            ? t.surface.lostTitle
            : fill(t.surface.announce, {
                title: t.surface.title,
                before: formatDecimal(finished.baselineRR, language, t),
                after: formatDecimal(finished.finalRR, language, t),
                unit: t.surface.unit,
              }),
        );
      },
    });

    sceneRef.current = scene;
    conductorRef.current = conductor;
    machineRef.current = machine;
    scene.setPose('level');

    // The engine is already running — it was started above, inside the gesture.
    // The stage goes full-viewport before the loop starts, so the first frame
    // is drawn at the size the dive is played at, not the setup band's.
    flushSync(() => setRunning(true));
    scene.start();
    // The machine starts the conductor once calibration is done — see #29.
    void machine.start();
  };

  // Leaving early ends the session where it stands. The machine reports the
  // dive so far through onResult, which settles the scene and opens the
  // surface screen; only the input side is torn down here. The scene and its
  // renderer stay alive under the surface screen, exactly as they do for the
  // completed and signal-lost endings, so the band shows the settled last
  // frame rather than a canvas whose context has been lost.
  const handleStop = () => {
    machineRef.current?.stop();
    machineRef.current = null;
    teardownRef.current?.();
    teardownRef.current = null;
    conductorRef.current?.stop();
    conductorRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    setRunning(false);
  };

  // ------------------------------------------------------------- the ring

  const surfacing = state === 'surfacing';
  let ringLabel: string | undefined;
  let ringCaption: string | undefined;
  let activeSegment = -1;
  let ringGlow = false;
  if (ring.step === 'calibrating') {
    ringLabel = t.dive.prompt.calibrating;
    ringCaption = t.dive.prompt.calibratingCaption;
  } else if (ring.step !== null) {
    ringLabel = PROMPT_LABEL[ring.step](t);
    activeSegment = SEGMENT_INDEX[ring.step];
    ringGlow = ring.step === 'exhale';
    if (surfacing) ringCaption = t.dive.prompt.surfacing;
    else if (ring.step === 'exhale') ringCaption = EXHALE_CAPTION[inputCode]?.(t);
  }
  const ringSize = landscape ? 80 : phone ? 96 : 120;
  const ringStroke = phone || landscape ? 5 : 6;

  const lightPercent = Math.round(light * 100);
  const showNotice = fallbackReason !== null && !noticeDismissed;

  return (
    <div className="dive" data-mode={mode}>
      <div className="stage">
        {/* The scene is decorative: everything it shows is also available as
            text in the HUD and in the live region, so nothing is audio-only or
            canvas-only. */}
        <canvas
          key={canvasSeq}
          ref={canvasRef}
          className="stage__canvas"
          role="presentation"
        />
        <p className="visually-hidden">{t.dive.sceneDescription}</p>
        <div className="stage__backdrop" aria-hidden="true" />

        {mode !== 'setup' && (
          <div
            className={mode === 'diving' ? 'hud' : 'hud hud--out'}
            ref={hudRef}
            tabIndex={-1}
            inert={mode !== 'diving'}
            aria-hidden={mode !== 'diving' ? true : undefined}
          >
            <div className="hud__top">
              <div className="hud__row">
                <Chip tone="hud" zone={chipZone} className="hud__stage">
                  {stateLabel(state)}
                </Chip>
                <Button
                  variant="ghost"
                  size="sm"
                  hud
                  className="hud__leave"
                  icon={<IconLeave size={18} />}
                  onClick={handleStop}
                >
                  {t.dive.leave}
                </Button>
              </div>
              {/* Assertive, unlike the stage announcements: someone who asked
                  for the microphone and got the keyboard needs to know before
                  they breathe, not at the next pause. */}
              {showNotice && (
                <Notice
                  tone="alert"
                  className="notice--hud hud__notice"
                  action={
                    <Button variant="ghost" size="sm" hud onClick={() => setNoticeDismissed(true)}>
                      {t.common.dismiss}
                    </Button>
                  }
                >
                  {fill(t.setup.micRefused, { reason: fallbackReason })}
                </Notice>
              )}
            </div>

            <div className="hud__bottom">
              <div className="hud__depth">
                <span className="t-label">{t.dive.depth}</span>
                <span className="t-num-lg">{formatMetres(depth, t, language)}</span>
              </div>
              <div className="hud__ring">
                <ProgressRing
                  tone="hud"
                  size={ringSize}
                  stroke={ringStroke}
                  mode="sweep"
                  durationMs={ring.sweepMs}
                  seq={ring.seq}
                  segments={4}
                  activeSegment={activeSegment}
                  label={ringLabel}
                  caption={ringCaption}
                  glow={ringGlow}
                />
              </div>
              <div className="hud__light">
                <span className="t-label">{t.dive.light}</span>
                <Meter
                  aria-label={t.dive.light}
                  value={lightPercent}
                  text={formatPercent(lightPercent, t)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Polite, not assertive: a stage change is worth hearing at the next
          pause, never worth interrupting someone mid-breath. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      {mode === 'setup' && (
        <section className="setup page page--narrow" aria-labelledby="setup-title">
          <h1 id="setup-title">{t.setup.title}</h1>
          <p className="t-lead setup__lead">
            {t.setup.howLine} <a href="#/how">{t.setup.howLink}</a>
          </p>

          <ChoiceGroup
            legend={t.setup.inputLegend}
            extra={
              DEV_TOOLS && source === 'scripted' ? (
                <Button variant="secondary" size="sm" onClick={() => setSpeed(speed === 1 ? 10 : 1)}>
                  {fill(t.setup.speed, { n: speed })}
                </Button>
              ) : undefined
            }
          >
            {(DEV_TOOLS ? ALL_SOURCES : PLAYABLE_SOURCES).map((option) => (
              <Choice
                key={option}
                name="input"
                value={option}
                checked={source === option}
                onChange={() => setSource(option)}
                icon={
                  option === 'mic' ? (
                    <IconMic size={24} />
                  ) : option === 'spacebar' ? (
                    <IconSpacebar size={24} />
                  ) : (
                    <IconNumbers size={24} />
                  )
                }
                title={
                  option === 'mic'
                    ? t.setup.micTitle
                    : option === 'spacebar'
                      ? t.setup.spacebarTitle
                      : t.setup.scriptedTitle
                }
                description={
                  option === 'mic'
                    ? t.setup.micDesc
                    : option === 'spacebar'
                      ? t.setup.spacebarDesc
                      : t.setup.scriptedDesc
                }
              />
            ))}
          </ChoiceGroup>

          <ChoiceGroup legend={t.setup.lengthLegend}>
            <Choice
              name="length"
              value="full"
              checked={plan === 'full'}
              onChange={() => setPlan('full')}
              icon={<IconDive size={24} />}
              title={t.setup.fullTitle}
              description={t.setup.fullDesc}
            />
            <Choice
              name="length"
              value="quick"
              checked={plan === 'quick'}
              onChange={() => setPlan('quick')}
              icon={<IconTimer size={24} />}
              title={t.setup.quickTitle}
              description={t.setup.quickDesc}
            />
          </ChoiceGroup>

          {startError !== null && <Notice tone="alert">{startError}</Notice>}

          <div className="setup__actions">
            <Button
              variant="primary"
              size="lg"
              icon={<IconDive size={18} />}
              disabled={starting}
              onClick={() => void handleStart(plan)}
            >
              {t.setup.start}
            </Button>
            {source === 'mic' && (
              <>
                <p className="t-small setup__note">{t.setup.permissionNote}</p>
                <p className="t-small setup__note">{t.setup.micFidelity}</p>
              </>
            )}
            {source === 'spacebar' && <p className="t-small setup__note">{t.setup.spacebarNote}</p>}
          </div>
        </section>
      )}

      {mode === 'surface' && result !== null && (
        <SurfaceScreen
          result={result}
          // The input that ran, not the one that was selected. A dive that
          // fell back to the keyboard says keyboard, here and in the export.
          inputLabel={CODE_LABEL[inputCode](t)}
          inputCode={inputCode}
          onLeave={leaveSurface}
        />
      )}
    </div>
  );
}
