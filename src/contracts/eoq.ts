import { z } from 'zod';

export const ProblemBranchSchema = z.enum(['with_setup', 'no_setup']);
export type ProblemBranch = z.infer<typeof ProblemBranchSchema>;

export const SolverFamilySchema = z.enum(['exact_with_setup', 'exact_no_setup']);
export type SolverFamily = z.infer<typeof SolverFamilySchema>;

export const ResponseModeSchema = z.enum(['solved', 'clarify', 'refuse']);
export type ResponseMode = z.infer<typeof ResponseModeSchema>;

export const SelectionDecisionSchema = z.enum(['solve', 'ask', 'refuse']);
export type SelectionDecision = z.infer<typeof SelectionDecisionSchema>;

export const ClarificationReasonSchema = z.enum([
  'missing_critical',
  'material_ambiguity',
  'out_of_domain',
  'low_confidence',
]);
export type ClarificationReason = z.infer<typeof ClarificationReasonSchema>;

export const SupportedFieldValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.number().finite()),
  z.record(z.number().finite()),
]);

export const ValidationDispositionSchema = z.enum(['valid', 'clarify', 'invalid']);
export type ValidationDisposition = z.infer<typeof ValidationDispositionSchema>;

export const CanonicalVariantSchema = z.enum(['scalar', 'setup_by_period', 'unit_cost_by_period']);
export type CanonicalVariant = z.infer<typeof CanonicalVariantSchema>;

export const RefusalKindSchema = z.enum(['invalid_input', 'out_of_domain', 'unsupported_variant']);
export type RefusalKind = z.infer<typeof RefusalKindSchema>;

export const TaxonomyTagSchema = z.object({
  family: z.literal('inventory'),
  topic: z.literal('eoq'),
  variant: z.enum(['standard', 'comparison_only', 'non_mvp']),
  branch: ProblemBranchSchema.optional(),
  status: z.enum(['supported', 'unsupported', 'ambiguous']),
  notes: z.array(z.string()).default([]),
});
export type TaxonomyTag = z.infer<typeof TaxonomyTagSchema>;

export const ProblemInterpretationSchema = z.object({
  normalizedText: z.string().min(1),
  branchCandidate: ProblemBranchSchema.optional(),
  extractedValues: z.record(SupportedFieldValueSchema).default({}),
  units: z
    .object({
      demandUnit: z.string().optional(),
      timeBasis: z.string().optional(),
      currency: z.string().optional(),
    })
    .default({}),
  taxonomyTags: z.array(TaxonomyTagSchema).min(1),
  confidence: z.number().min(0).max(1),
  missingCriticalFields: z.array(z.string()).default([]),
  issues: z.array(z.string()).default([]),
});
export type ProblemInterpretation = z.infer<typeof ProblemInterpretationSchema>;

export const InterpretationRequestSchema = z.object({
  sessionId: z.string().min(1),
  userText: z.string().min(1),
});
export type InterpretationRequest = z.infer<typeof InterpretationRequestSchema>;

export const DemandScheduleSchema = z.array(z.number().nonnegative()).min(1);
export type DemandSchedule = z.infer<typeof DemandScheduleSchema>;

export const PeriodMapSchema = z.record(z.number().finite());
export type PeriodMap = z.infer<typeof PeriodMapSchema>;

const CanonicalInputBaseObjectSchema = z.object({
  branch: ProblemBranchSchema.optional(),
  variant: CanonicalVariantSchema.default('scalar'),
  demandRate: z.number().finite().optional(),
  periodDemands: z.array(z.number().finite()).min(1).optional(),
  holdingCost: z.number().finite().optional(),
  setupCost: z.number().optional(),
  setupCostByPeriod: z.array(z.number().finite()).min(1).optional(),
  unitCost: z.number().finite().optional(),
  unitCostByPeriod: z.array(z.number().finite()).min(1).optional(),
});

export const CanonicalEoqInputSchema = CanonicalInputBaseObjectSchema.superRefine((value, context) => {
  if (value.periodDemands !== undefined && value.periodDemands.every((demand) => demand === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'periodDemands must contain at least one positive period demand.',
    });
  }

  if (value.setupCostByPeriod !== undefined && value.setupCostByPeriod.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'setupCostByPeriod must contain at least one period.',
    });
  }

  if (value.unitCostByPeriod !== undefined && value.unitCostByPeriod.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'unitCostByPeriod must contain at least one period.',
    });
  }
});
export type CanonicalEoqInput = z.infer<typeof CanonicalEoqInputSchema>;

