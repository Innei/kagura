import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { toJSONSchema, type z } from 'zod';

import { createToolDefinitions } from '../tools/tool-definitions.js';
import type { KaguraMcpServerOptions } from './types.js';

export function createKaguraMcpServer(options: KaguraMcpServerOptions): Server {
  const tools = createToolDefinitions(options);

  const server = new Server(
    {
      name: 'kagura',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const mcpTools: Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodSchemaToJsonSchema(tool.inputSchema) as Tool['inputSchema'],
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    const result = await tool.execute(request.params.arguments ?? {});
    return result as { content: Array<{ type: string; text?: string }>; isError?: boolean };
  });

  return server;
}

function zodSchemaToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return toJSONSchema(schema) as Record<string, unknown>;
}
