import { describe, expect, it } from 'vitest';

import {
  isParticipantInMentionedAgentTeam,
  parseSubteamMentions,
  parseUserMentions,
  resolveMentionCoordinationDecision,
} from '~/slack/ingress/agent-team-routing.js';

describe('agent team routing', () => {
  it('parses Slack user group and user mentions in message order', () => {
    expect(parseSubteamMentions('<!subteam^S123|@agents> and <!subteam^S456>')).toEqual([
      'S123',
      'S456',
    ]);
    expect(parseUserMentions('<@U1> <@U2> <@U1>')).toEqual(['U1', 'U2']);
  });

  it('runs the configured default lead for a team mention', () => {
    const decision = resolveMentionCoordinationDecision(
      '<!subteam^S123|@agents> handle this',
      { userId: 'U_LEAD', userName: 'codex' },
      {
        S123: {
          defaultLead: 'codex',
          members: ['codex', 'claude'],
        },
      },
    );

    expect(decision).toMatchObject({
      action: 'run',
      lead: 'codex',
      reason: 'team_lead',
      teamId: 'S123',
    });
  });

  it('puts non-lead team members on standby', () => {
    const decision = resolveMentionCoordinationDecision(
      '<!subteam^S123|@agents> handle this',
      { userId: 'U_HELPER', userName: 'claude' },
      {
        S123: {
          defaultLead: 'codex',
          members: ['codex', 'claude'],
        },
      },
    );

    expect(decision).toMatchObject({
      action: 'standby',
      lead: 'codex',
      reason: 'team_member_standby',
      teamId: 'S123',
    });
  });

  it('uses an explicitly mentioned team member as lead', () => {
    const decision = resolveMentionCoordinationDecision(
      '<!subteam^S123|@agents> <@U_HELPER> you coordinate',
      { userId: 'U_HELPER', userName: 'claude' },
      {
        S123: {
          defaultLead: 'U_LEAD',
          members: ['U_LEAD', 'U_HELPER'],
        },
      },
    );

    expect(decision).toMatchObject({
      action: 'run',
      lead: 'U_HELPER',
      reason: 'team_lead',
      teamId: 'S123',
    });
  });

  it('ignores mentions in later instruction lines when selecting a team lead', () => {
    const decision = resolveMentionCoordinationDecision(
      [
        '<!subteam^S123|@agents> handle this',
        'Later reply with "<@U_HELPER> DUAL_AGENT_TEAM_REQUEST".',
      ].join('\n'),
      { userId: 'U_LEAD', userName: 'codex' },
      {
        S123: {
          defaultLead: 'U_LEAD',
          members: ['U_LEAD', 'U_HELPER'],
        },
      },
    );

    expect(decision).toMatchObject({
      action: 'run',
      lead: 'U_LEAD',
      reason: 'team_lead',
      teamId: 'S123',
    });
  });

  it('falls back to the first direct mention for plain co-mentions', () => {
    expect(
      resolveMentionCoordinationDecision(
        '<@U_LEAD> <@U_HELPER> handle this',
        { userId: 'U_LEAD' },
        {},
      ),
    ).toMatchObject({
      action: 'run',
      lead: 'U_LEAD',
      reason: 'direct_co_mention_lead',
    });
    expect(
      resolveMentionCoordinationDecision(
        '<@U_LEAD> <@U_HELPER> handle this',
        { userId: 'U_HELPER' },
        {},
      ),
    ).toMatchObject({
      action: 'standby',
      lead: 'U_LEAD',
      reason: 'direct_co_mention_standby',
    });
  });

  it('recognizes bot-authored senders that joined through a team mention', () => {
    expect(
      isParticipantInMentionedAgentTeam('<!subteam^S123|@agents> handle this', 'U_LEAD', {
        S123: {
          defaultLead: 'U_LEAD',
          members: ['U_LEAD', 'U_HELPER'],
        },
      }),
    ).toBe(true);
  });
});
