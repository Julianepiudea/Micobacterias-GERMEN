# GERMEN · Micobacterias: calidad del dato e indicadores (PWA)

Aplicación web instalable para que los laboratorios de la red revisen la calidad de su **Libro de actividades TB (plantilla INS, hoja `BD_BK_CULTIVO_PM`)** y calculen sus indicadores, sin que los datos de pacientes salgan de la institución. Mismo patrón que *Calidad WHONET*: todo ocurre en el navegador y, tras la primera visita, funciona sin internet.

## Qué hace

| Pestaña | Contenido |
|---|---|
| **Calidad del dato** | 44 reglas: valores frente a las listas desplegables oficiales (exacto / tildes-espacios / mayúsculas), obligatorias, coherencia muestra↔tipo de TB, fechas (texto, ilegibles, futuras, en orden imposible, TAT atípico), cultivo (tipo, resultado, especie, informe), **cultivos sin cerrar** (>42 y >60 días a la fecha de corte), baciloscopia, molecular, PSF, controles, n.º de orden repetido y mismo paciente con sexo/edad distintos (por seudónimo). Completitud y calidad por mes. |
| **Tablero** | Indicadores operativos del tablero anterior (positividad con IC 95 %, contaminación, TAT, especies, BK vs cultivo, pirámide, municipio, EAPB) + volumen molecular y baciloscopias seriadas. |
| **Indicadores INS** | Los 27 indicadores de la hoja *INDICADORES TOTALES* del «Libro TB INDICADORES» (17 moleculares + 9.1, 4 de cultivo, 6 de baciloscopia), por trimestre y consolidado, con numerador/denominador y exportación CSV. |

## Privacidad (por diseño)

- La política de seguridad de contenido (`connect-src 'self'`, sin dominios externos) impide que la página envíe datos a cualquier servidor.
- El libro se lee en un **Web Worker** (`js/lector.worker.js`): de nombres y apellidos solo se registra *si están diligenciados*; el documento se convierte en seudónimo SHA-256 con sal aleatoria de la sesión; las observaciones no se leen. Esos valores nunca llegan a la interfaz.
- Nada se guarda en el navegador salvo los umbrales. «Cerrar datos» o cerrar la pestaña borra la memoria.
- Exportables **compartibles** (solo agregados): CSV de indicadores INS, CSV del tablero, resumen de calidad, PNG y PDF. Con «Modo compartir» las celdas de 1–4 casos se muestran como «<5».
- **Lista de corrección (uso interno)**: fila de Excel, n.º de orden, columna y valor del campo con problema. No contiene nombres ni documentos, pero no debe salir del laboratorio.

## Publicación

Igual que Calidad WHONET: se sirve por HTTPS (GitHub Pages o servidor institucional) copiando la carpeta tal cual, **sin `pruebas/` ni `herramientas/`**. En Chrome/Edge aparece «Instalar app».
Prueba local: `node herramientas/servidor.js` y abrir `http://localhost:8765`.

Al cambiar cualquier archivo, suba la versión en `sw.js` (`CACHE`) y en `js/app.js` (`APP_VERSION`).

## Estructura

| Archivo | Función |
|---|---|
| `js/catalogos.js` | Listas oficiales de la plantilla INS 2026 (listas 1, LISTAS LIBRO, EAPB) y la tabla tipo de muestra → tipo de TB. Generado, no editar a mano. |
| `js/lector.js`, `js/lector.worker.js` | Lectura del libro (xlsb/xlsx/xls), verificación de la plantilla, seudonimización. |
| `js/modelo.js` | Mapa de columnas y normalización de resultados (cultivo, BK, molecular, PSF, controles). |
| `js/calidad.js` | Reglas de control de calidad. |
| `js/indicadores.js` | Definiciones de los indicadores INS; `ajuste` documenta dónde se corrigió una fórmula del libro Excel. |
| `js/tablero.js`, `js/app.js` | Interfaz, gráficos, exportaciones, instalación y service worker. |
| `herramientas/` | `prueba_node.js` (prueba de extremo a extremo, solo agregados), `generar_sintetico.js` (libro sintético con errores sembrados), `servidor.js`. |

## Diferencias documentadas con el libro Excel de indicadores

1. **Ind. 2** — H en blanco: el Excel excluye la muestra (#N/A); aquí cuenta como «no aplica» y Calidad lo señala.
2. **Ind. 5** — la tabla auxiliar omite H «no aplica» + R «no interpretable» (típico de Xpert).
3. **Ind. 10** — el Excel solo cuenta quinolonas e inyectables *sensibles*; aquí cualquier resultado (como el 11).
4. **Ind. 12** — el numerador del Excel no se restringe a resistentes a R.
5. **Ind. 2 C** — el numerador del Excel exige un valor («NEGATIVO») que la columna auxiliar nunca toma: siempre da 0.
6. **Ind. 4 B** — el denominador del Excel son todas las filas; aquí, personas con baciloscopia.

El trimestre se asigna por la fecha de recepción (el Excel usa la columna A «TRIMESTRE», que Calidad verifica).
