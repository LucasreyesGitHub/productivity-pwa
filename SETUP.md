# Guía de instalación — Mi Espacio PWA

## 1. Crear proyecto en Supabase (5 minutos)

1. Ir a **https://supabase.com** → crear cuenta gratuita
2. **New Project** → elegir nombre y región (South America si está disponible)
3. En el panel ir a **SQL Editor** y ejecutar este script:

```sql
-- Habilitar UUID
create extension if not exists "pgcrypto";

-- Tabla tareas
create table tasks (
  id uuid primary key,
  user_id uuid references auth.users not null,
  text text not null,
  priority text default 'med',
  done boolean default false,
  position int default 0,
  created_at timestamptz default now()
);

-- Tabla eventos del calendario
create table events (
  id uuid primary key,
  user_id uuid references auth.users not null,
  date text not null,
  label text not null
);

-- Tabla ideas
create table ideas (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  desc text default '',
  tag text default 'otro',
  created_at timestamptz default now()
);

-- Seguridad: cada usuario solo ve sus datos (Row Level Security)
alter table tasks  enable row level security;
alter table events enable row level security;
alter table ideas  enable row level security;

create policy "tasks_own"  on tasks  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events_own" on events using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ideas_own"  on ideas  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table ideas;
```

4. Ir a **Project Settings → API** y copiar:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public key** → la clave larga que empieza con `eyJ...`

## 2. Configurar la app

Abrir `js/config.js` y reemplazar:
```javascript
const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';  // ← tu URL
const SUPABASE_ANON_KEY = 'TU_ANON_PUBLIC_KEY';             // ← tu clave
```

## 3. Publicar la app (hosting gratuito)

### Opción A — Netlify (recomendado, más fácil)
1. Ir a **https://netlify.com** → crear cuenta gratuita
2. Arrastrar la carpeta del proyecto al panel de Netlify
3. Te da una URL tipo `https://tu-app.netlify.app`
4. ¡Listo!

### Opción B — GitHub Pages
1. Subir el proyecto a tu repo de GitHub
2. Settings → Pages → Branch: main → / (root)
3. URL: `https://tu-usuario.github.io/tu-repo`

## 4. Instalar como app en el celular (Android)

1. Abrir la URL en **Chrome para Android**
2. Menú (⋮) → **"Agregar a pantalla de inicio"**
3. Se instala como app nativa sin app store ✅

## 5. Instalar en PC

1. Abrir la URL en **Chrome o Edge**
2. Click en el ícono de instalación en la barra de direcciones (o menú → Instalar app)
3. Se instala como app de escritorio ✅

## Seguridad implementada

- ✅ Autenticación con email/contraseña via Supabase Auth
- ✅ Contraseñas hasheadas (bcrypt) — nunca se guardan en texto plano
- ✅ Row Level Security (RLS): cada usuario solo puede ver/editar sus propios datos
- ✅ HTTPS obligatorio en producción
- ✅ Tokens JWT con refresh automático
- ✅ Prevención de XSS con escapeHTML en todos los inputs
- ✅ Variables de entorno en config.js (la anon key es pública por diseño de Supabase)
- ✅ Funciona offline — los datos se guardan localmente y sincronizan al reconectar
