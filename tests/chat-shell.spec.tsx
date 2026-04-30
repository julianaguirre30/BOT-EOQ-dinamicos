import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublicResponseEnvelopeSchema } from '../src/contracts/eoq';
import { ChatComposer, ChatFeed, ChatResponseCard, ChatEntry, buildChatTurnRequest } from '../src/ui/chat-shell';

const solvedResponse = PublicResponseEnvelopeSchema.parse({
  mode: 'solved',
  studentMessage: 'Resolví el caso con el plan completo y te dejo el desarrollo.',
  interpretation: {
    normalizedText: 'Caso EOQ',
    branchCandidate: 'with_setup',
    extractedValues: {
      periodDemands: [40, 20, 40],
      demandSchedule: [40, 20, 40],
      holdingCost: 1,
      h: 1,
      setupCost: 50,
      orderingCost: 50,
      S: 50,
      leadTime: 0,
    },
    units: { timeBasis: 'year' },
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'standard',
        branch: 'with_setup',
        status: 'supported',
        notes: [],
      },
    ],
    confidence: 0.97,
    missingCriticalFields: [],
    issues: [],
  },
  normalization: {
    canonicalInput: {
      branch: 'with_setup',
      variant: 'scalar',
      periodDemands: [40, 20, 40],
      holdingCost: 1,
      setupCost: 50,
      leadTime: 0,
    },
  },
  validation: {
    ok: true,
    disposition: 'valid',
    canonicalInput: {
      branch: 'with_setup',
      variant: 'scalar',
      periodDemands: [40, 20, 40],
      holdingCost: 1,
      setupCost: 50,
      leadTime: 0,
    },
    normalizedInput: {
      branch: 'with_setup',
      variant: 'scalar',
      periodDemands: [40, 20, 40],
      holdingCost: 1,
      setupCost: 50,
      leadTime: 0,
    },
    errors: [],
    warnings: [],
    defaultsApplied: [],
  },
  solverInput: {
    branch: 'with_setup',
    variant: 'scalar',
    periodDemands: [40, 20, 40],
    holdingCost: 1,
    setupCost: 50,
    leadTime: 0,
  },
  solverOutput: {
    branch: 'with_setup',
    solverFamily: 'exact_with_setup',
    policy: {
      orderQuantity: 60,
      replenishmentPlan: [
        { period: 1, quantity: 60, coversThroughPeriod: 2 },
        { period: 3, quantity: 40, coversThroughPeriod: 3 },
      ],
    },
    computed: { totalRelevantCost: 120 },
    equations: ['F(t) = min_j {...}'],
    mathematicalArtifacts: {
      demandSchedule: [40, 20, 40],
      endingInventoryByPeriod: [20, 0, 0],
      orderPeriods: [1, 3],
      costBreakdown: {
        setupOrOrderingCost: 100,
        holdingCost: 20,
        totalRelevantCost: 120,
      },
    },
  },
  algorithmSelection: {
    decision: 'solve',
    chosenBranch: 'with_setup',
    solverFamily: 'exact_with_setup',
    silverMealIncluded: true,
    why: ['validated_branch:with_setup'],
  },
  pedagogicalArtifacts: {
    interpretation: ['interpretación'],
    model: ['modelo'],
    algorithm: ['Se resolvió con programación dinámica exacta.'],
    result: ['Plan completo de reposición.'],
    procedure: ['procedimiento'],
    justification: ['justificación'],
  },
});

