import { ProblemInterpretation, TaxonomyTag } from '../../contracts/eoq';

export const MVP_BRANCHES = ['with_setup', 'no_setup'] as const;
export const UNSUPPORTED_MVP_SIGNALS = ['shortages', 'stochastic', 'multi_item', 'backlogging'] as const;
export const MATERIAL_CONFIDENCE_THRESHOLD = 0.6;

const hasUnsupportedTag = (tag: TaxonomyTag): boolean =>
  tag.status === 'unsupported';

export const hasAmbiguousTaxonomy = (interpretation: ProblemInterpretation): boolean =>
  interpretation.taxonomyTags.some((tag) => tag.status === 'ambiguous');

export const classifyMvpDomain = (interpretation: ProblemInterpretation) => {
  const signals = new Set<string>();
  const rawText = interpretation.normalizedText.toLowerCase();

  for (const tag of interpretation.taxonomyTags) {
    if (hasUnsupportedTag(tag)) {
      signals.add('unsupported_taxonomy');
    }

    for (const note of tag.notes) {
      const normalized = note.toLowerCase();

      if (normalized.includes('shortage')) signals.add('shortages');
      if (normalized.includes('stochastic')) signals.add('stochastic');
      if (normalized.includes('multi-item') || normalized.includes('multi item')) {
        signals.add('multi_item');
      }
      if (normalized.includes('backlog')) signals.add('backlogging');
    }
  }

  const { extractedValues } = interpretation;

  if (typeof extractedValues.itemCount === 'number' && extractedValues.itemCount !== 1) {
    signals.add('multi_item');
  }

  if (extractedValues.shortagesAllowed === true) {
    signals.add('shortages');
  }

  if (String(extractedValues.demandPattern ?? '').toLowerCase() === 'stochastic') {
    signals.add('stochastic');
  }

  if (extractedValues.backloggingAllowed === true) {
    signals.add('backlogging');
  }

  const rawSignals: Array<[string, string[]]> = [
    ['shortages', ['faltantes', 'shortage', 'faltante']],
    ['stochastic', ['stochastic', 'probabil', 'incierta', 'incertidumbre', 'azar']],
    ['multi_item', ['multi-item', 'multi item', 'tres productos', 'varios productos', 'multiple items']],
    ['backlogging', ['backlog', 'backlogging']],
  ];

  const explicitlyNoShortages =
    rawText.includes('no se permiten faltantes') ||
    rawText.includes('sin faltantes') ||
    rawText.includes('no shortage');

  for (const [signal, cues] of rawSignals) {
    if (signal === 'shortages' && explicitlyNoShortages) {
      continue;
    }

    if (cues.some((cue) => rawText.includes(cue) || interpretation.issues.some((issue) => issue.toLowerCase().includes(cue)))) {
      signals.add(signal);
    }
  }

  return {
    inDomain: signals.size === 0,
    reasons: Array.from(signals),
  };
};
