/**
 * GitHub Authentication Module
 *
 * Handles OAuth flow and token management for GitHub Copilot integration
 */

import * as crypto from 'crypto';
import chalk from 'chalk';
import ora from 'ora';
import { credentialStore } from './credential-store';
import { startOAuthServer, getAvailablePort } from '../utils/oauth-server';
import { logger } from '../utils/logger';

// GitHub OAuth App Configuration
// These should be set via environment variables or configured by the user
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv1.placeholder_id';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const OAUTH_SCOPES = 'copilot user:email';
const OAUTH_TIMEOUT_MS = 120000; // 2 minutes

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface OAuthResult {
  success: boolean;
  token?: string;
  user?: GitHubUser;
  error?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: GitHubUser;
  scopes?: string[];
  error?: string;
}

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
  try {
    // Dynamic import for ESM compatibility
    const open = (await import('open')).default;
    await open(url);
  } catch (error) {
    // Fallback for systems without 'open' module
    const { exec } = await import('child_process');
    const platform = process.platform;

    let command: string;
    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          reject(new Error(`Failed to open browser: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * Generate a cryptographically secure state token for CSRF protection
 */
function generateStateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code for token: ${response.statusText}`);
  }

  const data = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  if (!data.access_token) {
    throw new Error('No access token in response');
  }

  return data.access_token;
}

/**
 * Fetch GitHub user information using access token
 */
async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ClusterCode-CLI',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid or expired token');
    }
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  return response.json() as Promise<GitHubUser>;
}

/**
 * Validate a GitHub token by making a test API call
 */
export async function validateGitHubToken(token: string): Promise<TokenValidationResult> {
  try {
    const user = await fetchGitHubUser(token);

    // Check scopes by making a request to check token permissions
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClusterCode-CLI',
      },
    });

    const scopes = response.headers.get('x-oauth-scopes')?.split(', ') || [];

    return {
      valid: true,
      user,
      scopes,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Test connection to GitHub Copilot API
 */
export async function testCopilotConnection(token: string): Promise<{ success: boolean; message: string }> {
  try {
    // First, get a Copilot token
    const copilotToken = await getCopilotToken(token);

    // Test the Copilot API
    const response = await fetch('https://api.githubcopilot.com/models', {
      headers: {
        'Authorization': `Bearer ${copilotToken}`,
        'Accept': 'application/json',
        'User-Agent': 'ClusterCode-CLI',
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Successfully connected to GitHub Copilot API',
      };
    } else if (response.status === 401) {
      return {
        success: false,
        message: 'GitHub token does not have Copilot access. Make sure you have an active Copilot subscription.',
      };
    } else {
      return {
        success: false,
        message: `Copilot API error: ${response.statusText}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Get Copilot API token from GitHub token
 * This exchanges the GitHub OAuth token for a Copilot-specific token
 */
export async function getCopilotToken(githubToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    method: 'GET',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/json',
      'User-Agent': 'ClusterCode-CLI',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitHub token is invalid or expired');
    } else if (response.status === 403) {
      throw new Error('No access to Copilot. Make sure you have an active GitHub Copilot subscription.');
    }
    throw new Error(`Failed to get Copilot token: ${response.statusText}`);
  }

  const data = await response.json() as { token?: string; expires_at?: number };

  if (!data.token) {
    throw new Error('No Copilot token in response');
  }

  return data.token;
}

/**
 * Start the OAuth flow to authenticate with GitHub
 */
export async function startOAuthFlow(): Promise<OAuthResult> {
  const spinner = ora();

  try {
    // Check if client ID is configured
    if (GITHUB_CLIENT_ID === 'Iv1.placeholder_id') {
      console.log(chalk.yellow('\n⚠️  GitHub OAuth is not configured.'));
      console.log(chalk.gray('Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'));
      console.log(chalk.gray('Or use --github-token to set your token manually.\n'));
      return {
        success: false,
        error: 'GitHub OAuth not configured',
      };
    }

    // Get available port for callback server
    spinner.start('Preparing authentication server...');
    const port = await getAvailablePort();

    // Generate state token for CSRF protection
    const state = generateStateToken();

    // Build authorization URL
    const redirectUri = `http://localhost:${port}/callback`;
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', OAUTH_SCOPES);
    authUrl.searchParams.set('state', state);

    spinner.succeed('Authentication server ready');

    // Open browser
    console.log(chalk.cyan('\n🔐 Opening browser for GitHub authentication...'));
    console.log(chalk.gray(`   If browser doesn't open, visit: ${authUrl.toString()}\n`));

    await openBrowser(authUrl.toString());

    // Start OAuth callback server
    spinner.start('Waiting for authorization...');

    const callbackResult = await startOAuthServer({
      port,
      expectedState: state,
      timeoutMs: OAUTH_TIMEOUT_MS,
    });

    spinner.text = 'Exchanging authorization code...';

    // Exchange code for token
    const token = await exchangeCodeForToken(callbackResult.code);

    spinner.text = 'Fetching user information...';

    // Get user info
    const user = await fetchGitHubUser(token);

    spinner.succeed(`Authenticated as ${chalk.green('@' + user.login)}`);

    // Save token
    await credentialStore.saveGitHubToken(token, user.login);

    return {
      success: true,
      token,
      user,
    };
  } catch (error: any) {
    spinner.fail('Authentication failed');
    logger.debug(`OAuth error: ${error.message}`);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Set GitHub token manually
 */
export async function setManualToken(token: string): Promise<OAuthResult> {
  const spinner = ora('Validating token...').start();

  try {
    // Validate the token
    const validation = await validateGitHubToken(token);

    if (!validation.valid) {
      spinner.fail('Invalid token');
      return {
        success: false,
        error: validation.error || 'Token validation failed',
      };
    }

    // Check for required scopes
    const requiredScopes = ['copilot'];
    const missingScopes = requiredScopes.filter(scope => !validation.scopes?.includes(scope));

    if (missingScopes.length > 0) {
      spinner.warn('Token may be missing required scopes');
      console.log(chalk.yellow(`\n⚠️  Token is missing scopes: ${missingScopes.join(', ')}`));
      console.log(chalk.gray('Copilot features may not work correctly.\n'));
    }

    // Save the token
    await credentialStore.saveGitHubToken(token, validation.user?.login);

    spinner.succeed(`Token saved for ${chalk.green('@' + validation.user?.login)}`);

    return {
      success: true,
      token,
      user: validation.user,
    };
  } catch (error: any) {
    spinner.fail('Failed to set token');
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get current authentication status
 */
export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  user?: GitHubUser;
  provider?: string;
  tokenValid?: boolean;
}> {
  try {
    const token = await credentialStore.getGitHubToken();

    if (!token) {
      return { authenticated: false };
    }

    const validation = await validateGitHubToken(token);

    if (!validation.valid) {
      return {
        authenticated: true,
        tokenValid: false,
      };
    }

    return {
      authenticated: true,
      user: validation.user,
      provider: 'copilot',
      tokenValid: true,
    };
  } catch (error) {
    return { authenticated: false };
  }
}

/**
 * Logout from GitHub
 */
export async function logoutGitHub(): Promise<void> {
  await credentialStore.deleteGitHubToken();
}

/**
 * Get stored token for API calls
 */
export async function getStoredToken(): Promise<string | null> {
  return credentialStore.getGitHubToken();
}
