/**
 * Service port configuration for local development
 */
export const SERVICE_PORTS = {
  api: 3000,
  websocket: 3001,
  tendering: 3002,
  agent: 3003,
  user: 3004,
  wallet: 3005,
  escrow: 3006,
} as const;

export type ServiceName = keyof typeof SERVICE_PORTS;

/**
 * Get the base URL for a service in the current environment
 */
export function getServiceUrl(service: ServiceName): string {
  const port = SERVICE_PORTS[service];
  const host = process.env[`${service.toUpperCase()}_HOST`] ?? 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  return `${protocol}://${host}:${port}`;
}
