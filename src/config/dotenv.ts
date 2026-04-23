import { readFileSync } from 'node:fs';

export type EnvMap = Record<string, string>;

const parseLine = (line: string): [string, string] | undefined => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const normalized = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;
  const separatorIndex = normalized.indexOf('=');

  if (separatorIndex <= 0) {
    return undefined;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : undefined;
};

export const parseDotEnv = (contents: string): EnvMap => {
  const parsed: EnvMap = {};

  for (const line of contents.split(/\r?\n/u)) {
    const entry = parseLine(line);

    if (entry) {
      parsed[entry[0]] = entry[1];
    }
  }

  return parsed;
};

export const loadDotEnvFile = (filePath: string): EnvMap => {
  try {
    return parseDotEnv(readFileSync(filePath, 'utf8'));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
};