const noSetupUnitCostByPeriodResponse = PublicResponseEnvelopeSchema.parse({
  mode: 'solved',
  studentMessage: 'Resolví el caso sin setup con costos unitarios por período.',
  interpretation: {
    normalizedText: 'Caso EOQ sin setup con costo unitario por período',
    branchCandidate: 'no_setup',
    extractedValues: {
      P1: 40,
      P2: 50,
      P3: 30,
      P4: 60,
      setupCost: 0,
      productionCost: [5, 7, 4, 8],
      holdingCost: 1,
      leadTime: 0,
    },
    units: { timeBasis: 'period' },
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'standard',
        branch: 'no_setup',
        status: 'supported',
        notes: [],
      },
    ],
    confidence: 0.95,
    missingCriticalFields: [],
    issues: [],
  },
  normalization: {
    canonicalInput: {
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      periodDemands: [40, 50, 30, 60],
      unitCostByPeriod: [5, 7, 4, 8],
      holdingCost: 1,
      leadTime: 0,
      setupCost: 0,
    },
  },
  validation: {
    ok: true,
    disposition: 'valid',
    canonicalInput: {
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      periodDemands: [40, 50, 30, 60],
      unitCostByPeriod: [5, 7, 4, 8],
      holdingCost: 1,
      leadTime: 0,
      setupCost: 0,
    },
    normalizedInput: {
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      periodDemands: [40, 50, 30, 60],
      unitCostByPeriod: [5, 7, 4, 8],
      holdingCost: 1,
      leadTime: 0,
    },
    errors: [],
    unsupportedReasons: [],
    warnings: [],
    defaultsApplied: [],
  },
  solverInput: {
    branch: 'no_setup',
    variant: 'unit_cost_by_period',
    periodDemands: [40, 50, 30, 60],
    unitCostByPeriod: [5, 7, 4, 8],
    holdingCost: 1,
    leadTime: 0,
  },
  solverOutput: {
    branch: 'no_setup',
    solverFamily: 'exact_no_setup',
    policy: {
      orderQuantity: 90,
      cycleTime: 1,
      replenishmentPlan: [
        { period: 1, quantity: 90, coversThroughPeriod: 2 },
        { period: 3, quantity: 90, coversThroughPeriod: 4 },
      ],
    },
    computed: { totalRelevantCost: 920 },
    equations: ['min_i { c_i + h * (t - i) }'],
    mathematicalArtifacts: {
      demandSchedule: [40, 50, 30, 60],
      endingInventoryByPeriod: [50, 0, 60, 0],
      orderPeriods: [1, 3],
      costBreakdown: {
        setupOrOrderingCost: 810,
        holdingCost: 110,
        totalRelevantCost: 920,
      },
    },
  },
  algorithmSelection: {
    decision: 'solve',
    chosenBranch: 'no_setup',
    solverFamily: 'exact_no_setup',
    silverMealIncluded: false,
    why: ['validated_variant:unit_cost_by_period'],
  },
  pedagogicalArtifacts: {
    interpretation: ['interpretación'],
    model: ['modelo'],
    algorithm: ['Se resolvió con programación dinámica exacta sin setup con costo unitario por período.'],
    result: ['Plan completo de reposición.'],
    procedure: ['procedimiento'],
    justification: ['Sin setup y con costo unitario variable por período, la solución exacta puede agrupar compras antes.'],
  },
});

const invalidResponse = PublicResponseEnvelopeSchema.parse({
  mode: 'refuse',
  studentMessage: 'Hay datos inconsistentes o imposibles en el planteo; corregilos antes de intentar resolverlo.',
  interpretation: {
    normalizedText: 'Caso inconsistente',
    branchCandidate: 'with_setup',
    extractedValues: {
      demandRate: 200,
      holdingCost: -3,
      setupCost: 90,
      leadTime: 0,
    },
    units: { timeBasis: 'year' },
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'standard',
        branch: 'with_setup',
        status: 'supported',
        notes: [],
      },
    ],
    confidence: 0.9,
    missingCriticalFields: [],
    issues: ['negative holding cost'],
  },
  normalization: {
    canonicalInput: {
      branch: 'with_setup',
      variant: 'scalar',
      demandRate: 200,
      holdingCost: -3,
      setupCost: 90,
      leadTime: 0,
    },
  },
  validation: {
    ok: false,
    disposition: 'invalid',
    canonicalInput: {
      branch: 'with_setup',
      variant: 'scalar',
      demandRate: 200,
      holdingCost: -3,
      setupCost: 90,
      leadTime: 0,
    },
    errors: ['invalid_holding_cost'],
    unsupportedReasons: [],
    warnings: [],
    defaultsApplied: [],
  },
  refusal: {
    kind: 'invalid_input',
    reasons: ['invalid_holding_cost'],
    message: 'Hay datos inconsistentes o imposibles en el planteo; corregilos antes de intentar resolverlo.',
  },
  algorithmSelection: {
    decision: 'refuse',
    silverMealIncluded: false,
    why: ['input_inconsistency_detected', 'invalid_holding_cost'],
  },
  pedagogicalArtifacts: {
    interpretation: ['interpretación'],
    model: ['Todavía no hay un modelo matemático resoluble porque los datos validados son inconsistentes o inválidos.'],
    algorithm: ['El flujo se frenó antes del solver porque detectó inconsistencias o valores imposibles en los datos.'],
    result: ['Resultado: el caso fue rechazado antes del solver.'],
    procedure: ['procedimiento'],
    justification: ['Motivos del rechazo: el costo de mantener debe ser positivo.'],
  },
});

