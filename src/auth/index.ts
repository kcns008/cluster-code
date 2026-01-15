/**
 * Auth Module Exports
 */

export { credentialStore, CredentialStore, Credentials, CopilotOAuthToken } from './credential-store';

// New OAuth device flow for GitHub Copilot (recommended)
export {
  startCopilotDeviceFlow,
  getCopilotAccessToken,
  testCopilotAuth,
  logoutCopilot,
  CopilotAuthResult,
} from './copilot-oauth';

// Legacy exports (kept for backwards compatibility)
export {
  startOAuthFlow,
  setManualToken,
  getAuthStatus,
  logoutGitHub,
  getStoredToken,
  validateGitHubToken,
  testCopilotConnection,
  getCopilotToken,
  GitHubUser,
  OAuthResult,
  TokenValidationResult,
} from './github-auth';
