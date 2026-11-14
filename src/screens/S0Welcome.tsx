import type { JSX } from 'react';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Disclaimer } from '@/components/Disclaimer';
import { useApp } from '@/state/AppContext';

/** S0: promise, "Free · No account · No ads", status badge, one primary action. */
export function S0Welcome(): JSX.Element {
  const { actions, state, t } = useApp();
  return (
    <section className="screen" aria-labelledby="welcome-title">
      <p className="eyebrow">{t('welcome.eyebrow')}</p>
      <h1 id="welcome-title">{t('welcome.title')}</h1>
      <p className="lead">{t('welcome.lead')}</p>

      <div className="card card--soft stack">
        <strong>{t('app.free')}</strong>
        <ul className="bullet-list" style={{ margin: 0 }}>
          <li>{t('welcome.bullet1')}</li>
          <li>{t('welcome.bullet2')}</li>
          <li>{t('welcome.bullet3')}</li>
        </ul>
      </div>

      <button
        type="button"
        className="btn btn--block"
        onClick={() => actions.goTo('S1_FIND_FIELD')}
        disabled={state.loading}
      >
        {t('welcome.cta')}
      </button>
      <button
        type="button"
        className="btn btn--secondary btn--block"
        onClick={() => {
          void actions.startLocation({ kind: 'sample' });
        }}
        disabled={state.loading}
      >
        {t('welcome.offline')}
      </button>
      {state.loading ? <div className="loading-line" aria-label={state.loadingLabel} /> : null}

      <Disclaimer />
      <div className="row">
        <DataSourcesLink />
        {state.lang === 'en' ? (
          <button type="button" className="link-button" onClick={() => actions.setLang('id')}>
            Bahasa Indonesia
          </button>
        ) : (
          <button type="button" className="link-button" onClick={() => actions.setLang('en')}>
            English
          </button>
        )}
      </div>
    </section>
  );
}