const outOfDomainResponse = PublicResponseEnvelopeSchema.parse({
  mode: 'refuse',
  studentMessage: 'Ese caso queda fuera del MVP: solo cubrimos EOQ determinístico estándar, de un solo ítem y sin faltantes.',
  interpretation: {
    normalizedText: 'Caso fuera de dominio',
    branchCandidate: 'with_setup',
    extractedValues: {
      demandRate: 4000,
      holdingCost: 5,
      setupCost: 75,
      shortagesAllowed: true,
    },
    units: {},
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'non_mvp',
        status: 'unsupported',
        notes: ['shortages'],
      },
    ],
    confidence: 0.94,
    missingCriticalFields: ['holdingCost', 'setupCost'],
    issues: [],
  },
  normalization: {
    canonicalInput: {
      branch: 'with_setup',
      variant: 'scalar',
      demandRate: 4000,
      holdingCost: 5,
      setupCost: 75,
      leadTime: 0,
    },
  },
  validation: {
    ok: false,
    disposition: 'valid',
    canonicalInput: {
      branch: 'with_setup',
      variant: 'scalar',
      demandRate: 4000,
      holdingCost: 5,
      setupCost: 75,
      leadTime: 0,
    },
    errors: [],
    unsupportedReasons: [],
    warnings: [],
    defaultsApplied: [],
  },
  refusal: {
    kind: 'out_of_domain',
    reasons: ['shortages', 'stochastic'],
    message: 'Ese caso queda fuera del MVP: solo cubrimos EOQ determinístico estándar, de un solo ítem y sin faltantes.',
  },
  algorithmSelection: {
    decision: 'refuse',
    silverMealIncluded: false,
    why: ['mvp_domain_gate_blocked', 'shortages'],
  },
  pedagogicalArtifacts: {
    interpretation: ['interpretación'],
    model: ['No corresponde consolidar un modelo EOQ resoluble del MVP porque el caso quedó fuera de alcance.'],
    algorithm: ['El flujo se frenó antes del solver porque el caso queda fuera del alcance del MVP.'],
    result: ['Resultado: el caso fue rechazado antes del solver.'],
    procedure: ['procedimiento'],
    justification: ['Ese caso queda fuera del MVP.'],
  },
});

const resolvedFollowUpResponse = PublicResponseEnvelopeSchema.parse({
  ...solvedResponse,
  studentMessage: 'seguimos sobre el mismo resultado ya resuelto: te respondo el seguimiento sin recalcular ni repetir toda la solución completa.',
  pedagogicalArtifacts: {
    interpretation: ['seguimiento'],
    model: ['mismo modelo resuelto'],
    algorithm: ['programación dinámica exacta'],
    result: ['No se compra en el período 8 porque el pedido del período 6 ya cubre hasta el 8.'],
    procedure: ['reutilicé la solución guardada'],
    justification: ['La demanda validada del período 8 es 10 y ya estaba cubierta en ese lote.'],
  },
  threadContext: {
    phase: 'resolved_follow_up',
    hasPriorSolution: true,
  },
});

