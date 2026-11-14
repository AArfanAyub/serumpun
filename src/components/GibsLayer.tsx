import type { JSX } from 'react';
import { GIBS_FALLBACK_DATE, GIBS_LAYERS } from '@/config/endpoints';
import { useApp } from '@/state/AppContext';

export interface GibsLayerControlsProps {
  enabled: boolean;
  onToggle(enabled: boolean): void;
  date: string;
  onDateChange(date: string): void;
  layer: string;
  onLayerChange(layer: string): void;
  note?: string | null;
}

/**
 * Optional NASA GIBS true-colour overlay controls. Only the two verified true-colour
 * layers are offered; no vegetation-index layer is shipped. Off by default.
 */
export function GibsLayerControls({
  enabled,
  onToggle,
  date,
  onDateChange,
  layer,
  onLayerChange,
  note,
}: GibsLayerControlsProps): JSX.Element {
  const { t } = useApp();
  return (
    <div className="map-controls stack" style={{ gap: 6 }}>
      <label className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>{t('snapshot.satellite')}</span>
      </label>
      {enabled ? (
        <div className="stack" style={{ gap: 4 }}>
          <label className="tiny">
            {t('snapshot.satelliteDate')}
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => onDateChange(event.target.value || GIBS_FALLBACK_DATE)}
              style={{ minHeight: 40, fontSize: 13 }}
            />
          </label>
          <select
            value={layer}
            onChange={(event) => onLayerChange(event.target.value)}
            aria-label="NASA GIBS imagery layer"
            style={{ minHeight: 40, fontSize: 13 }}
          >
            {GIBS_LAYERS.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {note ? <span className="tiny muted">{note}</span> : null}
    </div>
  );
}