export const NormalizationResultSchema = z.object({
  canonicalInput: CanonicalEoqInputSchema,
  recognizedAliases: z.record(z.string()).default({}),
  notes: z.array(z.string()).default([]),
});
export type NormalizationResult = z.infer<typeof NormalizationResultSchema>;

const SolverInputSchemaBase = z.object({
  demandRate: z.number().positive().optional(),
  periodDemands: DemandScheduleSchema.optional(),
  holdingCost: z.number().positive(),
});

const ScalarWithSetupSolverInputSchema = SolverInputSchemaBase.extend({
  branch: z.literal('with_setup'),
  variant: z.literal('scalar'),
  setupCost: z.number().positive(),
});

const SetupByPeriodSolverInputSchema = SolverInputSchemaBase.extend({
  branch: z.literal('with_setup'),
  variant: z.literal('setup_by_period'),
  setupCostByPeriod: z.array(z.number().positive()).min(1),
});

const ScalarNoSetupSolverInputSchema = SolverInputSchemaBase.extend({
  branch: z.literal('no_setup'),
  variant: z.literal('scalar'),
  unitCost: z.number().nonnegative().optional(),
});

const UnitCostByPeriodSolverInputSchema = SolverInputSchemaBase.extend({
  branch: z.literal('no_setup'),
  variant: z.literal('unit_cost_by_period'),
  unitCostByPeriod: z.array(z.number().nonnegative()).min(1),
});

export const SolverInputSchema = z.union([
  ScalarWithSetupSolverInputSchema,
  SetupByPeriodSolverInputSchema,
  ScalarNoSetupSolverInputSchema,
  UnitCostByPeriodSolverInputSchema,
]).superRefine((value, context) => {
    if (value.demandRate === undefined && value.periodDemands === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either demandRate or periodDemands is required.',
      });
    }

    if (value.periodDemands !== undefined && value.periodDemands.every((demand) => demand === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'periodDemands must contain at least one positive period demand.',
      });
    }
  });
export type SolverInput = z.infer<typeof SolverInputSchema>;

