# factory-tools — dos herramientas HTTP para Hermes

Dos rutas con token en el servidor del factory (`server.js`) para que Hermes, el
agente de ventas de Boykot —que vive en otro repo y en otro hosting—, pueda
pedir una **imagen de referencia** (x.ai `grok-imagine-image`, guardada en R2) y
una **búsqueda técnica en la web** (x.ai `grok-4-1-fast` + `web_search`). El
código y el porqué de cada decisión están en `factory-tools.js`.

## Variables de entorno

| variable | qué es |
|---|---|
| `FACTORY_TOOLS_TOKEN` | el bearer que Hermes manda en `Authorization`. **Sin esta variable las tres rutas responden 503**: se prefiere apagado a abierto. |
| `GROK_KEY` | clave de x.ai (la misma que ya usa el resto del servidor). Sin ella, `imagen` y `buscar` responden 503 sin salir a la red; `health` sigue vivo. |
| `R2_UPLOAD_TOKEN` | token del worker `maarmapa-media` para subir la imagen. Si falta, la imagen se devuelve con la URL de x.ai y `durable:false`. |
| `FACTORY_TOOLS_DAILY_IMAGES` | tope diario global de imágenes (UTC). Por defecto `30`. **`0` apaga las imágenes** (429 `daily_cap` con `cap:0`): es la forma de cortar el gasto sin redesplegar. Un valor no numérico cae a 30 y lo avisa en el log. |
| `FACTORY_TOOLS_DAILY_SEARCHES` | tope diario global de búsquedas (UTC). Por defecto `200`; `0` las apaga. Existe porque cualquier remitente de WhatsApp puede provocar una búsqueda y cada una cuesta tokens. |

Los valores se configuran en el hosting; nunca van en el repo.

## Endpoints

Todos exigen `Authorization: Bearer <token>`. Cuerpo y respuesta en JSON; el
cuerpo se lee recién después del token y tiene tope de 32 KB.

### `POST /tools/imagen`

```bash
curl -s -X POST https://<host>/tools/imagen \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Set de acuarelas profesionales sobre mesa de madera","formato":"cuadrado"}'
```

- `prompt`: 10 a 600 caracteres. Se le agrega un sufijo fijo (render de
  referencia para tienda de materiales de arte; sin texto, logos, marcas de
  agua ni personas) y la relación de aspecto.
- `formato` (opcional): `cuadrado` (1:1, por defecto), `vertical` (9:16) u
  `horizontal` (16:9).
- Respuesta: `{ ok:true, url, durable, model:"grok-imagine-image", ms }`.
  `durable:true` es una URL de R2; `durable:false` viene con `nota` y es la
  URL de x.ai, que caduca. Una imagen de más de 8 MB no se sube a R2 (misma
  respuesta con `durable:false`). La URL que devuelve x.ai debe ser https con
  host con nombre; cualquier otra cosa se trata como `upstream_error` y no se
  descarga.
- Presupuesto de tiempo: 30 s x.ai + 8 s descarga + 8 s subida. Hermes espera
  50 s por una imagen, así que el factory siempre termina antes de que Hermes
  se rinda; si no fuera así, la imagen se cobraría y nadie la recibiría.
- Límite: 10 por hora por IP, y el tope diario global. La IP es la que
  agrega el proxy del hosting (último elemento de `X-Forwarded-For`), no la
  que escribe el cliente.

### `POST /tools/buscar`

```bash
curl -s -X POST https://<host>/tools/buscar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"consulta":"¿Qué tinta usa el marcador Copic Ciao y con qué recarga es compatible?"}'
```

- `consulta`: 3 a 300 caracteres. Responde en el idioma de la consulta.
- Respuesta: `{ ok:true, texto (máx 2000 chars), fuentes:[urls únicas], model:"grok-4-1-fast", ms }`.
- Solo `web_search`, sin `x_search`: para fichas técnicas X/Twitter es ruido.
- Límite: 30 por 15 minutos por IP, y el tope diario global (`FACTORY_TOOLS_DAILY_SEARCHES`). `fuentes` trae como máximo 20 URLs.

### `GET /tools/health`

```bash
curl -s https://<host>/tools/health -H "Authorization: Bearer <token>"
```

Responde `{ ok:true, images_today, cap }`. Sirve para saber cuánto cupo queda
antes de pedir una imagen.

## Códigos de error

| status | `error` | cuándo |
|---|---|---|
| 503 | `tools_disabled` | no hay `FACTORY_TOOLS_TOKEN` configurado (todas las rutas), o falta `GROK_KEY` (solo `imagen` y `buscar`; `detail` lo dice) |
| 401 | `unauthorized` | token ausente o distinto |
| 400 | `bad_request` | validación del cuerpo, JSON inválido o cuerpo mayor a 32 KB; `detail` dice qué |
| 429 | `daily_cap` | se superó el tope diario de imágenes; trae `cap` (`cap:0` = imágenes apagadas) |
| 429 | `rate_limited` | demasiadas llamadas desde una IP; trae `Retry-After` |
| 502 | `upstream_error` | x.ai falló, no respondió a tiempo o devolvió algo sin URL usable; `detail` acotado a 200 chars |

## Qué NO hace

- **No guarda historial**: cada llamada es independiente; si Hermes necesita
  recordar una imagen o una respuesta, la guarda él.
- **No autentica al usuario final**: el token identifica a Hermes como
  servicio, no al cliente que le está hablando. Lo que Hermes le pase como
  prompt o consulta es responsabilidad de Hermes.
- **El tope diario es por proceso y en memoria**: se reinicia al cambiar el
  día UTC y en cada deploy o reinicio. Si el servidor corre en más de una
  instancia, cada una tiene su contador.
- **No loguea contenido**: los logs llevan método, ruta, status, milisegundos
  y longitudes; nunca el prompt, la consulta ni URLs con query string.
- Las imágenes subidas a R2 (`hermes_<timestamp>.jpg`) **no aparecen en el
  `?list=true` del worker**, que filtra por `.mp4`; se ven desde el panel de R2.

## Probar sin red

```bash
npm run test:tools
```

Los tests levantan el router en un puerto efímero con dobles de `fetch` para
x.ai y R2: no necesitan credenciales ni salida a internet.
