import { SessionData } from './private/auth/session.js';

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionData;
    userId: string;
    user: SessionData['user'];
  }
}

declare module 'cookie' {
  export function parse(str: string): Record<string, string>;
  export function serialize(name: string, val: string, options?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
    maxAge?: number;
    domain?: string;
    expires?: Date;
  }): string;
}
