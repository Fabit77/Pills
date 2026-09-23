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

El acceso al Creator Studio usa enlaces mágicos de Supabase Auth. La ruta `/studio` está protegida por sesión y `/login` funciona como landing pública.

1. Instala o conecta Supabase al proyecto de Vercel.
2. Copia `.env.example` a `.env.local` para desarrollo local.
3. En Supabase Auth, configura el Site URL de producción y agrega estos Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://pills-nu.vercel.app/auth/callback`
4. Aplica `supabase/migrations/20260923010000_initial_creator_studio.sql`.

La migración crea perfiles, organizaciones, roles, colecciones, campañas y políticas RLS para que cada equipo acceda únicamente a sus datos.
