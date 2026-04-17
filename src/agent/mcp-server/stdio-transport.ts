import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { AppLogger } from '~/logger/index.js';

import { createKaguraMcpServer } from './create-server.js';
import type { KaguraMcpServerOptions } from './types.js';

export async function startMcpStdioServer(
  options: KaguraMcpServerOptions & { logger: AppLogger },
): Promise<void> {
  const { logger, ...serverOptions } = options;
  const server = createKaguraMcpServer({ ...serverOptions, logger });
  const transport = new StdioServerTransport();

  logger.info('Starting Kagura MCP server on stdio...');

  await server.connect(transport);

  logger.info('Kagura MCP server connected');
}
