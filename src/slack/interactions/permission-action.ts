import type { AppLogger } from '~/logger/index.js';

import {
  PERMISSION_APPROVE_ACTION_ID,
  PERMISSION_DENY_ACTION_ID,
  type SlackPermissionBridge,
} from '../interaction/permission-bridge.js';
import type { SlackWebClientLike } from '../types.js';

export { PERMISSION_APPROVE_ACTION_ID, PERMISSION_DENY_ACTION_ID };

export interface PermissionActionDependencies {
  logger: AppLogger;
  permissionBridge: SlackPermissionBridge;
}

export function createPermissionActionHandler(
  deps: PermissionActionDependencies,
  allowed: boolean,
) {
  return async (args: any): Promise<void> => {
    const { ack, body, client } = args;
    await ack();

    const userId = body?.user?.id as string | undefined;
    const message = body?.message ?? body?.container;
    const threadTs = (message?.thread_ts ?? message?.ts) as string | undefined;
    const channelId = (body?.channel?.id ?? body?.container?.channel_id) as string | undefined;

    if (!userId || !threadTs) {
      deps.logger.warn(
        'Permission action missing userId or threadTs (userId=%s threadTs=%s)',
        userId ?? 'missing',
        threadTs ?? 'missing',
      );
      return;
    }

    const result = deps.permissionBridge.submitDecision({
      allowed,
      threadTs,
      userId,
    });

    if (!result.handled) {
      deps.logger.info(
        'Permission action for thread %s was not handled (no pending request)',
        threadTs,
      );
      if (channelId) {
        const slackClient = client as SlackWebClientLike;
        if (slackClient.chat.postEphemeral) {
          await slackClient.chat.postEphemeral({
            channel: channelId,
            user: userId,
            thread_ts: threadTs,
            text: '没有待处理的权限请求。',
          });
        }
      }
      return;
    }

    if (result.feedback && channelId) {
      const slackClient = client as SlackWebClientLike;
      if (slackClient.chat.postEphemeral) {
        await slackClient.chat.postEphemeral({
          channel: channelId,
          user: userId,
          thread_ts: threadTs,
          text: result.feedback,
        });
      }
    }
  };
}
