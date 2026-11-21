# Mesa de Comunicación y Difusión — Instituto Tecnológico de Pachuca (ITP)

Plataforma web institucional para la recepción, seguimiento, gestión administrativa y emisión de reportes ejecutivos de solicitudes de servicios del **Departamento de Comunicación y Difusión** del **Instituto Tecnológico de Pachuca** (TecNM).

---

## 1. Visión General del Sistema

El sistema opera como una aplicación web de página única (Single Page Application — SPA) ligera y modular, dividida en dos entornos operativos:

1. **Portal Público de Solicitantes (sin registro ni contraseñas personales):**
   - Catálogo interactivo de 7 categorías de servicios de comunicación y difusión.
   - Formulario reactivo con especificaciones técnicas dinámicas según el servicio seleccionado.
   - Selector interactivo de fecha y reloj circular para eventos presenciales.
   - Generación atómica de número de folio oficial (`SRV-XXX`) respaldado por secuencia en PostgreSQL.
   - Módulo **"Consulta las solicitudes de tu departamento"**: acceso privado por área + PIN institucional (con sesión persistente por token opaco en servidor) para ver estatus, línea de tiempo, responsables asignados, notas de seguimiento y emitir o cancelar el **Sello de conformidad** (cancelable dentro de las primeras 24 horas).
   - Manual interactivo paso a paso para usuarios solicitantes.

2. **Panel Interno de Administración (Exclusivo Comunicación y Difusión):**
   - Acceso protegido mediante Supabase Auth verificado contra la tabla `public.admins` (`es_admin()`).
   - Métricas en vivo por periodo (Total, Pendientes, En proceso, Terminadas).
   - Bandeja de solicitudes en filas expandibles con filtros por estado, departamento y periodo, más conmutador de vista **Lista Paginada** y **Calendario Mensual Interactivo**.
   - Notificaciones en tiempo real (campana con contador) ante nuevas solicitudes sin asignar vía Supabase Realtime.
   - Asignación de responsable principal y hasta 2 colaboradores de apoyo (`+ Apoyo`, incluyendo prestadores de servicio social), envío de recordatorios por WhatsApp, fechas límite, denegación con motivo y notas de seguimiento.
   - Administración de **PINs de Departamentos** con generación criptográfica segura.
   - Generación e impresión multipágina de la **Bitácora de Comunicación Institucional (ITPAC-PL-PO-001-03)** en formato PDF vía vista imprimible (`@media print`), con asistente de corte semestral.
   - Manual operativo detallado del Panel Interno.

---

## 2. Arquitectura y Tecnologías Utilizadas

Aplicación estática sin pasos de compilación (*buildless*), lista para desplegar en servidores estáticos (GitHub Pages, Cloudflare Pages, Netlify o servidor institucional).

### Frontend
- **HTML5 y CSS3 Nativo:** Variables CSS, Modo Claro/Oscuro (`tema.js`), Flexbox/Grid, diseño responsivo y hoja `@media print` multipágina.
- **JavaScript (Vanilla ES6+):** Delegación de eventos sin manejadores inline (`onclick`/`onchange`), sanitización HTML (`esc()`) y CSP sin `'unsafe-inline'` en `script-src`.
- **Librerías externas (cargadas desde `cdn.jsdelivr.net` con SRI `sha384` y `crossorigin="anonymous"`):**
  - **`@supabase/supabase-js` (v2.46.1):** Cliente PostgreSQL, llamadas RPC, Auth y suscripciones Realtime.
  - **`lucide` (v0.460.0):** Iconografía vectorial SVG.
  - **`tom-select` (v2.2.2):** Menús desplegables con búsqueda.
  - **`flatpickr` (v4.6.13 + `l10n/es.js`):** Selector de fechas en español.
  - **`sweetalert2` (v11.14.5):** Diálogos de confirmación y alertas.

### Backend como Servicio (BaaS) — Supabase
- **Motor de Base de Datos:** PostgreSQL 15+ con extensión `pgcrypto`.
- **Row Level Security (RLS):** Activo en todas las tablas (`solicitudes`, `responsables`, `departamentos_acceso`, `admins`, `sesiones_departamento`, `intentos_pin_depto`, `solicitudes_rate_limit`, `auditoria_solicitudes`), restringiendo el acceso directo únicamente a usuarios registrados en `public.admins` mediante `public.es_admin()`.
- **Funciones RPC (`SECURITY DEFINER` con `search_path` fijo):**
  - `crear_solicitud(p_datos json)`: valida catálogo oficial de servicios y departamentos, asigna fecha del servidor (`America/Mexico_City`), aplica límite anti-abuso global y por huella IP y genera folio atómico (`seq_folio_solicitudes`).
  - `siguiente_folio()`: devuelve la vista previa del próximo folio sin avanzar la secuencia.
  - `consultar_solicitudes_departamento(p_departamento, p_pin, p_token, p_crear_sesion)`: autentica por PIN (con bloqueo progresivo `2 min → 15 min → 1 h`) o por token opaco de sesión, devolviendo únicamente las solicitudes del departamento.
  - `cerrar_sesion_departamento(p_departamento, p_token)`: revoca el token de sesión en servidor.
  - `gestionar_sello_conformidad(p_folio, p_activar, p_departamento, p_pin, p_token)`: emite o cancela el sello de conformidad validando pertenencia y reloj de 24 horas en servidor.
  - `consultar_folio(p_folio)` y `reiniciar_tabla_solicitudes()`: restringidas estrictamente a `public.es_admin()`.
