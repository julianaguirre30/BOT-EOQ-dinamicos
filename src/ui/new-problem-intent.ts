export const wantsNewProblem = (text: string): boolean => {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return false;

  // Heuristica conservadora: exige intencion + objeto "problema/ejercicio/modelo/caso".
  const strongPhrases = [
    /\bnuevo problema\b/,
    /\botro problema\b/,
    /\bnuevo ejercicio\b/,
    /\botro ejercicio\b/,
    /\botro caso\b/,
    /\bnuevo caso\b/,
    /\botro modelo\b/,
    /\bnuevo modelo\b/,
  ];
  if (strongPhrases.some((pattern) => pattern.test(normalized))) return true;

  const intentVerb = /\b(quiero|quisiera|necesito|vamos a|hagamos|podemos|me gustaria|desarrollar|resolver|arrancar|empezar|iniciar|hacer)\b/;
  const targetNoun = /\b(otro|nuev[oa])\b.*\b(problema|ejercicio|modelo|caso)\b/;

  return intentVerb.test(normalized) && targetNoun.test(normalized);
};
