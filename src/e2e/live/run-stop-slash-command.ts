import './load-e2e-env.js';

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createApplication } from '~/application.js';
import { env } from '~/env/server.js';
import { handleStopCommand } from '~/slack/commands/stop-command.js';
import type { SlackStatusProbeRecord } from '~/slack/render/status-probe.js';

import { readSlackStatusProbeFile, resetSlackStatusProbeFile } from './file-slack-status-probe.js';
import type { LiveE2EScenario } from './scenario.js';
import { runDirectly } from './scenario.js';
import { SlackApiClient } from './slack-api-client.js';

/** Same character as `finalizeThreadProgressMessage` success line (`✅ Done` / tool summary). */
const PROGRESS_SUCCESS_MARK = '\u2705';

interface StopSlashCommandResult {
  botUserId: string;
  channelId: string;
  failureMessage?: string;
  matched: {
    activeExecutionObserved: boolean;
    noSuccessProgressFinalize: boolean;
    stopCommandHandled: boolean;
    stoppedMarkerVisible: boolean;
  };
  passed: boolean;
  probePath: string;
  probeRecords: SlackStatusProbeRecord[];
  rootMessageTs?: string;
  runId: string;
  stopCommandResponseText?: string;
  targetRepo: string;
}

async function main(): Promise<void> {
  if (!env.SLACK_E2E_ENABLED) {
    throw new Error('Set SLACK_E2E_ENABLED=true before running the stop-slash-command E2E.');
  }

  if (!env.SLACK_E2E_CHANNEL_ID || !env.SLACK_E2E_TRIGGER_USER_TOKEN) {
    throw new Error('Live E2E requires SLACK_E2E_CHANNEL_ID and SLACK_E2E_TRIGGER_USER_TOKEN.');
  }

  const runId = randomUUID();
  const targetRepo = process.env.SLACK_E2E_TARGET_REPO?.trim() || 'slack-cc-bot';
  const triggerClient = new SlackApiClient(env.SLACK_E2E_TRIGGER_USER_TOKEN);
  const botClient = new SlackApiClient(env.SLACK_BOT_TOKEN);
  const botIdentity = await botClient.authTest();

  await resetSlackStatusProbeFile(env.SLACK_E2E_STATUS_PROBE_PATH);

  const result: StopSlashCommandResult = {
    botUserId: botIdentity.user_id,
    channelId: env.SLACK_E2E_CHANNEL_ID,
    matched: {
      activeExecutionObserved: false,
      noSuccessProgressFinalize: false,
      stopCommandHandled: false,
      stoppedMarkerVisible: false,
    },
    passed: false,
    probePath: env.SLACK_E2E_STATUS_PROBE_PATH,
    probeRecords: [],
    runId,
    targetRepo,
  };

  const application = createApplication();
  let caughtError: unknown;

  try {
    await application.start();
    await delay(3_000);

    const prompt = [
      `<@${botIdentity.user_id}> STOP_SLASH_E2E ${runId}`,
      `Use repository ${targetRepo} for this task.`,
      'Read src/index.ts, src/application.ts, src/slack/app.ts, package.json, and tsconfig.json using file-reading tools.',
      'Do not post a final reply until every read has completed.',
    ].join(' ');

    const rootMessage = await triggerClient.postMessage({
      channel: env.SLACK_E2E_CHANNEL_ID,
      text: prompt,
      unfurl_links: false,
      unfurl_media: false,
    });
    result.rootMessageTs = rootMessage.ts;
    console.info('Posted root message: %s', rootMessage.ts);

    const activationDeadline = Date.now() + env.SLACK_E2E_TIMEOUT_MS;
    while (Date.now() < activationDeadline) {
      if (application.threadExecutionRegistry.listActive(rootMessage.ts).length > 0) {
        result.matched.activeExecutionObserved = true;
        break;
      }
      await delay(250);
    }

    if (!result.matched.activeExecutionObserved) {
      throw new Error('Timed out waiting for an active thread execution in the registry.');
    }

    const stopResponse = await handleStopCommand({
      logger: application.logger,
      threadExecutionRegistry: application.threadExecutionRegistry,
      threadTs: rootMessage.ts,
    });
    result.stopCommandResponseText = stopResponse.text;
    if (stopResponse.text.includes('There is no in-progress reply')) {
      throw new Error('Stop command reported no in-progress reply despite active registry entry.');
    }
    result.matched.stopCommandHandled = true;

    const observeDeadline = Date.now() + env.SLACK_E2E_TIMEOUT_MS;
    while (Date.now() < observeDeadline) {
      const probeRecords = await readSlackStatusProbeFile(env.SLACK_E2E_STATUS_PROBE_PATH);
      result.probeRecords = probeRecords.filter((r) => r.threadTs === rootMessage.ts);

      const replies = await botClient.conversationReplies({
        channel: env.SLACK_E2E_CHANNEL_ID,
        inclusive: true,
        limit: 50,
        ts: rootMessage.ts,
      });
      const texts = (replies.messages ?? [])
        .map((m) => (typeof m.text === 'string' ? m.text : ''))
        .filter(Boolean);

      result.matched.stoppedMarkerVisible = threadShowsStoppedMarker(result.probeRecords, texts);
      result.matched.noSuccessProgressFinalize = !probeHasSuccessFinalize(result.probeRecords);

      if (result.matched.stoppedMarkerVisible && result.matched.noSuccessProgressFinalize) {
        break;
      }

      await delay(1_000);
    }

    await writeResult(result);
    assertResult(result);
    result.passed = true;
    await writeResult(result);

    console.info('Live stop-slash-command E2E passed.');
    console.info('Root thread: %s', result.rootMessageTs);
  } catch (error) {
    result.failureMessage = error instanceof Error ? error.message : String(error);
    caughtError = error;
  } finally {
    await writeResult(result).catch((error) => {
      console.error('Failed to persist result:', error);
    });
    await application.stop().catch((error) => {
      console.error('Failed to stop application:', error);
    });
  }

  if (caughtError) {
    throw caughtError;
  }
}

