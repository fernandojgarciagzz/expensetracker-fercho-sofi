# De Dos — gastos de Fercho & Sofi

## Qué es
"De Dos" — app de gastos compartidos para Fercho y Sofi. Mobile-first, dark mode por default.
(Ojo: la columna `Quien` del Sheet guarda "Fernando", no "Fercho" — la UI muestra el apodo vía `NICK`/`dispName`. Si algún día se cambia el valor guardado, hay que actualizar `data-who`, `setFilter('Fernando',...)` y migrar las filas viejas.)
Live en: https://fernandojgarciagzz.github.io/expensetracker-fercho-sofi

## Stack
- Frontend: HTML/CSS/JS vanilla, un solo archivo (index.html) + `sw.js` (service worker)
- Backend: Google Apps Script (actúa como API REST gratuita)
- DB: Google Sheet llamado "Gastos Fercho & Sofi", pestaña "Gastos"
- Hosting: GitHub Pages

## Apps Script URL
https://script.google.com/macros/s/AKfycbz2gocfUYljQRFtCeTl4uwzM8R7JWUP_nMnWoJEkXFpseVNmDQoalUqQ4ZTcWWC_dZpzw/exec
(Si se cambia el código del Apps Script, lo más limpio es editar ESTE deployment a "New version" para no cambiar la URL otra vez. Si se hace un deployment nuevo, hay que actualizar `APPS_SCRIPT_URL` en index.html con la URL nueva.)

## Google Sheet — columnas
- Pestaña "Gastos":  Timestamp | Fecha | Monto | Moneda | Tipo | Categoria | Emoji | Descripcion | Quien
- Pestaña "Ahorros": Timestamp | Fecha | Monto | Moneda | Destino | Nota | Quien   (la crea sola el Apps Script vía `getAhorrosSheet_()` la primera vez que algo la usa)

## Apps Script — endpoints
- GET `?action=getData`     → filas de "Gastos"  (default si no hay action)
- GET `?action=getAhorros`  → filas de "Ahorros"
- POST `{fecha,monto,moneda,tipo,categoria,emoji,descripcion,quien}`      → agrega un gasto
- POST `{action:'delete', timestamp}`                                     → borra un gasto
- POST `{action:'addAhorro', fecha,monto,moneda,destino,nota,quien}`      → agrega un aporte de ahorro
- POST `{action:'deleteAhorro', timestamp}`                               → borra un aporte
- (El POST es text/plain — "simple request", sin CORS preflight. Si cambias el Apps Script hay que re-deployar; si editas el deployment existente a "New version" la URL NO cambia.)

