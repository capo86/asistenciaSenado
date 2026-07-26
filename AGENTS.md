# AGENTS.md - Sistema de Registro de Asistencia a Eventos

Este documento guia a cualquier agente que trabaje en este repositorio. Refleja el estado actual del proyecto al 26 de julio de 2026, las decisiones tomadas, el modelo de datos desplegado y las convenciones que no se deben romper.

## 1. Estado actual del proyecto

Aplicacion web institucional para registrar asistencias a eventos de la Academia Legislativa. Tiene:

- Front publico mobile first para que el participante ingrese cedula, busque su nombre en el padron, valide ubicacion y registre asistencia.
- Ruta publica por evento: `/evento/:eventoId`.
- Ruta publica sin ID: `/evento`, que intenta cargar el evento activo del dia.
- Ruta publica fallback `/`, que intenta cargar el evento activo del dia.
- Panel interno en `/panel`, sin usar la palabra `admin` en rutas o textos visibles.
- CRUD basico de eventos desde el panel.
- Grilla/listado de eventos en el panel.
- Listado de asistencias reales del evento seleccionado.
- Generacion de QR por evento, con opcion de copiar, descargar y compartir.
- Mapa OpenStreetMap en el panel para marcar visualmente latitud/longitud del evento.
- Carga de flyer por evento en Storage y visualizacion del flyer en el front publico.
- Modo claro y oscuro.
- Toasts con `sonner` para exito/error.
- Favicon tomado del logo PNG de la Academia.

## 2. Stack instalado

- React 19 + TypeScript.
- Vite.
- Tailwind CSS v4 con `@tailwindcss/vite`.
- Supabase JS.
- Supabase Edge Functions.
- Wouter para ruteo.
- Zustand para estado del panel/sesion.
- shadcn-style local components en `src/components/ui`.
- Lucide React para iconos.
- Sonner para toasts.
- QR con `qrcode.react`.
- Mapa con Leaflet + React integration propia en `EventLocationMap`.
- Vercel CLI y Supabase CLI fueron instalados durante el avance del proyecto.
- Lint con `oxlint`.

Scripts disponibles:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## 3. Variables de entorno

Archivo local: `.env.local` (no commitear).

