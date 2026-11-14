import type { JSX } from 'react';
import { REGIONAL_ESTIMATE_CAVEAT } from '@/config/attribution';
import { roundToInt, wetnessWord } from '@/domain/membership';
import { useApp } from '@/state/AppContext';
import type { Provenance } from '@/types/data';
import type { SiteConditions } from '@/types/domain';
import { SourceLabel } from './SourceLabel';

interface Kpi {
  label: string;
  value: string;
  provenance: Provenance;
  raw: string;
}

/** Compact temperature / rain / soil wetness / elevation strip (7shifts pattern). */
export function KpiStrip({ site }: { site: SiteConditions }): JSX.Element {
  const { t } = useApp();
  const wetness = wetnessWord(site.monthlyForTarget.gwetRoot);
  const elevation = site.location.elevationM;

  const items: Kpi[] = [
    {
      label: t('snapshot.kpiTemp'),
      value: `${roundToInt(site.current.temperatureC)} °C`,
      raw: `${site.current.temperatureC.toFixed(1)} °C`,
      provenance: site.current.provenance,
    },
    {
      label: t('snapshot.kpiRain'),
      value: `${roundToInt(site.monthlyForTarget.precipMm)} mm`,
      raw: `${roundToInt(site.monthlyForTarget.precipMm)} mm this month (long-term average)`,
      provenance: site.climate.provenance,
    },
    {
      label: t('snapshot.kpiWetness'),
      value: t(`label.${wetness}`),
      raw: `relative wetness ${site.monthlyForTarget.gwetRoot.toFixed(2)} (0–1, not volumetric moisture)`,
      provenance: site.climate.provenance,
    },
    {
      label: t('snapshot.kpiElevation'),
      value: elevation === null ? t('common.notAvailable') : `${roundToInt(elevation)} m`,
      raw: elevation === null ? 'elevation unavailable' : `${roundToInt(elevation)} metres`,
      provenance: site.current.provenance,
    },
  ];

  return (
    <div className="stack">
      <div className="kpi-strip">
        {items.map((item) => (
          <div className="kpi" key={item.label} title={item.raw}>
            <span className="kpi__label">{item.label}</span>
            <span className="kpi__value">{item.value}</span>
            <SourceLabel
              source={item.provenance.source}
              freshness={item.provenance.freshness}
              isEstimated={item.provenance.isEstimated}
              sourceId={item.provenance.sourceId}
            />
          </div>
        ))}
      </div>
      <p className="caveat" style={{ margin: 0 }}>
        {REGIONAL_ESTIMATE_CAVEAT} Tap or hover a value to see its raw number.
      </p>
    </div>
  );
}
