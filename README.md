# Mesa de Comunicación y Difusión — Instituto Tecnológico de Pachuca (ITP)

Plataforma web institucional para la recepción, seguimiento, gestión administrativa y emisión de reportes ejecutivos de solicitudes de servicios del **Departamento de Comunicación y Difusión** del **Instituto Tecnológico de Pachuca** (TecNM).

---

## 1. Visión General del Sistema

El sistema opera como una aplicación web de página única (Single Page Application - SPA) ligera y modular, dividida en dos entornos operativos:

1. **Portal Público de Solicitantes:**
   - Catálogo interactivo de 7 categorías de servicios de comunicación y difusión.
   - Formulario reactivo con especificaciones técnicas dinámicas según el servicio seleccionado.
   - Selector interactivo de fecha y hora institucional para eventos presenciales.
   - Generación atómica de número de folio oficial (`SRV-XXX`) respaldado por secuencias de base de datos.
   - Módulo de consulta de estatus en tiempo real mediante folio, con línea de tiempo de progreso, asignación de responsables y notas de seguimiento.
   - Manual interactivo paso a paso para usuarios solicitantes.

2. **Panel Interno de Administración (Exclusivo Comunicación y Difusión):**
   - Acceso seguro mediante PIN institucional validado en servidor con persistencia de sesión adaptable.
   - Métricas en vivo y contadores automáticos por periodo (Total, Pendientes, En Proceso, Terminadas).
   - Bandeja de solicitudes en filas expandibles con código de colores, filtros rápidos y buscador predictivo.
   - Conmutador de vista: **Lista Paginada** y **Calendario Mensual Interactivo** con desglose por día.
   - Notificaciones en tiempo real (campana con contador reactivo) ante nuevas solicitudes vía WebSockets.
   - Asignación de colaboradores responsables, fechas límite y notas internas de avance.
   - Módulo de denegación con registro obligatorio de motivo justificado.
   - Generador en cliente de **Reportes Oficiales en PDF** (mensuales o semestrales) con diseño institucional y estadísticas.
   - Manual operativo detallado del Panel Interno.

---

## 2. Arquitectura y Tecnologías Utilizadas

La plataforma fue diseñada con una arquitectura desacoplada, sin frameworks pesados ni etapas complejas de compilación (*buildless*), permitiendo despliegues inmediatos en cualquier servidor estático o CDN.

### Frontend
- **HTML5:** Semántica web moderna, modular y accesible.
- **CSS3 Nativo:**
  - Sistema de diseño con variables CSS (`:root`) para consistencia visual institucional.
  - Soporte integrado de **Modo Claro** y **Modo Oscuro** con persistencia en `localStorage`.
  - Maquetación fluida mediante Flexbox y CSS Grid.
  - Diseño responsivo adaptado para computadoras de escritorio, tabletas y teléfonos móviles (*Mobile First*).
- **JavaScript (Vanilla ES6+):** Lógica desacoplada, gestión de estado en memoria y controladores de eventos sin librerías invasivas.
- **Librerías externas (cargadas vía CDN con SRI/integridad):**
  - **`@supabase/supabase-js` (v2):** Cliente de comunicación con la base de datos PostgreSQL, ejecución de procedimientos almacenados (RPC) y suscripciones en tiempo real mediante WebSockets.
  - **`lucide`:** Iconografía vectorial SVG institucional.
  - **`jspdf` & `jspdf-autotable`:** Generación vectorial de documentos PDF en el navegador para reportes mensuales y semestrales.

### Backend como Servicio (BaaS) — Supabase
- **Motor de Base de Datos:** PostgreSQL 15+.
- **Row Level Security (RLS):** Políticas de seguridad a nivel de fila activas en todas las tablas (`solicitudes`, `responsables`, `configuracion`).
- **Procedimientos Almacenados (RPC / `SECURITY DEFINER`):**
  - Toda mutación o consulta sensible se realiza a través de funciones SQL blindadas en el servidor (`crear_solicitud_segura`, `consultar_solicitud_publica`, `actualizar_solicitud_admin`, `cambiar_pin_admin`).
  - El cliente público no cuenta con permisos directos de `SELECT` indiscriminado, `UPDATE` o `DELETE` sobre la tabla de solicitudes.
