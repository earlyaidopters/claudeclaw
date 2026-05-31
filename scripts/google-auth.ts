#!/usr/bin/env npx tsx
/**
 * One-time Google OAuth 2.0 authorization flow.
 * Opens browser for consent, saves encrypted tokens to store/google-tokens.json.
 *
 * Usage: npx tsx scripts/google-auth.ts
 */

import http from 'http';
import { execSync } from 'child_process';
import { OAuth2Client } from 'google-auth-library';
import { readEnvFile } from '../src/env.js';
import { encryptField } from '../src/db.js';
import { saveTokens } from '../src/google-api.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const REDIRECT_PORT = 9876;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

async function main() {
  const env = readEnvFile(['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const oauth2Client = new OAuth2Client(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    REDIRECT_URI,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force refresh token generation
  });

  console.log('\nOpening browser for Google authorization...');
  console.log(`\nIf the browser doesn't open, visit:\n${authUrl}\n`);

  // Open browser
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${authUrl}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${authUrl}"`);
    }
  } catch {
    console.log('Could not open browser automatically. Please visit the URL above.');
  }

  // Start local HTTP server to catch the callback
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        console.error(`\nAuthorization failed: ${error}`);
        server.close();
        reject(new Error(error));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>No authorization code received</h1>');
        server.close();
        reject(new Error('No code'));
        return;
      }

      try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          console.warn('\nWarning: No refresh token received. You may need to revoke app access at https://myaccount.google.com/permissions and re-run this script.');
        }

        // Encrypt and save
        saveTokens({
          access_token: encryptField(tokens.access_token || ''),
          refresh_token: encryptField(tokens.refresh_token || ''),
          expiry_date: tokens.expiry_date || 0,
          token_type: tokens.token_type || 'Bearer',
          scope: tokens.scope || SCOPES.join(' '),
        });

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; background: #111; color: #eee;">
              <h1>Authorization successful!</h1>
              <p>Tokens saved. You can close this tab.</p>
            </body>
          </html>
        `);

        console.log('\nAuthorization successful! Tokens encrypted and saved to store/google-tokens.json');
        console.log('You can now use: node dist/google-cli.js calendar today');
        console.log('                 node dist/google-cli.js gmail unread 10');

        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Token exchange failed</h1><pre>${err}</pre>`);
        console.error('\nToken exchange failed:', err);
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Waiting for authorization callback on port ${REDIRECT_PORT}...`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error('\nTimeout: no authorization received within 5 minutes.');
      server.close();
      reject(new Error('Timeout'));
    }, 5 * 60 * 1000);
  });
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
