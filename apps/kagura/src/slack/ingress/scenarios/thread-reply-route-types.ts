import type { SessionRecord } from '~/session/types.js';

import type { ConversationDispatchInput } from '../conversation-dispatch.js';

export interface ThreadReplyIdentity {
  botUserId?: string | undefined;
  botUserName?: string | undefined;
}

export interface ThreadReplySummaryCheck {
  identity: ThreadReplyIdentity;
  session: SessionRecord | undefined;
}

export type CommonThreadReplyRoute =
  | {
      action: 'ignore';
      summaryCheck?: ThreadReplySummaryCheck;
    }
  | {
      action: 'dispatch';
      input: ConversationDispatchInput;
      summaryCheck?: ThreadReplySummaryCheck;
    };
