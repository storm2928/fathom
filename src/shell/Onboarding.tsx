import { CrisisRail } from './CrisisRail';
import './Onboarding.css';

/**
 * What this is, what it is not, and who should be careful — before anything
 * asks for a microphone.
 *
 * Ordering is the point. Permission prompts arrive after someone has read what
 * the thing does, not before, so nobody is deciding whether to hand over a
 * microphone to something they have not been told about yet. It is also short
 * on purpose: a scope screen nobody finishes reading protects nobody.
 */

interface OnboardingProps {
  onBegin: () => void;
}

export function Onboarding({ onBegin }: OnboardingProps) {
  return (
    <section className="onboarding">
      <h1>Before you dive</h1>

      <p className="onboarding-lead">
        FATHOM is a five-minute breathing exercise you play with your breath. It measures
        how fast you are breathing at the start, guides you through a slower pattern, and
        measures again at the end so you can see what changed.
      </p>

      <h2>What it is not</h2>
      <p>
        It is <strong>not therapy</strong>, <strong>not diagnosis</strong>, and{' '}
        <strong>not for a crisis</strong>. It does not treat, reduce or cure anxiety or any
        other condition, and it will never tell you that it has. It trains arousal
        regulation and shows you a measurement — that is the whole claim.
      </p>
      <p>
        There is nothing here that talks to you, remembers you, or scores you against
        anyone else. No account, no streak, no feed.
      </p>

      <h2>Take care if</h2>
      <ul className="onboarding-cautions">
        <li>
          You are driving, cycling, swimming, or operating anything that needs your
          attention. Do this sitting still, somewhere safe.
        </li>
        <li>
          Slow breathing makes you lightheaded. Some people find it does. If that happens,
          stop and let your breathing return to normal — there is nothing to win here.
        </li>
        <li>
          You have a heart or lung condition, are pregnant, or have a history of fainting
          or seizures. Worth a word with a clinician before making a habit of it.
        </li>
      </ul>
      <p className="onboarding-quiet">
        You can stop at any point. The session also stops itself.
      </p>

      <h2>What happens to your voice</h2>
      <p>
        If you use the microphone, the audio is processed on your device and never leaves
        it. Nothing is uploaded, nothing is stored on a server, and no recording is kept —
        the app only ever looks at how loud and how broad the sound is, moment to moment.
        You can also play the whole thing with the spacebar and never turn the microphone
        on at all.
      </p>

      <h2>What is actually measured</h2>
      <p>
        Your <strong>exhales</strong> are measured — when they start, how long they last,
        how steady they are. Your <strong>inhales are not</strong>. An inhale sounds too
        much like an exhale to tell apart reliably, so the app prompts your inhales on a
        rhythm and listens only for what follows. Where you see a breathing rate, it was
        counted from exhales.
      </p>

      <CrisisRail />

      <button type="button" className="onboarding-begin" onClick={onBegin}>
        I have read this — continue
      </button>
      <p className="onboarding-quiet">
        The next screen lets you choose the microphone or the spacebar. Nothing asks for
        permission until you pick.
      </p>
    </section>
  );
}
