import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { handleChatTurnRequest } from '../../../src/app/runtime/chat-handler';
import { getChatRuntime } from '../../../src/app/runtime/chat-runtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = await handleChatTurnRequest(body, {
      controller: getChatRuntime().controller,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid chat request payload.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unexpected chat runtime failure.' }, { status: 500 });
  }
}
