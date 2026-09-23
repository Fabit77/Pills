# Pills Creator Studio

Creator Studio para diseñar, publicar y medir coleccionables digitales vinculados a experiencias y eventos.

## Desarrollo local

```bash
npm install
npm run dev
```

## Arquitectura

- **Pills:** Creator Studio para marcas, artistas, clubes y productores.
- **Pillsfans:** experiencia pública para descubrir y coleccionar Pills.
- **Supabase:** autenticación, organizaciones, campañas, colecciones y biblioteca de fans.
- **Stellar:** prueba verificable de emisión y propiedad.

El prototipo actual funciona con estado local. La integración con Supabase y Stellar se implementará en la siguiente etapa.

## Autenticación y datos

El acceso al Creator Studio usa códigos temporales por correo y Google mediante Supabase Auth. La ruta `/studio` está protegida por sesión, `/login` funciona como landing pública y `/onboarding` exige un nombre de usuario antes de crear una Pill.

1. Instala o conecta Supabase al proyecto de Vercel.
2. Copia `.env.example` a `.env.local` para desarrollo local.
3. En Supabase Auth, configura el Site URL de producción y agrega estos Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://pills-nu.vercel.app/auth/callback`
4. Aplica `supabase/migrations/20260923010000_initial_creator_studio.sql`.
5. Aplica `supabase/migrations/20260923020000_usernames_and_onboarding.sql`.
6. En **Authentication → Emails → Magic Link**, usa `{{ .Token }}` en la plantilla para enviar el código de seis dígitos.
7. En **Authentication → Sign In / Providers → Google**, habilita Google y configura las credenciales OAuth.

El proveedor de correo incorporado de Supabase permite solo dos mensajes por hora. Antes de producción, conecta SMTP propio en **Authentication → SMTP Settings** y aumenta el límite de correos en **Authentication → Rate Limits**. La plantilla lista para copiar está en `supabase/templates/magic-link.html`.

Las migraciones separan los datos privados del perfil de la identidad pública. El correo permanece exclusivamente en Supabase Auth; `public_usernames` expone solo el nombre de usuario. Las políticas RLS impiden crear campañas o colecciones sin completar ese nombre.
