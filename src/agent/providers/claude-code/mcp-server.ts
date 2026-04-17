import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

import type {
  AgentExecutionRequest,
  AgentExecutionSink,
} from '~/agent/types.js';
import { createToolDefinitions } from '~/agent/tools/tool-definitions.js';
import type { ChannelPreferenceStore } from '~/channel-preference/types.js';
import type { AppLogger } from '~/logger/index.js';
import type { MemoryStore } from '~/memory/types.js';

export function createAnthropicAgentSdkMcpServer(
  logger: AppLogger,
  memoryStore: MemoryStore,
  channelPreferenceStore: ChannelPreferenceStore,
  request: AgentExecutionRequest,
  sink: AgentExecutionSink,
) {
  const definitions = createToolDefinitions({
    channelPreferenceStore,
    logger,
    memoryStore,
    request,
    sink,
  });

  return createSdkMcpServer({
    name: 'slack-ui',
    tools: definitions.map((def) =>
      tool(def.name, def.description, (def.inputSchema as unknown as { shape: Record<string, unknown> }).shape as Parameters<typeof tool>[2], async (args) => {
        const result = await def.execute(args);
        return result as {
          content: Array<{ type: 'text'; text: string }>;
          isError?: boolean;
        };
      }),
    ),
  });
}