## Features implementadas
- Registro de gastos con voz (Web Speech API, es-MX)
- Dark/light mode con toggle, guardado en localStorage
- 4 vistas: Registrar / Resumen / Ahorros / Historial
- Tipos: Personal (no cuenta al budget) y Juntos (cuenta al budget semanal)
- Budget semanal: $2,000 MXN, semana lunes-domingo
- Categorías (12): Restaurantes, Súper, Transporte, Entrete., Ropa, Salud, Casa, Suscripc., Viajes, Regalos, Personal, Otros
- Filtro global en Resumen (Todos / Juntos / Personal) — arriba de los cards MXN/USD; afecta esos cards, "Por categoría" y la gráfica semanal. El budget card NO se ve afectado (siempre es Juntos)
- Gráfica de línea SVG de últimas 8 semanas (lunes-domingo); en vista Juntos dibuja la línea de referencia del budget $2,000 y marca en rojo las semanas que lo rebasaron
- Gráfica de barras SVG de últimos 6 meses, apiladas por categoría con color por categoría (al final del Resumen, también afectada por el filtro) + leyenda. Los colores (CAT_COLORS, mismo índice que CATS) se usan también en las barras de "Por categoría" para que un color signifique lo mismo en ambas gráficas. Hover (desktop) o tap (móvil) en una barra muestra un tooltip con el desglose por categoría y montos de ese mes
- Las barras de "Por categoría" y los items del Historial usan los íconos SVG del sprite (CAT_ICON_BY_LABEL, mismo iconId que CATS) en lugar de emojis, coloreados con el color de la categoría. El indicador Personal/Juntos en el Historial también es ícono SVG (ic-user / ic-users). (La columna Emoji del Sheet ya no se usa para mostrar, pero se sigue guardando.)
- El título de "Por categoría" muestra el mes actual (es la única gráfica que cubre solo el mes en curso; las otras dos cubren 8 semanas / 6 meses)
- El switch Fer/Sofi del header (es "quién registra") solo se muestra en la vista Registrar; en Resumen y Historial se oculta. El Historial tiene su propio filtro por persona (chips Todos / Fernando / Sofi) que filtra por la columna Quien
- El Historial siempre se ordena por fecha descendente (más reciente arriba); en empate del mismo día, lo registrado más recientemente va primero
- Conversión USD→MXN: gastos (y ahorros) en USD se convierten al tipo de cambio diario de su fecha (frankfurter.app, datos del ECB, sin API key) y así cuentan en las gráficas Y en el budget semanal. Los cards "MXN este mes" / "USD este mes" siguen mostrando el monto literal de cada moneda. Los tipos de cambio se cachean en localStorage ('gastos_fx'); 1 request por día como máximo. `ensureFxRates()` considera fechas USD tanto de `data` (gastos) como de `ahData` (ahorros). Fallback si el API falla: último tipo cacheado, o 18 (USD_MXN_FALLBACK)
- Borrar gastos / aportes con confirmación
- Monedas: MXN y USD por separado
- **Ahorros** (pestaña aparte, ícono `ic-coins`, totalmente separada de gastos). Orden de la vista: header → formulario "Registrar aporte" (monto + moneda + Destino [input con datalist autocompletado de destinos usados] + nota opcional + fecha + botón) → "Total ahorrado por mes" (barras 6 meses, verde) → "Total ahorrado" (hero, verde --success) + aportes este mes + conteo → "Total por destino" (barras, color por destino vía `destColor()` = hash al palette CAT_COLORS) → "Historial de aportes" (divisores de fecha + borrar; en cada fila la nota es la descripción y el destino va en el meta, ícono `ic-coins` coloreado por destino). Funciones: `loadAhorros / submitAhorro / confirmDeleteAhorro / askDeleteAh / cancelDeleteAh / renderAhorros / renderAhMonthChart / renderAhList / renderAhDestinos / ahSetCurrency / destColor`. `loadAhorros` tiene un guard: si el Apps Script no está re-deployado (devuelve filas de gastos), pinta "Falta re-deployar" en toda la pestaña.

## Offline / datos celulares
El problema original: sin service worker la app era una página web normal, y GitHub Pages solo deja
cachear index.html 10 minutos (`cache-control: max-age=600`). Cada arranque en frío tenía que bajar
todo otra vez desde 3 hosts distintos antes de pintar nada, y el `<link>` de Google Fonts bloqueaba
el primer render hasta que `fonts.googleapis.com` contestara (y ése encadenaba a `fonts.gstatic.com`
para los archivos). En wifi eso es invisible; en celular débil es pantalla en blanco.

Peso de la carga inicial, medido:

| | antes | ahora |
|---|---|---|
| index.html (gzip) | 27 KB | 27 KB |
| CSS de Google Fonts | 17 KB | — (eliminado) |
| fuentes (subset latin) | 129 KB desde gstatic | 129 KB propias, precacheadas |
| icon.png | 76 KB | 12 KB |
| **total / hosts** | **~249 KB, 3 hosts** | **~168 KB, 1 host** |

Y sobre todo: **después del primer arranque son 0 requests de red para abrir la app.**

- **`sw.js`** — cachea el app shell (`./`, `index.html`, `icon.png`, `manifest.json`, `fonts/*.woff2`)
  y lo sirve primero, actualizándolo en segundo plano (stale-while-revalidate). Los GET al Apps
  Script y a frankfurter NO se cachean (dato viejo de dinero es peor que ninguno) y los POST nunca
  se interceptan.
  **Al cambiar index.html conviene subir `VERSION` en sw.js** para que los teléfonos tiren el shell
  viejo de inmediato en vez de esperar al refresh en segundo plano.
- **Snapshot** — cada lectura buena se guarda en localStorage (`gastos_cache` / `ahorros_cache`).
  `init()` pinta desde ahí antes de tocar la red, así la app abre con números reales aunque no haya
  señal. "Sin conexión" solo sale si de verdad no hay nada que mostrar.
- **Outbox** (`gastos_outbox`) — si el POST falla (o `navigator.onLine` es false) el gasto/aporte se
  encola y se pinta de una vez con la etiqueta **POR SUBIR** (`.exp-pending`, `Timestamp` = `__p__<id>`).
  Registrar nunca falla. La cola se drena sola en `online`, al volver a primer plano
  (`visibilitychange` — en iOS la app se suspende y `online` casi nunca dispara) y al arrancar.
  Se manda en orden y se para al primer error, así nada se duplica ni se reordena.
  Funciones: `lsGet / lsSet / enqueue / pendingRow / pendingRows / flushOutbox / dropPending / fetchT`.
