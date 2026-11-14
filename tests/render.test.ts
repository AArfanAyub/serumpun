import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { App } from '@/App';
import { AppProvider } from '@/state/AppContext';

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Render the real component tree with `react-dom/server`. `useEffect` does not run
 * during static rendering, so lazy Leaflet loading and the service worker are skipped —
 * exactly the "solid-colour + pin fallback" first paint a farmer sees before hydration.
 */
function renderApp(): string {
  return renderToStaticMarkup(createElement(AppProvider, null, createElement(App)));
}

describe('application shell renders end-to-end (no runtime crash)', () => {
  it('mounts the welcome screen with the app shell, banner, primary action and disclaimer', () => {
    const html = renderApp();
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain('app-shell');
    expect(html).toContain('app-header');
    expect(html).toContain('skip-link');
    expect(html).toContain('Serumpun');
    expect(html).toContain('Free · No account · No ads · Works offline');
    expect(html).toContain('Find my field');
    expect(html).toContain('Please read');
    expect(html).toContain('decision support');
    expect(html).toContain('Data &amp; sources');
  });

  it('no longer renders the offline status banner on first paint', () => {
    const html = renderApp();
    expect(html).not.toContain('status-banner');
    expect(html).not.toContain('nothing is live right now');
    expect(html).not.toContain('Offline sample data');
    expect(html).toContain('ID'); // language switch to Bahasa Indonesia
    expect(html).toContain('app-footer');
  });

  it('offers the Windows desktop download from the public GitHub Release', () => {
    const html = renderApp();
    expect(html).toContain('https://github.com/AArfanAyub/serumpun/releases/latest');
    expect(html).toContain('Windows desktop app');
    expect(html).toContain('rel="noreferrer noopener"');
  });

  it('renders accessible primary controls (>=48px tap targets via CSS, real buttons)', () => {
    const html = renderApp();
    expect(html).toContain('class="btn btn--block"');
    expect(html).toContain('type="button"');
    expect(html).toContain('lang-toggle');
  });

  it('renders without any DOM/browser globals present', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => renderApp()).not.toThrow();
  });
});
