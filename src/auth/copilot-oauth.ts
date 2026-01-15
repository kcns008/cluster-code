/**
 * GitHub Copilot OAuth Device Flow
 *
 * Implements OAuth device flow for GitHub Copilot authentication.
 * Based on OpenCode's authentication approach for proper Copilot API access.
 */

import chalk from 'chalk';
import ora from 'ora';
import { credentialStore, CopilotOAuthToken } from './credential-store';
import { logger } from '../utils/logger';

// GitHub Copilot OAuth Configuration (same as OpenCode)
const COPILOT_CLIENT_ID = 'Ov23li8tweQw6odWQebz';

// API URLs for different deployment types
interface CopilotUrls {
  DEVICE_CODE_URL: string;
  TOKEN_URL: string;
  API_BASE: string;
}

function getUrls(domain: string = 'github.com'): CopilotUrls {
  if (domain === 'github.com') {
    return {
      DEVICE_CODE_URL: 'https://github.com/login/device/code',
      TOKEN_URL: 'https://github.com/login/oauth/access_token',
      API_BASE: 'https://api.githubcopilot.com',
    };
  }

  // GitHub Enterprise
  return {
    DEVICE_CODE_URL: `https://${domain}/login/device/code`,
    TOKEN_URL: `https://${domain}/login/oauth/access_token`,
    API_BASE: `https://copilot-api.${domain}`,
  };
}

