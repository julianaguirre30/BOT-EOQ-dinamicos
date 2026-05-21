/**
 * Base de conocimiento teórico sobre modelos dinámicos de EOQ.
 * Fuente: Taha, Hamdy A. "Investigación de Operaciones", 9a edición,
 * Capítulo 13 — sección 13.4 ("Modelos dinámicos de cantidad de pedido económica").
 *
 * Este texto se inyecta en los system prompts del LLM para que pueda
 * responder preguntas teóricas/conceptuales sin inventar contenido.
 */

/**
 * Cita corta de la bibliografía que el LLM debe agregar al final de cada
 * respuesta teórica. Se mantiene como una sola línea de texto plano.
 */
export const EOQ_BIBLIOGRAPHY_CITATION =
  'Fuente: Taha, Hamdy A. — Investigación de Operaciones, 9a ed., cap. 13 §13.4.';
export const EOQ_THEORY_REFERENCE = `
=== BASE TEÓRICA — EOQ DINÁMICO (Taha §13.4) ===

[1] DIFERENCIA CON LOS MODELOS ESTÁTICOS (§13.3)
Los modelos dinámicos de EOQ se diferencian de los estáticos en dos aspectos:
  1. El nivel de inventario se revisa periódicamente a lo largo de un número finito de periodos iguales.
  2. La demanda por periodo, aun siendo determinística, es dinámica: varía de un periodo al siguiente.

[2] MRP (PLANEACIÓN DE REQUERIMIENTO DE MATERIALES)
Una situación típica donde aparece la demanda determinística dinámica es la MRP.
  • Se parte de la demanda de productos finales (por ejemplo modelos M1 y M2 con demanda trimestral).
  • Conociendo los tiempos de espera de producción, se calcula cuándo deben iniciarse los lotes.
  • A partir de las relaciones "padre-componente" (por ejemplo, 1 unidad de M1 usa 2 de un subensamble S),
    se obtiene la demanda derivada (variable pero conocida) del componente.
  • Esa demanda variable es la entrada típica para un EOQ dinámico.

[3] DOS MODELOS PRINCIPALES
La sección 13.4 presenta dos modelos. La diferencia "pequeña" tiene gran impacto en la complejidad:
  (a) EOQ dinámico SIN costo de preparación (§13.4.1).
  (b) EOQ dinámico CON costo de preparación (§13.4.2).

=========================================================
[A] MODELO SIN COSTO DE PREPARACIÓN (§13.4.1)
=========================================================

Supuestos:
  1. No se incurre en costo de preparación en ningún periodo.
  2. No se permite que haya faltantes.
  3. La función de costo de producción unitario en cualquier periodo es constante o convexa
     (costos marginales crecientes, p. ej. tiempo regular más barato que tiempo extra).
  4. El costo de retención unitario en cualquier periodo es constante.

Implicancias de "sin faltantes":
  • La capacidad acumulada de producción de los periodos 1..i debe ser ≥ demanda acumulada 1..i.
  • Si no se cumple, el problema es infactible.

Método de solución (modelo de transporte):
  • Se formula como un problema de transporte con k·n orígenes y n destinos,
    donde k = número de niveles de producción (p. ej. k=2 con tiempo regular y tiempo extra).
  • Capacidad de cada origen = capacidad del nivel de producción en ese periodo.
  • Demanda de cada destino = demanda del periodo.
  • Costo unitario de "transporte" desde origen i al destino j = costo de producción unitario
    en i + costo de retención acumulado desde i hasta j.
  • Las celdas que van de un periodo posterior a uno anterior están bloqueadas (no hay faltantes).
  • Si la oferta total > demanda total, se agrega un destino ficticio (excedente) con costo 0.

Procedimiento secuencial de Johnson (1957) para resolverlo sin la técnica del transporte:
  1. Se trabaja columna por columna (de izquierda a derecha, periodo 1 al n).
  2. En cada columna se satisface la demanda priorizando las rutas (origen → destino) más económicas.
  3. Por la convexidad de los costos, este procedimiento secuencial es óptimo.

Ejemplo 13.4-1 (MetalCo, deflectores de chiflones):
  • 4 periodos, dos niveles (tiempo regular $6/u, tiempo extra $9/u), retención $0,10/u/mes.
  • Costo total óptimo: $4 685.

=========================================================
[B] MODELO CON COSTO DE PREPARACIÓN (§13.4.2)
=========================================================

Características:
  • No se permiten faltantes.
  • Se incurre en un costo fijo de preparación Ki cada vez que se inicia un nuevo lote en el periodo i.
  • Hay un costo de retención unitario hi por mantener inventario del periodo i al i+1.

Notación:
  • zi  = cantidad pedida en el periodo i.
  • Di  = demanda del periodo i.
  • xi  = inventario al inicio del periodo i.
  • Ki  = costo de preparación del periodo i.
  • hi  = costo de retención unitario del periodo i al i+1.
  • Función de costo de producción: Ci(zi) = 0 si zi=0; Ki + ci(zi) si zi>0.
  • Balance de inventario: x_{i+1} = xi + zi − Di.
  • Frontera: x_{n+1} = 0 (no sobra al final del horizonte).

Se presentan dos algoritmos exactos (programación dinámica) y una heurística.

------------------------------
[B.1] ALGORITMO DE PD GENERAL
------------------------------
Sirve para cualquier función de costo (incluso costos marginales crecientes/convexos).
  • Estado en la etapa i: xi+1 = inventario al final del periodo.
  • Rango del estado: 0 ≤ xi+1 ≤ D_{i+1} + … + D_n (no tiene sentido cargar más inventario
    del necesario para cubrir lo que falta).
  • Recursión hacia adelante:
        f1(x2) = min_{z1 = D1 + x2 − x1} { C1(z1) + h1·x2 }
        fi(x_{i+1}) = min_{0 ≤ zi ≤ Di + x_{i+1}} { Ci(zi) + hi·x_{i+1} + f_{i−1}(x_{i+1} + Di − zi) }, i = 2..n
  • Para el periodo 1, z1 está forzado (z1 = D1 + x2 − x1).
  • Para i > 1, zi puede ser 0 porque la demanda se puede cubrir con producción previa.
  • Desventaja: si las demandas son grandes, las tablas se vuelven enormes
    (xi y zi se mueven en incrementos de 1).

Ejemplo 13.4-2 (3 periodos, demandas 3, 2, 4; setup 3, 7, 6; retención 1, 3, 2; x1 = 1):
  • Solución óptima: z1*=2, z2*=3, z3*=3.
  • Costo total: $99.

----------------------------------------------------------
[B.2] ALGORITMO DE WAGNER-WHITIN (1958, costos cóncavos)
----------------------------------------------------------
Caso especial: el costo de producción unitario y el costo de retención unitario son
funciones no crecientes (cóncavas) de la cantidad de producción y del nivel de inventario.
Cubre el caso de costos constantes y el de descuentos por cantidad.

Resultados clave que reducen drásticamente los cálculos:
  1. Inventario entrante e producción nueva no coexisten: zi · xi = 0 en el óptimo.
     • Si hay inventario inicial x1 > 0, se amortiza con las demandas siguientes hasta agotarlo.
  2. La cantidad óptima zi es 0 o satisface la demanda EXACTA de uno o más periodos
     subsiguientes contiguos. Es decir, zi ∈ {0, Di, Di+D_{i+1}, …, Di+…+D_n}.
  3. Esto significa que el "estado" y la "alternativa" toman sumas concentradas en lugar de
     pasos unitarios; el árbol de búsqueda es mucho más chico que en la PD general.

Generalización de Veinott Jr.: la suposición de funciones de costo idénticas por periodo
se puede flexibilizar a funciones cóncavas distintas por periodo.

Ejemplo 13.4-3 (4 periodos, x1 = 15; producción $2/u; retención $1/u/periodo;
                setup 98, 114, 185, 70; demandas 76, 26, 90, 67):
  • Demanda neta del periodo 1: 76 − 15 = 61.
  • Solución óptima: z1*=61, z2*=116, z3*=0, z4*=67.
  • Costo total: $860.

--------------------------------------------------
[B.3] HEURÍSTICA SILVER-MEAL
--------------------------------------------------
Aplicable solo cuando el costo de producción unitario es constante e idéntico en todos los
periodos. Por eso solo balancea costos de preparación y retención (no produce costos
de producción comparables al óptimo de PD).

Idea: agrupar la demanda de los próximos t periodos en un único pedido al periodo i,
minimizando el costo medio por periodo.

Definiciones:
  • TC(i, t) = costo de preparación + retención al producir en i para los periodos i..t.
        TC(i, i) = Ki
        TC(i, t) = TC(i, t−1) + (Σ_{k=i..t-1} hk) · Dt,  para t > i.
  • TCU(i, t) = TC(i, t) / (t − i + 1)  (costo por periodo cubierto).

Procedimiento:
  Paso 0. i = 1.
  Paso 1. Encontrar el mínimo local t* tal que
              TCU(i, t*−1) ≥ TCU(i, t*)  y  TCU(i, t*+1) ≥ TCU(i, t*).
          Pedir (Di + D_{i+1} + … + D_{t*}) en el periodo i para cubrir i..t*.
  Paso 2. i ← t* + 1. Si i > n, terminar. Si no, volver al paso 1.

Limitaciones:
  • Es miope: no "mira hacia adelante" en busca de mejores agrupaciones globales.
  • En el ejemplo 13.4-4 da costo $122 contra $92 de Wagner-Whitin (≈32% peor)
    debido a costos de preparación extremos en periodos 5 y 6.
  • Solo se justifica cuando la PD es demasiado costosa.

=========================================================
[C] PREGUNTAS FRECUENTES (RESPUESTAS RÁPIDAS)
=========================================================

¿Para qué sirve el modelo EOQ dinámico?
  Para planificar lotes de producción/compra cuando la demanda es conocida pero varía periodo
  a periodo, minimizando la suma de costos de preparación y de retención de inventario.

¿Qué datos necesito?
  • Horizonte de planeación: cantidad n de periodos.
  • Demanda Di de cada periodo (no negativa).
  • Costo de retención hi por unidad por periodo.
  • Si hay costo fijo de pedido: el setup Ki (puede variar por periodo).
  • Eventualmente: capacidad por nivel de producción e inventario inicial x1.

¿Cuándo conviene Wagner-Whitin y no el EOQ clásico?
  El EOQ clásico asume demanda constante. Si la demanda varía periodo a periodo,
  el EOQ clásico produce planes subóptimos. Wagner-Whitin garantiza el óptimo bajo
  demanda dinámica determinística y costos cóncavos.

¿Qué es el "costo relevante total"?
  Es la suma de los costos que dependen de la decisión: costo total de preparación
  + costo total de retención. No incluye el costo de producción por unidad cuando este
  es constante (porque entonces no afecta la elección del plan, solo lo hace el agrupar pedidos).

¿Por qué a veces conviene pedir más que la demanda del periodo?
  Porque agrupar la demanda de varios periodos en un solo lote ahorra preparaciones (K),
  aun pagando retención (h) sobre las unidades que se guardan. Wagner-Whitin encuentra
  el punto donde ese trade-off se minimiza.

¿Qué pasa si no hay costo fijo de pedido?
  Conviene pedir "lote a lote": producir en cada periodo exactamente Di, ya que retener
  inventario solo agrega costo sin ahorrar ningún setup. Si hay límites de capacidad
  por nivel, se usa el modelo de transporte de §13.4.1.

¿El modelo funciona si la demanda es 0 en algún periodo?
  Sí. Un periodo con Di = 0 simplemente no impone demanda nueva; puede recibir inventario
  arrastrado o no producir nada.

¿Cómo sé si el plan calculado es el óptimo?
  Wagner-Whitin es un algoritmo exacto de programación dinámica: bajo sus supuestos
  (sin faltantes, costos cóncavos, demanda determinística), la solución que devuelve
  es globalmente óptima. La heurística Silver-Meal NO garantiza optimalidad.
`;
