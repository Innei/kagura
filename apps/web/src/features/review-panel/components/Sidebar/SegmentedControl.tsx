import * as styles from './SegmentedControl.css';

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div aria-label={ariaLabel} className={styles.root} role="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-selected={selected}
            className={selected ? `${styles.button} ${styles.active}` : styles.button}
            key={option.value}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
