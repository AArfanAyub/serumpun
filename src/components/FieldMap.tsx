import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { ATTRIBUTION } from '@/config/attribution';
import {
  GIBS_FALLBACK_DATE,
  GIBS_LAYERS,
  gibsDefaultDate,
  gibsTileTemplate,
  osmTileTemplate,
} from '@/config/endpoints';
import { useApp } from '@/state/AppContext';
import { GibsLayerControls } from './GibsLayer';

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;
type LeafletTileLayer = import('leaflet').TileLayer;

const PIN_HTML =
  '<div style="width:20px;height:20px;border-radius:50%;background:#B4462F;' +
  'border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>';

interface FieldMapProps {
  latitude: number;
  longitude: number;
  onMove?: (lat: number, lon: number) => void;
  interactive?: boolean;
  tall?: boolean;
  showSatelliteControl?: boolean;
}

function FallbackMap({
  latitude,
  longitude,
  onMove,
  interactive,
  loading,
}: {
  latitude: number;
  longitude: number;
  onMove?: (lat: number, lon: number) => void;
  interactive: boolean;
  loading: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const { t } = useApp();

  function coordinatesAt(clientX: number, clientY: number): void {
    const element = ref.current;
    if (!element || !onMove || !interactive) return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const latitudeDelta = (0.5 - (clientY - rect.top) / rect.height) * 0.3;
    const longitudeDelta = ((clientX - rect.left) / rect.width - 0.5) * 0.3;
    onMove(
      Math.round((latitude + latitudeDelta) * 1e5) / 1e5,
      Math.round((longitude + longitudeDelta) * 1e5) / 1e5
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!interactive) return;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    coordinatesAt(event.clientX, event.clientY);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragging) return;
    coordinatesAt(event.clientX, event.clientY);
  }

  return (
    <div
      ref={ref}
      className="map-fallback"
      style={{ position: 'absolute', inset: 0, cursor: interactive ? 'crosshair' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      role={interactive ? 'application' : 'img'}
      aria-label="Map with a draggable field pin"
    >
      <div className="map-fallback__grid" />
      <span className="map-pin" style={{ left: '50%', top: '50%' }}>
        <span
          style={{
            display: 'block',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--poor)',
            border: '3px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
      </span>
      <div
        className="tiny"
        style={{
          position: 'absolute',
          left: 8,
          bottom: 26,
          background: 'rgba(255,255,255,0.9)',
          padding: '2px 6px',
          borderRadius: 4,
        }}
      >
        {loading ? 'Loading map…' : `${latitude.toFixed(3)}, ${longitude.toFixed(3)} — ${t('find.pin')}`}
      </div>
    </div>
  );
}

/**
 * Map screen component. Leaflet is dynamically imported ONLY here (code-split), so the
 * welcome -> recommendation path never downloads it. If the import or tiles fail, a
 * solid-colour map with a draggable pin remains fully usable. OSM attribution is always
 * visible; the optional NASA GIBS true-colour overlay is off by default.
 */
export function FieldMap({
  latitude,
  longitude,
  onMove,
  interactive = false,
  tall = false,
  showSatelliteControl = true,
}: FieldMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const gibsRef = useRef<LeafletTileLayer | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const initial = useRef({ latitude, longitude, interactive });

  const [mode, setMode] = useState<'loading' | 'leaflet' | 'fallback'>('loading');
  const [gibsOn, setGibsOn] = useState(false);
  const [gibsLayer, setGibsLayer] = useState<string>(GIBS_LAYERS[0]);
  const [gibsDate, setGibsDate] = useState<string>(gibsDefaultDate());
  const [gibsNote, setGibsNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    async function initialise(): Promise<void> {
      try {
        const leaflet: LeafletModule = await import('leaflet');
        if (cancelled || !containerRef.current) return;
        const element = containerRef.current;
        element.style.background = 'var(--green-soft)';

        map = leaflet
          .map(element, {
            zoomControl: true,
            attributionControl: false,
            scrollWheelZoom: false,
          })
          .setView([initial.current.latitude, initial.current.longitude], 10);

        const base = leaflet.tileLayer(osmTileTemplate(), {
          maxZoom: 18,
          minZoom: 2,
          crossOrigin: true,
        });
        let tileErrors = 0;
        base.on('tileerror', () => {
          tileErrors += 1;
          if (tileErrors >= 3 && mapRef.current && mapRef.current.hasLayer(base)) {
            mapRef.current.removeLayer(base); // solid-colour background remains
          }
        });
        base.addTo(map);

        const marker = leaflet
          .marker([initial.current.latitude, initial.current.longitude], {
            draggable: initial.current.interactive,
            icon: leaflet.divIcon({
              className: '',
              html: PIN_HTML,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
          })
          .addTo(map);

        marker.on('dragend', () => {
          const point = marker.getLatLng();
          onMoveRef.current?.(point.lat, point.lng);
        });

        if (initial.current.interactive) {
          map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
            marker.setLatLng(event.latlng);
            onMoveRef.current?.(event.latlng.lat, event.latlng.lng);
          });
        }

        mapRef.current = map;
        markerRef.current = marker;
        setMode('leaflet');
      } catch {
        if (!cancelled) setMode('fallback');
      }
    }

    void initialise();
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      markerRef.current = null;
      gibsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'leaflet' || !mapRef.current || !markerRef.current) return;
    const marker = markerRef.current;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - latitude) > 1e-6 || Math.abs(current.lng - longitude) > 1e-6) {
      marker.setLatLng([latitude, longitude]);
      mapRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude, mode]);

  useEffect(() => {
    if (mode !== 'leaflet') return;
    const map = mapRef.current;
    if (!map) return;
    if (gibsRef.current) {
      map.removeLayer(gibsRef.current);
      gibsRef.current = null;
    }
    if (!gibsOn) {
      setGibsNote(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const leaflet: LeafletModule = await import('leaflet');
      if (cancelled || !mapRef.current) return;
      const overlay = leaflet.tileLayer(gibsTileTemplate(gibsLayer, gibsDate || GIBS_FALLBACK_DATE), {
        opacity: 0.65,
        maxZoom: 9,
        minZoom: 2,
        crossOrigin: true,
      });
      overlay.on('tileerror', () => {
        if (mapRef.current && gibsRef.current === overlay) {
          mapRef.current.removeLayer(overlay);
          gibsRef.current = null;
          setGibsNote('Satellite image unavailable for this date; layer hidden.');
        }
      });
      overlay.addTo(mapRef.current);
      gibsRef.current = overlay;
    })();
    return () => {
      cancelled = true;
    };
  }, [gibsOn, gibsDate, gibsLayer, mode]);

  return (
    <div className={`map-frame ${tall ? 'map-frame--tall' : ''}`}>
      <div ref={containerRef} className="map-canvas" />
      {mode !== 'leaflet' ? (
        <FallbackMap
          latitude={latitude}
          longitude={longitude}
          onMove={onMove}
          interactive={interactive}
          loading={mode === 'loading'}
        />
      ) : null}
      {showSatelliteControl && mode === 'leaflet' ? (
        <GibsLayerControls
          enabled={gibsOn}
          onToggle={setGibsOn}
          date={gibsDate}
          onDateChange={setGibsDate}
          layer={gibsLayer}
          onLayerChange={setGibsLayer}
          note={gibsNote}
        />
      ) : null}
      <div className="map-attribution">{ATTRIBUTION.OSM} · {ATTRIBUTION.NASA_GIBS}</div>
    </div>
  );
}
