import type { JSX } from 'react';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { RELEASES_URL } from '@/config/links';
import { S0Welcome } from '@/screens/S0Welcome';
import { S1FindField } from '@/screens/S1FindField';
import { S2FieldSnapshot } from '@/screens/S2FieldSnapshot';
import { S3FieldProfile } from '@/screens/S3FieldProfile';
import { S4Recommendations } from '@/screens/S4Recommendations';
import { S5WhyThisCrop } from '@/screens/S5WhyThisCrop';
import { S6RotationPlan } from '@/screens/S6RotationPlan';
import { S6StrategyCompare } from '@/screens/S6StrategyCompare';
import { S7DataSources } from '@/screens/S7DataSources';
import { useApp } from '@/state/AppContext';
import type { Screen } from '@/types/ui';

/**
 * Screen registry. A single lookup keeps navigation declarative: the reducer
 * only ever stores a Screen id, and this map resolves it to a component.
 */
const SCREENS: Record<Screen, () => JSX.Element> = {
  S0_WELCOME: S0Welcome,
  S1_FIND_FIELD: S1FindField,
  S2_SNAPSHOT: S2FieldSnapshot,
  S3_PROFILE: S3FieldProfile,
  S4_RECOMMENDATIONS: S4Recommendations,
  S5_WHY: S5WhyThisCrop,
  S6_ROTATION: S6RotationPlan,
  S6_STRATEGY_COMPARE: S6StrategyCompare,
  S7_DATA_SOURCES: S7DataSources,
};

/**
 * Application shell. Owns only chrome that must be on EVERY screen:
 * the brand header, the current screen and the footer. All product logic lives
 * in the screens and the pure domain. Data provenance is shown per value through
 * SourceLabel / EstimatedBadge and on the Data & sources screen.
 */
export function App(): JSX.Element {
  const { state, actions, t } = useApp();
  const CurrentScreen = SCREENS[state.screen] ?? S0Welcome;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>

      <header className="app-header">
        <button
          type="button"
          className="app-header__brand"
          onClick={() => actions.goTo('S0_WELCOME')}
          aria-label={t('app.name')}
        >
          <span className="app-header__mark" aria-hidden="true">
            🌱
          </span>
          <span className="app-header__name">{t('app.name')}</span>
        </button>
        <div className="app-header__right">
          <span className="app-header__tagline">{t('app.tagline')}</span>
          {state.lang === 'en' ? (
            <button
              type="button"
              className="lang-toggle"
              onClick={() => actions.setLang('id')}
              aria-label="Ganti ke Bahasa Indonesia"
            >
              ID
            </button>
          ) : (
            <button
              type="button"
              className="lang-toggle"
              onClick={() => actions.setLang('en')}
              aria-label="Switch to English"
            >
              EN
            </button>
          )}
        </div>
      </header>

      <main id="main" className="app-main" tabIndex={-1}>
        <CurrentScreen />
      </main>

      <footer className="app-footer">
        <p style={{ margin: '0 0 var(--space-2)' }}>
          <strong>{t('app.free')}</strong>
        </p>
        <p style={{ margin: 0 }}>
          {t('app.name')} · {t('app.tagline')}
        </p>
        <p
          className="row row--center"
          style={{ margin: 'var(--space-2) 0 0', justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <DataSourcesLink />
          <span aria-hidden="true">·</span>
          <a className="link-button" href={RELEASES_URL} target="_blank" rel="noreferrer noopener">
            {t('app.desktopApp')}
          </a>
          <span aria-hidden="true">·</span>
          <button type="button" className="link-button" onClick={() => actions.reset()}>
            {t('common.startOver')}
          </button>
        </p>
      </footer>
    </div>
  );
}
