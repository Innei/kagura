import type { CSSProperties, KeyboardEvent } from 'react';
import { useId, useRef } from 'react';

import * as styles from './Pill.styles';

export interface PillOption<T extends string> {
  disabled?: boolean;
  label: string;
  value: T;
}

interface PillProps<T extends string> {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<PillOption<T>>;
  value: T;
}

export function Pill<T extends string>({ ariaLabel, options, value, onChange }: PillProps<T>) {
  const rawId = useId();
  const anchorName = `--pill-${rawId.replaceAll(/[^\da-z]/gi, '')}`;
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const enabledIndices = options.reduce<number[]>((acc, option, index) => {
    if (!option.disabled) acc.push(index);
    return acc;
  }, []);

  const moveTo = (nextIdx: number) => {
    const next = options[nextIdx];
    if (!next || next.disabled) return;
    buttonsRef.current[nextIdx]?.focus();
    if (next.value !== value) onChange(next.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabledIndices.length === 0) return;
    const currentIdx = options.findIndex((o) => o.value === value);
    const enabledPos = Math.max(0, enabledIndices.indexOf(currentIdx));

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        const prev =
          enabledIndices[(enabledPos - 1 + enabledIndices.length) % enabledIndices.length];
        if (prev !== undefined) moveTo(prev);
        break;
      }
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        const next = enabledIndices[(enabledPos + 1) % enabledIndices.length];
        if (next !== undefined) moveTo(next);
        break;
      }
      case 'Home': {
        event.preventDefault();
        const first = enabledIndices[0];
        if (first !== undefined) moveTo(first);
        break;
      }
      case 'End': {
        event.preventDefault();
        const last = enabledIndices.at(-1);
        if (last !== undefined) moveTo(last);
        break;
      }
      default: {
        break;
      }
    }
  };

  return (
    <div aria-label={ariaLabel} className={styles.root} role="tablist" onKeyDown={handleKeyDown}>
      {options.map((option, index) => {
        const selected = option.value === value;
        const className = selected ? `${styles.button} ${styles.active}` : styles.button;
        const style = selected ? ({ anchorName } as CSSProperties) : undefined;
        return (
          <button
            aria-disabled={option.disabled || undefined}
            aria-selected={selected}
            className={className}
            disabled={option.disabled}
            key={option.value}
            role="tab"
            style={style}
            tabIndex={selected ? 0 : -1}
            type="button"
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            onClick={() => {
              if (!option.disabled && !selected) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className={styles.indicator}
        style={{ positionAnchor: anchorName } as CSSProperties}
      />
    </div>
  );
}