Variables publicas usadas por el navegador:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_AUTH_EMAIL_DOMAIN=
```

Notas:

- `VITE_SUPABASE_URL` y una de las claves publicas (`VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY`) deben estar disponibles para que el frontend invoque funciones y Auth.
- `SUPABASE_SERVICE_ROLE_KEY` no va en `.env.local`; se configura como secret del proyecto Supabase para Edge Functions.
- `SUPABASE_ACCESS_TOKEN` solo se usa para CLI/deploy/migraciones locales. No debe commitearse ni mostrarse en UI.
- No exponer nombres de backend en textos visibles para usuarios finales.

## 4. Rutas frontend

Definidas en `src/App.tsx`:

- `/panel`: acceso al panel interno.
- `/evento/:eventoId`: formulario publico atado a un evento especifico.
- `/evento`: formulario publico que carga el evento activo actual.
- `/`: formulario publico que carga el evento activo actual.

Deploy en Vercel:

- `vercel.json` contiene un rewrite catch-all hacia `/index.html`.
- No quitar ese rewrite: permite entrar directo a rutas como `/evento`, `/evento/:eventoId` y `/panel` sin recibir 404 de Vercel.

Paginas principales:

- `src/pages/AsistenciaPage.tsx`: flujo publico de asistencia.
- `src/pages/PanelAccessPage.tsx`: decide si muestra login o panel segun sesion.
- `src/pages/PanelLoginPage.tsx`: login del panel.
- `src/pages/PanelPage.tsx`: gestion de eventos, QR, mapa y asistencias.

En mobile, el orden del front publico debe mantenerse asi:

1. Estado, titulo y descripcion del evento.
2. Formulario de registro de asistencia.
3. Datos del evento: lugar, radio, fecha y horario.

## 5. Modelo de datos actual

El proyecto usa un esquema separado llamado `asistencias`. El padron existente vive en `public` y no debe romperse.

### 5.1 Esquema `asistencias`

Creado por `supabase/migrations/202607260001_create_asistencias_schema.sql`.

Incluye:

- Tipo enum `asistencias.evento_estado`: `borrador`, `activo`, `finalizado`, `cancelado`.
- Funcion `asistencias.set_modificado_en()`.
- Funcion `asistencias.distancia_metros(...)` con Haversine.
- Tabla `asistencias.evento`.
- Tabla `asistencias.asistencia`.
- Tabla `asistencias.rate_limit_intento`.
- RLS habilitado en tablas.
- Grants para `anon`, `authenticated` y `service_role` segun corresponda.

### 5.2 Tabla `asistencias.evento`

Campos:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |
| `nombre` | text | obligatorio |
| `descripcion` | text | se muestra en el front publico |
| `lugar` | text | nombre del lugar |
| `direccion` | text | direccion legible |
| `latitud` | double precision | centro del evento |
| `longitud` | double precision | centro del evento |
| `radio_metros` | numeric | default 100, mayor a 0 |
| `fecha_desde` | date | inicio |
| `fecha_hasta` | date | fin |
| `hora_inicio` | time | opcional |
| `hora_fin` | time | opcional |
| `flyer_url` | text | opcional |
| `estado` | `asistencias.evento_estado` | default `borrador` |
| `creado_en` | timestamptz | default `now()` |
| `modificado_en` | timestamptz | trigger de actualizacion |
| `usuario_alta` | uuid | usuario que crea |
| `usuario_modificacion` | uuid | usuario que modifica |

### 5.3 Tabla `asistencias.asistencia`

Campos:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |
| `evento_id` | uuid | FK a `asistencias.evento(id)` |
| `cedula` | text | normalizada a digitos |
| `nombre_completo` | text | viene del padron si se encuentra |
| `telefono` | text | obligatorio desde el formulario publico |
| `email` | text | obligatorio desde el formulario publico |
| `latitud` | double precision | posicion del participante |
| `longitud` | double precision | posicion del participante |
| `distancia_metros` | numeric | calculada en servidor |
| `dentro_del_cuadrante` | boolean | resultado de geofence |
| `ip_address` | text | capturada por Edge Function |
| `creado_en` | timestamptz | default `now()` |

Indice actual importante:

- `idx_asistencia_cedula_creado` para consultar registros diarios por cedula.
- El indice unico antiguo por `(evento_id, cedula)` fue eliminado para permitir hasta 2 asistencias diarias por cedula.

## 6. Funciones Postgres/RPC

### Eventos publicos y panel

Migracion: `202607260002_create_evento_public_rpc.sql`.

- `public.asistencias_evento_get_public(p_id uuid)`: obtiene un evento activo por ID.
- `public.asistencias_evento_get_current()`: obtiene el evento activo del dia en zona horaria `America/Asuncion`.
- `public.asistencias_evento_list_panel()`: lista eventos para el panel.
- `public.asistencias_evento_save(p_evento jsonb, p_user_id uuid)`: crea o actualiza eventos desde el panel.

### Registro de asistencia

Migracion: `202607260003_create_registrar_asistencia_rpc.sql`.

Funcion:

- `public.asistencias_registrar(...)`.

Reglas de esta funcion:

- Normaliza cedula dejando solo digitos.
- Requiere minimo 5 digitos.
- Solo acepta eventos `activo`.
- Valida que la fecha local de Paraguay este dentro de `fecha_desde` y `fecha_hasta`.
- Calcula distancia real con `asistencias.distancia_metros`.
- Rechaza si la persona no se encuentra dentro del radio del evento.
- Inserta la asistencia en `asistencias.asistencia`.
- Limita a maximo 2 asistencias validas por cedula por dia calendario de Paraguay.

### Asistencias del panel

Migracion: `202607260004_create_asistencia_panel_rpc.sql`.

- `public.asistencias_list_panel(p_evento_id uuid)`: lista asistencias reales de un evento para el panel.

### Contacto de asistentes y flyers

Migracion: `202607260005_add_contact_fields_and_flyer_bucket.sql`.

- Agrega `telefono` y `email` a `asistencias.asistencia`.
- Actualiza `public.asistencias_registrar(...)` para recibir y validar esos campos.
- Crea el bucket publico `eventos-flyers`.
- Permite lectura publica de flyers y carga/actualizacion/borrado para usuarios autenticados.

## 7. Edge Functions

Las funciones estan en `supabase/functions`.

### `buscar-persona`

Archivo: `supabase/functions/buscar-persona/index.ts`.

Responsabilidad:

- Recibe cedula.
- Normaliza y valida formato.
- Usa `SUPABASE_SERVICE_ROLE_KEY`.
- Llama a `public.buscar_padron_por_cedula(p_cedula)`.
- Devuelve `cedula`, `nombre`, `apellido`, `nombre_completo`.

Importante:

- Esta funcion depende del padron existente en `public`.
- No cambiar el contrato de `public.buscar_padron_por_cedula(...)` sin confirmar.
- En el frontend, cuando encuentra una persona, el mensaje visible de exito fue removido y el campo `Nombre completo` queda bloqueado.

### `eventos`

Archivo: `supabase/functions/eventos/index.ts`.

Acciones soportadas:

- `get-public`: obtener evento activo por ID.
- `get-current`: obtener evento activo actual.
- `list-panel`: listar eventos para usuarios autenticados.
- `list-asistencias-panel`: listar asistencias reales por evento para usuarios autenticados.
- `save`: guardar evento para usuario autenticado.

Notas:

- Para acciones de panel exige sesion valida de Supabase Auth.
- Usa service role solo dentro de la funcion.
- Validar UUID, fechas, horarios, estado y numeros antes de llamar RPC.

### `registrar-asistencia`

Archivo: `supabase/functions/registrar-asistencia/index.ts`.

Responsabilidad:

- Recibe `evento_id`, `cedula`, `nombre_completo`, `latitud`, `longitud`.
- Tambien recibe `telefono` y `email`.
- Captura IP desde headers.
- Llama a `public.asistencias_registrar(...)`.
- Devuelve 429 cuando se alcanza el limite diario.
- Tiene CORS para `POST` y `OPTIONS`.

## 8. Reglas de negocio actuales

### 8.1 Evento activo

El front publico solo debe mostrar y aceptar asistencia si:

- `estado = 'activo'`.
- La fecha de Paraguay esta entre `fecha_desde` y `fecha_hasta`.

Estados:

- `borrador`: no deberia aceptar asistencia.
- `activo`: visible y registrable si fecha valida.
- `finalizado`: lectura/panel, no registra.
- `cancelado`: lectura/panel, no registra.

### 8.2 Geolocalizacion

- El cliente usa `navigator.geolocation.getCurrentPosition` con alta precision.
- El cliente hace una prevalidacion para mejorar UX.
- La validacion definitiva esta en servidor dentro de `public.asistencias_registrar`.
- Textos de distancia al usuario final no deben decir kilometros ni metros fuera del radio. Usar el mensaje: `No se encuentra en el local`.
- Siempre guardar `latitud` y `longitud` reales enviadas por el navegador.

### 8.3 Padron

- La busqueda de cedula se hace con la Edge Function `buscar-persona`.
- Esa funcion llama a `public.buscar_padron_por_cedula(...)`.
- No escribir directo desde el cliente contra el padron.
- Al encontrar una persona:
  - Se carga `nombre_completo`.
  - Se bloquea el input de nombre para evitar edicion manual.
  - No mostrar el texto `Persona encontrada en el padron`.
- El asistente debe cargar `telefono` y `email`; ambos son obligatorios.
- El telefono debe tener un placeholder claro como `09xxxxxxxx`.
- El correo se valida en frontend y servidor.

### 8.4 Duplicados por cedula

Regla vigente:

- Una misma cedula puede registrar como maximo 2 asistencias validas por dia calendario de Paraguay.
- La tercera asistencia valida del dia debe ser rechazada con HTTP 429 desde Edge Function.
- El conteo se hace del lado servidor contra `asistencias.asistencia`.

### 8.5 Escrituras sensibles

- El cliente no inserta asistencias directo en la tabla.
- El cliente invoca la Edge Function `registrar-asistencia`.
- El panel guarda eventos mediante la Edge Function `eventos`.
- Las funciones usan service role internamente.

## 9. UI/UX vigente

Tono visual:

- Sobrio, institucional, mobile first.
- Evitar aspecto de landing page generica.
- No usar textos visibles que den pistas del backend.
- No usar la palabra `admin` en rutas o UI; usar `panel`.

Componentes y patrones:

- Iconos con `lucide-react`.
- Botones, cards, inputs, labels, alerts, badges y separators desde `src/components/ui`.
- Toasts con `sonner`.
- Modo claro/oscuro con `next-themes` y `useThemeMode`.
- QR del evento con logo de la Academia al centro.
- Mapa de ubicacion en panel con OpenStreetMap/Leaflet.
- Flyer del evento cargado en bucket `eventos-flyers` y guardado como URL publica en `evento.flyer_url`.
- El front publico muestra el flyer debajo del titulo/descripcion en desktop y despues del formulario en mobile.
- El flyer publico no debe mostrar el texto visible `Flyer del evento`; se abre en un visor de imagen al tocarlo.

Textos importantes:

- Boton principal del front publico: `Registrar Asistencia`.
- Exito de registro: toast `Asistencia registrada`.
- Fuera de radio: `No se encuentra en el local`.
- Evitar `Supabase`, `backend`, `API`, `admin` y mensajes tecnicos en pantallas publicas.

## 10. Estructura actual

```text
src/
  components/
    panel/
      EventLocationMap.tsx
      EventQrCard.tsx
    ui/
      alert.tsx
      badge.tsx
      button.tsx
      card.tsx
      input.tsx
      label.tsx
      separator.tsx
      sonner.tsx
      textarea.tsx
  hooks/
    useGeolocation.ts
    useThemeMode.ts
  lib/
    asistenciasApi.ts
    authIdentity.ts
    eventoAvailability.ts
    eventosApi.ts
    geo.ts
    personasApi.ts
    supabaseClient.ts
    utils.ts
  pages/
    AsistenciaPage.tsx
    PanelAccessPage.tsx
    PanelLoginPage.tsx
    PanelPage.tsx
  stores/
    panelStore.ts
    sessionStore.ts
  types/
    asistencia.ts
    evento.ts
    persona.ts
