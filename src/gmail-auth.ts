#!/usr/bin/env node
/**
 * ClaudeClaw Gmail OAuth Bootstrapper
 *
 * Runs once locally. Walks Google's OAuth consent flow on port 3456,
 * exchanges the auth code for a refresh token, and prints the token plus
 * the exact `fly secrets set` command to wire it into the deployed bot.
 *
 * Why a separate flow from scripts/google-auth.ts?
 *   - That flow stores encrypted tokens in store/google-tokens.json for the
 *     local Mac/Linux service. Fine for the host machine, useless on Fly.
 *   - On Fly we want a long-lived refresh token in env (GMAIL_REFRESH_TOKEN)
 *     so the bot can mint access tokens on demand with no filesystem state.
 *
 * Scopes requested: send, readonly, compose, modify. Covers every operation
 * exposed by src/gmail.ts.
 *
 * Usage:
 *   npx tsx src/gmail-auth.ts
 *   (or after build) node dist/gmail-auth.js
 */

import http from 'http';
import { execSync } from 'child_process';
import { OAuth2Client } from 'google-auth-library';

import { readEnvFile } from './env.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
];

const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const FLY_APP_NAME = 'claudeclaw-impactworks';

function openBrowser(url: string): void {
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${url}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${url}"`);
    } else if (process.platform === 'win32') {
      execSync(`start "" "${url}"`);
    }
  } catch {
    /* user opens it manually */
  }
}

async function main(): Promise<void> {
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
    prompt: 'consent', // force a refresh token even on re-auth
  });

  console.log('\nGmail OAuth bootstrap');
  console.log('─────────────────────');
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log('Opening your browser. If it does not open, paste this URL:\n');
  console.log(authUrl);
  console.log();

  openBrowser(authUrl);

  await new Promise<void>((resolve, reject) => {
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
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body style="font-family: system-ui; padding: 40px; background: #111; color: #eee;">
              <h1>No refresh token returned</h1>
              <p>Google only issues a refresh token on first consent.</p>
              <p>Revoke this app at <a href="https://myaccount.google.com/permissions" style="color: #6cf;">myaccount.google.com/permissions</a> and run this script again.</p>
            </body></html>
          `);
          console.error('\nNo refresh token returned. Revoke at https://myaccount.google.com/permissions and re-run.');
          server.close();
          reject(new Error('No refresh token'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family: system-ui; padding: 40px; background: #111; color: #eee;">
            <h1>Done.</h1>
            <p>Refresh token printed in your terminal. You can close this tab.</p>
          </body></html>
        `);

        const refreshToken = tokens.refresh_token;

        console.log('\n────────────────────────────────────────────────────────────');
        console.log('Refresh token captured.\n');
        console.log('GMAIL_REFRESH_TOKEN:');
        console.log(refreshToken);
        console.log('\nSet it on Fly:');
        console.log(`  fly secrets set GMAIL_REFRESH_TOKEN=${refreshToken} -a ${FLY_APP_NAME}`);
        console.log('\nOr add to .env for local testing:');
        console.log(`  GMAIL_REFRESH_TOKEN=${refreshToken}`);
        console.log('────────────────────────────────────────────────────────────\n');

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

    setTimeout(() => {
      console.error('\nTimeout: no authorization received within 5 minutes.');
      server.close();
      reject(new Error('Timeout'));
    }, 5 * 60 * 1000);
  });
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
