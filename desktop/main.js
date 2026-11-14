/* Serumpun desktop shell — completely decoupled from the root package.json.
 *
 * The web build uses <script type="module">, which Chromium refuses to load from a
 * file:// origin (CORS: origin "null"). So the shell serves the static build from a tiny
 * loopback-only HTTP server on an ephemeral port and loads http://127.0.0.1:<port>/.
 * Nothing is exposed to the network: it binds 127.0.0.1 only, and there is no backend,
 * no account, no key, no analytics. External data still comes from the allowlisted
 * keyless endpoints in src/config/endpoints.ts (all send Access-Control-Allow-Origin: *).
 *
 * Security: no Node integration in the renderer, context isolation on, sandbox on,
 * preload intentionally empty, no remote content loaded into the window.
 */
const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** In the packaged app the static build lives in ./web; in dev it lives in ../dist. */
function webRoot() {
  const bundled = path.join(__dirname, 'web');
  if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled;
  return path.join(__dirname, '..', 'dist');
}

const ROOT = webRoot();
let server = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const instance = http.createServer((request, response) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      } catch {
        response.writeHead(400).end('Bad request');
        return;
      }
      if (pathname === '/' || pathname === '') pathname = '/index.html';

      // Resolve inside ROOT only — no path traversal.
      const candidate = path.resolve(ROOT, '.' + pathname);
      if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(candidate, (error, data) => {
        if (error) {
          // SPA fallback: any unknown path serves the app shell.
          fs.readFile(path.join(ROOT, 'index.html'), (fallbackError, html) => {
            if (fallbackError) {
              response.writeHead(404).end('Not found');
              return;
            }
            response.writeHead(200, { 'Content-Type': MIME['.html'] }).end(html);
          });
          return;
        }
        response.writeHead(200, {
          'Content-Type': MIME[path.extname(candidate).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        response.end(data);
      });
    });

    instance.once('error', reject);
    // Port 0 = OS-assigned ephemeral port, 127.0.0.1 = loopback only.
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
}

function createWindow(baseUrl) {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 320,
    minHeight: 480,
    backgroundColor: '#FAF7F0',
    title: 'Serumpun',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);

  // Keep external links in the user's browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(baseUrl)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.loadURL(baseUrl + 'index.html');
  return win;
}

app.whenReady().then(async () => {
  try {
    server = await startServer();
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}/`;
    createWindow(baseUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(baseUrl);
    });
  } catch (error) {
    console.error('Serumpun could not start its local static server:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (server && server.listening) server.close();
});