- **Auditoría automática:** Trigger `trg_auditoria_solicitudes` registra cada `INSERT`, `UPDATE`, `DELETE` y corte semestral en `public.auditoria_solicitudes`.

### Microservicio de Notificaciones — Google Apps Script
- Webhook `doPost(e)` en `google_apps_script.gs` (fuera del repositorio público vía `.gitignore`) que valida `WEBHOOK_SECRET` desde *Script Properties*, limita el tamaño del payload (16 KB), escapa HTML y envía correo al destinatario institucional configurado.

### Progressive Web App (PWA)
- Manifiesto `manifest.json` y metadatos móviles para instalación en escritorio o celular.

---

## 3. Estructura del Repositorio

```text
├── index.html               # Estructura de la aplicación, formularios, vistas, CSP y SRI
├── tema.js                  # Aplicación inicial de tema claro/oscuro sin scripts inline
├── styles.css               # Estilos principales, temas claro/oscuro, animaciones y @media print
├── app.js                   # Lógica de negocio, delegación de eventos y cliente Supabase
├── manifest.json            # Manifiesto de Progressive Web App (PWA)
├── security.txt             # Política de seguridad y divulgación responsable (RFC 9116)
├── .well-known/
│   └── security.txt         # Ubicación estándar de la política de seguridad
├── img/                     # Recursos gráficos e isotipos institucionales
└── README.md                # Documentación técnica del proyecto
```

*(Los archivos de servidor `seguridad_supabase.sql` y `google_apps_script.gs` están excluidos del control de versiones en `.gitignore` y se mantienen únicamente en entornos privados de despliegue).*

---

## 4. Parámetros de Configuración y Seguridad

> [!IMPORTANT]
> **Política de Cero Secretos Comprometidos:**
> - La clave pública de Supabase (`publishable_key` / `anon`) en `app.js` es pública por diseño; **toda la protección recae en PostgreSQL mediante RLS (`es_admin()`), secuencias y funciones RPC**.
> - **NUNCA** incluyas la clave `service_role` de Supabase en el frontend ni en el repositorio.
> - Los PINs de acceso del Panel Interno se validan mediante Supabase Auth y las sesiones persistentes de departamentos utilizan tokens opacos almacenados como hash SHA-256 en servidor (nunca se guarda el PIN en `localStorage`).
> - Al cambiar el PIN de un departamento desde el Panel Interno, un trigger revoca automáticamente todas las sesiones previas de esa área.

### Configuración del Webhook de Notificaciones (Google Apps Script)
En `google_apps_script.gs` (desplegado en Google Apps Script):
1. Configurar en **Propiedades de secuencia de comandos** (*Script Properties*):
   - `WEBHOOK_SECRET`: clave aleatoria secreta.
   - `DESTINATARIO_ALERTAS`: correo institucional receptor (`cyd_pachuca@tecnm.mx`).
2. El script valida el formato de folio (`^SRV-\d{3,6}$`), rechaza payloads mayores a 16 KB y escapa todo el contenido HTML.

---

## 5. Despliegue y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/avisosmesacd-gif/Help-Desk-ITP-ComyDif.git
   cd Help-Desk-ITP-ComyDif
   ```
2. **Levantar un servidor HTTP local:**
   ```bash
   python -m http.server 8000
   ```
   *(o `npx serve .`, o Live Server en VS Code)* y abrir `http://localhost:8000`.
3. **Configurar base de datos:** ejecutar el script privado `seguridad_supabase.sql` en el SQL Editor de Supabase y verificar la salida de la consulta final de permisos.

---

## 6. Contacto Institucional y Divulgación de Seguridad

- **Departamento:** Comunicación y Difusión — Instituto Tecnológico de Pachuca (TecNM)
- **Correo Institucional:** [cyd_pachuca@tecnm.mx](mailto:cyd_pachuca@tecnm.mx)
- **Política de Seguridad (RFC 9116):** [security.txt](security.txt) y [.well-known/security.txt](.well-known/security.txt)
