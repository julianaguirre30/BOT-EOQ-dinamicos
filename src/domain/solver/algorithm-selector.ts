import { AlgorithmSelectionTrace, RoutingResult, SolverInput, SolverOutput } from '../../contracts/eoq';
import { solveExactNoSetup, solveExactWithSetup } from './exact-solvers';

export type DeterministicSolverSelection = {
  algorithmSelection: AlgorithmSelectionTrace;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
};

const requireSolvableInput = (routingResult: RoutingResult): SolverInput => {
  if (routingResult.decision !== 'solve' || !routingResult.solvable) {
    throw new Error('Routing result is not solvable; deterministic solver selection is blocked.');
  }

  if (!routingResult.validation.normalizedInput) {
    throw new Error('Routing result is missing normalized solver input.');
  }

  return routingResult.validation.normalizedInput;
};

export const selectAndRunDeterministicSolver = (
  routingResult: RoutingResult,
): DeterministicSolverSelection => {
  const solverInput = requireSolvableInput(routingResult);
  const solverOutput =
    solverInput.branch === 'with_setup'
      ? solveExactWithSetup(solverInput)
      : solveExactNoSetup(solverInput);

  return {
    algorithmSelection: {
      ...routingResult.trace,
      solverFamily: solverOutput.solverFamily,
      silverMealIncluded: solverOutput.comparison !== undefined,
    },
    solverInput,
    solverOutput,
  };
};
