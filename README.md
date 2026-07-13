# Ministerio de Alabanza "Nuestro Hogar"

Aplicación web (PWA) para gestionar el ministerio de alabanza: calendario de ensayos y cultos,
repertorio de canciones, confirmación de asistencia, archivos (partituras, audios, PDF),
anuncios, estadísticas e integrantes.

- **Stack:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + React Router
  + React Hook Form + Zod + Lucide + Recharts + PWA (`vite-plugin-pwa`).
- **Diseño:** modo oscuro por defecto, paleta negro / gris oscuro / blanco con acento morado `#590776`.
  Barra lateral en escritorio y navegación inferior en móvil.
- **Idioma:** toda la interfaz está en español.
- **Roles:** `admin` (control total) y `musician` (integrante).

---

## 1. Requisitos

| Herramienta | Versión mínima | Comprobación |
|---|---|---|
| Node.js | 18 (probado en **22.22.2**) | `node -v` |
| npm | 9 (probado en **10.9.7**) | `npm -v` |
| Cuenta de Supabase | — | <https://supabase.com> |
| Supabase CLI *(solo para Edge Functions)* | 1.180+ | `supabase --version` |

---

## 2. Instalación

```bash
npm install
cp .env.example .env      # y completa los valores del paso 4
npm run dev               # http://localhost:5173
```

> Si la app arranca sin variables de entorno, **no falla en blanco**: muestra una pantalla
> de configuración que indica exactamente qué variables faltan.

---

## 3. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> → **New project**.
2. Elige un nombre (p. ej. `ministerio-nuestro-hogar`), una contraseña de base de datos y una región cercana.
3. Espera a que el proyecto termine de aprovisionarse.

---

## 4. Variables de entorno

En **Supabase → Project Settings → API** copia los dos valores y ponlos en tu `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

> ⚠️ **Nunca** pongas la `service_role key` en `.env`, en el frontend ni en el repositorio.
> Esa clave solo vive como secreto del servidor (Edge Functions) y la plataforma la inyecta sola.

---

## 5. Base de datos — ejecutar el SQL **en este orden**

Abre **Supabase → SQL Editor** y ejecuta el contenido de cada archivo, **uno por uno y en este orden exacto**.
Todos los scripts son idempotentes (se pueden volver a ejecutar sin romper nada).

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `supabase/schema.sql` | Enums, 10 tablas, restricciones e índices. |
| 2 | `supabase/functions.sql` | `is_admin()`, `is_active()`, trigger de alta de usuarios, `updated_at`, RPCs de estadísticas y el trigger que **impide que un músico se auto-ascienda a admin**. |
| 3 | `supabase/rls.sql` | Activa RLS y crea todas las políticas de acceso. |
| 4 | `supabase/storage.sql` | Crea los buckets `avatars` (público) y `ministry-files` (privado) con sus políticas. |
| 5 | `supabase/seed.sql` | Datos iniciales: ajustes del ministerio + catálogo de 12 instrumentos. **No crea usuarios ni datos falsos.** |
| 6 | `supabase/users.sql` | Promueve a **administrador** la cuenta de Gustavo (ver paso 6). |

> El orden importa: `rls.sql` depende de las funciones creadas en `functions.sql`, y `functions.sql`
> depende de las tablas de `schema.sql`.

---

## 6. Crear el usuario administrador (Gustavo)

`users.sql` **no inventa un correo**. Primero hay que crear la cuenta y luego promoverla:

1. **Supabase → Authentication → Users → Add user**.
2. Escribe el correo real de Gustavo y una contraseña temporal.
   Marca **Auto Confirm User** para que pueda entrar sin verificar el correo.
   *(El trigger `handle_new_user()` crea automáticamente su fila en `profiles`.)*
3. Abre `supabase/users.sql` y **reemplaza el marcador** por ese mismo correo:

   ```sql
   admin_email text := 'REEMPLAZAR_POR_CORREO_DE_GUSTAVO';  -- ← cámbialo
   ```

4. Ejecuta `users.sql` en el SQL Editor.
   El script **lanza un error explícito** si olvidaste reemplazar el marcador o si ese correo
   todavía no existe en `auth.users` (es decir, si te saltaste el paso 1).

A partir de ahí, Gustavo puede crear al resto de integrantes desde la propia app
(**Integrantes → Nuevo integrante**), que usa la Edge Function del paso 7.

---

## 7. Edge Functions (Deno)

Dos funciones del servidor. Son **obligatorias** para crear/eliminar integrantes desde la app,
porque esas operaciones exigen la `service_role key`, que jamás puede estar en el navegador.

| Función | Para qué sirve |
|---|---|
| `admin-users` | Crear y eliminar usuarios de Auth. Verifica el JWT de quien llama y **exige rol admin** antes de usar privilegios elevados. Protege al último administrador y no deja que te borres a ti mismo. |
| `send-notification` | Envía anuncios por email / WhatsApp / push y registra **cada intento** en `notification_logs`. |

### Desplegar

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF     # Settings → General → Reference ID
supabase functions deploy admin-users
supabase functions deploy send-notification
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase
automáticamente: **no** hay que declararlas como secretos.

### Secretos opcionales (envíos reales)

```bash
# Email (Resend)
supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_FROM_EMAIL="Nuestro Hogar <no-reply@tudominio.com>"