function normalizeDomain(url: string): string {
  try {
    const parsed = url.includes('://') ? new URL(url) : new URL(`https://${url}`);
    return parsed.hostname;
  } catch {
    return url;
  }
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface CopilotAuthResult {
  success: boolean;
  error?: string;
  user?: string;
}

/**
 * Start the OAuth device flow for GitHub Copilot
 */
export async function startCopilotDeviceFlow(
  options: { enterpriseUrl?: string } = {}
): Promise<CopilotAuthResult> {
  const spinner = ora();

  try {
    const domain = options.enterpriseUrl 
      ? normalizeDomain(options.enterpriseUrl) 
      : 'github.com';
    const urls = getUrls(domain);

    spinner.start('Initiating device authorization...');

    // Step 1: Request device code
    const deviceResponse = await fetch(urls.DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ClusterCode-CLI',
      },
      body: JSON.stringify({
        client_id: COPILOT_CLIENT_ID,
        scope: 'read:user',
      }),
    });

    if (!deviceResponse.ok) {
      throw new Error(`Failed to initiate device authorization: ${deviceResponse.statusText}`);
    }

    const deviceData = await deviceResponse.json() as DeviceCodeResponse;

    spinner.stop();

    // Step 2: Display user code and instructions
    console.log(chalk.cyan('\n🔐 GitHub Copilot Authorization'));
    console.log(chalk.white('\n  Please visit: ') + chalk.bold.underline(deviceData.verification_uri));
    console.log(chalk.white('  Enter code: ') + chalk.bold.yellow(deviceData.user_code));
    console.log(chalk.gray('\n  Waiting for authorization...'));

    // Try to open browser automatically
    try {
      const open = (await import('open')).default;
      await open(deviceData.verification_uri);
    } catch {
      // Browser opening is optional
      logger.debug('Could not open browser automatically');
    }

    spinner.start('Waiting for authorization...');

    // Step 3: Poll for token
    const token = await pollForToken(
      urls.TOKEN_URL,
      deviceData.device_code,
      deviceData.interval,
      deviceData.expires_in
    );

    spinner.text = 'Getting user info...';

    // Step 4: Get user info using the token
    const userInfo = await getCopilotUserInfo(token, urls.API_BASE);

    spinner.succeed(chalk.green(`Authenticated as ${userInfo.login || 'GitHub User'}`));

    // Step 5: Save OAuth credentials
    const oauthToken: CopilotOAuthToken = {
      refresh_token: token,
      enterprise_url: options.enterpriseUrl,
    };

    await credentialStore.saveCopilotOAuth(oauthToken, userInfo.login);

    console.log(chalk.green('\n✅ GitHub Copilot authentication successful!'));
    console.log(chalk.gray('   Your credentials have been saved securely.\n'));

    return {
      success: true,
      user: userInfo.login,
    };
  } catch (error: any) {
    spinner.fail('Authentication failed');
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Poll GitHub for the access token
 */
async function pollForToken(
  tokenUrl: string,
  deviceCode: string,
  interval: number,
  expiresIn: number
): Promise<string> {
  const startTime = Date.now();
  const expiresAtMs = startTime + (expiresIn * 1000);
  let pollInterval = interval * 1000; // Convert to milliseconds

  while (Date.now() < expiresAtMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ClusterCode-CLI',
      },
      body: JSON.stringify({
        client_id: COPILOT_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await response.json() as TokenResponse;

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === 'authorization_pending') {
      // User hasn't authorized yet, continue polling
      continue;
    }

    if (data.error === 'slow_down') {
      // Increase polling interval
      pollInterval += 5000;
      continue;
    }

    if (data.error === 'expired_token') {
      throw new Error('Authorization request expired. Please try again.');
    }

    if (data.error === 'access_denied') {
      throw new Error('Authorization was denied. Please try again and approve the request.');
    }

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
  }

  throw new Error('Authorization timed out. Please try again.');
}

/**
 * Get Copilot user info using the OAuth token
 */
async function getCopilotUserInfo(
  token: string,
  _apiBase: string
): Promise<{ login?: string }> {
  try {
    // First try GitHub API directly
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClusterCode-CLI',
      },
    });

    if (response.ok) {
      const data = await response.json() as { login: string };
      return { login: data.login };
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Get a valid Copilot access token for API calls
 * Uses the OAuth token directly (like OpenCode does)
 */
export async function getCopilotAccessToken(): Promise<{
  token: string;
  baseUrl: string;
} | null> {
  const oauth = await credentialStore.getCopilotOAuth();

  if (!oauth?.refresh_token) {
    return null;
  }

  const domain = oauth.enterprise_url 
    ? normalizeDomain(oauth.enterprise_url) 
    : 'github.com';
  const urls = getUrls(domain);

  // Use the OAuth token directly (same as OpenCode)
  return {
    token: oauth.refresh_token,
    baseUrl: urls.API_BASE,
  };
}

/**
 * Test if Copilot authentication is valid
 */
export async function testCopilotAuth(): Promise<{
  success: boolean;
  message: string;
  user?: string;
}> {
  const oauth = await credentialStore.getCopilotOAuth();

  if (!oauth?.refresh_token) {
    return {
      success: false,
      message: 'Not authenticated. Run: cluster-code github login',
    };
  }

  const credentials = await credentialStore.getCredentials();
  const user = credentials?.github_user;

  // Try to get an access token (this validates the refresh token)
  const tokenResult = await getCopilotAccessToken();

  if (!tokenResult) {
    return {
      success: false,
      message: 'Authentication expired. Please run: cluster-code github login',
    };
  }

  // Test the Copilot API
  try {
    const response = await fetch(`${tokenResult.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ClusterCode-CLI',
        'Openai-Intent': 'conversation-edits',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (response.ok || response.status === 200) {
      return {
        success: true,
        message: 'GitHub Copilot is authenticated and working',
        user,
      };
    }

    // 400 is acceptable - means API is reachable but request was malformed
    if (response.status === 400) {
      return {
        success: true,
        message: 'GitHub Copilot API is accessible',
        user,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        message: 'Copilot access denied. Check your subscription.',
      };
    }

    return {
      success: false,
      message: `Copilot API error: ${response.status}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection error: ${error.message}`,
    };
  }
}

/**
 * Logout from Copilot (clear OAuth credentials)
 */
export async function logoutCopilot(): Promise<void> {
  await credentialStore.deleteCopilotOAuth();
  // Also clear legacy PAT-based auth
  await credentialStore.deleteGitHubToken();
}
