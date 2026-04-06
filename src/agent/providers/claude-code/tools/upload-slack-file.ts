import { zodParse } from '~/schemas/safe-parse.js';

import {
  type UploadSlackFileToolInput,
  UploadSlackFileToolInputSchema,
} from '../schemas/upload-slack-file.js';

export const UPLOAD_SLACK_FILE_TOOL_NAME = 'upload_slack_file';
export const UPLOAD_SLACK_FILE_TOOL_DESCRIPTION =
  'Queue an existing local file from the current workspace/session root to be uploaded into the current Slack thread. Use this after you create a deliverable file for the user. Relative paths are resolved from the current workspace root.';

export function parseUploadSlackFileToolInput(input: unknown): UploadSlackFileToolInput {
  return zodParse(UploadSlackFileToolInputSchema, input, 'UploadSlackFileToolInput');
}
