import { createMessageIngressHandler } from './message-ingress.js';
import type { SlackIngressDependencies } from './types.js';

export function createThreadReplyHandler(deps: SlackIngressDependencies) {
  return createMessageIngressHandler(deps);
}
