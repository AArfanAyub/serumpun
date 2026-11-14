import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALLOWED_HOSTS } from '@/config/endpoints';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const ALL_FILES = walk(SRC);
const CODE_FILES = ALL_FILES.filter((file) => /\.(ts|tsx|js|json)$/.test(file));

function read(file: string): string {
  return readFileSync(file, 'utf8');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('pure, deterministic, network-free domain engine', () => {
  const DOMAIN = join(SRC, 'domain');
  const domainFiles = walk(DOMAIN).filter((file) => file.endsWith('.ts'));

  it('has a real domain folder', () => {
    expect(domainFiles.length).toBeGreaterThan(5);
  });

  it('contains no fetch, clock, randomness or browser globals', () => {
    // `window` is legitimately used as a LOCAL variable name for a PlantingWindow
    // (e.g. window.startMonth), and i18n keys are strings like 'window.note.now'.
    // Only actual browser-global accesses are forbidden here.
    const forbidden: Array<[string, RegExp]> = [
      ['fetch(', /\bfetch\s*\(/],
      ['Date.now()', /\bDate\.now\s*\(/],
      ['Math.random()', /\bMath\.random\s*\(/],
      ['new Date', /\bnew\s+Date\s*\(/],
      ['localStorage', /\blocalStorage\b/],
      ['sessionStorage', /\bsessionStorage\b/],
      ['globalThis', /\bglobalThis\b/],
      ['document.', /\bdocument\./],
      ['navigator.', /\bnavigator\./],
      ['window global', /\bwindow\.(document|location|localStorage|sessionStorage|navigator|fetch|open|setTimeout|addEventListener|scrollTo)\b/],
      ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ];
    for (const file of domainFiles) {
      const code = stripComments(read(file));
      for (const [label, pattern] of forbidden) {
        expect(
          pattern.test(code),
          `${relative(ROOT, file)} must not use ${label} (domain must be pure)`
        ).toBe(false);
      }
    }
  });
});

describe('network allowlist is the single source of truth', () => {
  it('declares exactly eight hosts', () => {
    expect(ALLOWED_HOSTS).toHaveLength(8);
  });

  it('calls assertAllowed(url) before fetch() in the only network module', () => {
    const http = read(join(SRC, 'api', 'http.ts'));
    const guard = http.indexOf('assertAllowed(url)');
    const fetchCall = http.indexOf('fetch(url');
    expect(guard).toBeGreaterThan(-1);
    expect(fetchCall).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fetchCall);
    expect(http).toContain("import { assertAllowed, hostOf } from '@/config/endpoints'");
  });

  it('uses fetch() only inside src/api/http.ts (plus the service worker)', () => {
    const offenders = CODE_FILES.filter((file) => {
      const name = relative(ROOT, file).replace(/\\/g, '/');
      if (name.endsWith('src/api/http.ts')) return false;
      return /\bfetch\s*\(/.test(stripComments(read(file)));
    });
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it('contains no forbidden Overpass / Earthdata-login / key / analytics / ad hosts', () => {
    const forbidden = [
      'overpass-api.de',
      'overpass.kumi.systems',
      'overpass.openstreetmap.ru',
      'urs.earthdata.nasa.gov',
      'e4ftl01.cr.usgs.gov',
      'appeears.earthdatacloud.nasa.gov',
      'NDVI',
      'EVI',
      'google-analytics.com',
      'doubleclick.net',
      'googletagmanager.com',
    ];
    for (const file of CODE_FILES) {
      const text = read(file);
      for (const needle of forbidden) {
        expect(text.includes(needle), `${relative(ROOT, file)} must not mention ${needle}`).toBe(false);
      }
    }
  });

  it('contains no API keys, bearer tokens, secrets or credential env vars in code', () => {
    const patterns: RegExp[] = [
      /\bapi[_-]?key\b\s*[:=]/i,
      /\baccess[_-]?token\b\s*[:=]/i,
      /\bclient[_-]?secret\b\s*[:=]/i,
      /Bearer\s+[A-Za-z0-9._-]{8,}/,
      /process\.env\.[A-Z_]+/,
      /import\.meta\.env\.VITE_[A-Z_]+/,
    ];
    for (const file of CODE_FILES) {
      const text = read(file);
      for (const pattern of patterns) {
        expect(pattern.test(text), `${relative(ROOT, file)} must not contain a secret`).toBe(false);
      }
    }
    // Vite's own boolean built-ins (PROD/DEV/MODE/BASE_URL/SSR) are safe and expected.
    const main = read(join(SRC, 'main.tsx'));
    expect(main).toMatch(/import\.meta\.env\.(PROD|DEV|MODE|BASE_URL|SSR)/);
  });

  it('has no TODO / FIXME / stub / placeholder markers in code', () => {
    const pattern = /\b(TODO|FIXME|XXX|HACK|implement later|not implemented)\b/i;
    const offenders = CODE_FILES.filter((file) => pattern.test(read(file)));
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });
});

describe('root scripts never reference Electron', () => {
  it('keeps the Electron wrapper isolated under desktop/', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const scripts = Object.values(pkg.scripts).join(' ');
    expect(scripts.toLowerCase()).not.toContain('electron');
    expect(Object.keys(pkg.dependencies).some((name) => name.includes('electron'))).toBe(false);
    expect(Object.keys(pkg.devDependencies).some((name) => name.includes('electron'))).toBe(false);
    expect(read(join(ROOT, 'desktop', 'package.json'))).toContain('electron');
  });
});

describe('attribution and fixed disclaimers are present', () => {
  it('publishes the disclaimer, regional caveat, climatology and no-match notes', () => {
    const attribution = read(join(SRC, 'config', 'attribution.ts'));
    for (const token of [
      'DISCLAIMER', 'REGIONAL_ESTIMATE_CAVEAT', 'CLIMATOLOGY_LABEL',
      'FORECAST_LABEL', 'TENTATIVE_NOTICE', 'NO_MATCH_NOTE', 'OFFLINE_SAMPLE_LABEL',
      'ATTRIBUTION', 'LICENCE', 'GLOSSARY', 'BANNER_LABEL',
    ]) {
      expect(attribution).toContain(token);
    }
    expect(attribution.toLowerCase()).toContain('decision support');
  });
});
