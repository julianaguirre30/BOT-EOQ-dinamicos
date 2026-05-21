/**
 * Base de conocimiento teórico sobre modelos dinámicos de EOQ.
 * Fuente: Taha, Hamdy A. "Investigación de Operaciones", 9a edición,
 * Capítulo 13 — sección 13.4 ("Modelos dinámicos de cantidad de pedido económica").
 *
 * Esta referencia se inyecta en los system prompts del LLM. Está comprimida
 * a propósito para no exceder el límite de tokens por minuto de la API.
 */

/**
 * Cita corta de la bibliografía que el LLM debe agregar al final de cada
 * respuesta teórica.
 */
export const EOQ_BIBLIOGRAPHY_CITATION =
  'Fuente: Taha, Hamdy A. — Investigación de Operaciones, 9a ed., cap. 13 §13.4.';

export const EOQ_THEORY_REFERENCE = `
=== TEORÍA EOQ DINÁMICO (Taha §13.4) ===

CONTRA EL EOQ ESTÁTICO
• Horizonte finito dividido en n periodos iguales con revisión periódica.
• Demanda determinística pero VARIABLE entre periodos (no constante).

MRP (planeación de requerimiento de materiales)
Genera demanda dinámica derivada: partiendo de la demanda de productos finales
y los tiempos de espera de producción, se obtiene la demanda variable pero
conocida de los componentes.

DOS MODELOS PRINCIPALES
(A) Sin costo de preparación. (B) Con costo de preparación.
La diferencia parece pequeña pero cambia drásticamente la complejidad.

----- (A) MODELO SIN COSTO DE PREPARACIÓN -----
Supuestos:
1) Sin costo de preparación.  2) Sin faltantes.
3) Costo de producción unitario constante o convexo (p. ej. tiempo regular más
   barato que tiempo extra).  4) Costo de retención unitario constante.

Implicancia "sin faltantes": capacidad acumulada en 1..i ≥ demanda acumulada 1..i.

Método: se formula como modelo de TRANSPORTE.
• k·n orígenes, n destinos (k = niveles de producción por periodo).
• Costo unitario en celda (i, j) = producción en i + retención i→j.
• Las celdas hacia periodos anteriores están bloqueadas (no hay faltantes).
• Se resuelve secuencialmente por columnas, dando prioridad a las rutas más baratas
  (procedimiento de Johnson, 1957). La convexidad garantiza optimalidad.

----- (B) MODELO CON COSTO DE PREPARACIÓN -----
• Sin faltantes; Ki = costo fijo cuando zi > 0; hi = costo de retención i→i+1.
• Balance: x_{i+1} = xi + zi − Di; restricción x_{n+1} = 0.

Existen 2 algoritmos exactos (PD) y 1 heurística.

[B.1] PD GENERAL
Sirve para CUALQUIER función de costo (incluso convexa).
Recursión hacia adelante con estado x_{i+1}:
  f1(x2)       = min { C1(z1) + h1·x2 }   con z1 = D1 + x2 − x1
  fi(x_{i+1}) = min { Ci(zi) + hi·x_{i+1} + f_{i−1}(x_{i+1} + Di − zi) }, i ≥ 2
Desventaja: estado y alternativa varían en pasos de 1 → tablas grandes
si las demandas son grandes.

[B.2] WAGNER-WHITIN (1958) — caso de costos cóncavos
Costo de producción unitario y retención no crecientes (constantes o con descuento
por cantidad). Veinott Jr. flexibilizó a funciones cóncavas distintas por periodo.

Dos propiedades que reducen drásticamente la búsqueda:
1) Inventario entrante y producción nueva NO coexisten en el óptimo: zi · xi = 0.
   Si hay inventario inicial x1 > 0 se amortiza con las demandas siguientes hasta
   agotarlo.
2) zi óptimo es 0 o cubre la demanda EXACTA de uno o más periodos contiguos:
   zi ∈ { 0, Di, Di+D_{i+1}, …, Di+…+D_n }.
   El estado y la alternativa toman "sumas concentradas" en vez de pasos unitarios,
   por eso el árbol es mucho menor que la PD general.

Wagner-Whitin es EXACTO bajo sus supuestos (sin faltantes, costos cóncavos,
demanda determinística): el plan que devuelve es globalmente óptimo.

[B.3] HEURÍSTICA SILVER-MEAL
Solo aplicable con costo de producción unitario constante e idéntico en todos los
periodos. Únicamente balancea costos de preparación y retención.

Idea: en el periodo i, agrupar la demanda de los próximos t periodos en un solo
pedido, minimizando el costo medio por periodo cubierto.

  TC(i, i) = Ki
  TC(i, t) = TC(i, t−1) + (Σ_{k=i..t−1} hk) · Dt,   t > i
  TCU(i, t) = TC(i, t) / (t − i + 1)

Procedimiento: arrancar en i=1, encontrar el primer mínimo local t* de TCU(i, ·),
pedir Di + … + D_{t*} en el periodo i. Saltar a i ← t* + 1 y repetir hasta n.

Limitación: es miope, no "mira hacia adelante". Puede dar costos sensiblemente
peores que Wagner-Whitin cuando los Ki/hi son extremos.

----- COSTO RELEVANTE TOTAL -----
Suma de costos que dependen de la decisión: preparación total + retención total.
No incluye el costo de producción cuando es constante por unidad, ya que ese
componente no influye en cómo agrupar los pedidos.
`;
