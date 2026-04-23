import { ProblemExampleFixture, ProblemExampleFixtureSchema } from '../../src/contracts/eoq';

const rawFixtures = [
  {
    id: 'complete-with-setup',
    title: 'Complete standard EOQ with setup cost',
    userText:
      'La planta demanda 2400 unidades por año, cada preparación cuesta 180 pesos, mantener una unidad cuesta 12 pesos por año y el lead time es 0.5 semanas. Calculá el lote económico.',
    coverage: ['complete_solvable', 'with_setup'],
    expectedMode: 'solved',
    expectedSolvable: true,
    expectedBranch: 'with_setup',
    expectedReasons: ['standard_eoq', 'all_material_values_present'],
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
  },
  {
    id: 'criollo-no-setup',
    title: 'Criollo input that still maps to standard EOQ',
    userText:
      'Che, vendo 900 unidades al año y me sale 4 pesos por unidad por año tenerlas guardadas. El proveedor repone al toque, sin costo de preparar máquina. ¿Qué lote me conviene manejar?',
    coverage: ['colloquial_criollo', 'without_setup'],
    expectedMode: 'solved',
    expectedSolvable: true,
    expectedBranch: 'no_setup',
    expectedReasons: ['colloquial_but_supported', 'standard_replenishment'],
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
  },
  {
    id: 'criollo-fresh-session-series',
    title: 'Fresh-session criollo case with demand schedule and setup cues',
    userText:
      'Che, arranco el horizonte con 15 unidades en stock. Para los próximos meses necesito 80 en mayo, 120 en junio y 60 en julio. Cada vez que largo un pedido me cuesta 150 pesos, mantener cada unidad me sale 3 pesos por mes y me reponen al toque. Decime el lote económico.',
    coverage: ['complete_solvable', 'colloquial_criollo', 'with_setup'],
    expectedMode: 'solved',
    expectedSolvable: true,
    expectedBranch: 'with_setup',
    expectedReasons: ['fresh_session_schedule_detected', 'colloquial_setup_and_holding_cues'],
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
  },
  {
    id: 'ambiguous-branch',
    title: 'Ambiguous statement between setup and no-setup',
    userText:
      'Tengo demanda anual de 1500 unidades y un costo fijo cada vez que me organizo para reponer, pero no queda claro si es preparación interna o pedido al proveedor. ¿Cómo lo resuelvo?',
    coverage: ['ambiguous'],
    expectedMode: 'clarify',
    expectedSolvable: false,
    expectedReasons: ['branch_is_materially_ambiguous'],
    expectedClarificationReason: 'material_ambiguity',
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'standard',
        status: 'ambiguous',
        notes: ['branch between with_setup and no_setup is unresolved'],
      },
    ],
  },
  {
    id: 'inconsistent-data',
    title: 'Inconsistent data blocks solving',
    userText:
      'La demanda es 200 unidades por mes, el costo de mantener es -3 pesos por unidad por año y además el costo de pedido está expresado por semana. Decime el EOQ.',
    coverage: ['inconsistent'],
    expectedMode: 'refuse',
    expectedSolvable: false,
    expectedReasons: ['negative_holding_cost', 'incompatible_time_basis'],
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'standard',
        status: 'supported',
        notes: ['input is standard EOQ in shape but inconsistent in values'],
      },
    ],
  },
  {
    id: 'out-of-domain-shortages',
    title: 'Out-of-domain shortages case',
    userText:
      'Necesito optimizar un EOQ con faltantes permitidos y demanda probabilística para tres productos a la vez.',
    coverage: ['out_of_domain'],
    expectedMode: 'refuse',
    expectedSolvable: false,
    expectedReasons: ['shortages_not_supported', 'stochastic_multi_item_not_supported'],
    expectedClarificationReason: 'out_of_domain',
    taxonomyTags: [
      {
        family: 'inventory',
        topic: 'eoq',
        variant: 'non_mvp',
        status: 'unsupported',
        notes: ['shortages, stochastic demand and multi-item optimization are outside MVP'],
      },
    ],
  },
  {
    id: 'explicit-with-setup',
    title: 'Explicit with-setup branch example',
    userText:
      'Fabricamos internamente 5000 piezas por año. Cada puesta a punto cuesta 250 pesos, el costo de mantenimiento es 8 pesos por unidad por año y el tiempo de reposición es 0. ¿Cuál sería el EOQ?',
    coverage: ['with_setup'],
    expectedMode: 'solved',
    expectedSolvable: true,
    expectedBranch: 'with_setup',
    expectedReasons: ['internal_setup_cost_detected'],
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
  },
  {
    id: 'explicit-without-setup',
    title: 'Explicit without-setup branch example',
    userText:
      'Compramos un insumo con demanda de 3600 unidades al año, costo de mantener 6 pesos por unidad por año y reposición inmediata sin costo de preparación. Necesito el lote económico.',
    coverage: ['without_setup'],
    expectedMode: 'solved',
    expectedSolvable: true,
    expectedBranch: 'no_setup',
    expectedReasons: ['standard_replenishment_branch'],
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
  },
] as const satisfies ReadonlyArray<ProblemExampleFixture>;

export const eoqCaseFixtures = rawFixtures.map((fixture) => ProblemExampleFixtureSchema.parse(fixture));
