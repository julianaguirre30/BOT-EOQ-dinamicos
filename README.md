# EOQ tutor MVP

Conversational tutor for Economic Order Quantity (EOQ) exercises built with Next.js, React, TypeScript, Zod, and Vitest.

The app exposes a chat UI that keeps the conversation continuous while returning a structured solver response for each assistant turn.

## Requirements

- Node.js 20 or newer
- npm
- A Groq API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
copy .env.example .env
```

3. Fill in the required values in `.env`.

## Environment variables

Required:

- `EOQ_INTERPRETER_API_KEY` or `GROQ_API_KEY`

Optional:

- `EOQ_INTERPRETER_PROVIDER` or `LLM_PROVIDER` - defaults to `groq`
- `EOQ_INTERPRETER_BASE_URL` or `GROQ_BASE_URL` - defaults to `https://api.groq.com/openai/v1`
- `EOQ_INTERPRETER_MODEL` or `GROQ_MODEL` - defaults to `llama-3.3-70b-versatile`
- `EOQ_INTERPRETER_TIMEOUT_MS` or `LLM_TIMEOUT_MS` - defaults to `15000`

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run start` - run the production server
- `npm run test` - run the test suite

## Project structure

- `app/` - Next.js app router entrypoints
- `src/app/runtime/` - chat runtime orchestration
- `src/application/` - turn controller and application logic
- `src/domain/` - EOQ routing, normalization, validation, and solver logic
- `src/infrastructure/` - LLM client implementations
- `src/interpreter/` - EOQ interpreter adapters
- `src/ui/` - chat interface components
- `tests/` - Vitest suites and fixtures

## Notes

- The repository is not meant to be published to npm, so `package.json` keeps `private: true`.
- `.env` is ignored; keep `.env.example` as the documented template for collaborators.