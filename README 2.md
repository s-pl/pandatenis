# Area Privada Panda Tenis

Aplicacion privada para gestionar la escuela Panda Tenis con Next.js, Vercel y Supabase.

## Incluye

- Dashboard con alumnos, objetivo, ingresos, asistencia, clases particulares y alertas.
- Alumnos con ficha completa, familiares, salud, consentimiento, observaciones e historial.
- Asistencia, progreso deportivo, informes trimestrales, pagos, recibos y clases particulares.
- Medalla Aventura, galeria por alumno, inscripciones de escuela/campus, leads y metricas de origen.
- WhatsApp Cloud API mediante Supabase Edge Functions.
- Mapa visual de grupos y calendario de actividades con recordatorios.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. La app requiere Supabase configurado; sin `.env.local`
muestra una pantalla de conexion y no carga datos demo ni usa localStorage.

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena los valores. WhatsApp se envía contra
la WhatsApp Business Cloud API oficial de Meta — necesitas un número aprobado en
Meta Business Manager, un system user token con permiso `whatsapp_business_messaging`
y el App Secret para validar la firma del webhook.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
META_WHATSAPP_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_API_VERSION=v20.0
```

Después, en Meta Business Manager configura el webhook apuntando a
`https://<dominio>/api/whatsapp/inbound` con el mismo `META_WEBHOOK_VERIFY_TOKEN`
y suscribe los campos `messages` y `message_template_status_update`.

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta la migracion `supabase/migrations/20260518180000_initial_private_area.sql`.
3. Crea usuarios en Supabase Auth y asigna `role` en `profiles`: `admin` o `profesor`.
4. Crea o actualiza el usuario admin inicial:

```bash
ADMIN_EMAIL=admin@pandatenis.com npm run seed:admin
```

Si no defines `ADMIN_PASSWORD`, el script genera una contrasena segura y la imprime una sola vez.

5. Despliega las Edge Functions:

```bash
supabase functions deploy send-receipt-whatsapp
supabase functions deploy send-campaign-whatsapp
supabase functions deploy send-media-whatsapp
supabase functions deploy send-event-reminder
```

6. Configura secretos:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set WHATSAPP_ACCESS_TOKEN=...
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
supabase secrets set WHATSAPP_DEFAULT_LOCALE=es_ES
```

## Vercel

1. Importa el repositorio en Vercel.
2. Anade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Publica la app en `app.pandatenis.com`.
4. En WordPress/Elementor, anade un enlace discreto a `Area privada` apuntando a ese subdominio.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
