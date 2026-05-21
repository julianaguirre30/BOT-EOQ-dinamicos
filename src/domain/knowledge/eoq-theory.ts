/**
 * Base de conocimiento teórico sobre modelos dinámicos de EOQ.
 * Fuente: Taha, Hamdy A. "Investigación de Operaciones", 9a edición,
 * Capítulo 13 — sección 13.4 ("Modelos dinámicos de cantidad de pedido económica").
 *
 * Esta referencia se inyecta en los system prompts del LLM. Está comprimida
 * a propósito para no exceder el límite de tokens por minuto de la API.
 *
 * Importante: no se usan etiquetas internas tipo "[A]" o "[B.1]" porque
 * tienden a filtrarse en las respuestas del modelo.
 */

/**
 * Cita corta de la bibliografía que el LLM debe agregar al final de cada
 * respuesta teórica.
 */
export const EOQ_BIBLIOGRAPHY_CITATION =
  'Fuente: Taha, Hamdy A. — Investigación de Operaciones, 9a ed.';

export const EOQ_THEORY_REFERENCE = `
TEORÍA EOQ DINÁMICO

DIFERENCIA CON EL EOQ ESTÁTICO
- Horizonte finito dividido en n periodos iguales con revisión periódica.
- Demanda determinística pero VARIABLE entre periodos (no constante).

MRP (planeación de requerimiento de materiales)
Genera demanda dinámica derivada: partiendo de la demanda de productos finales
y los tiempos de espera de producción, se obtiene la demanda variable pero
conocida de los componentes.

DOS MODELOS PRINCIPALES
Sin costo de preparación, y con costo de preparación. La diferencia parece
pequeña pero cambia drásticamente la complejidad.

MODELO SIN COSTO DE PREPARACIÓN
Supuestos:
- Sin costo de preparación.
- Sin faltantes.
- Costo de producción unitario constante o convexo (p. ej. tiempo regular más
  barato que tiempo extra).
- Costo de retención unitario constante.

Implicancia "sin faltantes": capacidad acumulada en 1..i mayor o igual a la
demanda acumulada 1..i.

**Caso simple (un solo nivel de producción, costo unitario constante):**
si NO hay costo de preparación y el costo de retención h es positivo, el
óptimo es **lote a lote**: pedir en cada periodo exactamente su demanda
D_i. Cualquier inventario almacenado solo genera costo de retención sin
ahorrar setups (no hay setups). Concentrar todo al inicio es peor, no
mejor: paga retención por toda la demanda futura. Costo relevante total =
0 si h = 0, o suma de holding de los periodos que quedan con stock si
agrupás (cero si vas lote a lote).

**Caso general (múltiples niveles de producción con costos distintos):**
se formula como modelo de TRANSPORTE.
- k·n orígenes y n destinos (k = niveles de producción por periodo).
- Costo unitario en cada celda = producción en el origen + retención hasta el
  destino.
- Las celdas hacia periodos anteriores están bloqueadas (no hay faltantes).
- Se resuelve secuencialmente por columnas, dando prioridad a las rutas más
  baratas (procedimiento de Johnson, 1957). La convexidad garantiza optimalidad.

MODELO CON COSTO DE PREPARACIÓN
- Sin faltantes; K_i es el costo fijo cuando z_i > 0; h_i es el costo de
  retención de i a i+1.
- Balance de inventario: x_{i+1} = x_i + z_i − D_i; restricción x_{n+1} = 0.

Hay dos algoritmos exactos (programación dinámica) y una heurística.

Algoritmo de PD GENERAL
Sirve para cualquier función de costo (incluso convexa).
Recursión hacia adelante con estado x_{i+1}:
  f_1(x_2)       = min { C_1(z_1) + h_1·x_2 }  con z_1 = D_1 + x_2 − x_1
  f_i(x_{i+1}) = min { C_i(z_i) + h_i·x_{i+1} + f_{i−1}(x_{i+1} + D_i − z_i) }
Desventaja: el estado y la alternativa varían en pasos de 1, así que las tablas
crecen mucho cuando las demandas son grandes.

Algoritmo de WAGNER-WHITIN (caso de costos cóncavos)
Costo de producción unitario y retención no crecientes (constantes o con
descuento por cantidad). Veinott Jr. flexibilizó la propuesta a funciones
cóncavas distintas por periodo.

Dos propiedades clave reducen muchísimo la búsqueda:
- Inventario entrante y producción nueva NO coexisten en el óptimo:
  z_i · x_i = 0. Si hay inventario inicial x_1 > 0, se amortiza con las
  demandas siguientes hasta agotarlo.
- z_i óptimo es 0 o cubre la demanda EXACTA de uno o más periodos contiguos:
  z_i ∈ { 0, D_i, D_i+D_{i+1}, …, D_i+…+D_n }.
  El estado y la alternativa toman "sumas concentradas" en lugar de pasos
  unitarios, por eso el árbol es mucho menor que en la PD general.

Wagner-Whitin es **EXACTO** bajo sus supuestos (sin faltantes, costos cóncavos,
demanda determinística): el plan que devuelve es globalmente óptimo.

Heurística SILVER-MEAL
Solo aplicable con costo de producción unitario constante e idéntico en todos
los periodos. Únicamente balancea costos de preparación y retención.

Idea: en el periodo i, agrupar la demanda de los próximos t periodos en un
solo pedido, minimizando el costo medio por periodo cubierto.

  TC(i, i) = K_i
  TC(i, t) = TC(i, t−1) + (suma de h_k para k=i..t−1) · D_t,  con t > i
  TCU(i, t) = TC(i, t) / (t − i + 1)

Procedimiento: arrancar en i=1, encontrar el primer mínimo local t* de
TCU(i, ·), pedir D_i + … + D_{t*} en el periodo i. Saltar a i = t*+1 y repetir
hasta n.

Limitación: es miope, no "mira hacia adelante". Puede dar costos sensiblemente
peores que Wagner-Whitin cuando los K_i / h_i son extremos.

COSTO RELEVANTE TOTAL
Suma de costos que dependen de la decisión: preparación total + retención
total. No incluye el costo de producción cuando es constante por unidad, ya
que ese componente no influye en cómo agrupar los pedidos.
`;
