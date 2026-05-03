export interface ChatMessage {
  content: string;
  role: 'system' | 'user' | 'assistant';
}

export interface OpenAICompatibleClientOptions {
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  model: string;
  timeoutMs: number;
}

export class OpenAICompatibleClient {
  constructor(private readonly options: OpenAICompatibleClientOptions) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const url = `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'authorization': `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: this.options.maxTokens,
          messages,
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LLM API ${response.status}: ${body.slice(0, 200)}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('empty completion content');
      return text;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM API timeout after ${this.options.timeoutMs}ms`, {
          cause: error,
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
