export type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  responseFormat?: {
    type: 'json_object';
  };
  timeoutMs?: number;
};

export type ChatCompletionResult = {
  provider: string;
  model: string;
  content: string;
  finishReason?: string;
  raw?: unknown;
};

export interface ChatCompletionClient {
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
}
