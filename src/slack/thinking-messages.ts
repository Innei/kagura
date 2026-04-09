export const THINKING_STATUS_MESSAGES = [
  'is thinking...',
  'is gathering thoughts...',
  'is turning the question over...',
  'is following a thread...',
  'is tracing the outline of an answer...',
  'is wandering through ideas...',
  'is weighing words carefully...',
  'is listening to the silence between words...',
  'is looking at it from another angle...',
  'is finding the right words...',
  'is chasing a thought to its source...',
  'is connecting distant dots...',
  'is sketching the shape of a reply...',
  'is reading between the lines...',
  'is walking around the problem...',
  'is weaving fragments into coherence...',
  'is watching the pieces fall into place...',
  'is holding the question lightly...',
  'is letting the answer surface...',
  'is paying attention to what matters...',
] as const;

export function rotateThinkingStatus(index: number): string {
  return THINKING_STATUS_MESSAGES[index % THINKING_STATUS_MESSAGES.length];
}

export const THINKING_LOADING_MESSAGES = [
  'Gathering threads of thought...',
  'Reading between the lines...',
  'Following where the question leads...',
  'Turning the problem over in mind...',
  'Tracing the shape of an answer...',
  'Weaving ideas together...',
  'Connecting distant dots...',
  'Listening for what is unspoken...',
  'Walking around the problem...',
  'Watching pieces fall into place...',
  'Holding the question lightly...',
  'Letting the answer surface...',
  'Sketching the outline of a reply...',
  'Weighing each word...',
  'Chasing a thread to its source...',
  'Finding the right words...',
  'Looking from another angle...',
  'Paying attention to detail...',
  'Building understanding layer by layer...',
  'Sensing the contours of the problem...',
  'Placing each stone with care...',
  'Wandering through the possibility space...',
  'Gathering light from different windows...',
  'Sitting with the question a moment longer...',
  'Drawing from stillness...',
] as const;

export function getShuffledThinkingMessages(count: number = 8): string[] {
  const shuffled = [...THINKING_LOADING_MESSAGES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
