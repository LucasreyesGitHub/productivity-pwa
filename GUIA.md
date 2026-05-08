# Mi Espacio — Guía de uso

## URL de la app
**https://productivity-pwa.vercel.app**

Cada persona se registra con su propio email y ve únicamente sus datos.

---

## Instalar en el celular

**Android (Chrome)**
1. Abrí la URL en Chrome
2. Menú `⋮` → "Agregar a pantalla de inicio"

**iPhone (Safari)**
1. Abrí la URL en Safari
2. Botón compartir `⬆` → "Agregar a pantalla de inicio"

Queda como ícono en el home, abre sin barra del navegador.

---

## Instalar en la computadora como app

**Chrome o Edge**
1. Abrí la URL
2. Ícono `⊕` en la barra de direcciones → "Instalar"
   — o —
   Menú `⋮` → "Instalar Mi Espacio"

Aparece en el menú inicio y abre sin navegador.

---

## Límites de Supabase (plan gratis)

| Límite | Plan gratis |
|--------|-------------|
| Usuarios activos (MAU) | 50.000/mes |
| Base de datos | 500 MB |
| Requests API | Sin límite |
| Conexiones simultáneas | 200 |

**Importante:** el proyecto se pausa automáticamente si no hay actividad por **7 días**.
Cuando eso pasa, la app no responde hasta que se reactive desde el dashboard de Supabase.

- Para evitarlo: usarla al menos una vez por semana alcanza.
- Plan Pro ($25/mes): no pausa. Solo vale la pena si hay usuarios que dependan de ella constantemente.

---

## Seguridad

### Qué protege la app

**Row Level Security (RLS) en Supabase**
Cada usuario solo puede ver, crear, modificar y eliminar sus propios datos. Aunque alguien obtuviera la clave pública de la API, no puede acceder a los datos de otra persona. Configurado en las tablas `tasks`, `events` e `ideas` con la política `user_id = auth.uid()` en todas las operaciones.

**Autenticación**
Login y registro manejados por Supabase Auth. Las contraseñas nunca se guardan en texto plano — Supabase las hashea internamente. La sesión se guarda localmente y se renueva automáticamente.

**Protección contra ataques web**
- XSS: todo el contenido del usuario se escapa antes de mostrarse en pantalla.
- Clickjacking: la app no puede ser embebida en iframes de otros sitios (`X-Frame-Options: DENY`).
- Importación maliciosa: los archivos JSON importados se validan campo por campo antes de guardarse.

### Qué es la clave pública de la API

La clave `sb_publishable_...` que aparece en el código es pública por diseño (como las claves de Firebase o Stripe). No da acceso a los datos — eso lo controla el RLS. La clave secreta del servidor nunca está en el código.

### Lo que no cubre

- Si alguien tiene acceso físico al dispositivo desbloqueado, puede ver los datos en pantalla.
- La app no tiene doble factor de autenticación (2FA). Si alguien obtiene tu contraseña, puede entrar.

---

## Stack técnico

- Frontend: HTML / CSS / JavaScript vanilla
- Base de datos y auth: Supabase
- Hosting: Vercel
- Repo: https://github.com/LucasreyesGitHub/productivity-pwa
