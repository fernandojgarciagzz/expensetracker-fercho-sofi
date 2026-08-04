# Fuentes self-hosted

Estos son los mismos archivos variable-font (subset `latin`) que Google Fonts servía
antes desde `fonts.gstatic.com`. Se guardan aquí para que la app cargue de un solo
host y el service worker los pueda cachear — ver la sección "Offline / datos
celulares" en CLAUDE.md.

| archivo | familia | pesos | origen |
|---|---|---|---|
| `fraunces.woff2`       | Fraunces       | 400–700 (variable, con eje `opsz` 9–144) | Google Fonts v38 |
| `sora.woff2`           | Sora           | 300–700 (variable) | Google Fonts v17 |
| `jetbrains-mono.woff2` | JetBrains Mono | 400–700 (variable) | Google Fonts v24 |

Las tres están bajo la **SIL Open Font License 1.1**, que permite redistribuirlas
junto con el proyecto:

- Fraunces — https://github.com/undercasetype/Fraunces
- Sora — https://github.com/soraSans/SoraSans
- JetBrains Mono — https://github.com/JetBrains/JetBrainsMono

## Si hay que actualizarlas
Pedir el CSS a Google con un User-Agent de Safari/iOS (para que devuelva woff2),
sacar la URL del bloque `/* latin */` de cada familia y bajar ese archivo. Ojo: son
fuentes variables, así que Google declara varios `@font-face` (uno por peso) que
apuntan **al mismo archivo** — en `index.html` eso se colapsa a un solo `@font-face`
por familia con rango de peso (`font-weight: 400 700`). Si se declara un solo peso,
el navegador finge los demás (faux bold) y la tipografía se ve mal.