# WhatsApp (Meta Cloud API)
supabase secrets set WHATSAPP_TOKEN=xxx WHATSAPP_PHONE_ID=xxx
```

---

## 8. Estado real de las notificaciones (léelo)

Esto **no está simulado ni fingido**, pero depende de credenciales externas:

- **Email** y **WhatsApp**: el código de integración está **completo** (Resend y WhatsApp Cloud API).
  Envían de verdad **en cuanto configures los secretos** del paso 7.
- Si un canal **no tiene credenciales**, la función **no finge un envío exitoso**: registra el intento
  con `status = 'failed'` y el motivo exacto en la columna `error`, visible en el historial de la
  pantalla **Anuncios**.
- **Push**: **pendiente**. Requiere que la app registre tokens de dispositivo (Web Push / FCM) y una
  tabla `push_subscriptions`, que todavía no existen. Hoy se registra como `failed` con ese motivo.
  Los anuncios **sí** se ven dentro de la app aunque el push no esté activo.

---

## 9. Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build       # tsc -b && vite build  → dist/
npm run preview     # sirve dist/ localmente
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

**Verificación ejecutada en este proyecto (los cuatro pasan sin errores ni advertencias):**

| Comando | Resultado |
|---|---|
| `npm install` | ✅ 610 paquetes, **0 vulnerabilidades** |
| `npm run typecheck` | ✅ 0 errores |
| `npm run lint` | ✅ 0 problemas |
| `npm run build` | ✅ compila, genera `sw.js` y 18 entradas de precaché |

---

## 10. Despliegue

La app es un SPA: hay que redirigir todas las rutas a `index.html` o fallará al recargar
una URL como `/calendario`.

**Vercel** — crea `vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**Netlify** — crea `public/_redirects`:

```
/*  /index.html  200
```

En ambos casos: *build command* `npm run build`, *output directory* `dist`, y define
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las variables del panel.

---

## 11. Estructura

```
src/
  components/     Layout, guards, buscador global, estados vacíos/error, ui/ (shadcn)
  contexts/       AuthContext (sesión, perfil, isAdmin)
  features/       EventDialog, EventDetail (asistencia + setlist)
  hooks/          useToast, useAsync, useDebounce
  lib/            cliente supabase, utilidades
  pages/          Dashboard, Calendario, Repertorio, Archivos, Anuncios, Perfil,
                  Integrantes, Instrumentos, Asistencia, Estadísticas, Configuración
  services/       CRUD real contra Supabase (sin datos falsos)
  types/          tipos e interfaces compartidas
supabase/
  schema.sql functions.sql rls.sql storage.sql seed.sql users.sql
  functions/      admin-users/  send-notification/  _shared/
```

---

## 12. Errores comunes

| Síntoma | Causa y solución |
|---|---|
| Pantalla "Configuración incompleta" | Faltan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` en `.env`. Reinicia `npm run dev` tras editarlo. |
| `users.sql` lanza un error | No reemplazaste el marcador del correo, o creaste el usuario en Auth después de ejecutarlo. Haz el paso 6.1 primero. |
| "Solo un administrador puede realizar esta acción" | Tu perfil tiene `role = 'musician'`. Promuévelo con `users.sql`. |
| Crear integrante falla | No desplegaste `admin-users` (paso 7). |
| Notificación aparece como *fallida* | Es el comportamiento esperado sin credenciales. Revisa la columna de error en el historial y configura los secretos del paso 7. |
| Recargar `/calendario` da 404 | Falta la regla de *rewrite* del SPA (paso 10). |
| No se sube un archivo | Límites: 50 MB en `ministry-files`, 5 MB en avatares. Ejecuta `storage.sql` si los buckets no existen. |

---

## 13. Seguridad

- **RLS activo en las 10 tablas.** Un integrante inactivo no lee nada.
- Un músico **no puede** cambiar su propio `role`, `active` ni `email`: lo bloquea un trigger en la
  base de datos, no solo la interfaz.
- La `service_role key` **solo** existe en las Edge Functions, nunca en el bundle del navegador.
- Los archivos privados se sirven con **URLs firmadas** con caducidad de 1 hora.
