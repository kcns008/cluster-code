/**
 * Auth Module Exports
 */

export { credentialStore, CredentialStore, Credentials } from './credential-store';
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
