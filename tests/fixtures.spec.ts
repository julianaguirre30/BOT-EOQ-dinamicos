import { describe, expect, it } from 'vitest';

import { FixtureCoverage, FixtureCoverageSchema, ProblemExampleFixtureSchema } from '../src/contracts/eoq';
import { eoqCaseFixtures } from './fixtures/eoq-cases';

describe('EOQ fixture dataset', () => {
  it('matches the fixture contract for every example', () => {
    for (const fixture of eoqCaseFixtures) {
      expect(ProblemExampleFixtureSchema.parse(fixture)).toEqual(fixture);
    }
  });

  it('covers the minimum mandatory fixture categories', () => {
    const requiredCoverage = FixtureCoverageSchema.options as FixtureCoverage[];
    const presentCoverage = new Set(eoqCaseFixtures.flatMap((fixture) => fixture.coverage));

    for (const coverage of requiredCoverage) {
      expect(presentCoverage.has(coverage)).toBe(true);
    }
  });

  it('represents ambiguous, inconsistent, and out-of-domain cases as non-solvable', () => {
    const protectedIds = ['ambiguous-branch', 'inconsistent-data', 'out-of-domain-shortages'];

    for (const id of protectedIds) {
      const fixture = eoqCaseFixtures.find((candidate) => candidate.id === id);

      expect(fixture).toBeDefined();
      expect(fixture?.expectedSolvable).toBe(false);
      expect(fixture?.expectedMode).not.toBe('solved');
    }
  });
});
