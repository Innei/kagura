import { forkSession, query } from '@anthropic-ai/claude-agent-sdk';

import type { AppLogger } from '~/logger/index.js';
import type { SessionStore } from '~/session/types.js';

import type { GitReviewService } from './git-review-service.js';

export interface CommitMessageGeneratorDeps {
  logger: AppLogger;
  reviewService: GitReviewService;
  sessionStore: SessionStore;
}

export interface CommitMessageGenerator {
  generateCommitMessage: (executionId: string) => Promise<string>;
}

const COMMIT_MESSAGE_SYSTEM_PROMPT = `You are a git commit message generator.
Based on the diff and conversation context, generate a concise commit message in Conventional Commits format.

Requirements:
- Start with a type prefix: feat, fix, refactor, chore, docs, style, test, perf, ci, build
- Keep the subject line under 72 characters
- Use imperative mood ("add" not "added")
- Focus on WHY, not just WHAT
- Return ONLY the commit message text, no explanation, no markdown fences`;

const MAX_DIFF_SIZE = 50_000;

export function createCommitMessageGenerator(
  deps: CommitMessageGeneratorDeps,
): CommitMessageGenerator {
  return {
    generateCommitMessage: (executionId) => generateCommitMessage(executionId, deps),
  };
}

async function generateCommitMessage(
  executionId: string,
  deps: CommitMessageGeneratorDeps,
): Promise<string> {
  const { reviewService, sessionStore, logger } = deps;

  const session = reviewService.getSession(executionId);
  if (!session) {
    throw new Error(`Review session not found: ${executionId}`);
  }

  const diff = reviewService.getDiff(executionId) ?? '';
  const truncatedDiff =
    diff.length > MAX_DIFF_SIZE ? `${diff.slice(0, MAX_DIFF_SIZE)}\n... (truncated)` : diff;

  const sessionRecord = sessionStore.get(session.threadTs);
  const providerSessionId = sessionRecord?.providerSessionId;

  const prompt = `${COMMIT_MESSAGE_SYSTEM_PROMPT}\n\nDiff:\n${truncatedDiff}`;

  let resumeSessionId: string | undefined;

  if (providerSessionId) {
    try {
      const forkResult = await forkSession(providerSessionId);
      resumeSessionId = forkResult.sessionId;
      logger.info(
        'Forked session %s → %s for commit message generation',
        providerSessionId,
        resumeSessionId,
      );
    } catch (forkError) {
      logger.warn(
        'Failed to fork session %s, falling back: %s',
        providerSessionId,
        String(forkError),
      );
    }
  }

  try {
    const queryResult = query({
      prompt,
      options: {
        model: 'claude-haiku-4-20250414',
        cwd: session.workspacePath,
        persistSession: false,
        ...(resumeSessionId ? { resume: resumeSessionId } : {}),
      },
    });

    let commitMessage = '';
    for await (const message of queryResult) {
      if (message.type === 'assistant') {
        const textParts = message.message.content
          .filter((part) => part.type === 'text')
          .map((part) => ('text' in part ? part.text : ''));
        commitMessage = textParts.join('').trim();
      }
    }

    if (!commitMessage) {
      throw new Error('Empty response from LLM');
    }

    return commitMessage;
  } catch (error) {
    logger.error('Commit message generation failed: %s', String(error));
    throw new Error(
      `Failed to generate commit message: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