export const ValidationResultSchema = z.object({
  ok: z.boolean(),
  disposition: ValidationDispositionSchema,
  canonicalInput: CanonicalEoqInputSchema,
  normalizedInput: SolverInputSchema.optional(),
  errors: z.array(z.string()).default([]),
  unsupportedReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  defaultsApplied: z.array(z.string()).default([]),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const ClarificationRequestSchema = z.object({
  reason: ClarificationReasonSchema,
  question: z.string().min(1),
  requiredFields: z.array(z.string()).default([]),
});
export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;

export const RefusalSchema = z.object({
  kind: RefusalKindSchema,
  reasons: z.array(z.string()).min(1),
  message: z.string().min(1),
});
export type Refusal = z.infer<typeof RefusalSchema>;

export const AlgorithmSelectionTraceSchema = z.object({
  decision: SelectionDecisionSchema,
  chosenBranch: ProblemBranchSchema.optional(),
  solverFamily: SolverFamilySchema.optional(),
  silverMealIncluded: z.boolean(),
  why: z.array(z.string()).min(1),
});
export type AlgorithmSelectionTrace = z.infer<typeof AlgorithmSelectionTraceSchema>;

export const DomainStatusSchema = z.enum(['in_domain', 'out_of_domain']);
export type DomainStatus = z.infer<typeof DomainStatusSchema>;

export const RoutingResultSchema = z.object({
  decision: SelectionDecisionSchema,
  solvable: z.boolean(),
  domainStatus: DomainStatusSchema,
  normalization: NormalizationResultSchema,
  validation: ValidationResultSchema,
  clarificationRequest: ClarificationRequestSchema.optional(),
  refusal: RefusalSchema.optional(),
  trace: AlgorithmSelectionTraceSchema,
});
export type RoutingResult = z.infer<typeof RoutingResultSchema>;

export const SolverOutputSchema = z.object({
  branch: ProblemBranchSchema,
  solverFamily: SolverFamilySchema,
  policy: z.object({
    orderQuantity: z.number().positive(),
    cycleTime: z.number().positive().optional(),
    replenishmentPlan: z
      .array(
        z.object({
          period: z.number().int().min(1),
          quantity: z.number().nonnegative(),
          coversThroughPeriod: z.number().int().min(1),
        }),
      )
      .min(1),
  }),
  computed: z.record(z.number()),
  equations: z.array(z.string()).min(1),
  mathematicalArtifacts: z.object({
    demandSchedule: DemandScheduleSchema,
    endingInventoryByPeriod: z.array(z.number()),
    orderPeriods: z.array(z.number().int().min(1)).min(1),
    costBreakdown: z.object({
      setupOrOrderingCost: z.number().min(0),
      holdingCost: z.number().min(0),
      totalRelevantCost: z.number().min(0),
    }),
  }),
  comparison: z
    .object({
      method: z.literal('silver_meal'),
      note: z.string().min(1),
      orderPeriods: z.array(z.number().int().min(1)).optional(),
      totalRelevantCost: z.number().min(0).optional(),
    })
    .optional(),
});
export type SolverOutput = z.infer<typeof SolverOutputSchema>;

export const PedagogicalArtifactsSchema = z.object({
  interpretation: z.array(z.string()).min(1),
  model: z.array(z.string()).min(1),
  algorithm: z.array(z.string()).min(1),
  result: z.array(z.string()).min(1),
  procedure: z.array(z.string()).min(1),
  justification: z.array(z.string()).min(1),
});
export type PedagogicalArtifacts = z.infer<typeof PedagogicalArtifactsSchema>;

export const FinalResponseEnvelopeSchema = z.object({
  mode: ResponseModeSchema,
  studentMessage: z.string().min(1),
  interpretation: ProblemInterpretationSchema,
  normalization: NormalizationResultSchema,
  validation: ValidationResultSchema.optional(),
  clarificationRequest: ClarificationRequestSchema.optional(),
  refusal: RefusalSchema.optional(),
  solverInput: SolverInputSchema.optional(),
  solverOutput: SolverOutputSchema.optional(),
  algorithmSelection: AlgorithmSelectionTraceSchema,
  pedagogicalArtifacts: PedagogicalArtifactsSchema,
  threadContext: z
    .object({
      phase: z.enum(['active', 'resolved_follow_up']),
      hasPriorSolution: z.boolean(),
    })
    .optional(),
  internalTrace: AlgorithmSelectionTraceSchema,
});
export type FinalResponseEnvelope = z.infer<typeof FinalResponseEnvelopeSchema>;

export const PublicResponseEnvelopeSchema = FinalResponseEnvelopeSchema.omit({
  internalTrace: true,
});
export type PublicResponseEnvelope = z.infer<typeof PublicResponseEnvelopeSchema>;

export const toPublicResponseEnvelope = (
  response: FinalResponseEnvelope,
): PublicResponseEnvelope => PublicResponseEnvelopeSchema.parse(response);

export const ProblemThreadStateSchema = z.object({
  problemId: z.string().min(1),
  interpretation: ProblemInterpretationSchema.optional(),
  normalization: NormalizationResultSchema.optional(),
  validation: ValidationResultSchema.optional(),
  pendingClarification: ClarificationRequestSchema.optional(),
  latestRefusal: RefusalSchema.optional(),
  latestSelectionTrace: AlgorithmSelectionTraceSchema.optional(),
  lastSolverInput: SolverInputSchema.optional(),
  lastSolverOutput: SolverOutputSchema.optional(),
  visibleDefaults: z.array(z.string()).default([]),
  pendingCriticalFields: z.array(z.string()).default([]),
});
export type ProblemThreadState = z.infer<typeof ProblemThreadStateSchema>;

export type ProblemThreadTransitionReason =
  | 'initial_problem'
  | 'follow_up'
  | 'resolved_follow_up'
  | 'explicit_reset'
  | 'detected_new_problem';

export type ThreadContext = {
  phase: 'active' | 'resolved_follow_up';
  hasPriorSolution: boolean;
};

export const SessionStateSchema = z.object({
  sessionId: z.string().min(1),
  activeProblemId: z.string().min(1).optional(),
  problemCount: z.number().int().min(0).default(0),
  activeProblem: ProblemThreadStateSchema.optional(),
  turnCount: z.number().int().min(0).default(0),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export const FixtureCoverageSchema = z.enum([
  'complete_solvable',
  'colloquial_criollo',
  'ambiguous',
  'inconsistent',
  'out_of_domain',
  'with_setup',
  'without_setup',
]);
export type FixtureCoverage = z.infer<typeof FixtureCoverageSchema>;

export const ProblemExampleFixtureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  userText: z.string().min(1),
  coverage: z.array(FixtureCoverageSchema).min(1),
  expectedMode: ResponseModeSchema,
  expectedSolvable: z.boolean(),
  expectedBranch: ProblemBranchSchema.optional(),
  expectedReasons: z.array(z.string()).default([]),
  expectedClarificationReason: ClarificationReasonSchema.optional(),
  taxonomyTags: z.array(TaxonomyTagSchema).min(1),
});
export type ProblemExampleFixture = z.infer<typeof ProblemExampleFixtureSchema>;

export const createEmptySessionState = (sessionId: string): SessionState =>
  SessionStateSchema.parse({
    sessionId,
    problemCount: 0,
    turnCount: 0,
  });
