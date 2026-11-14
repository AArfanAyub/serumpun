import { useState, type JSX } from 'react';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Disclaimer } from '@/components/Disclaimer';
import { GLOSSARY } from '@/config/attribution';
import { monthShort } from '@/domain/membership';
import { useApp } from '@/state/AppContext';
import type { RotationStrategy } from '@/types/domain';

function DetailList({ title, items }: { title: string; items: readonly string[] }): JSX.Element {
  return (
    <div>
      <strong className="small">{title}</strong>
      <ul className="bullet-list small" style={{ marginTop: 4 }}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** S6b: >=3 comparable strategies incl. the existing rotation + glossary. */
export function S6StrategyCompare(): JSX.Element {
  const { state, actions, t } = useApp();
  const recommendation =
    state.recommendations.find((item) => item.cropId === state.selectedCropId) ??
    state.recommendations[0];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!recommendation) {
    return (
      <section className="screen">
        <h1>{t('strategy.title')}</h1>
        <p>{t('common.notAvailable')}</p>
        <button type="button" className="btn" onClick={() => actions.goTo('S4_RECOMMENDATIONS')}>
          {t('why.backToList')}
        </button>
      </section>
    );
  }

  const strategies: RotationStrategy[] = recommendation.strategies;
  const expanded = strategies.find((item) => item.strategyId === expandedId) ?? null;

  return (
    <section className="screen" aria-labelledby="strategy-title">
      <div>
        <p className="eyebrow">S6b</p>
        <h1 id="strategy-title">{t('strategy.title')}</h1>
        <p className="lead">{t('strategy.lead')}</p>
      </div>

      <div className="card table-wrap">
        <p className="tiny muted" style={{ margin: '0 0 8px' }}>{t('strategy.scrollHint')}</p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>{t('strategy.soilHealth')}</th>
              <th>{t('strategy.waterDemand')}</th>
              <th>{t('strategy.nitrogen')}</th>
              <th>{t('strategy.bareWeeks')}</th>
              <th>{t('strategy.ruleViolations')}</th>
              <th>{t('strategy.avgFit')}</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((strategy) => (
              <tr key={strategy.strategyId}>
                <td>
                  <strong>{strategy.label}</strong>
                  {strategy.isExisting ? (
                    <div className="tiny muted">(baseline, inferred)</div>
                  ) : null}
                </td>
                <td>{strategy.comparison.soilHealthScore}</td>
                <td>{strategy.comparison.waterDemand}</td>
                <td>{strategy.comparison.nitrogenBalance}</td>
                <td>{strategy.comparison.bareFieldWeeks}</td>
                <td>{strategy.comparison.ruleViolations}</td>
                <td>{strategy.comparison.avgFitScore}</td>
                <td>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      actions.selectStrategy(strategy.strategyId);
                      setExpandedId((current) => (current === strategy.strategyId ? null : strategy.strategyId));
                    }}
                  >
                    {t('strategy.viewPlan')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {strategies.map((strategy) => (
        <article className="card stack" key={`detail-${strategy.strategyId}`}>
          <div className="row row--between">
            <h2 style={{ margin: 0 }}>{strategy.label}</h2>
            {strategy.isExisting ? <span className="badge badge--estimated">◇ {t('strategy.existing')}</span> : null}
          </div>
          <p style={{ margin: 0 }}>{strategy.summary}</p>
          <div className="grid-2">
            <DetailList title={t('strategy.evidence')} items={strategy.evidence} />
            <DetailList title={t('strategy.benefits')} items={strategy.benefits} />
            <DetailList title={t('strategy.gaps')} items={strategy.informationGaps} />
            <DetailList title={t('strategy.risks')} items={strategy.risks} />
          </div>
          <DetailList title={t('strategy.vulnerable')} items={strategy.vulnerableSeasons} />
        </article>
      ))}

      {expanded ? (
        <div className="card stack">
          <h2>{expanded.label} — {t('rotation.title')}</h2>
          <div className="timeline">
            {expanded.plan.seasons.map((season, index) => (
              <div key={season.seasonIndex}>
                {index > 0 ? (
                  <div className="timeline__arrow">
                    <strong>{t('rotation.transitionLabel')}:</strong> {expanded.plan.transitionReasons[index]}
                  </div>
                ) : null}
                <div className="card stack season-card">
                  <strong>
                    {season.periodLabel} · {season.cropName} ({season.family}, {season.nitrogenRole}, {season.rootDepth})
                  </strong>
                  <span className="small muted">
                    {monthShort(season.targetMonth)} · {t('rotation.fit')} {season.fitScore}/100 · {season.confidence}
                  </span>
                  {season.tentativeNotice ? <p className="caveat" style={{ margin: 0 }}>{season.tentativeNotice}</p> : null}
                </div>
              </div>
            ))}
          </div>
          {expanded.plan.noConfidentMatch ? (
            <p className="small" style={{ color: 'var(--poor)', margin: 0 }}>
              {expanded.plan.noMatchNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="card stack">
        <h2>{t('strategy.glossary')}</h2>
        <dl className="definition-list">
          {GLOSSARY.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
        <hr className="divider" />
        <h3>{t('strategy.satellite')}</h3>
        <p className="small" style={{ margin: 0 }}>{t('strategy.satelliteText')}</p>
      </div>

      <Disclaimer />
      <div className="row">
        <button type="button" className="link-button" onClick={() => actions.goTo('S6_ROTATION')}>
          {t('rotation.title')}
        </button>
        <DataSourcesLink />
      </div>
    </section>
  );
}