- Borrar una fila `__p__` la saca del outbox (`dropPending`), no le pide nada al Sheet.
- Los borrados de filas reales siguen siendo online-only (no se encolan).
- **`fetchT(url, opts, ms)`** — fetch con AbortController, **60 s** por default. En celular la falla
  típica es un socket colgado, no un error limpio; sin esto la UI se quedaba en "Guardando…".
  **No lo bajes.** Apps Script en frío tarda muchísimo (medido: 34.7 s desde una conexión por cable,
  2–5 s ya caliente, más 2–3 redirects vía googleusercontent). Con 12 s se mataban requests buenos y
  Resumen/Historial mostraban "Sin conexión" en la primera abierta del día. Y en los POST es un tema
  de correctitud: abortar un POST que el Sheet **sí** guardó lo vuelve a encolar y duplica el gasto
  al sincronizar. Una red de verdad muerta rechaza en milisegundos y nunca llega al límite.
  (frankfurter sí usa 15 s — es background best-effort y ese host a veces da 522.)
- Mientras carga sin snapshot se pinta "Cargando…", y si falla sale "No se pudo cargar" con botón
  **Reintentar** (`.retry-btn`) — antes era una pantalla vacía que parecía app rota.
- **Fuentes self-hosted** en `fonts/*.woff2` con `@font-face` inline en el `<head>` — ya no se pide
  nada a Google. Son los mismos archivos variable-font (subset latin) que servía gstatic, así que
  no cambia nada visual. Ver `fonts/README.md`; **ojo con el rango de peso** (`font-weight: 400 700`),
  si se declara un solo peso el navegador finge las negritas. `font-display: swap` + los fallbacks de
  `--font-ui/display/mono` cubren el primer frame.

## Íconos
SVG sprite inline en el HTML — no usa Lucide CDN. Todos los íconos están definidos como <symbol> en el <head>.

## "Agregar a inicio" (PWA básico)
- En iOS (Compartir → Agregar a inicio) se instala como app: ícono de billete, etiqueta "SF", abre en modo standalone (sin la barra de Safari).
- `icon.png` (512×512) es el ícono real; se generó de `icon.svg` con `qlmanage -t -s 512 -o . icon.svg` (no hay rsvg/cairosvg/IM en la máquina). Si cambias `icon.svg`, re-genera el PNG igual — **y vuélvelo a cuantizar**: qlmanage escupe RGBA de 8 bits (76 KB) para un ícono que es un degradado plano con trazos blancos. Con paleta de 128 colores baja a 12 KB sin diferencia visible (drift máximo 6/255):
  `python3 -c "from PIL import Image; Image.open('icon.png').convert('RGB').quantize(colors=128).save('icon.png', optimize=True)"`
- Tags relevantes en el `<head>`: `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title="SF"`, y `manifest.json` (para Android/Chrome). `theme_color`/`background_color` del manifest = `#0C0806` (el bg del tema oscuro, default de la app).
- Estos archivos (icon.png, manifest.json) viven en la raíz del repo porque GitHub Pages los sirve desde ahí, mismo origen que `index.html`.

## Importante al editar
- No uses librerías externas de charts (Chart.js, etc.) — las gráficas son SVG puro
- No rompas la estructura del sprite de íconos
- Si cambias columnas del Sheet, actualizar también doPost en apps-script.js
- Cada vez que cambies apps-script.js hay que hacer New Deployment en Google Apps Script (la URL cambia)
- El único API externo (aparte del Apps Script) es **api.frankfurter.dev** para tipos de cambio USD→MXN — si algún día falla o cambia, ver `ensureFxRates()` / `usdRateFor()` / `mxnAmount()`.
  (Ojo: el host viejo `api.frankfurter.app` hace 301 a `.dev` y **el redirect no trae headers CORS**, así que el navegador lo bloquea y la conversión se caía callada al fallback de 18. Si vuelve a pasar algo así, el síntoma es que los gastos en USD se ven ~4% caros y no hay error visible — solo el CORS en la consola.)
  El endpoint de rango es algo inestable (a veces 522); no importa, `ensureFxRates()` solo marca `fxCache.thru` cuando tuvo éxito, así que reintenta solo en la siguiente carga.
- `dateStr(d)` da YYYY-MM-DD en hora local — NO usar `toISOString()` para fechas de gasto (es UTC y recorre los gastos de la noche al día siguiente)
