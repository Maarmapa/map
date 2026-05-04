# /webpost-openrouter - Cómo Usar

## ¿Qué es?

Un comando limpio para generar posts de Instagram desde artículos/noticias:

```
/webpost Chile tech startups
```

**Sin Grok. Sin DeepSeek. Puro OpenRouter + Brave.**

---

## ¿Cómo funciona?

```
Tu comando: /webpost Chile tech startups
    ↓
[1] Busca 5 artículos con Brave API (0 tokens)
    ↓
[2] Genera post con OpenRouter Llama 2 (~200 tokens, ~4 segundos)
    ↓
[3] Crea video con Runway ML (async, no bloquea)
    ↓
Resultado: Post formateado para Telegram con fuentes y contador de tokens
```

---

## Output

```
📱 *WebPost: Chile tech startups*

✍️ *Post:*
🚀 The Chile tech startups space is heating up! 

Key insights:
• Innovation is accelerating at an unprecedented pace
• Early adopters are already seeing significant returns
• Infrastructure improvements are removing barriers to entry

The question isn't whether this matters—it's when you'll jump in. 

What's your take? 💭

📚 *Sources:*
1. [Chile tech startups - Latest Developments](https://example.com/...)
2. [Market Analysis: Chile tech startups Trends 2026](https://example.com/...)

📊 *Token Usage:*
OpenRouter: 215 tokens
⏱️  Generated in 4.5s

🎬 Video: Generating (ID: runway_123abc)
```

---

## Tokens

- **Búsqueda:** 0 tokens (Brave API es gratis)
- **Post:** ~200-250 tokens (Llama 2 es económico)
- **Video:** Sin costo de tokens (Runway es async)
- **Total:** ~200-250 tokens por comando

**Comparación:**
- `/post` (original): ~350 tokens
- `/webpost-carousel`: ~300 tokens
- `/webpost-openrouter`: **~200 tokens** ← **Más económico** ✅

---

## Integración

### Paso 1: Copiar módulo

```bash
# Ya está en /tmp/map/
# Solo asegúrate que esté en el mismo directorio que bot.js
cp webpost-openrouter-module.js /tu/ruta/del/bot/
```

### Paso 2: Agregar a bot.js

Al principio del archivo:

```javascript
const WebPostOpenRouter = require('./webpost-openrouter-module.js');
const webpostOpenRouter = new WebPostOpenRouter();
```

### Paso 3: Agregar manejador de comando

En el listener de mensajes, busca `if (msg.text?.startsWith('/'))` y agrega:

```javascript
// /webpost command
if (msg.text?.startsWith('/webpost ')) {
  const query = msg.text.replace('/webpost ', '').trim();

  if (!query || query.length === 0) {
    await bot.sendMessage(chatId, '📱 Uso: /webpost <tema>\n\nEjemplo: /webpost Chile tech startups');
    return;
  }

  const loadingMsg = await bot.sendMessage(chatId, '🔍 Buscando...');

  try {
    const result = await webpostOpenRouter.run(query);

    if (!result.success) throw new Error(result.error);

    const formatted = webpostOpenRouter.formatForTelegram(result);
    
    try {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (e) {}

    await bot.sendMessage(chatId, formatted, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}
```

(Ver `BOT_WEBPOST_OPENROUTER_SNIPPET.js` para el código completo)

### Paso 4: Variables de entorno

En tu `.env` o Render config:

```bash
BRAVE_SEARCH_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
RUNWAY_API_KEY=...  # opcional
```

### Paso 5: Deploy

```bash
git add .
git commit -m "Add /webpost-openrouter command"
git push
# Render se redeploy automáticamente
```

---

## Ejemplos de uso

```
/webpost Chile tech startups
→ Post sobre startups tech en Chile

/webpost AI regulation trends
→ Post sobre tendencias de regulación en IA

/webpost Web3 adoption enterprise
→ Post sobre adopción de Web3 en empresas

/webpost crypto market analysis 2026
→ Post sobre análisis del mercado cripto
```

---

## Modelos disponibles

**Llama 2 (recomendado, actual):**
- Precio: ~$0.07 por post
- Velocidad: ~4-5 segundos
- Calidad: Buena para redes sociales

**Alternativas:**
- Mixtral 8x7B: Mejor calidad, más caro
- Llama 3 8B: Más barato, más rápido

Para cambiar, edita `webpost-openrouter-module.js`:
```javascript
model: 'mistralai/mixtral-8x7b-instruct',  // o meta-llama/llama-3-8b
```

---

## Solución de problemas

### "BRAVE_SEARCH_API_KEY not set"
- El bot usa búsqueda simulada (igual funciona, pero con artículos genéricos)
- Para búsqueda real: https://api.search.brave.com

### "OPENROUTER_API_KEY not set"
- El comando falla completamente
- Necesitas esta clave para OpenRouter: https://openrouter.ai

### "Timeout"
- OpenRouter puede estar ocupado
- Intenta de nuevo en unos segundos

### Video no genera
- Runway puede estar rate-limited
- El comando igual devuelve el post (video es no-bloqueante)

---

## Comparación con otros comandos

| Comando | Búsqueda | Modelo | Tokens | Video | Uso |
|---------|----------|--------|--------|-------|-----|
| `/post` | No | Grok | ~350 | ✅ | Contenido original |
| `/webpost` | Brave ✅ | OpenRouter | ~200 ✅ | ✅ | **Noticias curadas** |
| `/webpost-carousel` | Web | OpenRouter | ~300 | ✅ | Carousel visual |
| `/webpost-openrouter` | Brave ✅ | OpenRouter | ~200 ✅ | ✅ | **Aquí estás** |

---

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `webpost-openrouter-module.js` | Implementación principal (340 líneas) |
| `BOT_WEBPOST_OPENROUTER_SNIPPET.js` | Código copy-paste para bot.js |
| `WEBPOST_OPENROUTER_INTEGRATION.md` | Guía completa (en inglés) |
| `WEBPOST_OPENROUTER_READY.md` | Checklist de deployment |
| `WEBPOST_OPENROUTER_DEMO.js` | Demo con ejemplos |

---

## Testing

### Sin API keys (modo mock)
```javascript
const webpost = new WebPostOpenRouter();
webpost.run('Chile tech').then(result => {
  console.log(webpost.formatForTelegram(result));
});
```

### Con APIs reales
1. Seta env vars
2. Corre el bot: `npm start`
3. Envía: `/webpost tu tema`
4. En ~5 segundos recibes el post

---

## Demo

```bash
cd /tmp/map
node WEBPOST_OPENROUTER_DEMO.js
```

Muestra el formato exacto que verás en Telegram.

---

## ¿Preguntas?

- Falta la búsqueda Brave? Check: `BRAVE_SEARCH_API_KEY` en `.env`
- OpenRouter no funciona? Check: `OPENROUTER_API_KEY` en `.env`
- Módulo no encontrado? Run: `npm install axios`

---

**Status:** ✅ Listo para producción

**Próximo paso:** Copy → Paste → Deploy