- **Secuencia Atómica de Folios:** Objeto `seq_folio_solicitudes` en PostgreSQL que previene duplicados o condiciones de carrera concurrentes.
- **Supabase Realtime:** Canales de escucha `postgres_changes` para reflejar nuevas solicitudes en el panel administrativo sin recargar la página.
- **Supabase Auth:** Sesión cifrada basada en tokens JWT para el personal administrativo.

### Microservicio de Notificaciones — Google Apps Script
- **Endpoint Webhook (HTTPS):** Función `doPost` en Google Apps Script que procesa nuevas solicitudes.
- **Filtro de Seguridad:** Parámetro secreto (`?clave=...`) configurado en variables de entorno del script (`Script Properties`).
- **Plantilla de Correo Institucional:** Notificaciones por correo electrónico con diseño HTML responsivo y remitente oficial hacia la cuenta del departamento (`cyd_pachuca@tecnm.mx`).

### Progressive Web App (PWA)
- Archivo `manifest.json` y meta tags de aplicación web para permitir instalación como aplicación de escritorio o app móvil autónoma.

---

## 3. Estructura del Repositorio

```text
├── index.html               # Estructura de la aplicación, formularios, vistas y modales
├── styles.css               # Hoja de estilos principal, temas claro/oscuro y diseño responsivo
├── app.js                   # Controlador de la aplicación, lógica de negocio y cliente Supabase
├── manifest.json            # Manifiesto de Progressive Web App (PWA)
├── security.txt             # Política de seguridad y divulgación responsable (RFC 9116)
├── .well-known/
│   └── security.txt         # Ubicación estándar de la política de seguridad
├── seguridad_supabase.sql   # DDL de PostgreSQL: tablas, RLS, índices, secuencias y RPCs
├── google_apps_script.gs    # Código fuente del webhook para notificaciones por correo
├── img/                     # Recursos gráficos e isotipos institucionales
└── README.md                # Documentación técnica del proyecto
```

---

## 4. Guía de Integración para Futuros Desarrolladores

Si en el futuro se requiere integrar esta plataforma a una aplicación móvil institucional (Android/iOS), a un portal web centralizado del TecNM o a un backend existente, se deben seguir las siguientes directrices técnicas:

### Opción A: Integración en App Móvil mediante WebView
Para envolver esta plataforma dentro de una aplicación móvil (Flutter, React Native, Android nativo o iOS Swift):

1. **Configuración del WebView:**
   - Asegúrate de habilitar JavaScript y el almacenamiento DOM (`localStorage` y `sessionStorage`):
     ```java
     // Ejemplo en Android (Kotlin/Java)
     webView.settings.javaScriptEnabled = true
     webView.settings.domStorageEnabled = true
     webView.settings.databaseEnabled = true
     ```
2. **Compatibilidad Móvil:**
   - Toda la interfaz cuenta con diseño responsivo táctil, menús adaptados y soporte para gestos.
3. **Manejo de Descarga de Archivos:**
   - Para la descarga del reporte PDF generado con `jsPDF`, el WebView debe tener configurado un listener de descargas o soporte para URLs de tipo `blob:`.

### Opción B: Integración en un Portal Web mediante `<iframe>`
Por defecto, `app.js` incluye una rutina de protección contra *Clickjacking* en las primeras líneas de código:
```javascript
if (window.top !== window.self) {
  window.top.location = window.self.location;
}
```
Si deseas embeber esta página dentro de un portal oficial del ITP o TecNM (por ejemplo, `https://pachuca.tecnm.mx`):
1. **Autorizar el dominio padre:** Modifica la verificación en `app.js` para permitir únicamente el origen institucional confiable:
   ```javascript
   const dominiosAutorizados = ['https://pachuca.tecnm.mx', 'https://tecnm.mx'];
   if (window.top !== window.self) {
     const origenPadre = document.referrer ? new URL(document.referrer).origin : '';
     if (!dominiosAutorizados.includes(origenPadre)) {
       window.top.location = window.self.location;
     }
   }
   ```
2. **Configuración de Cabeceras HTTP:** Si se utiliza un servidor propio (Nginx/Apache), configura `Content-Security-Policy: frame-ancestors 'self' https://pachuca.tecnm.mx;`.

