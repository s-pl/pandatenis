# Panda Tenis

Web pública y panel privado de Panda Tenis construido con Next.js, Vercel, Supabase y Meta WhatsApp Cloud API.

## Incluye

- Web pública con escuela, campamentos, torneos, quiénes somos, privacidad e inscripción.
- Panel privado para alumnos, grupos, asistencia, pagos, recibos, informes, galería, leads, inscripciones y calendario.
- WhatsApp con bandeja inbound, plantillas aprobadas de Meta, cola de reintentos y envíos masivos desde CSV/TSV.
- Supabase Auth, RLS, Storage privado para media de alumnos y seeder de admin.

## Desarrollo Local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. La app necesita Supabase configurado para usar el panel y guardar inscripciones reales.

## Variables De Entorno

Copia `.env.example` a `.env.local` y rellena valores reales.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
META_WHATSAPP_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=v20.0
```

En Meta Business Manager configura el webhook en `https://<dominio>/api/whatsapp/inbound`, usa el mismo `META_WEBHOOK_VERIFY_TOKEN` y suscribe `messages`.

## Supabase

1. Crea un proyecto Supabase.
2. Aplica todas las migraciones de `supabase/migrations` en orden.
3. Configura las variables de Vercel/Supabase.
4. Crea o repara el usuario admin:

```bash
ADMIN_EMAIL=admin@pandatenis.com ADMIN_PASSWORD='pon-una-segura' npm run seed:admin
```

Si no defines `ADMIN_PASSWORD`, el script genera una contraseña segura y la imprime una sola vez.

## WhatsApp

- El webhook inbound es público, pero valida firma HMAC con `META_APP_SECRET`.
- La cola de reintentos se procesa con:

```bash
curl -X POST https://<dominio>/api/admin/whatsapp/process-queue \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

Programa ese endpoint como Vercel Cron o cron externo cada pocos minutos.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm run smoke
```

`npm run smoke` espera que haya un servidor levantado en `http://127.0.0.1:3000` o que definas `SMOKE_BASE_URL`.