describe('ChatResponseCard', () => {
  it('renders a student-friendly card with normalized data and the full replenishment plan', () => {
    const markup = renderToStaticMarkup(<ChatResponseCard response={solvedResponse} />);

    expect(markup).toContain('Datos detectados');
    expect(markup).toContain('Datos faltantes');
    expect(markup).toContain('Modelo identificado');
    expect(markup).toContain('Algoritmo');
    expect(markup).toContain('Resultado');
    expect(markup).toContain('Explicación');
    expect(markup).toContain('Demanda por períodos: [40, 20, 40]');
    expect(markup).toContain('Costo de mantener: 1');
    expect(markup).toContain('Costo fijo de preparación/pedido: 50');
    expect(markup).toContain('EOQ determinístico con costo fijo de preparación/pedido');
    expect(markup).toContain('Programación dinámica exacta');
    expect(markup).toContain('Plan completo: 2 pedido(s)/lote(s) en el horizonte.');
    expect(markup).toContain('Período 1: reponer 60 unidades para cubrir hasta el período 2.');
    expect(markup).toContain('Período 3: reponer 40 unidades para ese mismo período.');
    expect(markup).not.toContain('validated_branch:with_setup');
    expect(markup).not.toContain('orderingCost');
    expect(markup).not.toContain('S: 50');
  });

  it('uses public no-setup labels when unit costs by period drive early aggregated purchases', () => {
    const markup = renderToStaticMarkup(<ChatResponseCard response={noSetupUnitCostByPeriodResponse} />);

    expect(markup).toContain('Costo unitario por período: [5, 7, 4, 8]');
    expect(markup).toContain('Programación dinámica exacta sin setup con costo unitario por período');
    expect(markup).toContain('Costo de compra/producción total: 810');
    expect(markup).not.toContain('Costo fijo total: 810');
    expect(markup).not.toContain('Política exacta lote-por-lote');
  });

  it('shows invalid blocked cases as data-to-fix instead of missing-field messaging', () => {
    const markup = renderToStaticMarkup(<ChatResponseCard response={invalidResponse} />);

    expect(markup).toContain('Datos a corregir');
    expect(markup).toContain('El costo de mantener debe ser positivo.');
    expect(markup).not.toContain('Datos faltantes');
    expect(markup).not.toContain('No faltan datos críticos.');
  });

  it('shows out-of-domain blocked cases as scope issues instead of missing-field lists', () => {
    const markup = renderToStaticMarkup(<ChatResponseCard response={outOfDomainResponse} />);

    expect(markup).toContain('Alcance del caso');
    expect(markup).toContain('Ese caso queda fuera del MVP');
    expect(markup).not.toContain('<li>holdingCost</li>');
    expect(markup).not.toContain('<li>setupCost</li>');
    expect(markup).not.toContain('Datos faltantes');
  });

  it('renders resolved follow-up cards with the specific explanation instead of the generic full-plan card', () => {
    const markup = renderToStaticMarkup(<ChatResponseCard response={resolvedFollowUpResponse} />);

    expect(markup).toContain('Seguimiento del problema resuelto');
    expect(markup).toContain('No se compra en el período 8 porque el pedido del período 6 ya cubre hasta el 8.');
    expect(markup).toContain('La demanda validada del período 8 es 10 y ya estaba cubierta en ese lote.');
    expect(markup).not.toContain('Plan completo: 2 pedido(s)/lote(s) en el horizonte.');
  });
});

describe('ChatFeed', () => {
  it('renders user and assistant turns in one continuous flow with the structured card nested inside the assistant turn', () => {
    const entries: ChatEntry[] = [
      { id: 'user-1', role: 'user', text: 'Tengo demanda por períodos [40,20,40].' },
      {
        id: 'assistant-1',
        role: 'assistant',
        text: solvedResponse.studentMessage,
        payload: { sessionId: 'session-1', response: solvedResponse },
      },
    ];

    const markup = renderToStaticMarkup(<ChatFeed entries={entries} />);

    expect(markup).toContain('data-testid="chat-feed"');
    expect(markup).toContain('data-testid="chat-turn-user"');
    expect(markup).toContain('data-testid="chat-turn-assistant"');
    expect(markup).toContain('Tengo demanda por períodos [40,20,40].');
    expect(markup).toContain('Resolví el caso con el plan completo y te dejo el desarrollo.');
    expect(markup).toContain('Datos detectados');
    expect(markup).not.toContain('internalTrace');
    expect(markup).not.toContain('validated_branch:with_setup');
  });
});

describe('ChatComposer', () => {
  it('renders a sticky composer footer with session context and submit state', () => {
    const markup = renderToStaticMarkup(
      <ChatComposer
        draft="Necesito revisar el setup por período"
        sessionId="session-42"
        pendingResetProblem={true}
        error={null}
        isSubmitting={true}
        onChange={() => undefined}
        onSubmit={(event) => event.preventDefault()}
        onResetProblem={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="chat-composer"');
    expect(markup).toContain('position:sticky');
    expect(markup).toContain('bottom:0');
    expect(markup).toContain('Sesión activa: session-42');
    expect(markup).toContain('Nuevo problema');
    expect(markup).toContain('El próximo envío va a arrancar un problema nuevo');
    expect(markup).toContain('Pensando...');
  });

  it('builds the next request with resetProblem while preserving the active session id', () => {
    expect(buildChatTurnRequest({
      sessionId: 'session-42',
      userText: 'Quiero arrancar otro caso',
      pendingResetProblem: true,
    })).toEqual({
      sessionId: 'session-42',
      userText: 'Quiero arrancar otro caso',
      resetProblem: true,
    });

    expect(buildChatTurnRequest({
      sessionId: 'session-42',
      userText: 'Solo sigo el mismo ejercicio',
      pendingResetProblem: false,
    })).toEqual({
      sessionId: 'session-42',
      userText: 'Solo sigo el mismo ejercicio',
    });
  });
});
