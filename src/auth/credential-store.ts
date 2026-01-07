/**
 * Secure Credential Storage
 *
 * Stores credentials securely using system keychain when available,
 * with fallback to encrypted file storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

const CLAUDE_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude');
const CREDENTIALS_FILE = path.join(CLAUDE_DIR, 'credentials.json');
const SERVICE_NAME = 'cluster-code';
const ACCOUNT_NAME = 'github-token';

export interface Credentials {
  provider: 'copilot' | 'anthropic' | 'openai' | 'google';
  github_token?: string;
  anthropic_api_key?: string;
  openai_api_key?: string;
  google_api_key?: string;
  created_at: string;
  expires_at: string | null;
  github_user?: string;
}

// Keytar type definitions (optional dependency)
interface KeytarModule {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

let keytar: KeytarModule | null = null;

/**
 * Try to load keytar for secure credential storage
 */
async function loadKeytar(): Promise<KeytarModule | null> {
  if (keytar !== null) {
    return keytar;
  }

  try {
    // Dynamic import to handle missing module gracefully
    keytar = await import('keytar');
    logger.debug('Using system keychain for credential storage');
    return keytar;
  } catch (error) {
    logger.debug('Keytar not available, using file-based storage');
    return null;
  }
}

/**
 * Simple encryption for file-based storage
 * Uses a machine-specific key derived from system information
 */
function getEncryptionKey(): Buffer {
  const machineId = `${process.env.HOME || process.env.USERPROFILE || 'default'}-${process.platform}-${process.arch}`;
  return crypto.createHash('sha256').update(machineId).digest();
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Ensure the credentials directory exists with proper permissions
 */
function ensureCredentialsDir(): void {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Credential Store class for managing secure token storage
 */
export class CredentialStore {
  private useKeychain: boolean = false;

  async initialize(): Promise<void> {
    const keytarModule = await loadKeytar();
    this.useKeychain = keytarModule !== null;
    ensureCredentialsDir();
  }

  /**
   * Save GitHub token securely
   */
  async saveGitHubToken(token: string, githubUser?: string): Promise<void> {
    await this.initialize();

    if (this.useKeychain) {
      try {
        await keytar!.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
        logger.debug('Token saved to system keychain');
      } catch (error) {
        logger.debug('Failed to save to keychain, falling back to file storage');
        await this.saveToFile(token, githubUser);
        return;
      }
    } else {
      await this.saveToFile(token, githubUser);
    }

    // Always save metadata to file (without the actual token if using keychain)
    const credentials = await this.loadCredentialsFile();
    credentials.provider = 'copilot';
    credentials.created_at = new Date().toISOString();
    credentials.expires_at = null;
    credentials.github_user = githubUser;

    if (!this.useKeychain) {
      credentials.github_token = encrypt(token);
    }

    await this.saveCredentialsFile(credentials);
  }

  /**
   * Save token to encrypted file (fallback method)
   */
  private async saveToFile(token: string, githubUser?: string): Promise<void> {
    const credentials: Credentials = {
      provider: 'copilot',
      github_token: encrypt(token),
      created_at: new Date().toISOString(),
      expires_at: null,
      github_user: githubUser,
    };

    await this.saveCredentialsFile(credentials);

    // Set restrictive permissions (chmod 600)
    try {
      fs.chmodSync(CREDENTIALS_FILE, 0o600);
    } catch (error) {
      // Windows doesn't support chmod the same way
      logger.debug('Could not set file permissions');
    }
  }

  /**
   * Get GitHub token from storage
   */
  async getGitHubToken(): Promise<string | null> {
    await this.initialize();

    if (this.useKeychain) {
      try {
        const token = await keytar!.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        if (token) {
          return token;
        }
      } catch (error) {
        logger.debug('Failed to read from keychain, trying file storage');
      }
    }

    // Try file storage
    const credentials = await this.loadCredentialsFile();
    if (credentials.github_token) {
      try {
        return decrypt(credentials.github_token);
      } catch (error) {
        logger.debug('Failed to decrypt token');
        return null;
      }
    }

    return null;
  }

  /**
   * Delete GitHub token from storage
   */
  async deleteGitHubToken(): Promise<void> {
    await this.initialize();

    if (this.useKeychain) {
      try {
        await keytar!.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      } catch (error) {
        logger.debug('Failed to delete from keychain');
      }
    }

    // Also remove from file
    const credentials = await this.loadCredentialsFile();
    delete credentials.github_token;
    delete credentials.github_user;
    await this.saveCredentialsFile(credentials);
  }

  /**
   * Get stored credentials metadata
   */
  async getCredentials(): Promise<Credentials | null> {
    const credentials = await this.loadCredentialsFile();
    if (Object.keys(credentials).length === 0) {
      return null;
    }
    return credentials;
  }

  /**
   * Save Anthropic API key
   */
  async saveAnthropicKey(apiKey: string): Promise<void> {
    await this.initialize();

    const credentials = await this.loadCredentialsFile();
    credentials.anthropic_api_key = encrypt(apiKey);
    if (!credentials.provider) {
      credentials.provider = 'anthropic';
    }
    credentials.created_at = credentials.created_at || new Date().toISOString();
    await this.saveCredentialsFile(credentials);
  }

  /**
   * Get Anthropic API key
   */
  async getAnthropicKey(): Promise<string | null> {
    const credentials = await this.loadCredentialsFile();
    if (credentials.anthropic_api_key) {
      try {
        return decrypt(credentials.anthropic_api_key);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if any credentials are stored
   */
  async hasCredentials(): Promise<boolean> {
    const token = await this.getGitHubToken();
    if (token) return true;

    const credentials = await this.loadCredentialsFile();
    return !!(credentials.anthropic_api_key || credentials.openai_api_key || credentials.google_api_key);
  }

  /**
   * Load credentials from file
   */
  private async loadCredentialsFile(): Promise<Credentials> {
    ensureCredentialsDir();

    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return {} as Credentials;
    }

    try {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.debug('Failed to read credentials file');
      return {} as Credentials;
    }
  }

  /**
   * Save credentials to file
   */
  private async saveCredentialsFile(credentials: Credentials): Promise<void> {
    ensureCredentialsDir();
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');

    // Set restrictive permissions
    try {
      fs.chmodSync(CREDENTIALS_FILE, 0o600);
    } catch {
      // Windows doesn't support chmod
    }
  }

  /**
   * Get credentials file path
   */
  getCredentialsPath(): string {
    return CREDENTIALS_FILE;
  }
}

// Export singleton instance
export const credentialStore = new CredentialStore();
