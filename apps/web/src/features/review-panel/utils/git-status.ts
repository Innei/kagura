export function mapGitStatus(status: string | undefined) {
  if (!status) return undefined;
  if (status === '??') return 'untracked' as const;
  if (status.startsWith('A')) return 'added' as const;
  if (status.startsWith('D')) return 'deleted' as const;
  if (status.startsWith('R')) return 'renamed' as const;
  if (status.startsWith('M')) return 'modified' as const;
  return 'modified' as const;
}
