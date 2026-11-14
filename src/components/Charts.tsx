import type { JSX } from 'react';
import { CLIMATOLOGY_LABEL, FORECAST_LABEL } from '@/config/attribution';
import { roundToInt } from '@/domain/membership';
import { MONTH_SHORT } from '@/domain/membership';
import type { Provenance } from '@/types/data';
import type { ForecastDay, MonthlyClimate } from '@/types/domain';
import type { Month } from '@/types/ui';
import { SourceLabel } from './SourceLabel';

const VIEW_W = 380;
const BAR_SLOT = VIEW_W / 12;

interface ClimateChartProps {
  monthly: readonly MonthlyClimate[];
  targetMonth: Month;
  provenance: Provenance;
}

/** Hand-built SVG 12-month temperature + rainfall climatology, current month highlighted. */
export function ClimateChart({ monthly, targetMonth, provenance }: ClimateChartProps): JSX.Element {
  const maxRain = Math.max(1, ...monthly.map((item) => item.precipMm));
  const rainBase = 96;
  const rainMaxH = 74;
  const tempBase = 190;
  const tempMaxH = 68;

  return (
    <div className="card stack">
      <div>
        <strong>{CLIMATOLOGY_LABEL}</strong>
        <p className="small muted" style={{ margin: 0 }}>
          Upper bars: millimetres of rain per month. Lower bars: degrees Celsius average temperature.
        </p>
        <SourceLabel
          source={provenance.source}
          freshness={provenance.freshness}
          isEstimated={provenance.isEstimated}
        />
      </div>
      <div className="bar-chart">
        <svg
          viewBox={`0 0 ${VIEW_W} 205`}
          width="100%"
          role="img"
          aria-label="Twelve-month long-term average rainfall and temperature"
        >
          <title>Long-term monthly average climate</title>
          <desc>Bars show average rainfall in millimetres and temperature in degrees Celsius for each month.</desc>
          <line x1="0" y1={rainBase} x2={VIEW_W} y2={rainBase} stroke="var(--line)" />
          <line x1="0" y1={tempBase} x2={VIEW_W} y2={tempBase} stroke="var(--line)" />
          {monthly.map((item, index) => {
            const isCurrent = item.month === targetMonth;
            const rainH = (item.precipMm / maxRain) * rainMaxH;
            const tempH = Math.max(2, (Math.max(0, item.t2mC) / 40) * tempMaxH);
            const x = index * BAR_SLOT + 3;
            const width = BAR_SLOT - 6;
            return (
              <g key={item.month}>
                <rect
                  x={x}
                  y={rainBase - rainH}
                  width={width}
                  height={rainH}
                  rx="2"
                  fill={isCurrent ? 'var(--amber)' : 'var(--green-soft)'}
                  stroke={isCurrent ? 'var(--poor)' : 'none'}
                  strokeWidth={isCurrent ? 2 : 0}
                />
                <rect
                  x={x}
                  y={tempBase - tempH}
                  width={width}
                  height={tempH}
                  rx="2"
                  fill={isCurrent ? 'var(--amber)' : 'var(--green)'}
                  opacity={isCurrent ? 1 : 0.75}
                />
                <text
                  x={x + width / 2}
                  y={204}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isCurrent ? 'var(--poor)' : 'var(--muted)'}
                  fontWeight={isCurrent ? 700 : 400}
                >
                  {MONTH_SHORT[index] ?? ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details>
        <summary className="small">Read the numbers as a table</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Rain (mm)</th>
                <th>Temp (°C)</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((item) => (
                <tr key={item.month}>
                  <td>{MONTH_SHORT[item.month - 1]}</td>
                  <td>{roundToInt(item.precipMm)}</td>
                  <td>{roundToInt(item.t2mC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

interface ForecastChartProps {
  forecast: readonly ForecastDay[];
  provenance: Provenance;
}

/** Hand-built SVG 16-day forecast: rainfall bars + FAO ET0 dots. */
export function ForecastChart({ forecast, provenance }: ForecastChartProps): JSX.Element {
  const days = forecast.slice(0, 16);
  const maxRain = Math.max(1, ...days.map((day) => day.precipMm));
  const base = 88;
  const maxH = 66;
  const slot = VIEW_W / Math.max(1, days.length);

  return (
    <div className="card stack">
      <div>
        <strong>{FORECAST_LABEL}</strong>
        <p className="small muted" style={{ margin: 0 }}>
          Bars: forecast rain in millimetres per day. Dots: reference evapotranspiration (water lost to the air).
        </p>
        <SourceLabel
          source={provenance.source}
          freshness={provenance.freshness}
          isEstimated={provenance.isEstimated}
        />
      </div>
      {days.length === 0 ? (
        <p className="muted">Forecast not available right now. Long-term averages are still shown above.</p>
      ) : (
        <div className="bar-chart">
          <svg
            viewBox={`0 0 ${VIEW_W} 110`}
            width="100%"
            role="img"
            aria-label="Sixteen day rainfall forecast"
          >
            <title>16-day rainfall forecast</title>
            <desc>Bars show forecast daily rainfall in millimetres; dots show reference evapotranspiration.</desc>
            <line x1="0" y1={base} x2={VIEW_W} y2={base} stroke="var(--line)" />
            {days.map((day, index) => {
              const height = (day.precipMm / maxRain) * maxH;
              const x = index * slot + 2;
              const width = Math.max(2, slot - 4);
              const et0 = day.et0Mm ?? 0;
              const et0Y = base - Math.min(maxH, (et0 / 8) * maxH);
              return (
                <g key={day.date || index}>
                  <rect x={x} y={base - height} width={width} height={height} rx="1.5" fill="var(--green)" opacity="0.8" />
                  <circle cx={x + width / 2} cy={et0Y} r="2.4" fill="var(--amber)" />
                  <text x={x + width / 2} y="104" textAnchor="middle" fontSize="9" fill="var(--muted)">
                    {day.date ? day.date.slice(8) : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

interface MonthChipsProps {
  value: Month;
  baseMonth: Month;
  onSelect(month: Month | null): void;
  label: string;
}

/** Month override (P1, R-19). One tap explores an adjacent month. */
export function MonthChips({ value, baseMonth, onSelect, label }: MonthChipsProps): JSX.Element {
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        {label}
      </p>
      <div className="chip-row" role="group" aria-label={label}>
        {MONTH_SHORT.map((short, index) => {
          const month = (index + 1) as Month;
          const selected = month === value;
          return (
            <button
              key={short}
              type="button"
              className="month-chip"
              aria-pressed={selected}
              onClick={() => onSelect(month === baseMonth ? null : month)}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
