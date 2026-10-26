import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { deviceKind } from './platform.ts';
import { APP_STRINGS, stringsFor } from '../appStrings.ts';

/**
 * The iPhone keeps its words exactly. A browser on a desk says what is true
 * there: no finger, no screen to touch, no phone to bring closer.
 */

test('the device kind follows the platform first, then the pointer', () => {
  equal(deviceKind(true, true), 'native');
  equal(deviceKind(true, false), 'native');
  equal(deviceKind(false, true), 'desktop');
  equal(deviceKind(false, false), 'touch-web');
});

test('the iPhone text is untouched', () => {
  for (const language of ['en', 'fr'] as const) {
    equal(JSON.stringify(stringsFor(language, 'native')), JSON.stringify(APP_STRINGS[language]));
  }
});

const DEVICE_WORDED = [
  'useTouch',
  'useTouchHint',
  'holdHint',
  'micFellBack',
  'lostFixMic',
  'lostFixTouch',
  'micDeclined',
  'micUnheard',
] as const;

test('on a desktop nothing mentions a finger, a touch screen or a phone', () => {
  for (const language of ['en', 'fr'] as const) {
    const s = stringsFor(language, 'desktop');
    for (const key of DEVICE_WORDED) {
      assert(
        !/finger|touch|\bphone|doigt|écran|téléphone|appui/i.test(s[key]),
        `${language}.${key} still talks about a phone: "${s[key]}"`,
      );
    }
    assert(/space|espace/i.test(s.useTouchHint), `${language}.useTouchHint does not mention Space`);
  }
});

test('a touch screen in a browser keeps touch, but has no phone to bring closer', () => {
  for (const language of ['en', 'fr'] as const) {
    const s = stringsFor(language, 'touch-web');
    assert(!/\bphone|téléphone/i.test(s.micUnheard), `${language}.micUnheard mentions a phone`);
    equal(s.useTouch, APP_STRINGS[language].useTouch);
  }
});
