import { readFileSync } from 'node:fs';
import { test, assert, equal } from '@fathom/game/testing/harness.ts';
import { POLICY, WEB_POLICY, policyFor } from './policy.ts';

/**
 * The policy is written once, here, and shown in the app. The public page the
 * App Store links to is hand-written HTML, so these tests keep the two saying
 * the same thing.
 */

const page = readFileSync(new URL('../../../public/privacy.html', import.meta.url), 'utf8');
const decode = (html: string) =>
  html.replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

test('every section of the in-app policy is on the public page', () => {
  const text = decode(page);
  for (const section of POLICY.en.sections) {
    assert(text.includes(section.heading), `the public page is missing "${section.heading}"`);
  }
  assert(text.includes(POLICY.en.updated), 'the public page carries a different date');
});

test('the French policy has the same sections as the English one', () => {
  equal(POLICY.fr.sections.length, POLICY.en.sections.length);
  equal(POLICY.fr.updated.length > 0, true);
});

test('the policy covers the microphone, Apple Health and deleting your data', () => {
  const all = POLICY.en.sections.flatMap((s) => [s.heading, ...s.body]).join(' ');
  assert(/microphone/i.test(all), 'nothing about the microphone');
  assert(/Apple Health/.test(all), 'nothing about Apple Health');
  assert(/Deleting the app deletes/.test(all), 'nothing about deleting your data');
});

const allText = (policy: (typeof WEB_POLICY)['en']) =>
  policy.sections.flatMap((s) => [s.heading, ...s.body]).join(' ');

test('the web policy says nothing that is only true on an iPhone', () => {
  for (const language of ['en', 'fr'] as const) {
    const all = allText(WEB_POLICY[language]);
    assert(
      !/iPhone|Apple Health|Apple Santé|iOS|Deleting the app|Supprimer l’app/.test(all),
      `the ${language} web policy still describes an iPhone`,
    );
  }
});

test('the web policy covers the microphone, the browser and clearing your data', () => {
  const all = allText(WEB_POLICY.en);
  assert(/microphone/i.test(all), 'nothing about the microphone');
  assert(/browser/i.test(all), 'nothing about the browser');
  assert(/clear/i.test(all), 'nothing about clearing your data');
  equal(WEB_POLICY.fr.sections.length, WEB_POLICY.en.sections.length);
});

test('the app shows the iPhone policy, a browser the web one', () => {
  equal(policyFor(true), POLICY);
  equal(policyFor(false), WEB_POLICY);
});
