import { createElement, type JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Render EVERY screen with a fully populated state. `vi.mock` swaps only `useApp`,
 * leaving the real AppProvider/reducer exports intact. Static rendering skips
 * useEffect, so Leaflet stays unloaded and we exercise the offline fallback map.
 */
const holder = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@/state/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/state/AppContext')>();
  return { ...actual, useApp: () => holder.value };
});

import { offlineSite } from '@/api/orchestrator';
import { recommend } from '@/domain/recommend';
import { makeT } from '@/i18n';
import { S0Welcome } from '@/screens/S0Welcome';
import { S1FindField } from '@/screens/S1FindField';
import { S2FieldSnapshot } from '@/screens/S2FieldSnapshot';
import { S3FieldProfile } from '@/screens/S3FieldProfile';
import { S4Recommendations } from '@/screens/S4Recommendations';
import { S5WhyThisCrop } from '@/screens/S5WhyThisCrop';
import { S6RotationPlan } from '@/screens/S6RotationPlan';
import { S6StrategyCompare } from '@/screens/S6StrategyCompare';
import { S7DataSources } from '@/screens/S7DataSources';
import type { AppContextValue } from '@/state/AppContext';
import type { Screen } from '@/types/ui';

function noop(): void {
  /* intentionally empty */
}

function contextValue(screen: Screen): AppContextValue {
  const site = offlineSite(undefined, undefined, 3);
  const recommendations = recommend(site, 'en');
  return {
    state: {
      screen,
      lang: 'en',
      location: site.location,
      site,
      resolved: null,
      profile: site.profile,
      recommendations,
      selectedCropId: recommendations[0]?.cropId ?? null,
      selectedStrategyId: 'balanced',
      monthOverride: null,
      baseTargetMonth: 3,
      showScoringMethod: true,
      loading: false,
      loadingLabel: '',
      notice: null,
      forcedOffline: false,
      lastInput: null,
      dataSourcesReturnScreen: 'S2_SNAPSHOT',
    },
    dispatch: noop,
    actions: {
      goTo: noop,
      setLang: noop,
      startLocation: async () => undefined,
      retry: async () => undefined,
      setProfile: noop,
      selectCrop: noop,
      selectStrategy: noop,
      setMonthOverride: noop,
      toggleScoringMethod: noop,
      reset: noop,
    },
    t: makeT('en'),
  };
}

const SCREENS: Array<[string, Screen, () => JSX.Element]> = [
  ['S0 welcome', 'S0_WELCOME', S0Welcome],
  ['S1 find field', 'S1_FIND_FIELD', S1FindField],
  ['S2 field snapshot', 'S2_SNAPSHOT', S2FieldSnapshot],
  ['S3 field profile', 'S3_PROFILE', S3FieldProfile],
  ['S4 recommendations', 'S4_RECOMMENDATIONS', S4Recommendations],
  ['S5 why this crop', 'S5_WHY', S5WhyThisCrop],
  ['S6 rotation plan', 'S6_ROTATION', S6RotationPlan],
  ['S6 strategy compare', 'S6_STRATEGY_COMPARE', S6StrategyCompare],
  ['S7 data sources', 'S7_DATA_SOURCES', S7DataSources],
];

beforeAll(() => {
  // A stable default; each test overrides it with its own screen.
  holder.value = contextValue('S0_WELCOME');
});

describe('every screen renders with real offline data', () => {
  for (const [label, screen, Component] of SCREENS) {
    it(`${label} produces non-trivial markup without a runtime error`, () => {
      holder.value = contextValue(screen);
      const html = renderToStaticMarkup(createElement(Component));
      expect(html.length).toBeGreaterThan(200);
      expect(html).toContain('screen');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('undefined');
    });
  }

  it('S4 lists ranked recommendations with scores and source labels', () => {
    holder.value = contextValue('S4_RECOMMENDATIONS');
    const html = renderToStaticMarkup(createElement(S4Recommendations));
    expect(html).toContain('score');
    expect(html).toContain('March');
    expect(html).toContain('/ 100');
    // Factor labels must NOT be duplicated (regression guard).
    expect(html).not.toContain('Temperature fit / Temperature fit');
    expect(html).toContain('F1');
  });

  it('S5 shows all seven factor cards and the score ring', () => {
    holder.value = contextValue('S5_WHY');
    const html = renderToStaticMarkup(createElement(S5WhyThisCrop));
    expect(html).toContain('score-ring');
    expect(html).toContain('Temperature fit');
    expect(html).toContain('Water fit');
    expect(html).toContain('Soil fit');
    expect(html).toContain('Rotation continuity');
    expect(html).toContain('Please read');
  });

  it('S6 shows exactly three seasons and the previous-crop assumption', () => {
    holder.value = contextValue('S6_ROTATION');
    const html = renderToStaticMarkup(createElement(S6RotationPlan));
    expect(html).toContain('Season 1');
    expect(html).toContain('Season 2');
    expect(html).toContain('Season 3');
    // Regression: the full neutral-previous-crop explanation must appear ONCE, not
    // be repeated by both the header line and the first transition reason.
    const note = 'We assumed a neutral, non-legume, medium-root starting crop';
    expect(html.split(note).length - 1).toBe(1);
    expect(html).toContain('a neutral starting crop was assumed');
  });

  it('S6 strategy compare shows at least three strategies including the existing rotation', () => {
    holder.value = contextValue('S6_STRATEGY_COMPARE');
    const html = renderToStaticMarkup(createElement(S6StrategyCompare));
    expect(html).toContain('Your current rotation');
    expect(html).toContain('Scroll the table sideways');
    expect(html).toContain('(baseline, inferred)');
    expect(html).toContain('Balanced');
    expect(html).toContain('Soil-restoring');
    expect(html).toContain('Water-saving');
    expect(html).toContain('Quick income');
  });

  it('S7 lists the allowlisted hosts and their licences', () => {
    holder.value = contextValue('S7_DATA_SOURCES');
    const html = renderToStaticMarkup(createElement(S7DataSources));
    expect(html).toContain('power.larc.nasa.gov');
    expect(html).toContain('api.open-meteo.com');
    expect(html).toContain('rest.isric.org');
    expect(html).toContain('NASA POWER');
  });

  it('every screen keeps the data-sources link and disclaimer on data screens', () => {
    for (const screen of ['S2_SNAPSHOT', 'S4_RECOMMENDATIONS', 'S5_WHY', 'S6_ROTATION'] as Screen[]) {
      holder.value = contextValue(screen);
      const html = renderToStaticMarkup(createElement(SCREENS.find((entry) => entry[1] === screen)![2]));
      expect(html, screen).toContain('decision support');
      expect(html, screen).toContain('Data &amp; sources');
    }
  });
});
