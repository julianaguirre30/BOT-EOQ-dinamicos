import {
  ProblemInterpretation,
  ProblemThreadState,
  ProblemThreadStateSchema,
  ProblemThreadTransitionReason,
} from '../contracts/eoq';

export type ProblemThreadTransition = {
  kind: 'continue' | 'fresh';
  reason: ProblemThreadTransitionReason;
};

const EXPLICIT_NEW_PROBLEM_CUES = [
  'nuevo problema',
  'nuevo caso',
  'otro problema',
  'otro caso',
  'resolve otro',
  'solve another',
  'different problem',
  'different case',
];

const SOLVED_FOLLOW_UP_CUES = [
  'explic',
  'por que',
  'porque',
  'pq',
  'de donde',
  'de donde salio',
  'why',
  'step',
  'paso',
  'y si',
  'que pasa si',
  'what if',
  'mismo problema',
  'este problema',
  'en este caso',
];

const hasDemandAnchor = (interpretation: ProblemInterpretation): boolean =>
  interpretation.extractedValues.demandRate !== undefined || interpretation.extractedValues.periodDemands !== undefined;

const hasHoldingAnchor = (interpretation: ProblemInterpretation): boolean =>
  interpretation.extractedValues.holdingCost !== undefined;

const hasBranchAnchor = (interpretation: ProblemInterpretation): boolean =>
  interpretation.branchCandidate !== undefined || interpretation.extractedValues.setupCost !== undefined;

const hasFreshAnchorSet = (interpretation: ProblemInterpretation): boolean =>
  hasDemandAnchor(interpretation) && hasHoldingAnchor(interpretation) && hasBranchAnchor(interpretation);

const anchorSignature = (interpretation: ProblemInterpretation | undefined): string | undefined => {
  if (!interpretation || !hasFreshAnchorSet(interpretation)) {
    return undefined;
  }

  return JSON.stringify({
    branchCandidate: interpretation.branchCandidate,
    demandRate: interpretation.extractedValues.demandRate,
    periodDemands: interpretation.extractedValues.periodDemands,
    holdingCost: interpretation.extractedValues.holdingCost,
    setupCost: interpretation.extractedValues.setupCost,
  });
};

const normalizeCueText = (value: string | undefined): string =>
  (value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const hasCue = (text: string, cues: string[]): boolean => cues.some((cue) => text.includes(cue));

const isSolvedPlanFollowUpQuestion = (text: string): boolean =>
  text.includes('periodo') &&
  ['repone', 'compra', 'comprar', 'cubre', 'cubrir', 'pedido'].some((cue) => text.includes(cue));

const isSameSolvedProblem = ({
  previousSignature,
  currentSignature,
}: {
  previousSignature: string | undefined;
  currentSignature: string | undefined;
}): boolean => previousSignature !== undefined && currentSignature !== undefined && previousSignature === currentSignature;

export const createFreshProblemThread = ({ nextProblemNumber }: { nextProblemNumber: number }): ProblemThreadState =>
  ProblemThreadStateSchema.parse({
    problemId: `problem-${nextProblemNumber}`,
    pendingCriticalFields: [],
    visibleDefaults: [],
  });

export const decideProblemThreadTransition = ({
  activeProblem,
  currentInterpretation,
  resetProblem,
}: {
  activeProblem?: ProblemThreadState;
  currentInterpretation: ProblemInterpretation;
  resetProblem: boolean;
}): ProblemThreadTransition => {
  if (!activeProblem) {
    return { kind: 'fresh', reason: 'initial_problem' };
  }

  if (resetProblem) {
    return { kind: 'fresh', reason: 'explicit_reset' };
  }

  if (activeProblem.pendingClarification) {
    return { kind: 'continue', reason: 'follow_up' };
  }

  const hasPriorSolution = activeProblem.lastSolverOutput !== undefined;
  const cueText = normalizeCueText(currentInterpretation.normalizedText);
  const previousSignature = anchorSignature(activeProblem.interpretation);
  const currentSignature = anchorSignature(currentInterpretation);

  if (hasPriorSolution && hasCue(cueText, EXPLICIT_NEW_PROBLEM_CUES)) {
    return { kind: 'fresh', reason: 'detected_new_problem' };
  }

  if (
    hasPriorSolution &&
    (hasCue(cueText, SOLVED_FOLLOW_UP_CUES) ||
      isSolvedPlanFollowUpQuestion(cueText) ||
      isSameSolvedProblem({ previousSignature, currentSignature }))
  ) {
    return { kind: 'continue', reason: 'resolved_follow_up' };
  }

  if (previousSignature && currentSignature && previousSignature !== currentSignature) {
    return { kind: 'fresh', reason: 'detected_new_problem' };
  }

  if (hasPriorSolution) {
    return { kind: 'fresh', reason: 'detected_new_problem' };
  }

  return { kind: 'continue', reason: 'follow_up' };
};
