/* Copies the root static build into desktop/web/ so electron-builder can bundle it.
 * desktop/web/ is generated and gitignored, so a fresh clone can still rebuild
 * the Windows executables with a single `npm run dist` from this folder.
 */
const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '..', 'dist');
const target = path.join(__dirname, 'web');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  console.error('Missing dist/index.html. Run "npm run build" in the project root first.');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Bundled static build: ${source} -> ${target}`);
