import * as styles from './SidebarTabs.styles';

export type SidebarTab = 'changes' | 'files';

interface TabSpec {
  count?: number | undefined;
  label: string;
  value: SidebarTab;
}

interface SidebarTabsProps {
  changesCount: number;
  filesCount?: number | undefined;
  onChange: (next: SidebarTab) => void;
  value: SidebarTab;
}

export function SidebarTabs({ changesCount, filesCount, value, onChange }: SidebarTabsProps) {
  const tabs: TabSpec[] = [
    { value: 'changes', label: 'Changes', count: changesCount },
    { value: 'files', label: 'Files', count: filesCount },
  ];
  return (
    <div aria-label="Sidebar sections" className={styles.root} role="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            aria-selected={selected}
            className={selected ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            key={tab.value}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
            onClick={() => {
              if (!selected) onChange(tab.value);
            }}
          >
            {tab.label}
            {tab.count !== undefined ? <span className={styles.count}>{tab.count}</span> : null}
          </button>
        );
      })}
      <span aria-hidden="true" className={styles.indicator} />
    </div>
  );
}