vercel.json
supabase/
  functions/
    buscar-persona/
    eventos/
    registrar-asistencia/
  migrations/
    202607260001_create_asistencias_schema.sql
    202607260002_create_evento_public_rpc.sql
    202607260003_create_registrar_asistencia_rpc.sql
    202607260004_create_asistencia_panel_rpc.sql
    202607260005_add_contact_fields_and_flyer_bucket.sql
    202607260006_require_attendee_contact_fields.sql
```

## 11. Verificacion usada hasta ahora

Comandos que deben seguir pasando tras cambios relevantes:

```bash
npm run build
npm run lint
```

Estado conocido:

- `npm run build` pasa.
- `npm run lint` pasa con warnings existentes en componentes shadcn-style:
  - `src/components/ui/button.tsx`
  - `src/components/ui/badge.tsx`

Tambien se verifico que:

- Las RPC `public.asistencias_registrar` y `public.asistencias_list_panel` existen.
- El bucket `eventos-flyers` existe, es publico y acepta PNG/JPG/WebP hasta 5 MB.
- La Edge Function `registrar-asistencia` responde correctamente cuando el evento no existe.
- El puerto local de Vite usado durante desarrollo fue `http://localhost:5173`.

## 12. Convenciones para futuros agentes

- Leer este archivo antes de modificar el proyecto.
- Mantener TypeScript estricto y evitar `any` salvo justificacion clara.
- Usar `rg` para busquedas.
- Usar `apply_patch` para ediciones manuales.
- No revertir cambios del usuario.
- No commitear `.env.local`, tokens, service role keys ni access tokens.
- No exponer secretos en respuestas.
- Mantener los cambios acotados a la solicitud.
- Despues de tocar frontend o funciones compartidas, correr `npm run build` y `npm run lint`.
- Despues de tocar migraciones o Edge Functions, documentar si fueron aplicadas/desplegadas o si quedan pendientes.
- Cualquier escritura sensible debe pasar por Edge Function/RPC, no directo desde el navegador.
- El esquema `public` existente contiene el padron; no moverlo ni modificarlo sin confirmacion.

## 13. Pendientes o decisiones futuras

- Confirmar politica final de autenticacion del panel si se agregan mas roles.
- Definir si el limite de 2 asistencias diarias representa entrada/salida o dos registros generales.
- Evaluar si conviene agregar auditoria de intentos fuera del local en `rate_limit_intento` u otra tabla.
- Generar tipos de Supabase con `supabase gen types typescript` cuando el modelo se estabilice.
- Evaluar code splitting si el warning de chunk mayor a 500 kB pasa a ser importante para produccion.
