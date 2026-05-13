import { ChatTurnResponse } from '../app/runtime/chat-handler';

/**
 * Single entry in the chat feed (user message or assistant response)
 */
export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; payload: ChatTurnResponse };

/**
 * Detected parameter from user input after parsing
 */
export type DetectedDatum = {
  label: string;
  value: string;
};
