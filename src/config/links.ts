/**
 * Outbound links only. These are ordinary hyperlinks opened by the browser (or
 * handed to the OS browser by the Electron shell). They are NOT data requests:
 * `src/config/endpoints.ts` remains the single allowlist for every fetch call.
 */
export const REPOSITORY_URL = 'https://github.com/AArfanAyub/serumpun';

/** Human-friendly "latest release" page; GitHub redirects to the current assets. */
export const RELEASES_URL = `${REPOSITORY_URL}/releases/latest`;
