import { z } from 'zod';

import { LlmInterpreterConfig } from '../../config/llm-config';
import { InterpreterFailure } from '../../interpreter/eoq-interpreter';
import {
  ChatCompletionClient,
  ChatCompletionRequest,
  ChatCompletionResult,
} from './chat-completion-client';

type FetchLike = typeof fetch;

const GroqChatCompletionResponseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().optional(),
        message: z.object({
          content: z.string().optional(),
        }),
      }),
    )
    .min(1),
});

export class GroqChatCompletionClient implements ChatCompletionClient {
  constructor(
    private readonly config: Pick<LlmInterpreterConfig, 'apiKey' | 'baseUrl' | 'timeoutMs'>,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? this.config.timeoutMs,
    );

    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0,
          response_format: request.responseFormat,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();

        throw new InterpreterFailure(
          `Groq request failed with status ${response.status}`,
          'provider_failure',
          body || `status_${response.status}`,
        );
      }

      const payload = GroqChatCompletionResponseSchema.parse(await response.json());
      const choice = payload.choices[0];
      const content = choice.message.content?.trim();

      if (!content) {
        throw new InterpreterFailure(
          'Groq response did not include message content.',
          'provider_failure',
          'empty_message_content',
        );
      }

      return {
        provider: 'groq',
        model: payload.model ?? request.model,
        content,
        finishReason: choice.finish_reason,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof InterpreterFailure) {
        throw error;
      }

      throw new InterpreterFailure(
        'Groq chat completion request failed.',
        'provider_failure',
        error instanceof Error ? error.message : 'unknown_provider_error',
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
