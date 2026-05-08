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

## Stack técnico

- Frontend: HTML / CSS / JavaScript vanilla
- Base de datos y auth: Supabase
- Hosting: Vercel
- Repo: https://github.com/LucasreyesGitHub/productivity-pwa