function threadShowsStoppedMarker(
  probeRecords: SlackStatusProbeRecord[],
  messageTexts: string[],
): boolean {
  const stoppedInProbe = probeRecords.some(
    (r) => r.kind === 'progress-message' && r.action === 'stopped',
  );
  const stoppedInMessages = messageTexts.some((t) => /stopped by user/i.test(t));
  return stoppedInProbe || stoppedInMessages;
}

function probeHasSuccessFinalize(probeRecords: SlackStatusProbeRecord[]): boolean {
  return probeRecords.some(
    (r) =>
      r.kind === 'progress-message' &&
      r.action === 'finalize' &&
      typeof r.text === 'string' &&
      r.text.includes(PROGRESS_SUCCESS_MARK),
  );
}

function assertResult(result: StopSlashCommandResult): void {
  const failures: string[] = [];

  if (!result.matched.activeExecutionObserved) {
    failures.push('no active execution was observed before calling /stop');
  }
  if (!result.matched.stopCommandHandled) {
    failures.push('handleStopCommand did not return an expected acknowledgement');
  }
  if (!result.matched.stoppedMarkerVisible) {
    failures.push(
      'thread did not show a stopped marker (probe stopped or "Stopped by user" in messages)',
    );
  }
  if (!result.matched.noSuccessProgressFinalize) {
    failures.push(
      `progress message was finalized with success marker (${PROGRESS_SUCCESS_MARK}) — expected stop, not completion`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Live stop-slash-command E2E failed: ${failures.join('; ')}`);
  }
}

async function writeResult(result: StopSlashCommandResult): Promise<void> {
  const resultPath = env.SLACK_E2E_RESULT_PATH.replace(
    /result\.json$/,
    'stop-slash-command-result.json',
  );
  const absolutePath = path.resolve(process.cwd(), resultPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const scenario: LiveE2EScenario = {
  id: 'stop-slash-command',
  title: 'Stop Slash Command',
  description:
    'Start the app, trigger a long-running thread reply, confirm the execution registry shows work in flight, ' +
    'invoke the /stop handler, and assert Slack shows a stopped marker without a success-style progress finalize.',
  keywords: ['stop', 'slash', 'abort', 'thread', 'registry'],
  run: main,
};

runDirectly(scenario);
