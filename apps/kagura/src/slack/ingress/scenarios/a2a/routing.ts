import type {
  AgentTeamRosterEntry,
  AgentTeamsConfig,
  MentionCoordinationDecision,
} from '../../agent-team-routing.js';
import { getAgentTeamRoster, parseUserMentions } from '../../agent-team-routing.js';

export interface A2AIdentity {
  userId?: string | undefined;
  userName?: string | undefined;
}

export interface A2AThreadContext {
  lead: string;
  participants: string[];
  roster: AgentTeamRosterEntry[];
  teamId?: string | undefined;
}

export type A2AThreadReplyDecision =
  | {
      action: 'run';
      reason: 'a2a_explicit_self_mention' | 'a2a_lead_default';
    }
  | {
      action: 'standby';
      lead: string;
      reason:
        | 'a2a_explicit_other_agent_mention'
        | 'a2a_non_lead_default'
        | 'a2a_unmatched_participant';
    };

export function buildA2AThreadContext(
  messageText: string,
  decision: MentionCoordinationDecision,
  agentTeams: AgentTeamsConfig | undefined,
): A2AThreadContext | undefined {
  if (decision.action === 'none') {
    return undefined;
  }

  const participants = new Set<string>();
  if (decision.lead) {
    participants.add(decision.lead);
  }

  if (decision.teamId) {
    const team = agentTeams?.[decision.teamId];
    if (team?.defaultLead) {
      participants.add(team.defaultLead);
    }
    for (const member of getAgentTeamRoster(team)) {
      participants.add(member.id);
    }
  }

  for (const mention of parseUserMentions(getRoutingText(messageText))) {
    participants.add(mention);
  }

  const participantIds = [...participants];
  return {
    lead: decision.lead,
    participants: participantIds,
    roster: buildA2ARoster(participantIds, decision, agentTeams),
    ...(decision.teamId ? { teamId: decision.teamId } : {}),
  };
}

export function serializeA2AParticipants(
  context: Pick<A2AThreadContext, 'participants' | 'roster'>,
): string {
  const rosterById = new Map(
    context.roster.map((entry) => [normalizeParticipant(entry.id), entry] as const),
  );
  return JSON.stringify(
    unique(context.participants).map((participant) => {
      const entry = rosterById.get(normalizeParticipant(participant));
      return entry ?? { id: participant };
    }),
  );
}

export function parseA2AParticipants(raw: string | undefined): string[] {
  return parseA2ARoster(raw).map((entry) => entry.id);
}

export function parseA2ARoster(raw: string | undefined): AgentTeamRosterEntry[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const entries: AgentTeamRosterEntry[] = [];
    for (const value of parsed) {
      if (typeof value === 'string' && value.trim()) {
        entries.push({ id: value.trim() });
        continue;
      }
      if (value && typeof value === 'object') {
        const entry = value as { id?: unknown; label?: unknown; role?: unknown };
        if (typeof entry.id !== 'string' || !entry.id.trim()) {
          continue;
        }
        entries.push({
          id: entry.id.trim(),
          ...(typeof entry.label === 'string' && entry.label.trim()
            ? { label: entry.label.trim() }
            : {}),
          ...(typeof entry.role === 'string' && entry.role.trim()
            ? { role: entry.role.trim() }
            : {}),
        });
      }
    }
    return uniqueRoster(entries);
  } catch {
    return [];
  }
}

export function getMentionedA2AParticipants(
  messageText: string,
  context: A2AThreadContext,
): string[] {
  return parseUserMentions(getRoutingText(messageText)).filter((mention) =>
    context.participants.some((participant) => candidateMatchesParticipant(mention, participant)),
  );
}

