import type { ImageAsset, SlotWriter } from './types.js';

export interface SlotWriterInternal extends SlotWriter {
  getImages: () => ImageAsset[];
  getSegments: () => string[];
  getText: () => string;
}

export function createSlotWriter(): SlotWriterInternal {
  const segments: string[] = [];
  const images: ImageAsset[] = [];

  return {
    append(text: string): void {
      segments.push(text);
    },
    prepend(text: string): void {
      segments.unshift(text);
    },
    image(asset: ImageAsset): void {
      images.push(asset);
    },
    getSegments(): string[] {
      return [...segments];
    },
    getImages(): ImageAsset[] {
      return [...images];
    },
    getText(): string {
      return segments.join('\n');
    },
  };
}
