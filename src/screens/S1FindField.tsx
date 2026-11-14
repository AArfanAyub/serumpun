import { useState, type FormEvent, type JSX } from 'react';
import { searchPlaces, type PlaceHit } from '@/api/geocode';
import { DataSourcesLink } from '@/components/DataSourcesLink';
import { FieldMap } from '@/components/FieldMap';
import { sampleLocation } from '@/data/sample';
import { formatCoordinate } from '@/normalize/units';
import { useApp } from '@/state/AppContext';

/** S1: search / GPS / draggable map pin / manual coordinates / sample fallback. */
export function S1FindField(): JSX.Element {
  const { actions, state, t } = useApp();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [latText, setLatText] = useState('-7.55');
  const [lonText, setLonText] = useState('110.42');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pin, setPin] = useState(() => {
    const sample = sampleLocation();
    return { lat: state.location?.latitude ?? sample.latitude, lon: state.location?.longitude ?? sample.longitude };
  });

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    const result = await searchPlaces(query);
    setSearching(false);
    if (result.ok && result.data && result.data.length > 0) {
      setHits(result.data);
    } else {
      setHits([]);
      setSearchError(t('find.noResults'));
    }
  }

  function handleGps(): void {
    setGpsError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('This browser cannot share a location. Please type coordinates or drop a pin.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void actions.startLocation({
          kind: 'gps',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setGpsError('Location permission was not given. You can type coordinates or drop a pin.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }

  function handleManual(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const latitude = Number(latText);
    const longitude = Number(lonText);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setSearchError('Please enter a latitude between -90 and 90 and a longitude between -180 and 180.');
      return;
    }
    void actions.startLocation({ kind: 'manual', latitude, longitude });
  }

  return (
    <section className="screen" aria-labelledby="find-title">
      <div>
        <p className="eyebrow">S1</p>
        <h1 id="find-title">{t('find.title')}</h1>
        <p className="lead">{t('find.lead')}</p>
      </div>

      <form className="card stack" onSubmit={(event) => void handleSearch(event)}>
        <label className="field-label" htmlFor="place-query">
          {t('find.searchLabel')}
        </label>
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
          <input
            id="place-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('find.searchPlaceholder')}
            required
          />
          <button type="submit" className="btn" disabled={searching || state.loading}>
            {t('find.search')}
          </button>
        </div>
        {searching ? <div className="loading-line" /> : null}
        {searchError ? <p className="small" style={{ color: 'var(--poor)', margin: 0 }}>{searchError}</p> : null}
        {hits.length > 0 ? (
          <div className="stack">
            <strong className="small">{t('find.results')}</strong>
            <ul className="list-plain">
              {hits.map((hit) => (
                <li key={`${hit.name}-${hit.latitude}-${hit.longitude}`}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      void actions.startLocation({
                        kind: 'coords',
                        latitude: hit.latitude,
                        longitude: hit.longitude,
                        placeName: hit.name,
                        adminContext: hit.adminContext,
                        elevationM: hit.elevationM,
                        timezone: hit.timezone ?? undefined,
                        isCoarse: true,
                      });
                    }}
                  >
                    {hit.name}
                    {hit.adminContext ? ` — ${hit.adminContext}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      <div className="row">
        <button type="button" className="btn btn--secondary" onClick={handleGps} disabled={state.loading}>
          {t('find.gps')}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => setManualMode((value) => !value)}
        >
          {t('find.manual')}
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t('find.gpsHint')}
      </p>
      {gpsError ? <p className="small" style={{ color: 'var(--poor)', margin: 0 }}>{gpsError}</p> : null}

      {manualMode ? (
        <form className="card stack" onSubmit={handleManual}>
          <div className="grid-2">
            <label>
              <span className="field-label">{t('find.lat')}</span>
              <input type="number" step="any" min="-90" max="90" value={latText} onChange={(e) => setLatText(e.target.value)} />
            </label>
            <label>
              <span className="field-label">{t('find.lon')}</span>
              <input type="number" step="any" min="-180" max="180" value={lonText} onChange={(e) => setLonText(e.target.value)} />
            </label>
          </div>
          <button type="submit" className="btn" disabled={state.loading}>
            {t('find.useThis')}
          </button>
        </form>
      ) : null}

      <div className="card stack">
        <strong>{t('find.pin')}</strong>
        <FieldMap latitude={pin.lat} longitude={pin.lon} interactive onMove={(lat, lon) => setPin({ lat, lon })} />
        <p className="small muted" style={{ margin: 0 }}>
          {t('find.coords')}: {formatCoordinate(pin.lat, pin.lon)}
        </p>
        <button
          type="button"
          className="btn btn--block"
          onClick={() => {
            void actions.startLocation({ kind: 'pin', latitude: pin.lat, longitude: pin.lon });
          }}
          disabled={state.loading}
        >
          {t('find.useThis')}
        </button>
      </div>

      {state.loading ? <div className="loading-line" aria-label={state.loadingLabel} /> : null}
      {state.notice ? <p className="small" role="status">{state.notice}</p> : null}

      <div className="row">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            void actions.startLocation({ kind: 'sample' });
          }}
          disabled={state.loading}
        >
          {t('find.sample')}
        </button>
        <button type="button" className="link-button" onClick={() => actions.goTo('S0_WELCOME')}>
          {t('common.back')}
        </button>
        <DataSourcesLink />
      </div>
    </section>
  );
}
