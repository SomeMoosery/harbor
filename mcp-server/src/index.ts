/**
 * Harbor MCP Server
 * Integrates Harbor marketplace into Claude Code via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import { HarborClient } from './services/harbor-client.js';
import { BidPollingService } from './services/polling.js';
import { DeliveryPollingService } from './services/delivery-polling.js';
import { logger } from './utils/logger.js';
import { initializeAuthentication } from './tools/authenticate.js';
import { createAsk } from './tools/create-ask.js';
import { listBids } from './tools/list-bids.js';
import { acceptBid } from './tools/accept-bid.js';
import { getDelivery } from './tools/get-delivery.js';
import {
  createAskSchema,
  listBidsSchema,
  acceptBidSchema,
  getDeliverySchema,
} from './utils/validators.js';
import { ValidationError, HarborMCPError } from './utils/errors.js';

export async function main() {
  logger.info('Starting Harbor MCP Server');

  // Load configuration
  const config = loadConfig();
  logger.info('Configuration loaded', {
    baseUrl: config.harborBaseUrl,
    logLevel: config.logLevel,
  });

  // Initialize Harbor client
  const harborClient = new HarborClient(config.harborBaseUrl);

  // Authenticate using API key from environment
  await initializeAuthentication(harborClient, config.harborApiKey);
  logger.info('Authentication successful');

  // Initialize polling services
  const bidPollingService = new BidPollingService(harborClient);
  const deliveryPollingService = new DeliveryPollingService(harborClient);

  // Create MCP server
  const server = new Server(
    {
      name: 'harbor-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_ask',
          description:
            'Post a new task to the Harbor marketplace for agents to bid on. Use this when you need help with a task you cannot complete.',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Detailed description of the task you need help with',
              },
              budget: {
                type: 'number',
                description: 'Maximum budget in USD you are willing to pay',
              },
              bidWindowHours: {
                type: 'number',
                description: 'How many hours to wait for bids (e.g., 1, 2, 24)',
              },
            },
            required: ['description', 'budget', 'bidWindowHours'],
          },
        },
        {
          name: 'list_bids',
          description:
            'Get the current bids for an ask. Shows agent details, prices, proposals, and availability.',
          inputSchema: {
            type: 'object',
            properties: {
              askId: {
                type: 'string',
                description: 'Ask ID to get bids for (optional - uses active ask if omitted)',
              },
            },
          },
        },
        {
          name: 'accept_bid',
          description:
            'Accept a specific bid to start the job. This locks escrow funds and notifies the agent to begin work.',
          inputSchema: {
            type: 'object',
            properties: {
              bidId: {
                type: 'string',
                description: 'The ID of the bid you want to accept',
              },
            },
            required: ['bidId'],
          },
        },
        {
          name: 'get_delivery',
          description:
            'Check if the delivery is complete and retrieve the deliverable. Call this after accepting a bid to monitor progress.',
          inputSchema: {
            type: 'object',
            properties: {
              askId: {
                type: 'string',
                description: 'Ask ID to check for delivery',
              },
            },
            required: ['askId'],
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
      logger.info(`Tool called: ${name}`, { args });

      switch (name) {
        case 'create_ask': {
          const input = createAskSchema.parse(args);
          const result = await createAsk(harborClient, input);

          // Start polling for bids
          if (result.askId) {
            bidPollingService.startPolling(
              result.askId,
              (bids, ask) => {
                // Bid update callback - log for now
                logger.info('Bids updated', {
                  askId: ask.id,
                  bidCount: bids.length,
                  status: ask.status,
                });
              },
              (ask, bids) => {
                // Window closed callback
                logger.info('Bid window closed!', {
                  askId: ask.id,
                  finalBidCount: bids.length,
                  message: `The bid window has closed! Received ${bids.length} bid(s). Use list_bids to review them.`,
                });
              }
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'list_bids': {
          const input = listBidsSchema.parse(args);
          const result = await listBids(harborClient, input);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'accept_bid': {
          const input = acceptBidSchema.parse(args);
          const result = await acceptBid(harborClient, input);

          // Start polling for delivery completion
          if (result.askId) {
            // Stop bid polling if still running
            if (bidPollingService.isPolling()) {
              bidPollingService.stopPolling();
            }

            // Start delivery polling
            deliveryPollingService.startPolling(
              result.askId,
              (ask) => {
                // Delivery complete callback
                logger.info('Delivery completed!', {
                  askId: ask.id,
                  message: 'The seller has completed the work! Use get_delivery to retrieve the deliverable.',
                });
              }
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_delivery': {
          const input = getDeliverySchema.parse(args);
          const result = await getDelivery(harborClient, input);

          // If delivery is complete, stop polling
          if (result.status === 'COMPLETED' && deliveryPollingService.isPolling()) {
            deliveryPollingService.stopPolling();
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new ValidationError(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, error);

      let errorMessage = 'Unknown error occurred';
      let errorCode = 'UNKNOWN_ERROR';
      let errorDetails: unknown = undefined;

      if (error instanceof HarborMCPError) {
        errorMessage = error.message;
        errorCode = error.code;
        errorDetails = error.details;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: errorCode,
                message: errorMessage,
                details: errorDetails,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Harbor MCP Server running on stdio');
}
