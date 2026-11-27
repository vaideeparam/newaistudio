import { randomBytes } from 'node:crypto';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { config } from './config.js';
import type { Session } from './sessions.js';

/**
 * OAuth client for the Gateway MCP, scoped to one browser session.
 * Implements the MCP authorization spec (discovery, dynamic client registration,
 * PKCE) through the SDK's `auth()` helper. Tokens are kept in the server-side session.
 */
export class SessionOAuthProvider implements OAuthClientProvider {
  /** Set by redirectToAuthorization; the login route sends the browser here. */
  pendingRedirect?: URL;

  constructor(private readonly session: Session) {}

  get redirectUrl(): string {
    return new URL('/api/auth/callback', config.publicUrl).toString();
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'ai/Studio',
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: config.oauthClientSecret ? 'client_secret_post' : 'none',
      ...(config.oauthScope ? { scope: config.oauthScope } : {}),
    };
  }

  state(): string {
    const s = randomBytes(16).toString('base64url');
    this.session.oauthState = s;
    return s;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    if (config.oauthClientId) {
      return { client_id: config.oauthClientId, client_secret: config.oauthClientSecret };
    }
    return this.session.clientInfo;
  }

  saveClientInformation(info: OAuthClientInformationMixed): void {
    this.session.clientInfo = info;
  }

  tokens(): OAuthTokens | undefined {
    return this.session.tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.session.tokens = tokens;
  }

  redirectToAuthorization(url: URL): void {
    this.pendingRedirect = url;
  }

  saveCodeVerifier(v: string): void {
    this.session.codeVerifier = v;
  }

  codeVerifier(): string {
    if (!this.session.codeVerifier) throw new Error('No PKCE code verifier for this session');
    return this.session.codeVerifier;
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void {
    if (scope === 'all' || scope === 'tokens') this.session.tokens = undefined;
    if (scope === 'all' || scope === 'client') this.session.clientInfo = undefined;
    if (scope === 'all' || scope === 'verifier') this.session.codeVerifier = undefined;
  }
}
