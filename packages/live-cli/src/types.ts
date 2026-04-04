export interface LiveE2EScenario {
  description: string;
  id: string;
  keywords: string[];
  run: () => Promise<void>;
  title: string;
}
