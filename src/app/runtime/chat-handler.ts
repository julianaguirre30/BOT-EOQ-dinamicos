import { z } from 'zod';

import { TurnController } from '../../application/turn-controller';
import { PublicResponseEnvelopeSchema, toPublicResponseEnvelope } from '../../contracts/eoq';

export const ChatTurnRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  userText: z.string().min(1),
});
export type ChatTurnRequest = z.infer<typeof ChatTurnRequestSchema>;

export const ChatTurnResponseSchema = z.object({
  sessionId: z.string().min(1),
  response: PublicResponseEnvelopeSchema,
});
export type ChatTurnResponse = z.infer<typeof ChatTurnResponseSchema>;

export const handleChatTurnRequest = async (
  body: unknown,
  dependencies: {
    controller: TurnController;
    createSessionId?: () => string;
  },
): Promise<ChatTurnResponse> => {
  const parsed = ChatTurnRequestSchema.parse(body);
  const sessionId = parsed.sessionId ?? dependencies.createSessionId?.() ?? crypto.randomUUID();
  const response = await dependencies.controller.handleTurn({
    sessionId,
    userText: parsed.userText,
  });
  const publicResponse = toPublicResponseEnvelope(response);

  return ChatTurnResponseSchema.parse({
    sessionId,
    response: publicResponse,
  });
};
