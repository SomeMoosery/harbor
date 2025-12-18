/**
 * Service port configuration for local development
 */
export const SERVICE_PORTS = {
  gateway: 3000,
  gatewayWs: 3005, // WebSocket server for gateway
  tendering: 3001,
  user: 3002,
  wallet: 3003,
  settlement: 3004,
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
