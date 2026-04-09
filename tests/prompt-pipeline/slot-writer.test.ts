import type { ImageAsset } from '@kagura/prompt-pipeline';
import { describe, expect, it } from 'vitest';

import { createSlotWriter } from '../../packages/prompt-pipeline/src/slot-writer.js';

describe('SlotWriter', () => {
  it('append adds text segments in order', () => {
    const writer = createSlotWriter();
    writer.append('hello');
    writer.append('world');
    expect(writer.getSegments()).toEqual(['hello', 'world']);
  });

  it('prepend inserts text at the beginning', () => {
    const writer = createSlotWriter();
    writer.append('world');
    writer.prepend('hello');
    expect(writer.getSegments()).toEqual(['hello', 'world']);
  });

  it('image collects ImageAsset references', () => {
    const writer = createSlotWriter();
    const img: ImageAsset = { name: 'test.png', mimeType: 'image/png', base64Data: 'abc' };
    writer.image(img);
    expect(writer.getImages()).toEqual([img]);
  });

  it('multiple prepends maintain LIFO order', () => {
    const writer = createSlotWriter();
    writer.append('c');
    writer.prepend('b');
    writer.prepend('a');
    expect(writer.getSegments()).toEqual(['a', 'b', 'c']);
  });

  it('getText joins segments with newline', () => {
    const writer = createSlotWriter();
    writer.append('line 1');
    writer.append('line 2');
    expect(writer.getText()).toBe('line 1\nline 2');
  });

  it('getText returns empty string when no segments', () => {
    const writer = createSlotWriter();
    expect(writer.getText()).toBe('');
  });
});