### Opción C: Consumo de la Lógica desde otra App (React, Vue, Angular o Backend)
No es necesario duplicar la lógica de base de datos ni los cálculos de folio en otras aplicaciones. Se pueden invocar directamente las funciones RPC de Supabase desde cualquier lenguaje o framework usando el cliente oficial `@supabase/supabase-js` o solicitudes HTTP REST:

#### 1. Registrar una nueva solicitud (público):
```javascript
const { data, error } = await supabase.rpc('crear_solicitud_segura', {
  p_servicio: 'Diseño e impresión de material gráfico',
  p_solicitante: 'Departamento de Sistemas y Computación',
  p_descripcion: 'Diseño de cartel para semana académica',
  p_especificacion: 'Formato cartel digital 1080x1920 px',
  p_aplica_evento: true,
  p_fecha_evento: '2026-12-01',
  p_hora_evento: '10:00',
  p_lugar_evento: 'Auditorio',
  p_aula_especifica: ''
});

// data retorna un objeto con el folio oficial generado: { ok: true, folio: 'SRV-045' }
```

#### 2. Consultar el estatus de un folio (público):
```javascript
const { data, error } = await supabase.rpc('consultar_solicitud_publica', {
  p_folio: 'SRV-045'
});

// data retorna el registro sanitizado con estatus, responsable y notas de seguimiento
```

---

## 5. Parámetros de Configuración y Seguridad

> [!IMPORTANT]
> **Política de Cero Secretos Comprometidos:**
> - La clave pública de Supabase (`anon_key` o `publishable_key`) que se encuentra en `app.js` está pensada para ser pública por diseño. **Toda la protección recae en el motor de base de datos a través de Row Level Security (RLS) y las funciones RPC**.
> - **NUNCA** coloques la clave secreta `service_role` de Supabase en el código frontend ni en este repositorio.
> - La contraseña del Panel Interno se valida en el servidor y nunca se compara en texto plano en el cliente.
> - El directorio interno de responsables y sus datos de contacto están alojados en la tabla `public.responsables`, accesible únicamente para usuarios autenticados mediante las políticas RLS.

### Configuración del Webhook de Notificaciones
En [google_apps_script.gs](file:///c:/Users/ajcr0/OneDrive/Desktop/HelpDesk/google_apps_script.gs) se gestionan las alertas de correo:
1. Las claves de autorización deben configurarse en **Propiedades de secuencia de comandos** (*Script Properties*) de Google Apps Script:
   - `WEBHOOK_SECRET`: Clave alfanumérica secreta que debe coincidir con la llamada del webhook.
   - `DESTINATARIO_ALERTAS`: Correo institucional receptor (`cyd_pachuca@tecnm.mx`).
2. El script sanitiza y escapa cualquier contenido HTML recibido para evitar inyecciones en el cuerpo del correo.

---

## 6. Despliegue y Ejecución Local

Para probar o continuar el desarrollo de este proyecto en tu entorno local:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/avisosmesacd-gif/Help-Desk-ITP-ComyDif.git
   cd Help-Desk-ITP-ComyDif
   ```

2. **Levantar un servidor local de desarrollo:**
   Dado que es una aplicación basada en estándares web puros, no requiere `npm install` ni compilación. Puedes usar cualquier servidor HTTP estático:
   - **Con Python:**
     ```bash
     python -m http.server 8000
     ```
   - **Con Node.js (npx):**
     ```bash
     npx serve .
     ```
   - **Con VS Code:** Extensión *Live Server* (clic derecho en `index.html` > *Open with Live Server*).

3. Abre tu navegador en `http://localhost:8000`.

---

## 7. Contacto Institucional y Divulgación de Seguridad

Para reportes de fallos, dudas de integración o divulgación de seguridad según el estándar RFC 9116:

- **Departamento:** Comunicación y Difusión
- **Institución:** Instituto Tecnológico de Pachuca (TecNM)
- **Correo Institucional:** [cyd_pachuca@tecnm.mx](mailto:cyd_pachuca@tecnm.mx)
- **Política de Seguridad:** Consulte [security.txt](file:///c:/Users/ajcr0/OneDrive/Desktop/HelpDesk/security.txt) o [.well-known/security.txt](file:///c:/Users/ajcr0/OneDrive/Desktop/HelpDesk/.well-known/security.txt)
