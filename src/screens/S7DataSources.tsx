import type { JSX } from 'react';
import { Disclaimer } from '@/components/Disclaimer';
import { SourceLabel } from '@/components/SourceLabel';
import {
  ATTRIBUTION,
  DATA_INSPIRATION,
  DISCLAIMER,
  LICENCE,
  REGIONAL_ESTIMATE_CAVEAT,
} from '@/config/attribution';
import { ALLOWED_HOSTS, ALLOWED_HOST_PURPOSE } from '@/config/endpoints';
import { FACTOR_NAMES, FACTOR_ORDER, FACTOR_WEIGHTS } from '@/config/scoring';
import { useApp } from '@/state/AppContext';

/** S7: every source, contribution, freshness, licence, status + full attribution. */
export function S7DataSources(): JSX.Element {
  const { state, actions, t } = useApp();
  const site = state.site;
  const statuses = site?.sources ?? [];
  const provenance = site?.provenance ?? [];

  return (
    <section className="screen" aria-labelledby="sources-title">
      <div>
        <p className="eyebrow">S7</p>
        <h1 id="sources-title">{t('sources.title')}</h1>
        <p className="lead">{t('sources.lead')}</p>
      </div>

      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('sources.colSource')}</th>
              <th>{t('sources.colContribution')}</th>
              <th>{t('sources.colFreshness')}</th>
              <th>{t('sources.colLicence')}</th>
              <th>{t('sources.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {statuses.length === 0 ? (
              <tr>
                <td colSpan={5}>{t('common.notAvailable')}</td>
              </tr>
            ) : (
              statuses.map((status) => (
                <tr key={status.sourceId}>
                  <td>
                    <strong>{status.provenance.source}</strong>
                    {status.error ? (
                      <div className="tiny" style={{ color: 'var(--poor)' }}>{status.userVisibleLabel}</div>
                    ) : null}
                  </td>
                  <td>{status.provenance.contribution}</td>
                  <td>{status.provenance.freshness}</td>
                  <td>{status.provenance.licence}</td>
                  <td>
                    <span className={`badge ${status.provenance.isEstimated ? 'badge--estimated' : 'badge--live'}`}>
                      {status.provenance.isEstimated ? '◇ ' : '● '}
                      {status.provenance.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <h2>{t('sources.attribution')}</h2>
        <ul className="bullet-list small" style={{ margin: 0 }}>
          {Object.values(ATTRIBUTION).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="tiny muted" style={{ margin: 0 }}>
          {Object.entries(LICENCE)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' · ')}
        </p>
        {provenance.slice(0, 3).map((entry, index) => (
          <SourceLabel
            key={`${entry.sourceId}-${index}`}
            source={entry.source}
            freshness={entry.freshness}
            isEstimated={entry.isEstimated}
            sourceId={entry.sourceId}
          />
        ))}
      </div>

      <div className="card stack">
        <h2>{t('sources.allowlist')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t('sources.allowlistNote')}</p>
        <ul className="bullet-list small" style={{ margin: 0 }}>
          {ALLOWED_HOSTS.map((host) => (
            <li key={host}>
              <code>{host}</code> — {ALLOWED_HOST_PURPOSE[host]}
            </li>
          ))}
        </ul>
        <p className="tiny muted" style={{ margin: 0 }}>
          No credentials, accounts, payment, analytics or advertising requests exist in this app.
        </p>
      </div>

      <div className="card stack">
        <h2>{t('sources.method')}</h2>
        <ul className="list-plain small">
          {FACTOR_ORDER.map((factorId) => (
            <li key={factorId} className="row row--between">
              <span>{FACTOR_NAMES[factorId]}</span>
              <strong>{FACTOR_WEIGHTS[factorId]}</strong>
            </li>
          ))}
        </ul>
        <p className="small" style={{ margin: 0 }}>{t('rec.scoringBody')}</p>
      </div>

      <div className="card stack">
        <h2>{t('sources.inspiration')}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t('sources.inspirationNote')}</p>
        <div className="tag-list">
          {DATA_INSPIRATION.map((item) => (
            <span className="tag tag--amber" key={item}>{item}</span>
          ))}
        </div>
      </div>

      <p className="caveat" style={{ margin: 0 }}>{REGIONAL_ESTIMATE_CAVEAT}</p>
      <p className="small" style={{ margin: 0 }}>{DISCLAIMER}</p>

      <button
        type="button"
        className="btn btn--block"
        onClick={() => {
          void actions.retry();
        }}
        disabled={state.loading}
      >
        {t('common.refresh')}
      </button>
      <div className="row">
        <button
          type="button"
          className="link-button"
          onClick={() => actions.goTo(state.dataSourcesReturnScreen)}
        >
          {t('common.back')}
        </button>
        <button type="button" className="link-button" onClick={() => actions.reset()}>
          {t('common.startOver')}
        </button>
      </div>
      <Disclaimer showCaveat={false} />
    </section>
  );
}
