/**
 * Renders the native soundscape offline and checks what it actually sounds
 * like, numerically:
 *
 *     npm run test:sound -w mobile
 *
 * The rule that matters most: with the speaker safety cut on, almost nothing
 * is left above 1 kHz, where the breath detector listens.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = new URL('../../../', import.meta.url).pathname;
const here = new URL('.', import.meta.url).pathname;
const bin = join(mkdtempSync(join(tmpdir(), 'fathom-sound-')), 'sound-check');
execFileSync('swiftc', [
  '-O',
  '-o',
  bin,
  join(repo, 'mobile/ios/App/App/Soundscape.swift'),
  join(here, 'main.swift'),
]);

const measure = (scenario) => JSON.parse(execFileSync(bin, [scenario], { encoding: 'utf8' }));
const m = Object.fromEntries(
  ['silent', 'shallow', 'deep', 'bubbles', 'speaker-window', 'midnight', 'abyss', 'ping', 'splash'].map((s) => [s, measure(s)]),
);

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${detail})`}`);
  if (!ok) failures += 1;
};

check('volume zero is silence', m.silent.peak === 0, `peak ${m.silent.peak}`);
for (const [name, r] of Object.entries(m)) {
  if (name === 'silent') continue;
  check(`${name} is audible`, r.rms > 0.005, `rms ${r.rms}`);
  check(`${name} never clips`, r.peak <= 1, `peak ${r.peak}`);
}
check(
  'sinking takes the brightness away',
  m.deep.high < m.shallow.high * 0.35,
  `deep high ${m.deep.high} vs shallow ${m.shallow.high}`,
);
check(
  'bubbles are bright',
  m.bubbles.high > m.shallow.high * 1.5,
  `bubbles high ${m.bubbles.high} vs ${m.shallow.high}`,
);
check(
  'the speaker cut leaves nothing above 1 kHz for the microphone',
  m['speaker-window'].high < m['speaker-window'].rms * 0.1,
  `high ${m['speaker-window'].high} of rms ${m['speaker-window'].rms}`,
);

if (failures) {
  console.log(`\n${failures} sound check(s) failed`);
  process.exit(1);
}
console.log('\nsoundscape checks pass');
