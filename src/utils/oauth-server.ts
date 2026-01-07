/**
 * OAuth Server
 *
 * Local HTTP server to handle OAuth callback from GitHub
 */

import * as http from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger';

export interface OAuthCallbackResult {
  code: string;
  state: string;
}

export interface OAuthServerOptions {
  port: number;
  expectedState: string;
  timeoutMs: number;
}

/**
 * HTML template for success page
 */
const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 60px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .checkmark {
      font-size: 80px;
      margin-bottom: 20px;
    }
    h1 {
      color: #10b981;
      margin: 0 0 10px;
    }
    p {
      color: #6b7280;
      margin: 10px 0 0;
    }
    .close-note {
      margin-top: 30px;
      color: #9ca3af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✅</div>
    <h1>Authentication Successful!</h1>
    <p>You have been authenticated with GitHub.</p>
    <p class="close-note">You can close this window and return to your terminal.</p>
  </div>
  <script>
    // Auto-close after 3 seconds
    setTimeout(() => window.close(), 3000);
  </script>
</body>
</html>
`;

/**
 * HTML template for error page
 */
const ERROR_HTML = (message: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 60px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .error-icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
    h1 {
      color: #ef4444;
      margin: 0 0 10px;
    }
    p {
      color: #6b7280;
      margin: 10px 0 0;
    }
    .error-detail {
      background: #fef2f2;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
      color: #991b1b;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">❌</div>
    <h1>Authentication Failed</h1>
    <p>There was an error during authentication.</p>
    <div class="error-detail">${message}</div>
    <p>Please close this window and try again.</p>
  </div>
</body>
</html>
`;

/**
 * Create and start OAuth callback server
 */
export function startOAuthServer(options: OAuthServerOptions): Promise<OAuthCallbackResult> {
  const { port, expectedState, timeoutMs } = options;

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);

      // Only handle the callback path
      if (url.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      // Handle OAuth error
      if (error) {
        logger.debug(`OAuth error: ${error} - ${errorDescription}`);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML(errorDescription || error));
        cleanup();
        reject(new Error(`GitHub OAuth error: ${errorDescription || error}`));
        return;
      }

      // Validate state to prevent CSRF attacks
      if (state !== expectedState) {
        logger.debug('State mismatch in OAuth callback');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML('Invalid state parameter. This may be a CSRF attack.'));
        cleanup();
        reject(new Error('Invalid state parameter in OAuth callback'));
        return;
      }

      // Validate code
      if (!code) {
        logger.debug('No authorization code in OAuth callback');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(ERROR_HTML('No authorization code received.'));
        cleanup();
        reject(new Error('No authorization code received'));
        return;
      }

      // Success!
      logger.debug('OAuth callback received successfully');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(SUCCESS_HTML);

      cleanup();
      resolve({ code, state });
    });

    // Error handler for server
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        cleanup();
        reject(new Error(`Port ${port} is already in use. Please close any other applications using this port.`));
      } else {
        cleanup();
        reject(err);
      }
    });

    // Cleanup function
    function cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try {
        server.close();
      } catch {
        // Ignore close errors
      }
    }

    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth callback timeout. Please try again.'));
    }, timeoutMs);

    // Start listening
    server.listen(port, 'localhost', () => {
      logger.debug(`OAuth callback server listening on http://localhost:${port}/callback`);
    });
  });
}

/**
 * Get available port for OAuth server
 * Tries 3000 first, then falls back to other ports
 */
export async function getAvailablePort(preferredPorts: number[] = [3000, 3001, 8080, 8888]): Promise<number> {
  for (const port of preferredPorts) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available ports for OAuth callback server');
}

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, 'localhost');
  });
}
