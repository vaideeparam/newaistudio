/**
 * Server configuration, read once from the environment.
 * See .env.example for every variable.
 */
export type AuthMode = 'oauth' | 'token' | 'mock';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

const gatewayUrl = env('STUDIO_MCP_URL');
const staticToken = env('STUDIO_MCP_TOKEN');
const mock = env('STUDIO_MCP_MOCK') === '1' || (!gatewayUrl && process.env.NODE_ENV !== 'production');

export const config = {
  port: Number(env('PORT') ?? 8787),
  isProd: process.env.NODE_ENV === 'production',
  /** Public origin of this app, used to build the OAuth redirect URL. */
  publicUrl: env('PUBLIC_URL') ?? 'http://localhost:5173',
  gatewayUrl,
  staticToken,
  mode: (mock ? 'mock' : staticToken ? 'token' : 'oauth') as AuthMode,
  /** OAuth scope to request from the Gateway. GUESS: unknown until we read its metadata. */
  oauthScope: env('STUDIO_MCP_SCOPE'),
  /** Pre-registered OAuth client, if the Gateway does not allow dynamic client registration. */
  oauthClientId: env('STUDIO_MCP_CLIENT_ID'),
  oauthClientSecret: env('STUDIO_MCP_CLIENT_SECRET'),
  sessionTtlMs: Number(env('SESSION_TTL_HOURS') ?? 12) * 3600_000,
};

if (config.mode !== 'mock' && !config.gatewayUrl) {
  throw new Error('STUDIO_MCP_URL is required unless STUDIO_MCP_MOCK=1');
}
