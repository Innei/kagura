const SLACK_USER_MENTION_PATTERN = /<@([\dA-Z_]+)>/g;
const SLACK_SUBTEAM_MENTION_PATTERN = /<!subteam\^([\dA-Z_]+)(?:\|[^>]+)?>/g;

export interface AgentTeamConfig {
  defaultLead?: string | undefined;
  members?: string[] | undefined;
  name?: string | undefined;
}

export type AgentTeamsConfig = Record<string, AgentTeamConfig>;

export interface AgentTeamRoutingIdentity {
  userId?: string | undefined;
  userName?: string | undefined;
}

export type MentionCoordinationDecision =
  | { action: 'none' }
  | {
      action: 'run';
      lead: string;
      reason: 'direct_co_mention_lead' | 'team_lead';
      teamId?: string | undefined;
    }
  | {
      action: 'standby';
      lead: string;
      reason: 'direct_co_mention_standby' | 'team_member_standby';
      teamId?: string | undefined;
    };

export function resolveMentionCoordinationDecision(
  messageText: string,
  identity: AgentTeamRoutingIdentity,
  agentTeams: AgentTeamsConfig | undefined,
): MentionCoordinationDecision {
  const routingText = getRoutingText(messageText);
  const teamDecision = resolveAgentTeamDecision(routingText, identity, agentTeams);
  if (teamDecision.action !== 'none') {
    return teamDecision;
  }

  const directMentions = parseUserMentions(routingText);
  if (!identity.userId || directMentions.length < 2 || !directMentions.includes(identity.userId)) {
    return { action: 'none' };
  }

  const lead = directMentions[0]!;
  if (lead === identity.userId) {
    return { action: 'run', lead, reason: 'direct_co_mention_lead' };
  }
  return { action: 'standby', lead, reason: 'direct_co_mention_standby' };
}

export function isParticipantInMentionedAgentTeam(
  messageText: string,
  participant: string | undefined,
  agentTeams: AgentTeamsConfig | undefined,
): boolean {
  if (!participant) {
    return false;
  }

  for (const teamId of parseSubteamMentions(messageText)) {
    const team = agentTeams?.[teamId];
    if (team && candidateMatchesParticipant(participant, team.defaultLead)) {
      return true;
    }
    if (team?.members?.some((member) => candidateMatchesParticipant(participant, member))) {
      return true;
    }
  }

  return false;
}

export function parseSubteamMentions(messageText: string): string[] {
  return uniqueMatches(messageText, SLACK_SUBTEAM_MENTION_PATTERN);
}

export function parseUserMentions(messageText: string): string[] {
  return uniqueMatches(messageText, SLACK_USER_MENTION_PATTERN);
}

function resolveAgentTeamDecision(
  messageText: string,
  identity: AgentTeamRoutingIdentity,
  agentTeams: AgentTeamsConfig | undefined,
): MentionCoordinationDecision {
  if (!agentTeams || Object.keys(agentTeams).length === 0) {
    return { action: 'none' };
  }

  const directMentions = parseUserMentions(messageText);
  for (const teamId of parseSubteamMentions(messageText)) {
    const team = agentTeams[teamId];
    if (!team || !isCurrentBotTeamParticipant(identity, team)) {
      continue;
    }

    const explicitLead = directMentions.find((mention) =>
      isConfiguredTeamParticipant(mention, team),
    );
    const lead = explicitLead ?? team.defaultLead ?? team.members?.[0];
    if (!lead) {
      continue;
    }

    if (candidateMatchesIdentity(identity, lead)) {
      return { action: 'run', lead, reason: 'team_lead', teamId };
    }
    return { action: 'standby', lead, reason: 'team_member_standby', teamId };
  }

  return { action: 'none' };
}

function isCurrentBotTeamParticipant(
  identity: AgentTeamRoutingIdentity,
  team: AgentTeamConfig,
): boolean {
  if (candidateMatchesIdentity(identity, team.defaultLead)) {
    return true;
  }
  return team.members?.some((member) => candidateMatchesIdentity(identity, member)) ?? false;
}

function isConfiguredTeamParticipant(candidate: string, team: AgentTeamConfig): boolean {
  if (candidateMatchesParticipant(candidate, team.defaultLead)) {
    return true;
  }
  return team.members?.some((member) => candidateMatchesParticipant(candidate, member)) ?? false;
}

function candidateMatchesIdentity(
  identity: AgentTeamRoutingIdentity,
  candidate: string | undefined,
): boolean {
  return (
    candidateMatchesParticipant(identity.userId, candidate) ||
    candidateMatchesParticipant(identity.userName, candidate)
  );
}

function candidateMatchesParticipant(
  participant: string | undefined,
  candidate: string | undefined,
): boolean {
  if (!participant || !candidate) {
    return false;
  }
  return normalizeParticipant(participant) === normalizeParticipant(candidate);
}

function normalizeParticipant(value: string): string {
  return value.trim().replace(/^@/u, '').toLowerCase();
}

function uniqueMatches(messageText: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  for (const match of messageText.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value && !matches.includes(value)) {
      matches.push(value);
    }
  }
  return matches;
}

function getRoutingText(messageText: string): string {
  return (
    messageText
      .split(/\r?\n/u)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ''
  );
}
