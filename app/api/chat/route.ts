import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { handleSimpleChatRequest } from '../../../src/app/runtime/simple-handler';

// Fuerza runtime Node.js (necesario para fs/promises y escritura en /tmp)
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = await handleSimpleChatRequest(body);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    }
    console.error('[chat/route]', error);
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error inesperado en el servidor: ${detail}` },
      { status: 500 },
    );
  }
}
