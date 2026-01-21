import { google } from 'googleapis';
import type { Logger } from '@harbor/logger';
import { randomUUID, createHmac } from 'crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  sessionSecret: string;
  mockOAuth: boolean;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

/**
 * Create OAuth2 client for Google authentication
 */
export function createOAuthHandler(config: OAuthConfig, logger: Logger) {
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.callbackUrl
  );

  /**
   * Generate a signed state token for CSRF protection
   */
  function generateState(): string {
    const state = randomUUID();
    const signature = createHmac('sha256', config.sessionSecret)
      .update(state)
      .digest('hex')
      .slice(0, 16);
    return `${state}.${signature}`;
  }

  /**
   * Verify a state token signature
   */
  function verifyState(stateWithSignature: string): boolean {
    const parts = stateWithSignature.split('.');
    if (parts.length !== 2) return false;

    const [state, signature] = parts;
    const expectedSignature = createHmac('sha256', config.sessionSecret)
      .update(state)
      .digest('hex')
      .slice(0, 16);

    return signature === expectedSignature;
  }

  /**
   * Get the Google OAuth authorization URL
   */
  function getAuthUrl(state: string): string {
    return oauth2Client.generateAuthUrl({
      access_type: 'online', // We don't need refresh tokens
      scope: ['email', 'profile'],
      state,
      prompt: 'select_account', // Always show account selector
    });
  }

  /**
   * Exchange authorization code for tokens and get user profile
   */
  async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    logger.info('Exchanging OAuth code for tokens');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.id || !data.email || !data.name) {
      throw new Error('Incomplete profile data from Google');
    }

    logger.info({ email: data.email }, 'Successfully retrieved Google profile');

    return {
      googleId: data.id,
      email: data.email,
      name: data.name,
    };
  }

  /**
   * Get mock profile for development
   */
  function getMockProfile(): GoogleProfile {
    logger.info('Using mock OAuth profile');
    return {
      googleId: 'mock-google-id-12345',
      email: 'mock-user@example.com',
      name: 'Mock User',
    };
  }

  return {
    generateState,
    verifyState,
    getAuthUrl,
    exchangeCodeForProfile,
    getMockProfile,
    isMockMode: config.mockOAuth,
  };
}

export type OAuthHandler = ReturnType<typeof createOAuthHandler>;
