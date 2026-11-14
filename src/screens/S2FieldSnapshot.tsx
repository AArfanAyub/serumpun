import type { JSX } from 'react';
import { ClimateChart, ForecastChart, MonthChips } from '@/components/Charts';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { Disclaimer } from '@/components/Disclaimer';
import { FieldMap } from '@/components/FieldMap';
import { KpiStrip } from '@/components/KpiStrip';
import { REGIONAL_ESTIMATE_CAVEAT } from '@/config/attribution';
import { monthName } from '@/domain/membership';
import { formatCoordinate } from '@/normalize/units';
import { useApp } from '@/state/AppContext';

/** S2: map + legend + KPI strip + climate/forecast context (Felt + komoot patterns). */
export function S2FieldSnapshot(): JSX.Element {
  const { state, actions, t } = useApp();
  const site = state.site;

  if (!site) {
    return (
      <section className="screen">
        <h1>{t('snapshot.title')}</h1>
        <p>{t('common.notAvailable')}</p>
        <button type="button" className="btn" onClick={() => actions.goTo('S1_FIND_FIELD')}>
          {t('find.title')}
        </button>
      </section>
    );
  }

  const place = site.location.adminContext ?? site.location.placeName ?? t('find.unnamed');
  const baseMonth = state.baseTargetMonth ?? site.targetMonth;

  return (
    <section className="screen" aria-labelledby="snapshot-title">
      <div>
        <p className="eyebrow">S2</p>
        <h1 id="snapshot-title">{t('snapshot.title')}</h1>
        <p className="lead">{t('snapshot.lead')}</p>
        <p className="small muted" style={{ margin: 0 }}>
          <strong>{place}</strong> · {formatCoordinate(site.location.latitude, site.location.longitude)}
          {site.location.elevationM !== null ? ` · ${Math.round(site.location.elevationM)} m` : ''}
          {' · '}
          {monthName(site.targetMonth)}
        </p>
      </div>

      <div className="stack">
        <FieldMap
          latitude={site.location.latitude}
          longitude={site.location.longitude}
          tall
          showSatelliteControl
        />
        <p className="small muted" style={{ margin: 0 }}>
          {t('snapshot.mapLegend')}
        </p>
      </div>

      <KpiStrip site={site} />

      <div className="grid-2">
        <ClimateChart
          monthly={site.climate.monthly}
          targetMonth={site.targetMonth}
          provenance={site.climate.provenance}
        />
        <ForecastChart forecast={site.current.forecast} provenance={site.current.provenance} />
      </div>

      <div className="card">
        <MonthChips
          value={site.targetMonth}
          baseMonth={baseMonth}
          onSelect={(month) => actions.setMonthOverride(month)}
          label={t('snapshot.monthOverride')}
        />
      </div>

      <p className="caveat" style={{ margin: 0 }}>
        {REGIONAL_ESTIMATE_CAVEAT} {t('snapshot.climatologyNote')} {t('snapshot.forecastNote')}
      </p>

      <button type="button" className="btn btn--block" onClick={() => actions.goTo('S3_PROFILE')}>
        {t('snapshot.describe')}
      </button>
      <div className="row">
        <button type="button" className="link-button" onClick={() => actions.goTo('S1_FIND_FIELD')}>
          {t('common.change')}
        </button>
        <DataSourcesLink />
      </div>
      <Disclaimer />
    </section>
  );
}
