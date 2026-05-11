# Expense Tracker — Fer & Sofi

## Qué es
App de gastos compartidos para Fernando y Sofi. Mobile-first, dark mode por default.
Live en: https://fernandojgarciagzz.github.io/expensetracker-fercho-sofi

## Stack
- Frontend: HTML/CSS/JS vanilla, un solo archivo (index.html)
- Backend: Google Apps Script (actúa como API REST gratuita)
- DB: Google Sheet llamado "Gastos Fercho & Sofi", pestaña "Gastos"
- Hosting: GitHub Pages

## Apps Script URL
https://script.google.com/macros/s/AKfycbxKqVelLnlv4IzXxine6VwZKIYVzl-h1OlPtwECsOU1Ct7t6r4CkE8M4kj7f058ePWDvw/exec

## Google Sheet — columnas
Timestamp | Fecha | Monto | Moneda | Tipo | Categoria | Emoji | Descripcion | Quien

## Features implementadas
- Registro de gastos con voz (Web Speech API, es-MX)
- Dark/light mode con toggle, guardado en localStorage
- 3 vistas: Registrar / Resumen / Historial
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
- Conversión USD→MXN: gastos en USD se convierten al tipo de cambio diario de su fecha (frankfurter.app, datos del ECB, sin API key) y así cuentan en las gráficas Y en el budget semanal. Los cards "MXN este mes" / "USD este mes" siguen mostrando el monto literal de cada moneda. Los tipos de cambio se cachean en localStorage ('gastos_fx'); 1 request por día como máximo. Si no hay USD nunca se llama el API. Fallback si el API falla: último tipo cacheado, o 18 (USD_MXN_FALLBACK)
- Borrar gastos con confirmación
- Monedas: MXN y USD por separado

## Íconos
SVG sprite inline en el HTML — no usa Lucide CDN. Todos los íconos están definidos como <symbol> en el <head>.

## Importante al editar
- No uses librerías externas de charts (Chart.js, etc.) — las gráficas son SVG puro
- No rompas la estructura del sprite de íconos
- Si cambias columnas del Sheet, actualizar también doPost en apps-script.js
- Cada vez que cambies apps-script.js hay que hacer New Deployment en Google Apps Script (la URL cambia)
- El único API externo (aparte del Apps Script) es frankfurter.app para tipos de cambio USD→MXN — si algún día falla o cambia, ver `ensureFxRates()` / `usdRateFor()` / `mxnAmount()`
- `dateStr(d)` da YYYY-MM-DD en hora local — NO usar `toISOString()` para fechas de gasto (es UTC y recorre los gastos de la noche al día siguiente)
