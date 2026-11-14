/* Publish the built static app to the gh-pages branch of this repository.
 *
 * GitHub Pages is configured with build_type=legacy, source=gh-pages:/. A plain
 * branch push needs only the classic `repo` scope, so this works even when the
 * GitHub OAuth token is not allowed to create .github/workflows/*.yml files.
 *
 * Usage (after `gh auth login` and cloning this repo):
 *   npm run deploy:pages
 */
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

console.log('Building the static web app…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error('dist/index.html is missing after the build.');
}

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
if (!remote) throw new Error('No "origin" remote is configured.');

const tmp = mkdtempSync(join(tmpdir(), 'serumpun-pages-'));
const stage = join(tmp, 'site');

try {
  cpSync(DIST, stage, { recursive: true });
  // Disable Jekyll processing so hashed asset files are served exactly as built.
  writeFileSync(join(stage, '.nojekyll'), '');
  if (!existsSync(join(stage, 'index.html'))) {
    throw new Error('The staged site has no index.html.');
  }

  const git = (args) => execFileSync('git', args, { cwd: stage, stdio: 'inherit' });
  git(['init', '-q', '-b', 'gh-pages']);
  git(['config', 'user.name', 'Serumpun deploy']);
  git(['config', 'user.email', 'deploy@localhost']);
  git(['add', '-A']);
  git(['commit', '-q', '-m', `Deploy Serumpun ${new Date().toISOString()}`]);
  git(['push', '--force', remote, 'gh-pages:refs/heads/gh-pages']);
  console.log('Deployed dist/ to the gh-pages branch.');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
