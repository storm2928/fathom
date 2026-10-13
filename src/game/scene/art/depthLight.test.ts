import { test, assert, equal } from '../../testing/harness.ts';
import {
  PRESSURE_VIGNETTE,
  RAYS_GONE_AT_METRES,
  SURFACE_ABOVE_DIVER_PX,
  pressure,
  rayStrength,
  surfaceY,
} from './depthLight.ts';
import { PIXELS_PER_METRE } from '../renderer.ts';
import { DARKEST_AT_METRES } from '../descent.ts';

/**
 * The surface you leave behind, and the dark you sink into. Both are pure
 * functions of drawn depth so the camera can never disagree with the gauge.
 */

test('at the surface the waterline sits just above the diver', () => {
  equal(surfaceY(0, 400), 400 - SURFACE_ABOVE_DIVER_PX);
});

test('the waterline rises one base-layer metre per metre descended', () => {
  equal(surfaceY(10, 400) - surfaceY(11, 400), PIXELS_PER_METRE);
});

test('rays are full at the surface, fade monotonically, and are gone by the limit', () => {
  equal(rayStrength(0), 1);
  for (let d = 0; d < RAYS_GONE_AT_METRES; d += 5) {
    assert(rayStrength(d + 5) <= rayStrength(d), `rays brightened at ${d}m`);
  }
  equal(rayStrength(RAYS_GONE_AT_METRES), 0);
  equal(rayStrength(RAYS_GONE_AT_METRES * 3), 0);
});

test('pressure is 0 at the surface, 1 at the darkest depth, and never beyond', () => {
  equal(pressure(0), 0);
  equal(pressure(DARKEST_AT_METRES), 1);
  equal(pressure(DARKEST_AT_METRES * 2), 1);
  equal(pressure(-5), 0);
  assert(PRESSURE_VIGNETTE > 0 && PRESSURE_VIGNETTE < 1);
});
