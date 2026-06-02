# Twilio WhatsApp — guía de puesta en marcha

Este proyecto envía mensajes de WhatsApp directamente desde el servidor Next.js usando Twilio, sin Edge Functions ni servicios intermedios.

## 1. Crear cuenta y proyecto Twilio

1. Regístrate en [https://www.twilio.com](https://www.twilio.com).
2. Crea un **Project** (Twilio los llama también "Account").
3. Copia el `Account SID` y el `Auth Token` del Dashboard.

## 2. WhatsApp Sender (número remitente)

Tienes dos opciones según el momento:

**Para probar hoy mismo (Sandbox)**
1. Ve a *Messaging → Try it out → Send a WhatsApp message*.
2. Anota el número del sandbox (`+1 415 523 8886`) y el código de "join" que te asignan.
3. Envía desde tu móvil personal el código por WhatsApp a ese número (algo como `join red-elephant`).
4. Eso activa tu número para recibir mensajes del sandbox.
5. Para activar a una familia, esa familia tiene que hacer también el "join". Pásale el código por WhatsApp manual.

**Para producción**
1. Ve a *Messaging → Senders → WhatsApp senders*.
2. Pulsa **Create new sender** y completa el alta de tu número (suele tardar 1-3 días).
3. Twilio se encarga del proceso con Meta por ti, normalmente más rápido que pedirlo directo.

## 3. Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu-auth-token

# Sandbox:
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# Producción:
# TWILIO_WHATSAPP_FROM=whatsapp:+34xxxxxxxxx
```

Reinicia `npm run dev` después de modificar `.env.local`.

## 4. Plantillas (Content Templates)

WhatsApp obliga a usar plantillas pre-aprobadas para iniciar conversaciones fuera de la ventana de 24h tras el último mensaje del usuario.

1. En Twilio Console, ve a *Content → Templates → New*.
2. Elige el tipo `Text` (o `Media` si vas a mandar fotos).
3. Escribe el cuerpo con variables `{{1}}`, `{{2}}`, etc.
4. Envíalo a aprobación. Suele tardar de horas a 1-2 días.
5. Cuando esté aprobado, copia el `Content SID` (empieza por `HX...`).

En el panel:
1. Ve a `/admin/whatsapp → Plantillas → Crear plantilla`.
2. Pega el `Content SID` en el campo **Twilio Content SID**.
3. Marca la casilla "Aprobada en Twilio" sólo cuando esté efectivamente aprobada.

## 5. Comportamiento en runtime

- **Modo automático del wizard** → llama a Twilio en serie controlada (4 envíos concurrentes) y actualiza cada mensaje a `sent` o `failed` según la respuesta.
- **Cobro de pago** → si hay una plantilla aprobada con categoría `recibo`, se envía automáticamente al marcar el recibo como pagado.
- **Compartir foto/vídeo** → desde la galería, usa la plantilla con categoría `galeria` si está aprobada; en su defecto envía texto libre con la URL firmada de Supabase Storage.
- **Modo manual del wizard** → no usa Twilio, abre `wa.me` con el texto pre-escrito.
- **Reintentar mensajes fallidos** → desde la bandeja, vuelve a llamar a Twilio con la misma plantilla y variables.

## 6. Tarifas aproximadas (España)

- Tarifa Twilio: ~$0.005 por mensaje.
- Tarifa WhatsApp (conversación iniciada por la empresa): ~$0.04 por conversación.
- Una "conversación" cubre 24h: si la familia te responde y le contestas en menos de 24h, no se cuenta como nueva conversación.

## 7. Plantillas sugeridas para Panda Tenis

Categoría `recibo`:

```
Hola {{1}}, te confirmamos el recibo {{2}} por {{3}}€. ¡Gracias por confiar en Panda Tenis!
```

Categoría `promocion`:

```
Hola {{1}}, abrimos plazas para el próximo trimestre. Avísanos si quieres reservar la de {{2}}.
```

Categoría `inscripcion`:

```
Hola {{1}}, ya está abierta la inscripción al {{2}}. Aquí tienes el enlace: {{3}}
```

Categoría `evento`:

```
Hola {{1}}, te recordamos el {{2}}. ¡Nos vemos en la pista!
```

Categoría `galeria`:

```
Hola {{1}}, te mandamos una foto de {{2}} en la clase. ¡Esperamos que os guste!
```