export function getA2AContextFromSession(session: {
  a2aLead?: string | undefined;
  a2aParticipantsJson?: string | undefined;
  a2aTeamId?: string | undefined;
  conversationMode?: string | undefined;
}): A2AThreadContext | undefined {
  if (session.conversationMode !== 'a2a' || !session.a2aLead) {
    return undefined;
  }
  return {
    lead: session.a2aLead,
    participants: unique([session.a2aLead, ...parseA2AParticipants(session.a2aParticipantsJson)]),
    roster: ensureA2ARosterIncludesParticipants(
      parseA2ARoster(session.a2aParticipantsJson),
      unique([session.a2aLead, ...parseA2AParticipants(session.a2aParticipantsJson)]),
    ),
    ...(session.a2aTeamId ? { teamId: session.a2aTeamId } : {}),
  };
}

export function resolveA2AThreadReplyDecision(
  messageText: string,
  identity: A2AIdentity,
  context: A2AThreadContext,
): A2AThreadReplyDecision {
  if (!isA2AParticipant(identity, context)) {
    return {
      action: 'standby',
      lead: context.lead,
      reason: 'a2a_unmatched_participant',
    };
  }

  const mentionedParticipants = parseUserMentions(getRoutingText(messageText)).filter((mention) =>
    context.participants.some((participant) => candidateMatchesParticipant(mention, participant)),
  );

  if (mentionedParticipants.length > 0) {
    if (mentionedParticipants.length > 1 && candidateMatchesIdentity(identity, context.lead)) {
      return { action: 'run', reason: 'a2a_lead_default' };
    }
    const mentionsCurrentBot = mentionedParticipants.some((mention) =>
      candidateMatchesIdentity(identity, mention),
    );
    if (mentionsCurrentBot) {
      return { action: 'run', reason: 'a2a_explicit_self_mention' };
    }
    return {
      action: 'standby',
      lead: context.lead,
      reason: 'a2a_explicit_other_agent_mention',
    };
  }

  if (candidateMatchesIdentity(identity, context.lead)) {
    return { action: 'run', reason: 'a2a_lead_default' };
  }

  return {
    action: 'standby',
    lead: context.lead,
    reason: 'a2a_non_lead_default',
  };
}

export function isA2AParticipant(identity: A2AIdentity, context: A2AThreadContext): boolean {
  if (candidateMatchesIdentity(identity, context.lead)) {
    return true;
  }
  return context.participants.some((participant) =>
    candidateMatchesIdentity(identity, participant),
  );
}

export function identityMatchesA2AParticipant(
  identity: A2AIdentity,
  participant: string | undefined,
): boolean {
  return candidateMatchesIdentity(identity, participant);
}

function candidateMatchesIdentity(identity: A2AIdentity, candidate: string | undefined): boolean {
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

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeParticipant(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

function buildA2ARoster(
  participants: string[],
  decision: MentionCoordinationDecision,
  agentTeams: AgentTeamsConfig | undefined,
): AgentTeamRosterEntry[] {
  const teamRoster =
    decision.action !== 'none' && decision.teamId && agentTeams?.[decision.teamId]
      ? getAgentTeamRoster(agentTeams[decision.teamId])
      : [];
  return ensureA2ARosterIncludesParticipants(teamRoster, participants);
}

function ensureA2ARosterIncludesParticipants(
  roster: AgentTeamRosterEntry[],
  participants: string[],
): AgentTeamRosterEntry[] {
  const entries = new Map<string, AgentTeamRosterEntry>();
  for (const entry of roster) {
    const id = entry.id.trim();
    if (!id) {
      continue;
    }
    entries.set(normalizeParticipant(id), {
      id,
      ...(entry.label?.trim() ? { label: entry.label.trim() } : {}),
      ...(entry.role?.trim() ? { role: entry.role.trim() } : {}),
    });
  }
  for (const participant of participants) {
    const id = participant.trim();
    const key = normalizeParticipant(id);
    if (id && !entries.has(key)) {
      entries.set(key, { id });
    }
  }
  return [...entries.values()];
}

function uniqueRoster(roster: AgentTeamRosterEntry[]): AgentTeamRosterEntry[] {
  return ensureA2ARosterIncludesParticipants(
    roster,
    roster.map((entry) => entry.id),
  );
}

function getRoutingText(messageText: string): string {
  return (
    messageText
      .split(/\r?\n/u)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ''
  );
}
