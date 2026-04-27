import { SlackMessageSchema } from '~/schemas/slack/message.js';

import type { SlackWebClientLike } from '../types.js';
import { createBotIdentityResolver } from './message-filter.js';
import { maybeHandlePendingUserInputReply } from './pending-user-input.js';
import { executeThreadReplyRoute, resolveThreadReplyRoute } from './thread-reply-routing.js';
import type { SlackIngressDependencies } from './types.js';

export function createThreadReplyHandler(deps: SlackIngressDependencies) {
  const getBotIdentity = createBotIdentityResolver(deps.logger);

  return async (args: { client: unknown; event: unknown }): Promise<void> => {
    const parsed = SlackMessageSchema.safeParse(args.event);
    if (!parsed.success) {
      return;
    }

    const message = parsed.data;
    const client = args.client as SlackWebClientLike;

    if (message.user && !message.bot_id && !message.subtype) {
      const handledUserInput = await maybeHandlePendingUserInputReply(
        client,
        {
          channelId: typeof message.channel === 'string' ? message.channel : undefined,
          text: message.text,
          threadTs: message.thread_ts ?? message.ts,
          userId: message.user,
        },
        deps,
      );
      if (handledUserInput) {
        return;
      }
    }

    const botIdentity = await getBotIdentity(client);
    const route = await resolveThreadReplyRoute(client, deps, message, {
      botUserId: botIdentity?.userId,
      botUserName: botIdentity?.userName,
    });
    await executeThreadReplyRoute(client, deps, route);
  };
}
