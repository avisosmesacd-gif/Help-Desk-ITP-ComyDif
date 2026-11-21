// protección contra clickjacking: impide incrustar la aplicación dentro de iframes externos
if (window.top !== window.self) {
  window.top.location = window.self.location;
}

// credenciales de supabase
const supabase_url = 'https://ijcytjuvgexjzilrbdeg.supabase.co';
const supabase_key = 'sb_publishable_iCtqB1w6QHXS-QJ5Ourc8w_CFBv-DPJ';

// cuenta compartida única del departamento en supabase auth (el pin se valida en el servidor como contraseña)
const correo_panel_compartido = 'avisos.mesacd@gmail.com';

// directorio de responsables en memoria sin datos personales expuestos en el código fuente
// los teléfonos y correos reales se cargan desde public.responsables únicamente tras iniciar sesión en supabase auth
const catalogo_responsables = {
  'Sin asignar': { correo: '', telefono: '' },
  'Karla': { correo: '', telefono: '' },
  'Lina': { correo: '', telefono: '' },
  'Juan': { correo: '', telefono: '' },
  'Karina': { correo: '', telefono: '' },
  'Arge': { correo: '', telefono: '' },
  'Chico(a) de servicio': { correo: '', telefono: '' }
};

// almacenamiento adaptable para sesión jwt de supabase auth (soporta "mantener sesión abierta en este equipo")
const almacenamiento_sesion_itp = {
  getItem: (clave) => {
    try {
      const recordar = localStorage.getItem('itp_recordar_equipo') !== '0';
      return (recordar ? localStorage.getItem(clave) : null) || sessionStorage.getItem(clave);
    } catch (e) {
      return sessionStorage.getItem(clave);
    }
  },
  setItem: (clave, valor) => {
    try {
      const recordar = localStorage.getItem('itp_recordar_equipo') !== '0';
      if (recordar) {
        localStorage.setItem(clave, valor);
        sessionStorage.setItem(clave, valor);
      } else {
        localStorage.removeItem(clave);
        sessionStorage.setItem(clave, valor);
      }
    } catch (e) {
      sessionStorage.setItem(clave, valor);
    }
  },
  removeItem: (clave) => {
    try { localStorage.removeItem(clave); } catch (e) {}
    try { sessionStorage.removeItem(clave); } catch (e) {}
  }
};

// cliente supabase configurado con almacenamiento adaptable para mantener la sesión jwt segura
const usar_nube = supabase_url.startsWith('https://') && supabase_key.length > 20;
const cliente_db = usar_nube
  ? window.supabase.createClient(supabase_url, supabase_key, {
      auth: {
        storage: almacenamiento_sesion_itp,
        persistSession: true
      }
    })
  : null;

let servicio_actual = 'Diseño e impresión de material gráfico';
let aplica_evento = true;
let solicitudes = [];
let filtro_activo = 'todos';
let depto_filtro_panel = 'todos';
let pagina_actual_tickets = 1;
const limite_tickets_pagina = 10;
const tickets_abiertos_panel = new Set();
const folios_slot_apoyo_nuevo = new Set();

// estado de consulta privada por departamento (el pin nunca se guarda en localStorage; solo token opaco)
let consulta_depto_actual = '';
let consulta_pin_actual = '';
let consulta_token_actual = '';
let solicitudes_depto_publico = [];
const tickets_abiertos_publico = new Set();
let pines_deptos_cache = [];

// detecta automáticamente el mes actual (01 al 12) para seleccionarlo por defecto
const mes_actual_sistema = String(new Date().getMonth() + 1).padStart(2, '0');
let mes_filtro_activo = mes_actual_sistema;

let selector_mes_instancia = null;
let selector_solicitante_instancia = null;
let selector_lugar_instancia = null;
let selector_rastreo_depto_instancia = null;
let selector_filtro_depto_panel_instancia = null;
const catalogo_departamentos_itp = [
  'Subdirección Académica',
  'Departamento de Desarrollo Académico',
  'División de Estudios Profesionales',
  'División de Estudios de Posgrado e Investigación',
  'Departamento de Ciencias Básicas',
  'Departamento de Metal-Mecánica',
  'Departamento de Ciencias de la Tierra',
  'Departamento de Sistemas y Computación',
  'Departamento de Ingeniería Industrial',
  'Departamento de Ingeniería Eléctrica y Electrónica',
  'Departamento de Ingeniería Química y Bioquímica',
  'Departamento de Ciencias Económico-Administrativas',
  'Coordinación de Educación a Distancia',
  'Subdirección de Planeación y Vinculación',
  'Departamento de Planeación, Programación y Presupuestación',
  'Departamento de Comunicación y Difusión',
  'Departamento de Gestión Tecnológica y Vinculación',
  'Coordinación de Lenguas Extranjeras',
  'Departamento de Servicios Escolares',
  'Centro de Información',
  'Departamento de Actividades Extraescolares',
  'Subdirección de Servicios Administrativos',
  'Departamento de Recursos Humanos',
  'Departamento de Recursos Financieros',
  'Departamento de Recursos Materiales y Servicios',
  'Centro de Cómputo',
  'Departamento de Mantenimiento y Equipo'
];

const catalogo_sitios_itp = [
  'No aplica',
  'Sala Rafael Rosado',
  'Aula Institutos',
  'Foro Cultural',
  'Sala de Usos Múltiples',
  'Gimnasio Miguel Hidalgo',
  'Gimnasio Olímpico',
  'Sala de Juntas de Dirección',
  'Plaza Cívica',
  'Otro (especificar aula)'
];

let calendario_evento_instancia = null;
let selectores_responsable_instancias = [];

// estado del reloj circular interactivo
let reloj_input_destino_id = 'hora-evento';
let reloj_modo_actual = 'horas';
let reloj_hora_sel = 12;
let reloj_minuto_sel = 0;
let reloj_ampm_sel = 'PM';
let arrastrando_reloj = false;

// estado de sesión derivado exclusivamente de la sesión jwt de supabase auth
let sesion_autorizada = false;

const nombres_meses = {
  'todos': 'Histórico General Acumulado',
  'sem-1': 'Semestre Enero – Junio',
  'sem-2': 'Semestre Julio – Diciembre',
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre'
};

const configuracion_servicios = {
  'Diseño e impresión de material gráfico': {
    label_esp: 'Formato y medidas requeridas',
    placeholder_esp: 'Ej. Cartel impreso tabloide y versión digital para redes',
    label_desc: 'Texto e información clave que debe contener el diseño',
    placeholder_desc: 'Ej. Título del evento, fecha, hora y logotipos oficiales'
  },
  'Difusión en redes sociales': {
    label_esp: 'Redes sociales destino y fecha de publicación',
    placeholder_esp: 'Ej. Facebook e Instagram Oficial — Jueves 10:00 hrs',
    label_desc: 'Copy (texto de la publicación) o enlace al material base',
    placeholder_desc: 'Ej. Invitamos a toda la comunidad tecnológica a...'
  },
  'Cobertura fotográfica/audiovisual': {
    label_esp: 'Tipo de cobertura requerida',
    placeholder_esp: 'Ej. Fotografía general y entrega de reconocimientos',
    label_desc: 'Momentos clave o autoridades a destacar',
    placeholder_desc: 'Ej. Presídium, entrega de menciones honoríficas'
  },
  'Producción de videos': {
    label_esp: 'Duración estimada y formato',
    placeholder_esp: 'Ej. Cápsula de 1 min en formato vertical',
    label_desc: 'Objetivo y guion general o referencias',
    placeholder_desc: 'Ej. Video institucional de invitación al aniversario'
  },
  'Revisión y visto bueno de materiales': {
    label_esp: 'Tipo de material y medio de difusión',
    placeholder_esp: 'Ej. Lona impresa para fachada principal',
    label_desc: 'Enlace al archivo (Drive/Canva) para validación',
    placeholder_desc: 'Ej. https://drive.google.com/... revisar uso del TecNM'
  },
  'Campañas institucionales': {
    label_esp: 'Público objetivo y periodo de difusión',
    placeholder_esp: 'Ej. Estudiantes de nuevo ingreso — Mes en curso',
    label_desc: 'Mensaje central y objetivos de la campaña',
    placeholder_desc: 'Ej. Campaña de difusión de convocatorias de becas'
  },
  'Otro servicio': {
    label_esp: 'Tipo de apoyo o servicio solicitado',
    placeholder_esp: 'Ej. Maestro de ceremonias, préstamo de equipo, protocolo, etc.',
    label_desc: 'Descripción detallada de los requerimientos',
    placeholder_desc: 'Ej. Especifica en qué consiste el apoyo y las necesidades especiales'
  }
};

// función de escape html estricto para blindar todas las interpolaciones contra xss
function esc(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// limpieza de texto plano sin codificar html antes de guardar en la base de datos
function sanitizar_texto(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function capitalizar_inicial(texto) {
  if (!texto) return '';
  const limpio = String(texto).trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

// divide el campo responsable en hasta 3 asignados separados por coma (titular + hasta 2 apoyos)
function parsear_responsables(cadena) {
  const bruto = String(cadena || '').trim();
  if (!bruto) return [];
  const bajo = bruto.toLowerCase();
  if (bajo === 'sin asignar' || bajo.startsWith('denegada')) return [];
  return bruto
    .split(',')
    .map(p => sanitizar_texto(p))
    .filter(p => p && !['sin asignar', 'denegada'].includes(p.toLowerCase()))
    .slice(0, 3);
}

function formatear_responsables_texto(lista) {
  const unicos = [];
  (Array.isArray(lista) ? lista : []).forEach(nombre => {
    const limpio = sanitizar_texto(nombre).replace(/,/g, ' ');
    if (!limpio || ['sin asignar', 'denegada'].includes(limpio.toLowerCase())) return;
    if (!unicos.some(x => x.toLowerCase() === limpio.toLowerCase())) {
      unicos.push(limpio);
    }
  });
  return unicos.length > 0 ? unicos.slice(0, 3).join(', ') : 'Sin asignar';
}

function formatear_responsables_corto(cadena) {
  const lista = parsear_responsables(cadena);
  if (lista.length === 0) return 'Sin asignar';
  return lista.map(r => capitalizar_inicial(r.replace(/^chico\(a\) de servicio:\s*/i, ''))).join(', ');
}

function normalizar_opcion_responsable(nombre_resp) {
  const mapa_fijos = {
    'sin asignar': 'Sin asignar',
    'karla': 'Karla',
    'lina': 'Lina',
    'juan': 'Juan',
    'karina': 'Karina',
    'arge': 'Arge',
    'yessica': 'Yessica'
  };
  const limpio = String(nombre_resp || '').trim();
  const fijo = mapa_fijos[limpio.toLowerCase()];
  if (fijo) return { select: fijo, es_ss: false, nombre_ss: '' };
  if (limpio.toLowerCase().startsWith('chico(a) de servicio')) {
    const partes = limpio.split(':');
    return {
      select: 'Chico(a) de servicio',
      es_ss: true,
      nombre_ss: partes.length > 1 ? partes.slice(1).join(':').trim() : ''
    };
  }
  if (limpio !== '' && limpio.toLowerCase() !== 'denegada') {
    return { select: 'Chico(a) de servicio', es_ss: true, nombre_ss: limpio };
  }
  return { select: 'Sin asignar', es_ss: false, nombre_ss: '' };
}

// formatea la descripción aplicando escape xss seguro a los fragmentos extraídos
function formatear_descripcion_color(texto_desc) {
  if (!texto_desc) return '';
  const texto_limpio = String(texto_desc).replace(/&#x2F;/gi, '/');
  const regex = /^\[(.*?)\]\s*—\s*(.*)$/;
  const coincidencia = texto_limpio.match(regex);
  if (coincidencia) {
    return `<span class="tag-especificacion-color">[${esc(capitalizar_inicial(coincidencia[1]))}]</span> <span class="texto-descripcion-color">— ${esc(capitalizar_inicial(coincidencia[2]))}</span>`;
  }
  return `<span class="texto-descripcion-color">${esc(capitalizar_inicial(texto_limpio))}</span>`;
}

// puente api móvil protegido con object.freeze y restringido según estado de autenticación
window.itp_api_movil = Object.freeze({
  obtener_estado_conexion: () => usar_nube ? 'nube_supabase' : 'local_storage',
  obtener_todas_solicitudes: () => sesion_autorizada ? [...solicitudes] : [],
  obtener_solicitudes_periodo_actual: () => sesion_autorizada ? [...obtener_solicitudes_por_periodo()] : [],
  consultar_por_folio: async (folio) => {
    if (!sesion_autorizada) return null;
    const codigo = sanitizar_texto(folio).toUpperCase();
    if (!/^SRV-\d{3,6}$/.test(codigo)) return null;
    if (usar_nube && cliente_db) {
      const { data } = await cliente_db.rpc('consultar_folio', { p_folio: codigo });
      return Array.isArray(data) && data.length > 0 ? data[0] : (data || null);
    }
    return solicitudes.find(s => String(s.folio).toUpperCase() === codigo) || null;
  },
  consultar_por_departamento: async (departamento, pin, token = null) => {
    const depto = sanitizar_texto(departamento);
    const clave = sanitizar_texto(pin);
    const tok = sanitizar_texto(token);
    if (!depto || (!clave && !tok)) return { ok: false, error: 'Departamento y PIN requeridos.' };
    if (usar_nube && cliente_db) {
      const { data, error } = await cliente_db.rpc('consultar_solicitudes_departamento', {
        p_departamento: depto,
        p_pin: clave || null,
        p_token: tok || null,
        p_crear_sesion: false
      });
      if (error) return { ok: false, error: error.message };
      return data;
    }
    const filtradas = solicitudes.filter(s => String(s.solicitante || '').trim().toLowerCase() === depto.toLowerCase());
    return { ok: true, departamento: depto, solicitudes: filtradas };
  },
  crear_solicitud_externa: async (datos_solicitud) => {
    const fecha_emision = new Date().toLocaleDateString('es-MX');
    const registro = {
      fecha_solicitud: fecha_emision,
      servicio: sanitizar_texto(datos_solicitud.servicio || 'Diseño e impresión de material gráfico'),
      solicitante: sanitizar_texto(datos_solicitud.solicitante || ''),
      descripcion: sanitizar_texto(datos_solicitud.descripcion || ''),
      aplica_evento: Boolean(datos_solicitud.aplica_evento),
      fecha_evento: sanitizar_texto(datos_solicitud.fecha_evento || ''),
      hora_evento: sanitizar_texto(datos_solicitud.hora_evento || ''),
      lugar_evento: sanitizar_texto(datos_solicitud.lugar_evento || '')
    };
    if (usar_nube && cliente_db) {
      const { data, error } = await cliente_db.rpc('crear_solicitud', { p_datos: registro });
      if (error) throw error;
      if (sesion_autorizada) await cargar_solicitudes();
      await actualizar_folio_preview();
      return data;
    }
    const folio_local = await actualizar_folio_preview();
    const reg_local = {
      ...registro,
      folio: folio_local,
      estado: 'Pendiente',
      responsable: 'Sin asignar',
      fecha_limite: '',
      observaciones: `[${fecha_emision}] Solicitud registrada desde App Móvil.`
    };
    solicitudes.unshift(reg_local);
    localStorage.setItem('tickets_itp_v6', JSON.stringify(solicitudes));
    renderizar_tickets();
    actualizar_notificaciones_ios();
    return reg_local;
  },
  sincronizar_remoto: async () => {
    if (!sesion_autorizada) return [];
    await cargar_solicitudes();
    return [...solicitudes];
  }
});

function refrescar_iconos() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function mostrar_toast() {
  return;
}

// =========================================================================
// carga protegida del directorio de responsables (solo usuarios autenticados)
// =========================================================================
async function cargar_directorio_responsables() {
  if (!usar_nube || !cliente_db || !sesion_autorizada) return;
  try {
    const { data, error } = await cliente_db
      .from('responsables')
      .select('nombre, correo, telefono');
    if (!error && Array.isArray(data)) {
      data.forEach(item => {
        if (item && item.nombre) {
          catalogo_responsables[item.nombre] = {
            correo: item.correo || '',
            telefono: item.telefono || ''
          };
        }
      });
    }
  } catch (err) {
    console.warn('No se pudo cargar el directorio de responsables:', err);
  }
}

function limpiar_directorio_responsables_memoria() {
  Object.keys(catalogo_responsables).forEach(nombre => {
    catalogo_responsables[nombre] = { correo: '', telefono: '' };
  });
}

// =========================================================================
// centro de notificaciones estilo ios (solicitudes sin responsable asignado)
// =========================================================================
function obtener_solicitudes_sin_responsable() {
  if (!sesion_autorizada) return [];
  return solicitudes.filter(item => {
    const info_den = obtener_info_denegacion(item);
    if (info_den && info_den.denegada) return false;
    return parsear_responsables(item.responsable).length === 0;
  });
}

function actualizar_notificaciones_ios() {
  const badge = document.getElementById('badge-notificaciones-ios');
  const pildora = document.getElementById('pildora-conteo-ios');
  const lista = document.getElementById('lista-notificaciones-ios');
  if (!badge || !lista) return;

  const pendientes_asignar = obtener_solicitudes_sin_responsable();
  const total = pendientes_asignar.length;

  if (total > 0) {
    badge.textContent = total;
    badge.classList.remove('oculto');
    if (pildora) pildora.textContent = total === 1 ? '1 nueva' : `${total} nuevas`;
  } else {
    badge.textContent = '0';
    badge.classList.add('oculto');
    if (pildora) pildora.textContent = '0 nuevas';
  }

  if (total === 0) {
    lista.innerHTML = `
      <div class="notif-ios-vacio">
        <i data-lucide="check-circle-2"></i>
        <div>Todo al día. No hay solicitudes pendientes por asignar responsable.</div>
      </div>
    `;
    refrescar_iconos();
    return;
  }

  // se utilizan atributos data-* y escape html para evitar xss en notificaciones
  lista.innerHTML = pendientes_asignar.map(item => {
    const folio_sup = esc(String(item.folio || '').toUpperCase());
    const servicio_cap = esc(capitalizar_inicial(item.servicio));
    const fecha_sol = esc(item.fecha_solicitud);
    const solicitante_esc = esc(item.solicitante);
    return `
      <div class="tarjeta-notif-ios" data-accion="ir-notif" data-folio="${folio_sup}">
        <div class="notif-ios-top">
          <span class="notif-ios-folio">${folio_sup}</span>
          <span class="notif-ios-fecha">${fecha_sol}</span>
        </div>
        <div class="notif-ios-servicio">${servicio_cap}</div>
        <div class="notif-ios-depto">Solicita: ${solicitante_esc}</div>
        <span class="notif-ios-accion">
          Asignar responsable <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
        </span>
      </div>
    `;
  }).join('');

  refrescar_iconos();
}

function alternar_notificaciones_ios(e) {
  if (e) e.stopPropagation();
  const popover = document.getElementById('popover-notificaciones-ios');
  if (!popover) return;
  popover.classList.toggle('oculto');
  if (!popover.classList.contains('oculto')) {
    actualizar_notificaciones_ios();
  }
}

function ir_a_solicitud_notificacion(folio_destino) {
  const popover = document.getElementById('popover-notificaciones-ios');
  if (popover) popover.classList.add('oculto');

  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }

  cambiar_vista('panel');

  filtro_activo = 'todos';
  document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
  const primer_filtro = document.querySelector('.btn-filtro');
  if (primer_filtro) primer_filtro.classList.add('activo');

  const lista_periodo = obtener_solicitudes_por_periodo();
  const existe_en_periodo = lista_periodo.some(s => String(s.folio).toUpperCase() === String(folio_destino).toUpperCase());
  if (!existe_en_periodo) {
    mes_filtro_activo = 'todos';
    if (selector_mes_instancia) {
      selector_mes_instancia.setValue('todos', true);
    }
  }

  depto_filtro_panel = 'todos';
  if (selector_filtro_depto_panel_instancia) {
    selector_filtro_depto_panel_instancia.setValue('todos', true);
  }

  const lista_final_notif = obtener_solicitudes_por_periodo();
  const idx_notif = lista_final_notif.findIndex(
    s => String(s.folio).toUpperCase() === String(folio_destino).toUpperCase()
  );
  pagina_actual_tickets = idx_notif !== -1 ? Math.floor(idx_notif / limite_tickets_pagina) + 1 : 1;

  const id_limpio_notif = String(folio_destino).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  tickets_abiertos_panel.add(id_limpio_notif);
  renderizar_tickets();

  setTimeout(() => {
    const id_limpio = 'ticket-' + id_limpio_notif;
    const tarjeta = document.getElementById(id_limpio);
    if (tarjeta) {
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tarjeta.classList.remove('ticket-resaltado-notif');
      void tarjeta.offsetWidth;
      tarjeta.classList.add('ticket-resaltado-notif');
    }
  }, 120);
}

document.addEventListener('click', (e) => {
  const contenedor = document.getElementById('contenedor-notificaciones-ios');
  const popover = document.getElementById('popover-notificaciones-ios');
  if (contenedor && popover && !contenedor.contains(e.target)) {
    popover.classList.add('oculto');
  }
});

// =========================================================================
// directorio de contacto en memoria y recordatorios por whatsapp
// las alertas por correo se disparan desde el servidor vía database webhook
// =========================================================================
function obtener_contacto_responsable(nombre_responsable) {
  if (!nombre_responsable || nombre_responsable.toLowerCase() === 'sin asignar') {
    return { correo: '', telefono: '' };
  }
  if (nombre_responsable.toLowerCase().startsWith('chico(a) de servicio')) {
    return catalogo_responsables['Chico(a) de servicio'] || { correo: '', telefono: '' };
  }
  const clave_exacta = Object.keys(catalogo_responsables).find(
    k => k.toLowerCase() === nombre_responsable.toLowerCase()
  );
  return catalogo_responsables[clave_exacta] || {
    correo: '',
    telefono: ''
  };
}

// las notificaciones por correo ahora son enviadas en segundo plano por el webhook de supabase hacia google apps script
async function notificar_nueva_solicitud_correo() {
  return;
}

function construir_url_whatsapp_asignacion(solicitud, nombre_objetivo) {
  const persona = nombre_objetivo || parsear_responsables(solicitud.responsable)[0] || solicitud.responsable || '';
  const contacto = obtener_contacto_responsable(persona);
  const numero_wa = String(contacto.telefono || '').replace(/\D/g, '');
  const descripcion_limpia = String(solicitud.descripcion || '').replace(/&#x2F;/gi, '/');

  const mensaje =
    `Hola *${persona}*, te ha asignado el seguimiento de una solicitud:\n\n` +
    `*Folio:* ${String(solicitud.folio || '').toUpperCase()}\n` +
    `*Servicio:* ${capitalizar_inicial(solicitud.servicio)}\n` +
    `*Departamento solicitante:* ${solicitud.solicitante}\n` +
    `*Fecha del evento:* ${solicitud.aplica_evento ? solicitud.fecha_evento : 'N/A'}\n` +
    `- *Hora:* ${solicitud.aplica_evento ? solicitud.hora_evento + ' hrs' : 'N/A'}\n` +
    `*Sitio:* ${solicitud.aplica_evento ? solicitud.lugar_evento : 'N/A'}\n` +
    `*Información clave :* ${descripcion_limpia}\n\n` +
    `Por favor verifica los detalles o dudas en la *Mesa de Comunicación y Difusión.* Gracias.`;

  return `https://wa.me/${numero_wa}?text=${encodeURIComponent(mensaje)}`;
}

async function enviar_whatsapp_responsable(index_real, nombre_especifico) {
  const item = solicitudes[index_real];
  if (!item) return;

  const lista_planta = parsear_responsables(item.responsable)
    .filter(n => !n.toLowerCase().startsWith('chico(a) de servicio'));

  const destinatario = nombre_especifico || (lista_planta.length === 1 ? lista_planta[0] : '');

  if (destinatario) {
    if (!obtener_contacto_responsable(destinatario).telefono) {
      await cargar_directorio_responsables();
    }
    const url = construir_url_whatsapp_asignacion(item, destinatario);
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (lista_planta.length > 1) {
    if (!obtener_contacto_responsable(lista_planta[0]).telefono) {
      await cargar_directorio_responsables();
    }
    const botones_html = lista_planta.map(nombre_p => `
      <button type="button" class="btn-wa-selector-item" data-wa-persona="${esc(nombre_p)}">
        Enviar recordatorio a <strong>${esc(nombre_p)}</strong>
      </button>
    `).join('');

    await Swal.fire({
      title: `Enviar WhatsApp (${esc(String(item.folio || '').toUpperCase())})`,
      html: `<p style="font-size: 0.86rem; color: var(--ink-muted); margin-bottom: 0.75rem;">Selecciona a qué integrante asignado deseas enviarle el recordatorio:</p><div class="lista-botones-wa-modal">${botones_html}</div>`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      cancelButtonColor: '#64748b',
      didOpen: (popup) => {
        popup.querySelectorAll('.btn-wa-selector-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = btn.getAttribute('data-wa-persona');
            if (p) {
              const url = construir_url_whatsapp_asignacion(item, p);
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          });
        });
      }
    });
  }
}

async function notificar_asignacion_responsable(index_real, nombre_especifico) {
  const item = solicitudes[index_real];
  const destino = nombre_especifico || parsear_responsables(item && item.responsable)[0] || '';
  if (!item || !destino || destino.toLowerCase() === 'sin asignar') return;

  const responsable_seguro = esc(destino);
  const icono_notificacion = `
    <div class="alerta-icono-minimal verde">
      <svg viewBox="0 0 24 24" fill="currentColor" style="width: 38px; height: 38px; color: #16a34a;">
        <path d="M12.031 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.993L2 22l5.233-1.237a9.994 9.994 0 0 0 4.779 1.217h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.037-5.176-2.922-7.062A9.935 9.935 0 0 0 12.031 2zm5.829 14.144c-.245.693-1.43 1.326-1.981 1.408-.507.075-1.148.107-1.855-.117-.428-.135-.978-.316-1.682-.62-2.961-1.278-4.896-4.261-5.044-4.459-.148-.197-1.204-1.601-1.204-3.054 0-1.453.763-2.167 1.034-2.463.271-.296.591-.37.788-.37.197 0 .394.002.566.01.182.009.426-.069.666.508.246.591.838 2.045.912 2.193.074.148.123.32.025.517-.098.197-.148.32-.296.493-.148.172-.311.385-.444.517-.148.148-.302.308-.13.604.172.296.766 1.264 1.645 2.047 1.13 1.007 2.083 1.319 2.379 1.467.296.148.468.123.641-.074.172-.197.739-.862.936-1.158.197-.296.394-.246.665-.148.271.098 1.725.813 2.02.961.296.148.493.222.567.345.074.123.074.714-.171 1.407z"></path>
      </svg>
    </div>
  `;

  const respuesta = await Swal.fire({
    html: `
      ${icono_notificacion}
      <span class="alerta-tag-sup" style="color: #15803d; background: #ecfdf5;">Responsable Asignado</span>
      <h3 class="alerta-titulo-custom">Notificar a ${responsable_seguro}</h3>
      <p class="alerta-cuerpo-custom">
        Has asignado esta solicitud a <strong>${responsable_seguro}</strong>.
        <span class="alerta-pregunta-resaltada">¿Deseas abrir WhatsApp para enviarle el recordatorio con los datos del servicio?</span>
      </p>
    `,
    showCancelButton: true,
    confirmButtonColor: '#16a34a',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Abrir WhatsApp',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: {
      popup: ''
    }
  });

  if (respuesta.isConfirmed) {
    await enviar_whatsapp_responsable(index_real, destino);
  }
}

// =========================================================================
// manejo de responsable principal y apoyos adicionales (hasta 3 en total)
// =========================================================================
async function cambiar_responsable_select(index_real, opcion_seleccionada) {
  const bloque_ss = document.getElementById(`bloque-ss-${index_real}`);
  const input_ss = document.getElementById(`input-ss-${index_real}`);

  if (opcion_seleccionada === 'Chico(a) de servicio') {
    if (bloque_ss) {
      bloque_ss.classList.remove('oculto');
    }
    if (input_ss) {
      input_ss.focus();
    }
    return;
  }

  if (bloque_ss) {
    bloque_ss.classList.add('oculto');
  }

  const item = solicitudes[index_real];
  const actuales = parsear_responsables(item ? item.responsable : '');
  let nueva_lista;

  if (opcion_seleccionada === 'Sin asignar') {
    nueva_lista = actuales.slice(1);
  } else {
    nueva_lista = [sanitizar_texto(opcion_seleccionada), ...actuales.slice(1)];
  }

  const valor_final = formatear_responsables_texto(nueva_lista);
  await actualizar_campo(index_real, 'responsable', valor_final);
  if (opcion_seleccionada !== 'Sin asignar' && opcion_seleccionada !== 'Chico(a) de servicio') {
    await notificar_asignacion_responsable(index_real, opcion_seleccionada);
  }
}

async function guardar_nombre_servicio_social(index_real, slot_idx) {
  const slot = typeof slot_idx === 'number' && !isNaN(slot_idx) ? slot_idx : 0;
  const input_id = slot === 0 ? `input-ss-${index_real}` : `input-ss-apoyo-${index_real}-${slot}`;
  const input_ss = document.getElementById(input_id);
  const nombre_manual = input_ss ? sanitizar_texto(input_ss.value.trim()).replace(/,/g, ' ').slice(0, 80) : '';

  if (!nombre_manual) {
    Swal.fire({
      icon: 'warning',
      title: 'Nombre requerido',
      text: 'Escribe el nombre del chico(a) de servicio social para asignarlo.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const etiqueta_ss = `Chico(a) de servicio: ${nombre_manual}`;
  const item = solicitudes[index_real];
  const actuales = parsear_responsables(item ? item.responsable : '');
  const nueva_lista = [...actuales];
  if (slot < nueva_lista.length) {
    nueva_lista[slot] = etiqueta_ss;
  } else {
    nueva_lista.push(etiqueta_ss);
  }

  if (item && item.folio) {
    folios_slot_apoyo_nuevo.delete(String(item.folio).toUpperCase());
  }
  await actualizar_campo(index_real, 'responsable', formatear_responsables_texto(nueva_lista));
}

function abrir_slot_apoyo(index_real) {
  const item = solicitudes[index_real];
  if (!item || !item.folio) return;
  const actuales = parsear_responsables(item.responsable);
  if (actuales.length >= 3) return;
  folios_slot_apoyo_nuevo.add(String(item.folio).toUpperCase());
  renderizar_tickets();
}

function cancelar_slot_apoyo_nuevo(index_real) {
  const item = solicitudes[index_real];
  if (!item || !item.folio) return;
  folios_slot_apoyo_nuevo.delete(String(item.folio).toUpperCase());
  renderizar_tickets();
}

async function cambiar_apoyo_responsable(index_real, slot_idx, valor_elegido) {
  const bloque_ss = document.getElementById(`bloque-ss-apoyo-${index_real}-${slot_idx}`);
  const input_ss = document.getElementById(`input-ss-apoyo-${index_real}-${slot_idx}`);

  if (valor_elegido === 'Chico(a) de servicio') {
    if (bloque_ss) bloque_ss.classList.remove('oculto');
    if (input_ss) input_ss.focus();
    return;
  }

  if (bloque_ss) bloque_ss.classList.add('oculto');
  if (!valor_elegido) return;

  const item = solicitudes[index_real];
  const actuales = parsear_responsables(item ? item.responsable : '');
  const nueva_lista = [...actuales];
  if (slot_idx < nueva_lista.length) {
    nueva_lista[slot_idx] = sanitizar_texto(valor_elegido);
  } else {
    nueva_lista.push(sanitizar_texto(valor_elegido));
  }

  if (item && item.folio) {
    folios_slot_apoyo_nuevo.delete(String(item.folio).toUpperCase());
  }

  await actualizar_campo(index_real, 'responsable', formatear_responsables_texto(nueva_lista));
  await notificar_asignacion_responsable(index_real, valor_elegido);
}

async function quitar_apoyo_responsable(index_real, slot_idx) {
  const item = solicitudes[index_real];
  if (!item) return;
  const actuales = parsear_responsables(item.responsable);
  const nueva_lista = actuales.filter((_, i) => i !== slot_idx);
  if (item.folio) {
    folios_slot_apoyo_nuevo.delete(String(item.folio).toUpperCase());
  }
  await actualizar_campo(index_real, 'responsable', formatear_responsables_texto(nueva_lista));
}

function inicializar_selectores_responsable_tarjetas() {
  if (!window.TomSelect) return;

  selectores_responsable_instancias.forEach(inst => {
    try { inst.destroy(); } catch (e) {}
  });
  selectores_responsable_instancias = [];

  document.querySelectorAll('.select-responsable-tom').forEach(el => {
    const idx = parseInt(el.getAttribute('data-index'), 10);
    const inst = new TomSelect(el, {
      create: false,
      allowEmptyOption: false,
      controlInput: null,
      onDelete: () => false,
      onChange: (valor) => {
        if (!isNaN(idx) && valor) {
          cambiar_responsable_select(idx, valor);
        }
      }
    });
    selectores_responsable_instancias.push(inst);
  });

  document.querySelectorAll('.select-apoyo-tom').forEach(el => {
    const idx = parseInt(el.getAttribute('data-index'), 10);
    const slot = parseInt(el.getAttribute('data-slot'), 10);
    const es_nuevo = el.getAttribute('data-nuevo') === '1';
    const inst = new TomSelect(el, {
      create: false,
      allowEmptyOption: es_nuevo,
      placeholder: es_nuevo ? 'Seleccionar apoyo...' : undefined,
      controlInput: null,
      dropdownParent: 'body',
      onDelete: () => false,
      onChange: (valor) => {
        if (!isNaN(idx) && !isNaN(slot) && valor) {
          cambiar_apoyo_responsable(idx, slot, valor);
        }
      }
    });
    selectores_responsable_instancias.push(inst);
  });
}

// =========================================================================
// delegación segura de eventos para evitar handlers onclick con datos dinámicos
// =========================================================================
let delegacion_eventos_activa = false;

function inicializar_delegacion_eventos_segura() {
  if (delegacion_eventos_activa) return;
  delegacion_eventos_activa = true;

  document.addEventListener('click', (e) => {
    const nodo_accion = e.target.closest('[data-accion]');
    if (!nodo_accion) return;

    const accion = nodo_accion.getAttribute('data-accion');
    const idx = parseInt(nodo_accion.getAttribute('data-index'), 10);
    const slot_idx = parseInt(nodo_accion.getAttribute('data-slot'), 10);
    const idx_nota = parseInt(nodo_accion.getAttribute('data-nota-index'), 10);

    if (accion === 'ir-notif') {
      const folio = nodo_accion.getAttribute('data-folio') || '';
      ir_a_solicitud_notificacion(folio);
    } else if (accion === 'denegar-solicitud' && !isNaN(idx)) {
      denegar_solicitud_panel(idx);
    } else if (accion === 'enviar-wa' && !isNaN(idx)) {
      enviar_whatsapp_responsable(idx);
    } else if (accion === 'guardar-ss' && !isNaN(idx)) {
      guardar_nombre_servicio_social(idx, 0);
    } else if (accion === 'agregar-apoyo' && !isNaN(idx)) {
      abrir_slot_apoyo(idx);
    } else if (accion === 'cancelar-slot-apoyo' && !isNaN(idx)) {
      cancelar_slot_apoyo_nuevo(idx);
    } else if (accion === 'quitar-apoyo' && !isNaN(idx) && !isNaN(slot_idx)) {
      quitar_apoyo_responsable(idx, slot_idx);
    } else if (accion === 'guardar-ss-apoyo' && !isNaN(idx) && !isNaN(slot_idx)) {
      guardar_nombre_servicio_social(idx, slot_idx);
    } else if (accion === 'agregar-nota' && !isNaN(idx)) {
      agregar_nota(idx);
    } else if (accion === 'editar-nota' && !isNaN(idx) && !isNaN(idx_nota)) {
      editar_nota(idx, idx_nota);
    } else if (accion === 'eliminar-nota' && !isNaN(idx) && !isNaN(idx_nota)) {
      eliminar_nota(idx, idx_nota);
    } else if (accion === 'vista-panel') {
      cambiar_vista_panel(nodo_accion.getAttribute('data-vista') || 'lista');
    } else if (accion === 'cal-mes') {
      mover_mes_calendario(parseInt(nodo_accion.getAttribute('data-delta'), 10) || 0);
    } else if (accion === 'cal-sel-dia') {
      const dia_sel = parseInt(nodo_accion.getAttribute('data-dia'), 10);
      if (!isNaN(dia_sel)) {
        calendario_dia_seleccionado_movil = dia_sel;
        renderizar_calendario_panel();
      }
    } else if (accion === 'cal-evento') {
      const folio_cal = nodo_accion.getAttribute('data-folio') || '';
      cambiar_vista_panel('lista');
      ir_a_solicitud_notificacion(folio_cal);
    } else if (accion === 'cambiar-pagina-tickets') {
      const num_pag = parseInt(nodo_accion.getAttribute('data-pagina'), 10);
      if (!isNaN(num_pag)) {
        cambiar_pagina_tickets(num_pag);
      }
    } else if (accion === 'alternar-ticket-panel') {
      const folio_t = nodo_accion.getAttribute('data-folio') || '';
      const fila_t = nodo_accion.closest('.pi-fila-solicitud');
      if (fila_t && folio_t) {
        const abierto = fila_t.classList.toggle('pi-abierta');
        nodo_accion.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        if (abierto) {
          tickets_abiertos_panel.add(folio_t);
        } else {
          tickets_abiertos_panel.delete(folio_t);
        }
      }
    } else if (accion === 'alternar-ticket-publico') {
      const folio_pub = nodo_accion.getAttribute('data-folio') || '';
      const fila_pub = nodo_accion.closest('.pub-fila-solicitud');
      if (fila_pub && folio_pub) {
        const abierto = fila_pub.classList.toggle('pub-abierta');
        nodo_accion.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        if (abierto) {
          tickets_abiertos_publico.add(folio_pub);
        } else {
          tickets_abiertos_publico.delete(folio_pub);
        }
      }
    } else if (accion === 'poner-sello') {
      const folio_sello = nodo_accion.getAttribute('data-folio') || '';
      gestionar_sello_conformidad_publico(folio_sello, true);
    } else if (accion === 'quitar-sello') {
      const folio_sello = nodo_accion.getAttribute('data-folio') || '';
      gestionar_sello_conformidad_publico(folio_sello, false);
    } else if (accion === 'gen-pin-depto') {
      const idx_depto = parseInt(nodo_accion.getAttribute('data-depto-index'), 10);
      if (!isNaN(idx_depto)) {
        asignar_pin_aleatorio_input(idx_depto);
      }
    } else if (accion === 'guardar-pin-depto') {
      const idx_depto = parseInt(nodo_accion.getAttribute('data-depto-index'), 10);
      if (!isNaN(idx_depto)) {
        guardar_pin_departamento_panel(idx_depto);
      }
    } else if (accion === 'cambiar-vista') {
      cambiar_vista(nodo_accion.getAttribute('data-vista') || 'formulario');
    } else if (accion === 'abrir-panel') {
      intentar_abrir_panel();
    } else if (accion === 'abrir-manual') {
      abrir_modal_manual();
    } else if (accion === 'alternar-tema') {
      alternar_modo_oscuro();
    } else if (accion === 'alternar-notificaciones') {
      alternar_notificaciones_ios(e);
    } else if (accion === 'seleccionar-servicio') {
      seleccionar_servicio(nodo_accion, nodo_accion.getAttribute('data-servicio') || '');
    } else if (accion === 'alternar-evento') {
      alternar_evento();
    } else if (accion === 'abrir-reloj') {
      abrir_reloj_circular(nodo_accion.getAttribute('data-target') || 'hora-evento');
    } else if (accion === 'abrir-pines-deptos') {
      abrir_modal_pines_deptos();
    } else if (accion === 'cerrar-sesion-admin') {
      cerrar_sesion_admin();
    } else if (accion === 'abrir-reporte') {
      abrir_modal_reporte();
    } else if (accion === 'filtrar-estado') {
      filtrar_estado(nodo_accion.getAttribute('data-estado') || 'todos', nodo_accion);
    } else if (accion === 'ir-arriba') {
      ir_arriba_del_todo();
    } else if (accion === 'modo-reloj') {
      cambiar_modo_reloj(nodo_accion.getAttribute('data-modo') || 'horas');
    } else if (accion === 'ampm-reloj') {
      seleccionar_ampm_reloj(nodo_accion.getAttribute('data-ampm') || 'AM');
    } else if (accion === 'cerrar-reloj') {
      cerrar_reloj_circular();
    } else if (accion === 'confirmar-reloj') {
      confirmar_reloj_circular();
    } else if (accion === 'cerrar-modal-exito') {
      cerrar_modal();
    } else if (accion === 'cerrar-modal-pin') {
      cerrar_modal_pin();
    } else if (accion === 'cerrar-pines-deptos') {
      cerrar_modal_pines_deptos();
    } else if (accion === 'generar-pines-faltantes') {
      generar_pines_faltantes_deptos();
    } else if (accion === 'cerrar-manual') {
      cerrar_modal_manual();
    } else if (accion === 'tab-manual') {
      cambiar_tab_manual(nodo_accion.getAttribute('data-tab') || 'publico');
    } else if (accion === 'imprimir-reporte') {
      imprimir_reporte_pdf();
    } else if (accion === 'cerrar-reporte') {
      cerrar_modal_reporte();
    } else if (accion === 'cerrar-rastreo') {
      cerrar_rastreo_publico();
    } else if (accion === 'recargar-depto') {
      recargar_solicitudes_departamento();
    }
  });

  // cierre al hacer clic sobre el fondo oscuro de modales (sin onclick inline)
  document.addEventListener('click', (e) => {
    const fondo = e.target && e.target.getAttribute ? e.target.getAttribute('data-cerrar-fondo') : null;
    if (!fondo) return;
    if (fondo === 'reloj') cerrar_reloj_circular();
    else if (fondo === 'pines-deptos') cerrar_modal_pines_deptos();
    else if (fondo === 'manual') cerrar_modal_manual();
  });

  // envío de formularios mediante delegación (sin onsubmit inline)
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || !form.id) return;
    if (form.id === 'form-rastreo-depto') {
      consultar_solicitudes_departamento(e);
    } else if (form.id === 'form-solicitud') {
      guardar_solicitud(e);
    } else if (form.id === 'form-pin-admin') {
      verificar_pin(e);
    }
  });

  // respaldo silencioso para imágenes institucionales faltantes (sin onerror inline)
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.hasAttribute('data-ocultar-error')) {
      el.style.display = 'none';
    }
  }, true);

  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'selector-mes-reporte') {
      cambiar_mes_filtro();
      return;
    }
    const nodo_cambio = e.target.closest('[data-cambio]');
    if (!nodo_cambio) return;

    const tipo_cambio = nodo_cambio.getAttribute('data-cambio');
    const idx = parseInt(nodo_cambio.getAttribute('data-index'), 10);
    if (isNaN(idx)) return;

    if (tipo_cambio === 'tipo-comunicacion') {
      const subtipo = nodo_cambio.getAttribute('data-tipo') || '';
      alternar_tipo_comunicacion(idx, subtipo, nodo_cambio.checked);
    } else if (tipo_cambio === 'fecha-limite-manual') {
      alternar_fecha_limite_manual(idx, nodo_cambio.checked);
    } else if (tipo_cambio === 'apoyo-responsable') {
      const slot_idx = parseInt(nodo_cambio.getAttribute('data-slot'), 10);
      if (!isNaN(slot_idx)) {
        cambiar_apoyo_responsable(idx, slot_idx, nodo_cambio.value);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    const cab_ticket = e.target.closest('[data-accion="alternar-ticket-panel"], [data-accion="alternar-ticket-publico"]');
    if (cab_ticket && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      cab_ticket.click();
      return;
    }
    if (e.key !== 'Enter') return;
    const input_ss = e.target.closest('[data-enter="guardar-ss"]');
    if (input_ss) {
      e.preventDefault();
      const idx = parseInt(input_ss.getAttribute('data-index'), 10);
      if (!isNaN(idx)) guardar_nombre_servicio_social(idx, 0);
      return;
    }
    const input_ss_apoyo = e.target.closest('[data-enter="guardar-ss-apoyo"]');
    if (input_ss_apoyo) {
      e.preventDefault();
      const idx = parseInt(input_ss_apoyo.getAttribute('data-index'), 10);
      const slot_idx = parseInt(input_ss_apoyo.getAttribute('data-slot'), 10);
      if (!isNaN(idx) && !isNaN(slot_idx)) guardar_nombre_servicio_social(idx, slot_idx);
    }
  });
}

// =========================================================================
// funciones del selector de hora circular interactivo
// =========================================================================
function inicializar_eventos_reloj_circular() {
  const esfera = document.getElementById('reloj-esfera-interactiva');
  if (!esfera) return;

  const procesar_interaccion = (e, finalizar) => {
    const rect = esfera.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const client_x = e.touches ? e.touches[0].clientX : e.clientX;
    const client_y = e.touches ? e.touches[0].clientY : e.clientY;

    let grados = Math.atan2(client_y - cy, client_x - cx) * (180 / Math.PI) + 90;
    if (grados < 0) grados += 360;

    if (reloj_modo_actual === 'horas') {
      let h = Math.round(grados / 30);
      if (h === 0) h = 12;
      reloj_hora_sel = h;
      renderizar_cara_reloj();
      if (finalizar) {
        setTimeout(() => cambiar_modo_reloj('minutos'), 220);
      }
    } else {
      let m = Math.round(grados / 6) % 60;
      m = Math.round(m / 5) * 5;
      if (m === 60) m = 0;
      reloj_minuto_sel = m;
      renderizar_cara_reloj();
    }
  };

  esfera.addEventListener('mousedown', (e) => {
    arrastrando_reloj = true;
    procesar_interaccion(e, false);
  });
  window.addEventListener('mousemove', (e) => {
    if (arrastrando_reloj) procesar_interaccion(e, false);
  });
  window.addEventListener('mouseup', (e) => {
    if (arrastrando_reloj) {
      arrastrando_reloj = false;
      procesar_interaccion(e, true);
    }
  });

  esfera.addEventListener('touchstart', (e) => {
    arrastrando_reloj = true;
    procesar_interaccion(e, false);
    e.preventDefault();
  }, { passive: false });
  esfera.addEventListener('touchmove', (e) => {
    if (arrastrando_reloj) procesar_interaccion(e, false);
    e.preventDefault();
  }, { passive: false });
  esfera.addEventListener('touchend', () => {
    if (arrastrando_reloj) {
      arrastrando_reloj = false;
      if (reloj_modo_actual === 'horas') {
        setTimeout(() => cambiar_modo_reloj('minutos'), 220);
      }
    }
  });
}

function abrir_reloj_circular(id_input) {
  reloj_input_destino_id = id_input || 'hora-evento';
  const input = document.getElementById(reloj_input_destino_id);
  const valor_previo = input ? (input.getAttribute('data-hora-24') || input.value) : '';

  if (valor_previo && valor_previo.includes(':')) {
    const partes = valor_previo.split(':');
    let h24 = parseInt(partes[0], 10);
    let m = parseInt(partes[1], 10) || 0;
    if (!isNaN(h24)) {
      reloj_ampm_sel = h24 >= 12 ? 'PM' : 'AM';
      reloj_hora_sel = h24 % 12 || 12;
      reloj_minuto_sel = Math.round(m / 5) * 5;
      if (reloj_minuto_sel === 60) reloj_minuto_sel = 0;
    }
  } else {
    const sugerencia = new Date(Date.now() + 60 * 60 * 1000);
    const h_sug = sugerencia.getHours();
    let m_sug = Math.ceil(sugerencia.getMinutes() / 5) * 5;
    if (m_sug === 60) m_sug = 0;
    reloj_ampm_sel = h_sug >= 12 ? 'PM' : 'AM';
    reloj_hora_sel = h_sug % 12 || 12;
    reloj_minuto_sel = m_sug;
  }

  reloj_modo_actual = 'horas';
  renderizar_cara_reloj();
  document.getElementById('modal-reloj-circular').classList.remove('oculto');
}

function cambiar_modo_reloj(nuevo_modo) {
  reloj_modo_actual = nuevo_modo;
  renderizar_cara_reloj();
}

function seleccionar_ampm_reloj(periodo) {
  reloj_ampm_sel = periodo;
  renderizar_cara_reloj();
}

function renderizar_cara_reloj() {
  const btn_h = document.getElementById('reloj-btn-hora');
  const btn_m = document.getElementById('reloj-btn-minuto');
  const btn_am = document.getElementById('reloj-btn-am');
  const btn_pm = document.getElementById('reloj-btn-pm');
  const capa_numeros = document.getElementById('reloj-capa-numeros');
  const aguja = document.getElementById('reloj-aguja-linea');

  if (!btn_h || !capa_numeros || !aguja) return;

  btn_h.textContent = String(reloj_hora_sel).padStart(2, '0');
  btn_m.textContent = String(reloj_minuto_sel).padStart(2, '0');

  btn_h.classList.toggle('activo', reloj_modo_actual === 'horas');
  btn_m.classList.toggle('activo', reloj_modo_actual === 'minutos');
  btn_am.classList.toggle('activo', reloj_ampm_sel === 'AM');
  btn_pm.classList.toggle('activo', reloj_ampm_sel === 'PM');

  const radio = 86;
  const centro = 118;
  let html = '';

  if (reloj_modo_actual === 'horas') {
    const angulo_aguja = (reloj_hora_sel % 12) * 30;
    aguja.style.transform = `rotate(${angulo_aguja}deg)`;

    for (let i = 1; i <= 12; i++) {
      const rad = ((i * 30) - 90) * (Math.PI / 180);
      const x = centro + radio * Math.cos(rad);
      const y = centro + radio * Math.sin(rad);
      const sel = i === reloj_hora_sel ? 'seleccionado' : '';
      html += `<div class="reloj-num-item ${sel}" style="left: ${x}px; top: ${y}px;">${i}</div>`;
    }
  } else {
    const angulo_aguja = reloj_minuto_sel * 6;
    aguja.style.transform = `rotate(${angulo_aguja}deg)`;

    for (let i = 0; i < 60; i += 5) {
      const rad = ((i * 6) - 90) * (Math.PI / 180);
      const x = centro + radio * Math.cos(rad);
      const y = centro + radio * Math.sin(rad);
      const sel = i === reloj_minuto_sel ? 'seleccionado' : '';
      const etiqueta = String(i).padStart(2, '0');
      html += `<div class="reloj-num-item ${sel}" style="left: ${x}px; top: ${y}px;">${etiqueta}</div>`;
    }
  }

  capa_numeros.innerHTML = html;
}

function cerrar_reloj_circular() {
  document.getElementById('modal-reloj-circular').classList.add('oculto');
}

function obtener_fecha_iso_hoy() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function es_fecha_hora_futura(fecha_iso, hora_24) {
  if (!fecha_iso || !hora_24) return false;
  const hora_limpia = String(hora_24).slice(0, 5);
  const fecha_hora_ev = new Date(`${fecha_iso}T${hora_limpia}:00`);
  if (isNaN(fecha_hora_ev.getTime())) return false;
  return fecha_hora_ev.getTime() > new Date().getTime();
}

function confirmar_reloj_circular() {
  let h24 = reloj_hora_sel;
  if (reloj_ampm_sel === 'PM' && h24 < 12) h24 += 12;
  if (reloj_ampm_sel === 'AM' && h24 === 12) h24 = 0;

  const cadena_24 = `${String(h24).padStart(2, '0')}:${String(reloj_minuto_sel).padStart(2, '0')}`;
  const cadena_vista = `${String(reloj_hora_sel).padStart(2, '0')}:${String(reloj_minuto_sel).padStart(2, '0')} ${reloj_ampm_sel === 'AM' ? 'A.M.' : 'P.M.'}`;

  const input_fecha_ev = document.getElementById('fecha-evento');
  const fecha_seleccionada = input_fecha_ev ? input_fecha_ev.value : '';

  if (fecha_seleccionada && !es_fecha_hora_futura(fecha_seleccionada, cadena_24)) {
    Swal.fire({
      icon: 'warning',
      title: 'Hora ya transcurrida',
      text: 'No puedes asignar un evento en una hora que ya pasó. Selecciona una hora posterior a la actual.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const input = document.getElementById(reloj_input_destino_id);
  if (input) {
    input.setAttribute('data-hora-24', cadena_24);
    input.value = cadena_vista;
  }

  cerrar_reloj_circular();
}

function inicializar_controles_visuales() {
  const select_el = document.getElementById('selector-mes-reporte');
  if (select_el && window.TomSelect) {
    select_el.value = mes_filtro_activo;
    if (selector_mes_instancia) {
      selector_mes_instancia.destroy();
    }
    selector_mes_instancia = new TomSelect(select_el, {
      create: false,
      allowEmptyOption: false,
      controlInput: null,
      onDelete: () => false,
      onChange: (valor) => {
        if (!valor) {
          selector_mes_instancia.setValue(mes_actual_sistema, true);
          mes_filtro_activo = mes_actual_sistema;
        } else {
          mes_filtro_activo = valor;
        }
        pagina_actual_tickets = 1;
        renderizar_tickets();
      }
    });
    selector_mes_instancia.setValue(mes_filtro_activo, true);
  }

  configurar_calendario_evento();
  inicializar_selectores_formulario();
  inicializar_selectores_departamento_consulta_y_panel();
  inicializar_eventos_reloj_circular();
}

function inicializar_selectores_departamento_consulta_y_panel() {
  if (!window.TomSelect) return;

  const select_rastreo = document.getElementById('select-rastreo-depto');
  if (select_rastreo) {
    select_rastreo.required = false;
    select_rastreo.innerHTML = catalogo_departamentos_itp
      .map((d, i) => `<option value="${esc(d)}" ${i === 0 ? 'selected' : ''}>${esc(d)}</option>`)
      .join('');
    if (selector_rastreo_depto_instancia) {
      try { selector_rastreo_depto_instancia.destroy(); } catch (e) {}
    }
    selector_rastreo_depto_instancia = new TomSelect(select_rastreo, {
      create: false,
      allowEmptyOption: false,
      controlInput: null,
      dropdownParent: 'body',
      onDelete: () => false
    });
    selector_rastreo_depto_instancia.setValue(catalogo_departamentos_itp[0], true);
  }

  const filtro_panel = document.getElementById('filtro-departamento-panel');
  if (filtro_panel) {
    filtro_panel.innerHTML = `<option value="todos" selected>Todos los departamentos</option>` +
      catalogo_departamentos_itp.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    if (selector_filtro_depto_panel_instancia) {
      try { selector_filtro_depto_panel_instancia.destroy(); } catch (e) {}
    }
    selector_filtro_depto_panel_instancia = new TomSelect(filtro_panel, {
      create: false,
      allowEmptyOption: false,
      controlInput: null,
      dropdownParent: 'body',
      onDelete: () => false,
      onChange: (valor) => {
        depto_filtro_panel = valor || 'todos';
        pagina_actual_tickets = 1;
        renderizar_tickets();
      }
    });
    selector_filtro_depto_panel_instancia.setValue(depto_filtro_panel || 'todos', true);
  }
}

function inicializar_selectores_formulario() {
  if (!window.TomSelect) return;

  const select_depto = document.getElementById('solicitante');
  if (select_depto) {
    select_depto.required = false;
    select_depto.innerHTML = catalogo_departamentos_itp
      .map((d, i) => `<option value="${esc(d)}" ${i === 0 ? 'selected' : ''}>${esc(d)}</option>`)
      .join('');
    if (selector_solicitante_instancia) {
      try { selector_solicitante_instancia.destroy(); } catch (e) {}
    }
    selector_solicitante_instancia = new TomSelect(select_depto, {
      create: false,
      allowEmptyOption: false,
      controlInput: null,
      dropdownParent: 'body',
      onDelete: () => false
    });
    selector_solicitante_instancia.setValue(catalogo_departamentos_itp[0], true);
  }

  const select_lugar = document.getElementById('lugar-evento');
  if (select_lugar) {
    select_lugar.required = false;
    select_lugar.innerHTML = catalogo_sitios_itp
      .map((s, i) => `<option value="${esc(s)}" ${i === 0 ? 'selected' : ''}>${esc(s)}</option>`)
      .join('');
    if (selector_lugar_instancia) {
      try { selector_lugar_instancia.destroy(); } catch (e) {}
    }
    selector_lugar_instancia = new TomSelect(select_lugar, {
      create: false,
      allowEmptyOption: false,
      controlInput: null,
      dropdownParent: 'body',
      onDelete: () => false,
      onChange: (valor) => {
        const bloque_otro = document.getElementById('bloque-lugar-otro');
        const input_otro = document.getElementById('input-lugar-otro');
        if (valor === 'Otro (especificar aula)') {
          if (bloque_otro) bloque_otro.classList.remove('oculto');
          if (input_otro) setTimeout(() => input_otro.focus(), 60);
        } else {
          if (bloque_otro) bloque_otro.classList.add('oculto');
          if (input_otro) input_otro.value = '';
        }
      }
    });
    selector_lugar_instancia.setValue(catalogo_sitios_itp[0], true);
  }
}

function configurar_calendario_evento() {
  const fecha_input = document.getElementById('fecha-evento');
  if (fecha_input && window.flatpickr) {
    fecha_input.required = false;
    if (calendario_evento_instancia) {
      calendario_evento_instancia.destroy();
    }
    calendario_evento_instancia = flatpickr(fecha_input, {
      locale: 'es',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      altInputClass: 'input-fecha-con-icono',
      minDate: 'today',
      onChange: function(selectedDates, dateStr) {
        const input_h = document.getElementById('hora-evento');
        const hora_guardada = input_h ? (input_h.getAttribute('data-hora-24') || input_h.value) : '';
        if (dateStr && hora_guardada && !es_fecha_hora_futura(dateStr, hora_guardada)) {
          input_h.value = '';
          input_h.removeAttribute('data-hora-24');
          Swal.fire({
            icon: 'warning',
            title: 'Ajusta la hora del evento',
            text: 'La hora seleccionada previamente ya transcurrió el día de hoy. Por favor elige una hora futura.',
            confirmButtonColor: '#1B396A'
          });
        }
      },
      allowInput: false,
      disableMobile: true,
      onReady: function(selectedDates, dateStr, instance) {
        if (instance.altInput) {
          instance.altInput.placeholder = 'dd/mm/aaaa';
          instance.altInput.required = false;
        }
      }
    });
  }

  const hora_input = document.getElementById('hora-evento');
  if (hora_input) {
    hora_input.placeholder = '--:--';
    hora_input.required = false;
  }

  refrescar_iconos();
}

function inicializar_calendarios_panel_interno() {
  if (!window.flatpickr) return;
  document.querySelectorAll('.input-fecha-limite-panel').forEach(el => {
    const fecha_min_panel = obtener_fecha_iso_hoy();
    flatpickr(el, {
      minDate: fecha_min_panel,
      locale: 'es',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      allowInput: false,
      disableMobile: true,
      onChange: function(selectedDates, dateStr) {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          actualizar_campo(idx, 'fecha_limite', dateStr);
        }
      }
    });
  });
}

function extraer_mes_solicitud(item) {
  if (item.fecha_solicitud && item.fecha_solicitud.includes('/')) {
    const partes = item.fecha_solicitud.split('/');
    if (partes.length >= 2) {
      return partes[1].padStart(2, '0');
    }
  }
  if (item.fecha_evento && item.fecha_evento.includes('-')) {
    const partes_ev = item.fecha_evento.split('-');
    if (partes_ev.length >= 2) {
      return partes_ev[1].padStart(2, '0');
    }
  }
  return '';
}

function obtener_solicitudes_por_periodo() {
  if (!mes_filtro_activo || mes_filtro_activo === 'todos') {
    return solicitudes;
  }
  if (mes_filtro_activo === 'sem-1') {
    return solicitudes.filter(item => {
      const mes = parseInt(extraer_mes_solicitud(item), 10);
      return mes >= 1 && mes <= 6;
    });
  }
  if (mes_filtro_activo === 'sem-2') {
    return solicitudes.filter(item => {
      const mes = parseInt(extraer_mes_solicitud(item), 10);
      return mes >= 7 && mes <= 12;
    });
  }
  return solicitudes.filter(item => extraer_mes_solicitud(item) === mes_filtro_activo);
}

function cambiar_mes_filtro() {
  const select = document.getElementById('selector-mes-reporte');
  const valor_elegido = select && select.value ? select.value : mes_actual_sistema;
  mes_filtro_activo = nombres_meses[valor_elegido] ? valor_elegido : mes_actual_sistema;
  pagina_actual_tickets = 1;
  renderizar_tickets();
}

function animar_contador(id_elemento, valor_final) {
  const el = document.getElementById(id_elemento);
  if (!el) return;
  const valor_inicial = parseInt(el.textContent, 10) || 0;
  const duracion = 550;
  const inicio = performance.now();

  function paso(tiempo_actual) {
    const progreso = Math.min((tiempo_actual - inicio) / duracion, 1);
    const curva = 1 - Math.pow(1 - progreso, 3);
    el.textContent = Math.round(valor_inicial + (valor_final - valor_inicial) * curva);
    if (progreso < 1) {
      requestAnimationFrame(paso);
    }
  }
  requestAnimationFrame(paso);
}

function actualizar_metricas_panel() {
  const lista_base = obtener_solicitudes_por_periodo();
  let pendientes = 0;
  let en_proceso = 0;
  let terminados = 0;

  lista_base.forEach(item => {
    const est = calcular_estado_automatico(item);
    if (est === 'Pendiente') pendientes++;
    else if (est === 'En proceso') en_proceso++;
    else if (est === 'Terminado') terminados++;
  });

  animar_contador('stat-total', lista_base.length);
  animar_contador('stat-pendientes', pendientes);
  animar_contador('stat-proceso', en_proceso);
  animar_contador('stat-terminados', terminados);
}

let liquid_morph_listener_activo = false;

function inicializar_brillo_liquid_morph() {
  if (liquid_morph_listener_activo) return;
  if (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
  liquid_morph_listener_activo = true;

  document.addEventListener('mousemove', (e) => {
    const tarjeta = e.target.closest('.tarjeta-servicio, .ticket-item, .item-metrica-unificada');
    if (!tarjeta) return;
    const rect = tarjeta.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    tarjeta.style.setProperty('--mouse-x', `${x}px`);
    tarjeta.style.setProperty('--mouse-y', `${y}px`);
  }, { passive: true });
}

function aplicar_tema_visual(tema) {
  const es_oscuro = tema === 'oscuro';
  if (es_oscuro) {
    document.documentElement.setAttribute('data-tema', 'oscuro');
  } else {
    document.documentElement.removeAttribute('data-tema');
  }

  const meta_theme = document.querySelector('meta[name="theme-color"]');
  if (meta_theme) {
    meta_theme.setAttribute('content', es_oscuro ? '#070d19' : '#1B396A');
  }

  const btn_tema = document.getElementById('btn-tema-ios');
  if (btn_tema) {
    btn_tema.innerHTML = `<i data-lucide="${es_oscuro ? 'sun' : 'moon'}" id="icono-tema-ios"></i>`;
    btn_tema.setAttribute('title', es_oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    refrescar_iconos();
  }
}

function inicializar_tema_preferido() {
  let tema_actual = 'claro';
  try {
    const guardado = localStorage.getItem('itp_tema_preferido');
    if (guardado === 'oscuro' || guardado === 'claro') {
      tema_actual = guardado;
    }
  } catch (e) {}
  aplicar_tema_visual(tema_actual);
}

function alternar_modo_oscuro() {
  const es_oscuro_actual = document.documentElement.getAttribute('data-tema') === 'oscuro';
  const nuevo_tema = es_oscuro_actual ? 'claro' : 'oscuro';
  try {
    localStorage.setItem('itp_tema_preferido', nuevo_tema);
  } catch (e) {}
  aplicar_tema_visual(nuevo_tema);
}

function deshabilitar_autocompletado_global() {
  document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, form').forEach(el => {
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
  });
}

document.addEventListener('focusin', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    e.target.setAttribute('autocomplete', 'off');
    e.target.setAttribute('autocorrect', 'off');
  }
}, true);

async function inicializar() {
  deshabilitar_autocompletado_global();
  inicializar_tema_preferido();
  inicializar_delegacion_eventos_segura();
  const hoy = new Date();
  document.getElementById('fecha-actual').textContent = hoy.toLocaleDateString('es-MX');
  window.addEventListener('scroll', controlar_flecha_flotante);
  inicializar_brillo_liquid_morph();

  const badge = document.getElementById('estado-conexion');
  if (usar_nube) {
    badge.textContent = '● Conectado';
    badge.classList.add('online');
  } else {
    badge.textContent = 'Desconectado';
    badge.classList.remove('online');
  }

  inicializar_controles_visuales();

  // sincronización de estado de sesión real mediante supabase auth
  if (usar_nube && cliente_db) {
    const { data: datos_sesion } = await cliente_db.auth.getSession();
    sesion_autorizada = Boolean(datos_sesion && datos_sesion.session);
    if (sesion_autorizada) {
      await cargar_directorio_responsables();
    }

    cliente_db.auth.onAuthStateChange(async (evento, sesion) => {
      if (evento === 'SIGNED_OUT' || !sesion) {
        sesion_autorizada = false;
        actualizar_icono_candado();
        limpiar_directorio_responsables_memoria();
        solicitudes = [];
        renderizar_tickets();
        actualizar_notificaciones_ios();
      } else if (evento === 'SIGNED_IN') {
        const ya_autorizada = sesion_autorizada;
        sesion_autorizada = true;
        actualizar_icono_candado();
        if (!ya_autorizada || solicitudes.length === 0) {
          await cargar_directorio_responsables();
          await cargar_solicitudes();
        }
      } else if (evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED') {
        sesion_autorizada = true;
        actualizar_icono_candado();
      }
    });
  }

  actualizar_icono_candado();
  await actualizar_folio_preview();
  if (sesion_autorizada || !usar_nube) {
    await cargar_solicitudes();
  }

  try {
    const sesion_depto_guardada = JSON.parse(localStorage.getItem('itp_depto_sesion_equipo') || 'null');
    if (sesion_depto_guardada && sesion_depto_guardada.depto && sesion_depto_guardada.token) {
      if (selector_rastreo_depto_instancia) {
        selector_rastreo_depto_instancia.setValue(sesion_depto_guardada.depto, true);
      }
      await cargar_y_mostrar_solicitudes_departamento(sesion_depto_guardada.depto, '', true, sesion_depto_guardada.token);
    } else if (sesion_depto_guardada && sesion_depto_guardada.pin) {
      // limpia formato anterior que almacenaba el pin en texto plano
      localStorage.removeItem('itp_depto_sesion_equipo');
    }
  } catch (e) {}

  setInterval(() => {
    if (sesion_autorizada || !usar_nube) {
      renderizar_tickets();
      actualizar_notificaciones_ios();
    }
  }, 60000);
}

function actualizar_icono_candado() {
  const icono = document.getElementById('icono-candado');
  if (icono) {
    icono.setAttribute('data-lucide', sesion_autorizada ? 'unlock' : 'lock');
    refrescar_iconos();
  }
}

async function intentar_abrir_panel() {
  if (usar_nube && cliente_db) {
    const { data: datos_sesion } = await cliente_db.auth.getSession();
    sesion_autorizada = Boolean(datos_sesion && datos_sesion.session);
  }

  if (sesion_autorizada) {
    cambiar_vista('panel');
  } else {
    sesion_autorizada = false;
    document.getElementById('input-pin').value = '';
    document.getElementById('modal-pin').classList.remove('oculto');
    setTimeout(() => document.getElementById('input-pin').focus(), 100);
  }
}

// validación del pin directamente en el servidor mediante supabase auth (sin exponer el pin en el código)
async function verificar_pin(e) {
  e.preventDefault();
  const pin_ingresado = document.getElementById('input-pin').value.trim();
  const check_recordar = document.getElementById('check-recordar-pin');
  try {
    localStorage.setItem('itp_recordar_equipo', (!check_recordar || check_recordar.checked) ? '1' : '0');
  } catch (err) {}

  if (usar_nube && cliente_db) {
    const { data, error } = await cliente_db.auth.signInWithPassword({
      email: correo_panel_compartido,
      password: pin_ingresado
    });

    if (!error && data && data.session) {
      sesion_autorizada = true;
      actualizar_icono_candado();
      cerrar_modal_pin();
      await cargar_directorio_responsables();
      await cargar_solicitudes();
      cambiar_vista('panel');
      return;
    }
  }

  sesion_autorizada = false;
  const tarjeta = document.getElementById('tarjeta-pin');
  tarjeta.classList.remove('sacudir');
  void tarjeta.offsetWidth;
  tarjeta.classList.add('sacudir');
  Swal.fire({
    icon: 'error',
    title: 'Acceso Denegado',
    text: 'PIN institucional incorrecto.',
    confirmButtonColor: '#1B396A'
  });
}

function cerrar_modal_pin() {
  document.getElementById('modal-pin').classList.add('oculto');
}

async function cerrar_sesion_admin() {
  const resultado = await Swal.fire({
    title: '¿Estás seguro?',
    text: '¿Deseas cerrar sesión del panel administrativo?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#1B396A',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, cerrar sesión',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: {
      popup: ''
    }
  });

  if (resultado.isConfirmed) {
    try { localStorage.removeItem('itp_recordar_equipo'); } catch (err) {}
    if (usar_nube && cliente_db) {
      await cliente_db.auth.signOut();
    }
    sesion_autorizada = false;
    limpiar_directorio_responsables_memoria();
    pines_deptos_cache = [];
    cerrar_modal_pines_deptos();
    solicitudes = [];
    document.getElementById('contador-tickets').textContent = '0';
    actualizar_icono_candado();
    actualizar_notificaciones_ios();
    cambiar_vista('formulario');
  }
}

// =========================================================================
// administración de pines por departamento (solo panel interno autenticado)
// =========================================================================
function generar_codigo_pin_seguro(longitud = 6) {
  const digitos = '0123456789';
  const limite_sin_sesgo = 250; // múltiplo de 10 para evitar sesgo de módulo
  const largo = Math.max(6, Math.min(12, Number(longitud) || 6));
  const buffer = new Uint8Array(16);
  let pin = '';
  while (pin.length < largo) {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(buffer);
    } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(buffer);
    } else {
      throw new Error('Generador criptográfico no disponible en este navegador.');
    }
    for (let i = 0; i < buffer.length && pin.length < largo; i++) {
      if (buffer[i] < limite_sin_sesgo) {
        const d = digitos[buffer[i] % 10];
        if (pin.length === 0 && d === '0') continue;
        pin += d;
      }
    }
  }
  return pin;
}

function generar_codigo_pin_4() {
  return generar_codigo_pin_seguro(6);
}

async function abrir_modal_pines_deptos() {
  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }
  const modal = document.getElementById('modal-pines-deptos');
  if (modal) modal.classList.remove('oculto');
  await cargar_pines_departamentos();
  refrescar_iconos();
}

function cerrar_modal_pines_deptos() {
  const modal = document.getElementById('modal-pines-deptos');
  if (modal) modal.classList.add('oculto');
}

async function cargar_pines_departamentos() {
  const cont = document.getElementById('lista-pines-deptos');
  if (!cont) return;
  cont.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--ink-muted);">Cargando claves de departamentos...</div>`;

  const mapa_pines = {};
  if (usar_nube && cliente_db) {
    const { data, error } = await cliente_db
      .from('departamentos_acceso')
      .select('departamento, pin_acceso');
    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        if (row && row.departamento) {
          mapa_pines[row.departamento] = row.pin_acceso || '';
        }
      });
    }
  } else {
    try {
      const local_pins = JSON.parse(localStorage.getItem('tickets_itp_deptos_pins_v1') || '{}');
      Object.assign(mapa_pines, local_pins);
    } catch (e) {}
  }

  pines_deptos_cache = catalogo_departamentos_itp.map(depto => ({
    departamento: depto,
    pin_acceso: mapa_pines[depto] || ''
  }));

  renderizar_lista_pines_deptos();
}

function renderizar_lista_pines_deptos() {
  const cont = document.getElementById('lista-pines-deptos');
  if (!cont) return;

  cont.innerHTML = pines_deptos_cache.map((item, idx) => `
    <div class="fila-pin-depto" id="fila-pin-depto-${idx}">
      <span class="nombre-depto-pin">${esc(item.departamento)}</span>
      <div class="controles-pin-depto">
        <input type="text" id="input-cfg-pin-${idx}" class="input-cfg-pin" value="${esc(item.pin_acceso)}" minlength="4" maxlength="12" placeholder="Sin PIN" autocomplete="off" spellcheck="false">
        <button type="button" class="btn-gen-pin-item" data-accion="gen-pin-depto" data-depto-index="${idx}" title="Generar PIN aleatorio">
          <i data-lucide="refresh-cw"></i>
        </button>
        <button type="button" class="btn-guardar-pin-item" data-accion="guardar-pin-depto" data-depto-index="${idx}">
          <i data-lucide="check"></i> Guardar
        </button>
      </div>
    </div>
  `).join('');

  refrescar_iconos();
}

function asignar_pin_aleatorio_input(idx_depto) {
  const input = document.getElementById(`input-cfg-pin-${idx_depto}`);
  if (input) {
    input.value = generar_codigo_pin_4();
    input.focus();
  }
}

async function guardar_pin_departamento_panel(idx_depto) {
  if (!sesion_autorizada) return;
  const reg = pines_deptos_cache[idx_depto];
  const input = document.getElementById(`input-cfg-pin-${idx_depto}`);
  if (!reg || !input) return;

  const pin_nuevo = sanitizar_texto(input.value).slice(0, 12);
  if (pin_nuevo.length < 4) {
    Swal.fire({
      icon: 'warning',
      title: 'PIN muy corto',
      text: 'El PIN debe tener al menos 4 caracteres.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  if (usar_nube && cliente_db) {
    const { error } = await cliente_db
      .from('departamentos_acceso')
      .upsert(
        { departamento: reg.departamento, pin_acceso: pin_nuevo, intentos_fallidos: 0, bloqueado_hasta: null },
        { onConflict: 'departamento' }
      );
    if (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar PIN',
        text: error.message,
        confirmButtonColor: '#1B396A'
      });
      return;
    }
  } else {
    try {
      const local_pins = JSON.parse(localStorage.getItem('tickets_itp_deptos_pins_v1') || '{}');
      local_pins[reg.departamento] = pin_nuevo;
      localStorage.setItem('tickets_itp_deptos_pins_v1', JSON.stringify(local_pins));
    } catch (e) {}
  }

  reg.pin_acceso = pin_nuevo;
  const fila = document.getElementById(`fila-pin-depto-${idx_depto}`);
  if (fila) {
    fila.classList.add('pin-guardado-ok');
    setTimeout(() => fila.classList.remove('pin-guardado-ok'), 1200);
  }
}

async function generar_pines_faltantes_deptos() {
  if (!sesion_autorizada) return;
  const faltantes = pines_deptos_cache.filter(d => !d.pin_acceso || d.pin_acceso.trim().length < 4);
  if (faltantes.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Todo completo',
      text: 'Todos los departamentos ya cuentan con un PIN asignado.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const registros_upsert = faltantes.map(d => ({
    departamento: d.departamento,
    pin_acceso: generar_codigo_pin_4(),
    intentos_fallidos: 0,
    bloqueado_hasta: null
  }));

  if (usar_nube && cliente_db) {
    const { error } = await cliente_db
      .from('departamentos_acceso')
      .upsert(registros_upsert, { onConflict: 'departamento' });
    if (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al generar PINs',
        text: error.message,
        confirmButtonColor: '#1B396A'
      });
      return;
    }
  } else {
    try {
      const local_pins = JSON.parse(localStorage.getItem('tickets_itp_deptos_pins_v1') || '{}');
      registros_upsert.forEach(r => { local_pins[r.departamento] = r.pin_acceso; });
      localStorage.setItem('tickets_itp_deptos_pins_v1', JSON.stringify(local_pins));
    } catch (e) {}
  }

  registros_upsert.forEach(r => {
    const encontrado = pines_deptos_cache.find(x => x.departamento === r.departamento);
    if (encontrado) encontrado.pin_acceso = r.pin_acceso;
  });
  renderizar_lista_pines_deptos();
}

function obtener_info_sello_conformidad(item) {
  const activo = Boolean(item && item.sello_conformidad);
  const fecha_raw = item && item.sello_fecha ? item.sello_fecha : null;
  if (!activo) {
    return { activo: false, fecha_texto: '', cancelable: false, tiempo_restante: '' };
  }

  let cancelable = false;
  let seg_restantes = 0;

  if (typeof item.sello_cancelable === 'boolean') {
    cancelable = item.sello_cancelable;
    seg_restantes = Number(item.sello_segundos_restantes || 0);
  } else if (fecha_raw) {
    const ms_transcurridos = Date.now() - new Date(fecha_raw).getTime();
    const ms_limite = 24 * 60 * 60 * 1000;
    if (!isNaN(ms_transcurridos) && ms_transcurridos <= ms_limite) {
      cancelable = true;
      seg_restantes = Math.max(0, Math.floor((ms_limite - ms_transcurridos) / 1000));
    }
  }

  let fecha_texto = '';
  if (fecha_raw) {
    const fecha_obj = new Date(fecha_raw);
    if (!isNaN(fecha_obj.getTime())) {
      fecha_texto = fecha_obj.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  let tiempo_restante = '';
  if (cancelable && seg_restantes > 0) {
    const horas = Math.floor(seg_restantes / 3600);
    const mins = Math.floor((seg_restantes % 3600) / 60);
    tiempo_restante = horas > 0 ? `${horas} h ${mins} min` : `${Math.max(1, mins)} min`;
  }

  return { activo: true, fecha_texto, cancelable, tiempo_restante };
}

function renderizar_bloque_sello_publico(encontrado, es_denegada) {
  if (es_denegada || !encontrado || !encontrado.folio) return '';

  const folio_esc = esc(String(encontrado.folio).toUpperCase());
  const info_sello = obtener_info_sello_conformidad(encontrado);

  if (!info_sello.activo) {
    return `
      <div class="bloque-sello-conformidad pendiente">
        <div class="sello-info">
          <div class="sello-titulo"><i data-lucide="shield-check"></i> Sello de conformidad</div>
          <p class="sello-desc">Avala que el servicio fue recibido y cumplido a satisfacción.</p>
        </div>
        <button type="button" class="btn-poner-sello" data-accion="poner-sello" data-folio="${folio_esc}">
          <i data-lucide="badge-check"></i> Poner sello de conformidad
        </button>
      </div>
    `;
  }

  return `
    <div class="bloque-sello-conformidad emitido">
      <div class="sello-emitido-cabecera">
        <div class="sello-emblema">
          <i data-lucide="badge-check"></i>
          <div>
            <div class="sello-titulo">Sello de conformidad emitido</div>
            <p class="sello-desc">El servicio fue recibido y cumplido a satisfacción.${info_sello.fecha_texto ? ` · ${esc(info_sello.fecha_texto)}` : ''}</p>
          </div>
        </div>
        ${info_sello.cancelable
          ? `<div class="sello-acciones-cancelar">
               <button type="button" class="btn-quitar-sello" data-accion="quitar-sello" data-folio="${folio_esc}">
                 <i data-lucide="rotate-ccw"></i> Quitar sello
               </button>
               ${info_sello.tiempo_restante ? `<span class="sello-plazo-texto">Cancelable por ${esc(info_sello.tiempo_restante)}</span>` : ''}
             </div>`
          : `<span class="sello-bloqueado-tag"><i data-lucide="lock"></i> Definitivo</span>`
        }
      </div>
    </div>
  `;
}

function tiene_credencial_depto_activa() {
  return Boolean(consulta_depto_actual && (consulta_token_actual || consulta_pin_actual));
}

async function gestionar_sello_conformidad_publico(folio, activar) {
  const codigo = sanitizar_texto(folio).toUpperCase();
  if (!/^SRV-\d{3,6}$/.test(codigo)) return;
  if (!tiene_credencial_depto_activa()) {
    Swal.fire({
      icon: 'warning',
      title: 'Sesión de consulta requerida',
      text: 'Vuelve a consultar las solicitudes de tu departamento con su PIN.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const confirmacion = await Swal.fire({
    icon: activar ? 'question' : 'warning',
    title: activar ? 'Poner sello de conformidad' : 'Quitar sello de conformidad',
    text: activar
      ? 'Con este sello avalas que el servicio fue bien recibido y cumplido a satisfacción. Solo podrá cancelarse dentro de las primeras 24 horas.'
      : '¿Deseas cancelar el sello de conformidad de esta solicitud?',
    showCancelButton: true,
    confirmButtonColor: activar ? '#15803d' : '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: activar ? 'Sí, poner sello' : 'Sí, quitar sello',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: { popup: '' }
  });

  if (!confirmacion.isConfirmed) return;

  try {
    if (usar_nube && cliente_db) {
      const { data, error } = await cliente_db.rpc('gestionar_sello_conformidad', {
        p_folio: codigo,
        p_activar: Boolean(activar),
        p_departamento: consulta_depto_actual,
        p_pin: consulta_token_actual ? null : consulta_pin_actual,
        p_token: consulta_token_actual || null
      });

      if (error || (data && data.ok === false)) {
        const msg_err = (data && data.error) || (error && error.message) || 'No se pudo actualizar el sello de conformidad.';
        await Swal.fire({
          icon: 'warning',
          title: 'Acción no disponible',
          text: String(msg_err),
          confirmButtonColor: '#1B396A'
        });
        await cargar_y_mostrar_solicitudes_departamento(consulta_depto_actual, consulta_pin_actual, false, consulta_token_actual);
        return;
      }

      const idx_local = solicitudes.findIndex(s => String(s.folio).toUpperCase() === codigo);
      if (idx_local !== -1 && data) {
        solicitudes[idx_local].sello_conformidad = Boolean(data.sello_conformidad);
        solicitudes[idx_local].sello_fecha = data.sello_fecha || null;
        solicitudes[idx_local].sello_cancelable = Boolean(data.sello_cancelable);
        solicitudes[idx_local].sello_segundos_restantes = Number(data.sello_segundos_restantes || 0);
        renderizar_tickets();
      }
    } else {
      const idx_local = solicitudes.findIndex(s => String(s.folio).toUpperCase() === codigo);
      if (idx_local === -1) return;
      const item_local = solicitudes[idx_local];

      if (activar) {
        if (!item_local.sello_conformidad) {
          item_local.sello_conformidad = true;
          item_local.sello_fecha = new Date().toISOString();
        }
      } else {
        const ms_transcurridos = item_local.sello_fecha ? (Date.now() - new Date(item_local.sello_fecha).getTime()) : Infinity;
        if (ms_transcurridos > 24 * 60 * 60 * 1000) {
          await Swal.fire({
            icon: 'warning',
            title: 'Plazo concluido',
            text: 'El plazo de 24 horas para cancelar el sello de conformidad ya expiró.',
            confirmButtonColor: '#1B396A'
          });
          await cargar_y_mostrar_solicitudes_departamento(consulta_depto_actual, consulta_pin_actual, false, consulta_token_actual);
          return;
        }
        item_local.sello_conformidad = false;
        item_local.sello_fecha = null;
      }

      localStorage.setItem('tickets_itp_v6', JSON.stringify(solicitudes));
      renderizar_tickets();
    }

    tickets_abiertos_publico.add(codigo);
    await cargar_y_mostrar_solicitudes_departamento(consulta_depto_actual, consulta_pin_actual, false, consulta_token_actual);
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: err && err.message ? err.message : 'Ocurrió un error al procesar el sello de conformidad.',
      confirmButtonColor: '#1B396A'
    });
  }
}

// consulta privada por departamento y pin sin exponer solicitudes de otras áreas
async function consultar_solicitudes_departamento(e) {
  e.preventDefault();
  const select_depto = document.getElementById('select-rastreo-depto');
  const input_pin = document.getElementById('input-pin-depto');
  const depto = sanitizar_texto(select_depto ? select_depto.value : '');
  const pin = sanitizar_texto(input_pin ? input_pin.value : '');

  if (!depto || !pin) {
    Swal.fire({
      icon: 'warning',
      title: 'Datos requeridos',
      text: 'Selecciona tu departamento e ingresa su PIN institucional.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  tickets_abiertos_publico.clear();
  await cargar_y_mostrar_solicitudes_departamento(depto, pin, false, '');
}

async function recargar_solicitudes_departamento() {
  if (!tiene_credencial_depto_activa()) return;
  await cargar_y_mostrar_solicitudes_departamento(consulta_depto_actual, consulta_pin_actual, false, consulta_token_actual);
}

async function cargar_y_mostrar_solicitudes_departamento(depto, pin, silencioso, token_sesion = '') {
  const contenedor_res = document.getElementById('resultado-rastreo');
  const btn_consultar = document.getElementById('btn-consultar-depto');
  if (btn_consultar) btn_consultar.disabled = true;

  try {
    let lista_res = null;
    let error_msg = '';
    let token_resultante = token_sesion || '';
    const check_rec_depto = document.getElementById('check-recordar-depto');
    const quiere_recordar = !silencioso && (!check_rec_depto || check_rec_depto.checked);

    if (usar_nube && cliente_db) {
      const { data, error } = await cliente_db.rpc('consultar_solicitudes_departamento', {
        p_departamento: depto,
        p_pin: pin || null,
        p_token: token_sesion || null,
        p_crear_sesion: Boolean(!token_sesion && quiere_recordar)
      });

      if (error) {
        error_msg = error.message || 'No se pudo consultar el departamento.';
      } else if (!data || data.ok === false) {
        error_msg = (data && data.error) || 'Departamento o PIN incorrecto.';
      } else {
        lista_res = Array.isArray(data.solicitudes) ? data.solicitudes : [];
        if (data.sesion_token) {
          token_resultante = String(data.sesion_token);
        }
      }
    } else {
      let local_pins = {};
      try {
        local_pins = JSON.parse(localStorage.getItem('tickets_itp_deptos_pins_v1') || '{}');
      } catch (e) {}
      if (!local_pins[depto] || local_pins[depto] !== pin) {
        error_msg = 'Departamento o PIN incorrecto.';
      } else {
        lista_res = solicitudes.filter(
          s => String(s.solicitante || '').trim().toLowerCase() === depto.toLowerCase()
        );
      }
    }

    if (error_msg) {
      consulta_depto_actual = '';
      consulta_pin_actual = '';
      consulta_token_actual = '';
      solicitudes_depto_publico = [];
      try { localStorage.removeItem('itp_depto_sesion_equipo'); } catch (e) {}
      if (silencioso) {
        return;
      }
      contenedor_res.classList.remove('oculto');
      contenedor_res.innerHTML = `
        <div class="tarjeta-rastreo-publico">
          <div class="alerta-denegada-rastreo" style="margin-bottom: 0.75rem;">
            <strong>Acceso no autorizado:</strong> ${esc(error_msg)}
          </div>
          <div style="text-align: right;">
            <button type="button" class="btn-cerrar-rastreo" data-accion="cerrar-rastreo">Cerrar</button>
          </div>
        </div>
      `;
      return;
    }

    consulta_depto_actual = depto;
    consulta_token_actual = token_resultante;
    // si ya tenemos token opaco de servidor, no conservamos el pin ni siquiera en memoria
    consulta_pin_actual = token_resultante ? '' : (pin || '');
    solicitudes_depto_publico = lista_res || [];

    if (!silencioso) {
      try {
        if (quiere_recordar && token_resultante) {
          localStorage.setItem('itp_depto_sesion_equipo', JSON.stringify({ depto, token: token_resultante }));
        } else if (!quiere_recordar) {
          localStorage.removeItem('itp_depto_sesion_equipo');
        }
      } catch (e) {}
      const input_pin_d = document.getElementById('input-pin-depto');
      if (input_pin_d) input_pin_d.value = '';
    }

    if (solicitudes_depto_publico.length === 1 && solicitudes_depto_publico[0].folio) {
      tickets_abiertos_publico.add(String(solicitudes_depto_publico[0].folio).toUpperCase().replace(/[^A-Z0-9-]/g, ''));
    }

    renderizar_lista_solicitudes_departamento(contenedor_res);
  } finally {
    if (btn_consultar) btn_consultar.disabled = false;
  }
}

function renderizar_lista_solicitudes_departamento(contenedor_res) {
  if (!contenedor_res) return;
  contenedor_res.classList.remove('oculto');

  const total = solicitudes_depto_publico.length;
  const cabecera_html = `
    <div class="pub-depto-cabecera">
      <div class="pub-depto-titulo-grupo">
        <strong><i data-lucide="building-2" class="icono-inline"></i> ${esc(consulta_depto_actual)}</strong>
        <span class="pub-depto-conteo">${total} ${total === 1 ? 'solicitud registrada' : 'solicitudes registradas'}</span>
      </div>
      <div class="pub-depto-acciones">
        <button type="button" class="btn-actualizar-depto" data-accion="recargar-depto" title="Actualizar listado">
          <i data-lucide="refresh-cw"></i> Actualizar
        </button>
        <button type="button" class="btn-cerrar-rastreo" data-accion="cerrar-rastreo">Cerrar sesión</button>
      </div>
    </div>
  `;

  if (total === 0) {
    contenedor_res.innerHTML = `
      <div class="tarjeta-rastreo-publico">
        ${cabecera_html}
        <p class="sin-fecha-aviso" style="padding: 1rem 0;">Este departamento aún no tiene solicitudes registradas.</p>
      </div>
    `;
    refrescar_iconos();
    return;
  }

  const tarjetas_html = solicitudes_depto_publico.map(item => {
    const estado_calculado = calcular_estado_automatico(item);
    const info_den_pub = obtener_info_denegacion(item);
    const etiqueta_estado_pub = info_den_pub.denegada ? 'Denegada' : estado_calculado;
    const sufijo_estado = info_den_pub.denegada ? 'Denegada' : estado_calculado.replace(' ', '-');
    const clase_estado = 'estado-' + sufijo_estado;
    const clase_borde = 'borde-' + sufijo_estado;
    const folio_id = String(item.folio || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const folio_esc = esc(String(item.folio || '').toUpperCase());
    const abierta = tickets_abiertos_publico.has(folio_id);

    const aviso_denegacion_html = info_den_pub.denegada
      ? `<div class="alerta-denegada-rastreo"><strong>Solicitud Denegada:</strong> ${esc(info_den_pub.motivo)}</div>`
      : '';
    const lista_notas = obtener_arreglo_notas(item.observaciones);
    const notas_publicas = lista_notas.length > 0
      ? lista_notas.map(n => `<div class="nota-individual"><span>${esc(n)}</span></div>`).join('')
      : `<div class="sin-fecha-aviso">Sin notas registradas por el departamento.</div>`;

    const info_evento_publico = item.aplica_evento
      ? `<div class="ticket-dato-linea"><i data-lucide="map-pin"></i> <span>Lugar: ${esc(item.lugar_evento)}</span></div>
         <div class="ticket-dato-linea"><i data-lucide="calendar"></i> <span>${esc(item.fecha_evento)} <em>(${esc(item.hora_evento)} hrs)</em></span></div>`
      : `<div class="ticket-dato-linea sin-evento"><i data-lucide="info"></i> <span>Sin evento presencial asociado</span></div>`;

    const info_sello = obtener_info_sello_conformidad(item);
    const sello_badge_resumen = (!info_den_pub.denegada && info_sello.activo)
      ? `<span class="pi-badge-sello"><i data-lucide="badge-check"></i> Sello de conformidad</span>`
      : '';

    const resp_texto = formatear_responsables_corto(item.responsable);
    const limite_texto = (item.fecha_limite && item.fecha_limite.trim() !== '') ? item.fecha_limite : 'Sin asignar';

    return `
      <div class="pub-fila-solicitud ${clase_borde} ${abierta ? 'pub-abierta' : ''}">
        <div class="pub-cabecera-expandible" role="button" tabindex="0" aria-expanded="${abierta ? 'true' : 'false'}" data-accion="alternar-ticket-publico" data-folio="${folio_id}">
          <div class="pub-col-meta">
            <span class="ticket-folio"><i data-lucide="hash"></i>${folio_esc}</span>
            <span class="pub-fecha-sol">${esc(item.fecha_solicitud)}</span>
          </div>
          <div class="pub-col-resumen">
            <div class="pub-servicio-titulo">${esc(capitalizar_inicial(item.servicio))}</div>
            <div class="pub-resumen-datos">
              <span class="badge-estado-actual ${clase_estado}">
                <span class="punto-estado"></span>
                <span>${esc(etiqueta_estado_pub)}</span>
              </span>
              ${info_den_pub.denegada ? '' : `
              <span class="pi-dato-plano"><span class="pi-etiqueta-plana">Responsable:</span> <strong>${esc(resp_texto)}</strong></span>
              <span class="pi-dato-plano"><span class="pi-etiqueta-plana">Entrega:</span> <strong>${esc(limite_texto)}</strong></span>
              ${sello_badge_resumen}
              `}
            </div>
          </div>
          <span class="pub-indicador-toggle"><i data-lucide="chevron-down"></i></span>
        </div>

        <div class="pub-cuerpo-expandible">
          <div class="ticket-detalles" style="margin-bottom: 0.75rem;">
            <div class="ticket-dato-linea">
              <i data-lucide="file-text"></i>
              <span class="texto-descripcion-color">${formatear_descripcion_color(item.descripcion)}</span>
            </div>
            ${info_evento_publico}
          </div>

          ${aviso_denegacion_html}
          ${construir_linea_tiempo_rastreo(item, estado_calculado, info_den_pub.denegada)}

          <div class="rastreo-grid-meta">
            <div><strong>Responsable asignado:</strong> ${esc(resp_texto)}</div>
            <div><strong>Fecha límite estimada:</strong> ${esc(limite_texto)}</div>
          </div>

          <div class="caja-notas" style="border-top: none; padding-top: 0;">
            <span class="titulo-notas"><i data-lucide="message-square"></i> Notas del seguimiento:</span>
            <div class="lista-notas-items">${notas_publicas}</div>
          </div>

          ${renderizar_bloque_sello_publico(item, info_den_pub.denegada)}
        </div>
      </div>
    `;
  }).join('');

  contenedor_res.innerHTML = `
    <div class="tarjeta-rastreo-publico">
      ${cabecera_html}
      <div class="pub-lista-solicitudes">
        ${tarjetas_html}
      </div>
    </div>
  `;

  refrescar_iconos();
}

function cerrar_rastreo_publico() {
  const depto_prev = consulta_depto_actual;
  const token_prev = consulta_token_actual;
  consulta_depto_actual = '';
  consulta_pin_actual = '';
  consulta_token_actual = '';
  solicitudes_depto_publico = [];
  tickets_abiertos_publico.clear();
  try { localStorage.removeItem('itp_depto_sesion_equipo'); } catch (e) {}
  if (usar_nube && cliente_db && depto_prev && token_prev) {
    try {
      cliente_db.rpc('cerrar_sesion_departamento', {
        p_departamento: depto_prev,
        p_token: token_prev
      }).catch(() => {});
    } catch (e) {}
  }
  const res = document.getElementById('resultado-rastreo');
  if (res) {
    res.classList.add('oculto');
    res.innerHTML = '';
  }
  const input_pin = document.getElementById('input-pin-depto');
  if (input_pin) input_pin.value = '';
}

// =========================================================================
// línea de tiempo visual estilo rastreo de paquete (vista de departamento)
// =========================================================================
function construir_linea_tiempo_rastreo(item, estado_calc, es_denegada) {
  const lista_resp = parsear_responsables(item.responsable);
  const tiene_resp = lista_resp.length > 0;
  const nombre_resp = tiene_resp ? formatear_responsables_corto(item.responsable) : '';

  let pasos;
  if (es_denegada) {
    pasos = [
      { titulo: 'Recibida', detalle: item.fecha_solicitud || '', icono: 'scroll-text', estado: 'hecho' },
      { titulo: 'Revisión', detalle: 'Evaluada por el departamento', icono: 'scan-search', estado: 'hecho' },
      { titulo: 'Denegada', detalle: 'Consulta el motivo arriba', icono: 'octagon-x', estado: 'denegado' }
    ];
  } else {
    const terminado = estado_calc === 'Terminado';
    const en_proceso = estado_calc === 'En proceso' || terminado;
    pasos = [
      { titulo: 'Recibida', detalle: item.fecha_solicitud || '', icono: 'scroll-text', estado: 'hecho' },
      { titulo: 'Asignada', detalle: tiene_resp ? nombre_resp : 'Por asignar', icono: 'handshake', estado: tiene_resp ? 'hecho' : 'actual' },
      { titulo: 'En producción', detalle: en_proceso ? 'Trabajando en tu solicitud' : 'En espera', icono: 'pen-tool', estado: terminado ? 'hecho' : (en_proceso ? 'actual' : 'pendiente') },
      { titulo: 'Concluida', detalle: terminado ? 'Servicio entregado' : (item.fecha_limite || item.fecha_evento || 'Próximamente'), icono: 'badge-check', estado: terminado ? 'hecho' : 'pendiente' }
    ];
    if (!tiene_resp) {
      pasos[2].estado = 'pendiente';
    }
  }

  const hechos = pasos.filter(p => p.estado === 'hecho' || p.estado === 'denegado').length;
  const actual = pasos.some(p => p.estado === 'actual') ? 0.5 : 0;
  const progreso = Math.min(100, ((hechos - 1 + actual) / (pasos.length - 1)) * 100);

  return `
    <div class="linea-tiempo-rastreo ${es_denegada ? 'es-denegada' : ''}" style="--progreso-lt: ${Math.max(0, progreso)}%; --total-pasos: ${pasos.length};">
      <div class="lt-riel"><div class="lt-riel-relleno"></div></div>
      ${pasos.map((p, i) => `
        <div class="lt-paso lt-${p.estado}" style="--lt-delay: ${i * 0.18}s">
          <div class="lt-nodo"><i data-lucide="${p.icono}"></i></div>
          <span class="lt-titulo">${esc(p.titulo)}</span>
          <span class="lt-detalle">${esc(p.detalle)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// =========================================================================
// vista conmutable de calendario / cronograma de eventos (panel interno)
// =========================================================================
let vista_panel_actual = 'lista';
let calendario_mes_vista = new Date().getMonth();
let calendario_anio_vista = new Date().getFullYear();
let calendario_dia_seleccionado_movil = null;

function cambiar_vista_panel(vista) {
  vista_panel_actual = vista === 'calendario' ? 'calendario' : 'lista';
  const cont_lista = document.getElementById('contenedor-tickets');
  const cont_cal = document.getElementById('contenedor-calendario');
  const btn_lista = document.getElementById('btn-vista-lista');
  const btn_cal = document.getElementById('btn-vista-calendario');
  const es_cal = vista_panel_actual === 'calendario';

  if (cont_lista) cont_lista.classList.toggle('oculto', es_cal);
  if (cont_cal) cont_cal.classList.toggle('oculto', !es_cal);
  if (btn_lista) btn_lista.classList.toggle('activo', !es_cal);
  if (btn_cal) btn_cal.classList.toggle('activo', es_cal);

  if (es_cal) renderizar_calendario_panel();
}

function mover_mes_calendario(delta) {
  calendario_mes_vista += delta;
  if (calendario_mes_vista < 0) { calendario_mes_vista = 11; calendario_anio_vista--; }
  if (calendario_mes_vista > 11) { calendario_mes_vista = 0; calendario_anio_vista++; }
  calendario_dia_seleccionado_movil = null;
  renderizar_calendario_panel();
}

function renderizar_calendario_panel() {
  const cont = document.getElementById('contenedor-calendario');
  if (!cont || vista_panel_actual !== 'calendario') return;

  const anio = calendario_anio_vista;
  const mes = calendario_mes_vista;
  const prefijo_mes = `${anio}-${String(mes + 1).padStart(2, '0')}-`;
  const nombres_mes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // agrupa solicitudes por día usando la fecha del evento o, en su defecto, la fecha límite
  const eventos_por_dia = {};
  solicitudes.forEach(item => {
    const fecha_ref = (item.aplica_evento && item.fecha_evento) ? item.fecha_evento : (item.fecha_limite || '');
    if (!fecha_ref || !fecha_ref.startsWith(prefijo_mes)) return;
    const dia = parseInt(fecha_ref.slice(8, 10), 10);
    if (!eventos_por_dia[dia]) eventos_por_dia[dia] = [];
    eventos_por_dia[dia].push(item);
  });
  Object.values(eventos_por_dia).forEach(lista => {
    lista.sort((a, b) => String(a.hora_evento || '99').localeCompare(String(b.hora_evento || '99')));
  });

  const primer_dia = (new Date(anio, mes, 1).getDay() + 6) % 7; // semana inicia en lunes
  const dias_mes = new Date(anio, mes + 1, 0).getDate();
  const hoy = new Date();
  const es_mes_hoy = hoy.getFullYear() === anio && hoy.getMonth() === mes;
  const total_mes = Object.values(eventos_por_dia).reduce((acc, l) => acc + l.length, 0);

  const dias_con_ev_nums = Object.keys(eventos_por_dia).map(Number).sort((a, b) => a - b);
  if (!calendario_dia_seleccionado_movil || calendario_dia_seleccionado_movil < 1 || calendario_dia_seleccionado_movil > dias_mes) {
    if (es_mes_hoy && eventos_por_dia[hoy.getDate()]) {
      calendario_dia_seleccionado_movil = hoy.getDate();
    } else if (dias_con_ev_nums.length > 0) {
      calendario_dia_seleccionado_movil = dias_con_ev_nums[0];
    } else if (es_mes_hoy) {
      calendario_dia_seleccionado_movil = hoy.getDate();
    } else {
      calendario_dia_seleccionado_movil = 1;
    }
  }

  let celdas = '';
  for (let i = 0; i < primer_dia; i++) {
    celdas += `<div class="cal-celda cal-vacia"></div>`;
  }
  for (let d = 1; d <= dias_mes; d++) {
    const lista = eventos_por_dia[d] || [];
    const es_hoy = es_mes_hoy && hoy.getDate() === d;
    const es_sel_movil = calendario_dia_seleccionado_movil === d;
    const visibles = lista.slice(0, 3);
    const extra = lista.length - visibles.length;

    const puntos_movil = lista.slice(0, 4).map(ev => {
      const info_den = obtener_info_denegacion(ev);
      const est = info_den.denegada ? 'Denegada' : calcular_estado_automatico(ev);
      return `<span class="cal-punto-dia cal-ev-${est.replace(' ', '-')}"></span>`;
    }).join('');

    celdas += `
      <div class="cal-celda ${es_hoy ? 'cal-hoy' : ''} ${lista.length ? 'cal-con-eventos' : ''} ${es_sel_movil ? 'cal-dia-activo-movil' : ''}" data-accion="cal-sel-dia" data-dia="${d}">
        <span class="cal-num-dia">${d}</span>
        <div class="cal-puntos-movil">${puntos_movil}</div>
        ${visibles.map(ev => {
          const info_den = obtener_info_denegacion(ev);
          const est = info_den.denegada ? 'Denegada' : calcular_estado_automatico(ev);
          const clase_est = 'cal-ev-' + est.replace(' ', '-');
          const resp_corto = info_den.denegada ? 'Denegada' : formatear_responsables_corto(ev.responsable);
          const hora = ev.aplica_evento && ev.hora_evento ? String(ev.hora_evento).slice(0, 5) : 'Límite';
          const folio_ev = esc(String(ev.folio || '').toUpperCase());
          return `
            <button type="button" class="cal-evento ${clase_est}" data-accion="cal-evento" data-folio="${folio_ev}"
              title="${folio_ev} · ${esc(capitalizar_inicial(ev.servicio))} · ${esc(ev.solicitante)}${ev.lugar_evento ? ' · ' + esc(ev.lugar_evento) : ''} · ${esc(resp_corto)}">
              <span class="cal-ev-hora">${esc(hora)}</span>
              <span class="cal-ev-texto">${esc(capitalizar_inicial(ev.servicio))}</span>
              <span class="cal-ev-resp">${esc(resp_corto)}</span>
            </button>
          `;
        }).join('')}
        ${extra > 0 ? `<span class="cal-mas">+${extra} más</span>` : ''}
      </div>
    `;
  }

  const nombres_dia_largo = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const fecha_sel_obj = new Date(anio, mes, calendario_dia_seleccionado_movil);
  const nombre_dia_sel = nombres_dia_largo[fecha_sel_obj.getDay()];
  const lista_dia_sel = eventos_por_dia[calendario_dia_seleccionado_movil] || [];

  const html_agenda_movil = lista_dia_sel.length > 0
    ? lista_dia_sel.map(ev => {
        const info_den = obtener_info_denegacion(ev);
        const est = info_den.denegada ? 'Denegada' : calcular_estado_automatico(ev);
        const clase_est = 'cal-ev-' + est.replace(' ', '-');
        const resp_corto = info_den.denegada ? 'Denegada' : formatear_responsables_corto(ev.responsable);
        const hora = ev.aplica_evento && ev.hora_evento ? `${String(ev.hora_evento).slice(0, 5)} hrs` : 'Fecha límite';
        const folio_ev = esc(String(ev.folio || '').toUpperCase());
        return `
          <button type="button" class="cal-agenda-item ${clase_est}" data-accion="cal-evento" data-folio="${folio_ev}">
            <div class="cal-agenda-hora">
              <strong>${esc(hora)}</strong>
              <span>#${folio_ev}</span>
            </div>
            <div class="cal-agenda-info">
              <div class="cal-agenda-servicio">${esc(capitalizar_inicial(ev.servicio))}</div>
              <div class="cal-agenda-meta">${esc(ev.solicitante)}${ev.lugar_evento ? ' · ' + esc(ev.lugar_evento) : ''}</div>
              ${info_den.denegada ? '' : `<div class="cal-agenda-resp">Responsable: <strong>${esc(resp_corto)}</strong></div>`}
            </div>
          </button>
        `;
      }).join('')
    : `<div class="cal-agenda-vacia">Sin eventos programados para este día.</div>`;

  cont.innerHTML = `
    <div class="cal-cabecera">
      <button type="button" class="btn-pagina-ticket nav" data-accion="cal-mes" data-delta="-1" title="Mes anterior"><i data-lucide="chevron-left"></i></button>
      <div class="cal-titulo">
        <strong>${nombres_mes[mes]} ${anio}</strong>
        <span>${total_mes} ${total_mes === 1 ? 'evento programado' : 'eventos programados'}</span>
      </div>
      <button type="button" class="btn-pagina-ticket nav" data-accion="cal-mes" data-delta="1" title="Mes siguiente"><i data-lucide="chevron-right"></i></button>
    </div>
    <div class="cal-leyenda">
      <span><i class="cal-punto cal-ev-Pendiente"></i> Pendiente</span>
      <span><i class="cal-punto cal-ev-En-proceso"></i> En proceso</span>
      <span><i class="cal-punto cal-ev-Terminado"></i> Terminado</span>
      <span><i class="cal-punto cal-ev-Denegada"></i> Denegada</span>
    </div>
    <div class="cal-grid">
      ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(n => `<div class="cal-dia-semana">${n}</div>`).join('')}
      ${celdas}
    </div>
    <div class="cal-agenda-movil">
      <div class="cal-agenda-cabecera">
        <strong>${nombre_dia_sel} ${calendario_dia_seleccionado_movil} de ${nombres_mes[mes]}</strong>
        <span>${lista_dia_sel.length} ${lista_dia_sel.length === 1 ? 'solicitud' : 'solicitudes'}</span>
      </div>
      <div class="cal-agenda-lista">
        ${html_agenda_movil}
      </div>
    </div>
  `;
  refrescar_iconos();
}

function calcular_estado_automatico(item) {
  const tiene_responsable = parsear_responsables(item && item.responsable).length > 0;
  const tiene_limite = Boolean(item.fecha_limite && item.fecha_limite.trim() !== '');

  // solo pasa a terminado en automático cuando tiene un responsable asignado
  if (tiene_responsable) {
    const ahora = new Date();

    if (item.aplica_evento && item.fecha_evento) {
      const hora_ev = (item.hora_evento || '23:59').slice(0, 5);
      const fecha_evento_completa = new Date(`${item.fecha_evento}T${hora_ev}:00`);
      if (ahora >= fecha_evento_completa) {
        return 'Terminado';
      }
    }

    if (item.fecha_limite) {
      const fecha_limite_completa = new Date(`${item.fecha_limite}T23:59:00`);
      if (ahora >= fecha_limite_completa) {
        return 'Terminado';
      }
    }
  }

  if (tiene_responsable || tiene_limite) {
    return 'En proceso';
  }

  return 'Pendiente';
}

// sincronización en la nube restringida exclusivamente a sesiones autenticadas
async function sincronizar_estados_nube() {
  if (!usar_nube || !cliente_db || !sesion_autorizada) return;
  for (const item of solicitudes) {
    const estado_real = calcular_estado_automatico(item);
    if (item.estado !== estado_real && item.id) {
      item.estado = estado_real;
      await cliente_db.from('solicitudes').update({ estado: estado_real }).eq('id', item.id);
    }
  }
}

// carga del listado completo restringida a usuarios con sesión activa en el panel interno
async function cargar_solicitudes() {
  if (usar_nube) {
    if (!sesion_autorizada || !cliente_db) {
      await actualizar_folio_preview();
      return;
    }

    const { data, error } = await cliente_db
      .from('solicitudes')
      .select('*')
      .order('id', { ascending: false });

    if (!error && data) {
      solicitudes = data;
      await sincronizar_estados_nube();
    }
  } else {
    solicitudes = JSON.parse(localStorage.getItem('tickets_itp_v6')) || [
      {
        id: 1,
        folio: 'SRV-001',
        fecha_solicitud: '22/10/2026',
        servicio: 'Cobertura fotográfica/audiovisual',
        solicitante: 'Dpto. Comunicación y Difusión',
        descripcion: '[Fotografía general] — Ceremonia de entrega de títulos',
        aplica_evento: true,
        fecha_evento: '2026-10-28',
        hora_evento: '11:00',
        lugar_evento: 'Auditorio Principal',
        estado: 'En proceso',
        responsable: 'Karla',
        fecha_limite: '',
        observaciones: '[22/10/2026] Solicitud recibida y en proceso de asignación.'
      }
    ];
  }

  await actualizar_folio_preview();
  renderizar_tickets();
  actualizar_notificaciones_ios();
}

function controlar_flecha_flotante() {
  const btn_subir = document.getElementById('btn-subir');
  if (window.scrollY > 220) {
    btn_subir.classList.add('visible');
  } else {
    btn_subir.classList.remove('visible');
  }
}

// obtiene la vista previa del siguiente folio desde la función rpc siguiente_folio
async function actualizar_folio_preview() {
  const el_preview = document.getElementById('folio-preview');
  if (usar_nube && cliente_db) {
    try {
      const { data, error } = await cliente_db.rpc('siguiente_folio');
      if (!error && data && typeof data === 'string') {
        if (el_preview) el_preview.textContent = data;
        return data;
      }
      const { data: folios_db } = await cliente_db.from('solicitudes').select('folio');
      if (Array.isArray(folios_db) && folios_db.length > 0) {
        let max_db = 0;
        folios_db.forEach(f => {
          const n = parseInt(String(f.folio || '').replace(/\D/g, ''), 10);
          if (!isNaN(n) && n > max_db) max_db = n;
        });
        const sig_db = Math.max(folios_db.length, max_db) + 1;
        const cod_db = 'SRV-' + String(sig_db).padStart(3, '0');
        if (el_preview) el_preview.textContent = cod_db;
        return cod_db;
      }
    } catch (e) {}
  }

  let max_num = 0;
  solicitudes.forEach(s => {
    const num = parseInt(String(s.folio || '').replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > max_num) {
      max_num = num;
    }
  });
  const siguiente_numero = Math.max(solicitudes.length, max_num) + 1;
  const codigo = 'SRV-' + String(siguiente_numero).padStart(3, '0');
  if (el_preview) el_preview.textContent = codigo;
  return codigo;
}

function seleccionar_servicio(elemento, nombre_servicio) {
  document.querySelectorAll('.tarjeta-servicio').forEach(t => t.classList.remove('seleccionada'));
  elemento.classList.add('seleccionada');
  servicio_actual = nombre_servicio;
  document.getElementById('texto-servicio-elegido').textContent = nombre_servicio;

  const clave_conf = Object.keys(configuracion_servicios).find(
    k => k.toLowerCase() === nombre_servicio.toLowerCase()
  );
  const conf = configuracion_servicios[clave_conf];
  if (conf) {
    document.getElementById('label-especifico').textContent = conf.label_esp;
    document.getElementById('detalle-especifico').placeholder = conf.placeholder_esp;
    document.getElementById('label-descripcion').textContent = conf.label_desc;
    document.getElementById('descripcion').placeholder = conf.placeholder_desc;
  }

  alternar_evento(true);

  if (calendario_evento_instancia && calendario_evento_instancia.altInput) {
    calendario_evento_instancia.altInput.placeholder = 'dd/mm/aaaa';
  }
  const input_hora = document.getElementById('hora-evento');
  if (input_hora) {
    input_hora.placeholder = '--:--';
  }
  refrescar_iconos();

  const seccion_detalles = document.getElementById('seccion-detalles');
  seccion_detalles.scrollIntoView({ behavior: 'smooth', block: 'start' });

  setTimeout(() => {
    document.getElementById('detalle-especifico').focus({ preventScroll: true });
  }, 450);
}

function ir_arriba_del_todo() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth'
  });
}

function volver_catalogo() {
  ir_arriba_del_todo();
}

function alternar_evento(forzar_estado) {
  aplica_evento = typeof forzar_estado === 'boolean' ? forzar_estado : !aplica_evento;
  const bloque = document.getElementById('bloque-evento');
  const boton_switch = document.getElementById('switch-evento');
  const input_fecha_orig = document.getElementById('fecha-evento');
  const input_visible_fecha = calendario_evento_instancia && calendario_evento_instancia.altInput
    ? calendario_evento_instancia.altInput
    : input_fecha_orig;
  const input_visible_hora = document.getElementById('hora-evento');
  const input_lugar = document.getElementById('lugar-evento');

  // nunca dejamos required en el input oculto de flatpickr para evitar bloqueo del navegador
  if (input_fecha_orig) input_fecha_orig.required = false;
  if (input_visible_fecha) input_visible_fecha.required = false;
  if (input_visible_hora) input_visible_hora.required = false;

  if (aplica_evento) {
    bloque.classList.add('abierto');
    boton_switch.classList.add('activo');
    if (input_visible_fecha) {
      input_visible_fecha.placeholder = 'dd/mm/aaaa';
    }
    if (input_visible_hora) {
      input_visible_hora.placeholder = '--:--';
    }
    if (input_lugar) input_lugar.required = false;
  } else {
    bloque.classList.remove('abierto');
    boton_switch.classList.remove('activo');
    if (input_lugar) input_lugar.required = false;
  }
}

async function guardar_solicitud(e) {
  e.preventDefault();

  // validación anti-bots mediante campo honeypot invisible
  const campo_hp = document.getElementById('campo-sitio-web-hp');
  if (campo_hp && campo_hp.value.trim() !== '') {
    return;
  }

  if (aplica_evento && !document.getElementById('fecha-evento').value) {
    Swal.fire({
      icon: 'warning',
      title: 'Fecha requerida',
      text: 'Por favor selecciona la fecha del evento en el calendario.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const input_hora_el = document.getElementById('hora-evento');
  const valor_hora_24 = input_hora_el.getAttribute('data-hora-24') || input_hora_el.value;

  if (aplica_evento && !valor_hora_24) {
    Swal.fire({
      icon: 'warning',
      title: 'Hora requerida',
      text: 'Por favor selecciona la hora del evento en el reloj.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const input_lugar_el = document.getElementById('lugar-evento');
  const input_lugar_otro_el = document.getElementById('input-lugar-otro');
  const es_lugar_otro = input_lugar_el && input_lugar_el.value === 'Otro (especificar aula)';
  const valor_lugar_final = es_lugar_otro
    ? (input_lugar_otro_el ? input_lugar_otro_el.value.trim() : '')
    : (input_lugar_el ? input_lugar_el.value.trim() : '');

  if (aplica_evento && !valor_lugar_final) {
    Swal.fire({
      icon: 'warning',
      title: es_lugar_otro ? 'Aula o sitio requerido' : 'Sitio requerido',
      text: es_lugar_otro
        ? 'Por favor especifica el aula o lugar del evento.'
        : 'Por favor selecciona el sitio o lugar del evento.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const btn_submit = document.getElementById('btn-submit-form');
  const valor_fecha_ev = document.getElementById('fecha-evento').value;
  if (aplica_evento && !es_fecha_hora_futura(valor_fecha_ev, valor_hora_24)) {
    Swal.fire({
      icon: 'warning',
      title: 'Fecha u hora no válida',
      text: 'No se permite programar un evento en una fecha u hora que ya transcurrió. Selecciona un horario futuro.',
      confirmButtonColor: '#1B396A'
    });
    return;
  }

  const texto_btn = document.getElementById('texto-btn-enviar');
  btn_submit.disabled = true;
  texto_btn.textContent = 'Enviando solicitud...';

  try {
    const fecha_hoy = document.getElementById('fecha-actual').textContent;
    const esp_valor = sanitizar_texto(document.getElementById('detalle-especifico').value.trim()).slice(0, 180);
    const desc_valor = sanitizar_texto(document.getElementById('descripcion').value.trim()).slice(0, 400);

    let folio_confirmado = await actualizar_folio_preview();

    const nueva = {
      folio: folio_confirmado,
      fecha_solicitud: fecha_hoy,
      servicio: capitalizar_inicial(servicio_actual),
      solicitante: sanitizar_texto(document.getElementById('solicitante').value.trim()).slice(0, 150),
      descripcion: `[${esp_valor}] — ${desc_valor}`,
      aplica_evento: aplica_evento,
      fecha_evento: aplica_evento ? document.getElementById('fecha-evento').value : '',
      hora_evento: aplica_evento ? valor_hora_24 : '',
      lugar_evento: aplica_evento ? sanitizar_texto(valor_lugar_final).slice(0, 150) : '',
      estado: 'Pendiente',
      responsable: 'Sin asignar',
      fecha_limite: '',
      observaciones: `[${fecha_hoy}] Solicitud registrada en plataforma.`
    };

    if (usar_nube && cliente_db) {
      // registro atómico en servidor con reintento automático anti-colisión para envíos simultáneos
      let guardado_exitoso = false;
      let ultimo_error_db = null;

      for (let intento = 0; intento < 4 && !guardado_exitoso; intento++) {
        if (intento > 0) {
          await new Promise(res => setTimeout(res, 90 + Math.floor(Math.random() * 140)));
          folio_confirmado = await actualizar_folio_preview();
          nueva.folio = folio_confirmado;
        }

        const { data: respuesta_rpc, error: error_rpc } = await cliente_db.rpc('crear_solicitud', { p_datos: nueva });

        if (!error_rpc) {
          if (typeof respuesta_rpc === 'string' && respuesta_rpc.startsWith('SRV-')) {
            folio_confirmado = respuesta_rpc;
            nueva.folio = folio_confirmado;
          } else if (respuesta_rpc && respuesta_rpc.folio) {
            folio_confirmado = respuesta_rpc.folio;
            nueva.folio = folio_confirmado;
          }
          guardado_exitoso = true;
          break;
        }

        const msg_err = String(error_rpc.message || '');
        const es_colision = error_rpc.code === '23505' || msg_err.toLowerCase().includes('duplicate') || msg_err.includes('solicitudes_folio_unico');
        if (es_colision) {
          ultimo_error_db = error_rpc;
          continue;
        }

        const rpc_no_existe = msg_err.includes('crear_solicitud') || error_rpc.code === 'PGRST202' || error_rpc.code === '42883';
        if (rpc_no_existe) {
          nueva.estado = calcular_estado_automatico(nueva);
          const { error: error_insert } = await cliente_db.from('solicitudes').insert([nueva]);
          if (!error_insert) {
            guardado_exitoso = true;
            break;
          }
          const msg_ins = String(error_insert.message || '');
          if (error_insert.code === '23505' || msg_ins.toLowerCase().includes('duplicate')) {
            ultimo_error_db = error_insert;
            continue;
          }
          throw new Error(msg_ins);
        }

        throw new Error(msg_err || 'No se pudo guardar la solicitud en la base de datos.');
      }

      if (!guardado_exitoso && ultimo_error_db) {
        throw new Error(ultimo_error_db.message || 'No se pudo asignar el folio tras varios intentos.');
      }

      if (sesion_autorizada) {
        await cargar_solicitudes();
      } else {
        await actualizar_folio_preview();
      }
      if (tiene_credencial_depto_activa() && String(nueva.solicitante || '').toLowerCase() === consulta_depto_actual.toLowerCase()) {
        await cargar_y_mostrar_solicitudes_departamento(consulta_depto_actual, consulta_pin_actual, true, consulta_token_actual);
      }
    } else {
      nueva.estado = calcular_estado_automatico(nueva);
      solicitudes.unshift(nueva);
      localStorage.setItem('tickets_itp_v6', JSON.stringify(solicitudes));
      await actualizar_folio_preview();
      renderizar_tickets();
      actualizar_notificaciones_ios();
      if (tiene_credencial_depto_activa() && String(nueva.solicitante || '').toLowerCase() === consulta_depto_actual.toLowerCase()) {
        await cargar_y_mostrar_solicitudes_departamento(consulta_depto_actual, consulta_pin_actual, true, consulta_token_actual);
      }
    }

    document.getElementById('form-solicitud').reset();
    if (selector_solicitante_instancia) {
      selector_solicitante_instancia.setValue(catalogo_departamentos_itp[0], true);
    }
    if (selector_lugar_instancia) {
      selector_lugar_instancia.setValue(catalogo_sitios_itp[0], true);
    }
    const bloque_otro_reset = document.getElementById('bloque-lugar-otro');
    const input_otro_reset = document.getElementById('input-lugar-otro');
    if (bloque_otro_reset) bloque_otro_reset.classList.add('oculto');
    if (input_otro_reset) input_otro_reset.value = '';
    if (calendario_evento_instancia) {
      calendario_evento_instancia.clear();
      if (calendario_evento_instancia.altInput) {
        calendario_evento_instancia.altInput.placeholder = 'dd/mm/aaaa';
      }
    }
    if (input_hora_el) {
      input_hora_el.value = '';
      input_hora_el.removeAttribute('data-hora-24');
      input_hora_el.placeholder = '--:--';
    }
    alternar_evento(true);

    document.getElementById('modal-folio-texto').textContent = folio_confirmado;
    document.getElementById('modal-exito').classList.remove('oculto');
  } catch (err_envio) {
    Swal.fire({
      icon: 'error',
      title: 'Error al Guardar',
      text: err_envio && err_envio.message ? err_envio.message : 'Ocurrió un error al registrar la solicitud.',
      confirmButtonColor: '#1B396A'
    });
  } finally {
    btn_submit.disabled = false;
    texto_btn.textContent = 'Enviar solicitud';
  }
}

function filtrar_estado(estado, btn) {
  filtro_activo = estado;
  pagina_actual_tickets = 1;
  document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  renderizar_tickets();
}

function cambiar_pagina_tickets(nueva_pagina) {
  pagina_actual_tickets = nueva_pagina;
  renderizar_tickets();
  const contenedor = document.getElementById('contenedor-tickets');
  if (contenedor) {
    contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function obtener_arreglo_notas(cadena_observaciones) {
  if (!cadena_observaciones || !cadena_observaciones.trim()) return [];
  return String(cadena_observaciones)
    .replace(/&#x2F;/gi, '/')
    .split(' | ')
    .map(n => n.trim())
    .filter(n => n && !n.startsWith('[COM:') && !n.startsWith('[DENEGADA:') && !n.includes('SOLICITUD DENEGADA — Motivo:'));
}

function obtener_info_denegacion(item) {
  const cadena = String((item && item.observaciones) || '').replace(/&#x2F;/gi, '/');
  const coincidencia = cadena.match(/\[DENEGADA:(.*?)\]/);
  const resp = String((item && item.responsable) || '').trim().toLowerCase();
  if (coincidencia) {
    return {
      denegada: true,
      motivo: coincidencia[1].trim()
    };
  }
  if (resp.startsWith('denegada')) {
    return {
      denegada: true,
      motivo: 'Solicitud denegada por el Departamento de Comunicación y Difusión.'
    };
  }
  return {
    denegada: false,
    motivo: ''
  };
}

function obtener_prefijo_denegacion(cadena_observaciones) {
  const cadena = String(cadena_observaciones || '');
  const coincidencia = cadena.match(/\[DENEGADA:(.*?)\]/);
  return coincidencia ? coincidencia[0] : '';
}

async function denegar_solicitud_panel(index_real) {
  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }

  const item = solicitudes[index_real];
  if (!item) return;

  const info_den = obtener_info_denegacion(item);
  if (info_den.denegada) {
    const reactivar = await Swal.fire({
      icon: 'question',
      title: '¿Reactivar solicitud?',
      text: `Esta solicitud (${String(item.folio).toUpperCase()}) está marcada como DENEGADA. ¿Deseas reactivarla?`,
      showCancelButton: true,
      confirmButtonColor: '#1B396A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
      showCloseButton: true,
      allowOutsideClick: true,
      allowEscapeKey: true,
      hideClass: { popup: '' }
    });
    if (!reactivar.isConfirmed) return;

    const prefijo_com = obtener_prefijo_comunicacion(item.observaciones);
    const notas_limpias = obtener_arreglo_notas(item.observaciones);
    const nueva_obs = (prefijo_com ? [prefijo_com, ...notas_limpias] : notas_limpias).join(' | ');
    solicitudes[index_real].responsable = 'Sin asignar';
    if (usar_nube && item.id) {
      await cliente_db.from('solicitudes').update({ responsable: 'Sin asignar' }).eq('id', item.id);
    }
    await actualizar_campo(index_real, 'observaciones', nueva_obs);
    return;
  }

  const { value: motivo_rechazo } = await Swal.fire({
    title: `Denegar Solicitud ${esc(String(item.folio).toUpperCase())}`,
    html: `<p style="font-size: 0.88rem; color: var(--ink-muted); margin-bottom: 0.5rem;">Solicitante: <strong>${esc(item.solicitante)}</strong><br>Escribe el motivo por el cual se deniega esta solicitud (solo será visible cuando el departamento consulte su folio):</p>`,
    input: 'text',
    inputAttributes: {
      maxlength: '300'
    },
    inputPlaceholder: 'Ej. Fuera de tiempo, material incompleto, no corresponde al área...',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Denegar Solicitud',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: { popup: '' },
    inputValidator: (valor) => {
      if (!valor || !valor.trim()) {
        return 'Por favor indica el motivo de la denegación.';
      }
    }
  });

  if (!motivo_rechazo) return;

  const motivo_limpio = sanitizar_texto(motivo_rechazo.trim()).replace(/[\[\]\|]/g, '').slice(0, 300);
  const prefijo_com = obtener_prefijo_comunicacion(item.observaciones);
  const etiqueta_den = `[DENEGADA:${motivo_limpio}]`;
  const notas_limpias = obtener_arreglo_notas(item.observaciones);

  const partes_obs = [];
  if (prefijo_com) partes_obs.push(prefijo_com);
  partes_obs.push(etiqueta_den);
  partes_obs.push(...notas_limpias);

  solicitudes[index_real].responsable = 'Denegada';
  if (usar_nube && item.id) {
    await cliente_db.from('solicitudes').update({ responsable: 'Denegada' }).eq('id', item.id);
  }
  await actualizar_campo(index_real, 'observaciones', partes_obs.join(' | '));
}

function obtener_estado_comunicacion_solicitud(item) {
  const cadena = String((item && item.observaciones) || '');
  const coincidencia = cadena.match(/\[COM:(I?)(E?)\]/);
  if (coincidencia) {
    return {
      interna: coincidencia[1] === 'I',
      externa: coincidencia[2] === 'E'
    };
  }
  return {
    interna: true,
    externa: false
  };
}

function obtener_prefijo_comunicacion(cadena_observaciones) {
  const cadena = String(cadena_observaciones || '');
  const coincidencia = cadena.match(/\[COM:(I?)(E?)\]/);
  return coincidencia ? coincidencia[0] : '';
}

async function alternar_tipo_comunicacion(index, tipo, marcado) {
  const item = solicitudes[index];
  if (!item) return;
  const estado_com = obtener_estado_comunicacion_solicitud(item);
  if (tipo === 'interna') estado_com.interna = Boolean(marcado);
  if (tipo === 'externa') estado_com.externa = Boolean(marcado);

  const etiqueta_com = `[COM:${estado_com.interna ? 'I' : ''}${estado_com.externa ? 'E' : ''}]`;
  const prefijo_den = obtener_prefijo_denegacion(item.observaciones);
  const notas_limpias = obtener_arreglo_notas(item.observaciones);
  const partes = [etiqueta_com];
  if (prefijo_den) partes.push(prefijo_den);
  partes.push(...notas_limpias);
  const nueva_cadena = partes.join(' | ');
  await actualizar_campo(index, 'observaciones', nueva_cadena);
}

function extraer_actividad_y_medios(item) {
  const servicio_txt = capitalizar_inicial(String(item.servicio || '').replace(/&#x2F;/gi, '/'));
  const desc_raw = String(item.descripcion || '').replace(/&#x2F;/gi, '/').trim();
  const regex = /^\[(.*?)\]\s*—\s*(.*)$/;
  const coincidencia = desc_raw.match(regex);
  if (coincidencia) {
    const especificacion = capitalizar_inicial(coincidencia[1].trim());
    const detalle_actividad = capitalizar_inicial(coincidencia[2].trim());
    return {
      actividad: detalle_actividad ? `${servicio_txt} — ${detalle_actividad}` : servicio_txt,
      medios: especificacion || servicio_txt
    };
  }
  return {
    actividad: desc_raw ? `${servicio_txt} — ${capitalizar_inicial(desc_raw)}` : servicio_txt,
    medios: servicio_txt
  };
}

function renderizar_tickets() {
  const contenedor = document.getElementById('contenedor-tickets');
  if (!contenedor) return;

  const lista_periodo = obtener_solicitudes_por_periodo();

  const filtrados = lista_periodo.filter(item => {
    const estado_calculado = calcular_estado_automatico(item);
    const cumple_estado = filtro_activo === 'todos' || estado_calculado.toLowerCase() === filtro_activo.toLowerCase();
    const cumple_depto = depto_filtro_panel === 'todos' || String(item.solicitante || '').trim().toLowerCase() === depto_filtro_panel.toLowerCase();
    return cumple_estado && cumple_depto;
  });

  document.getElementById('contador-tickets').textContent = solicitudes.length;
  actualizar_metricas_panel();

  if (filtrados.length === 0) {
    contenedor.innerHTML = `<div style="text-align: center; padding: 2.5rem; color: var(--ink-muted);">No se encontraron solicitudes en este periodo o criterio.</div>`;
    return;
  }

  const total_paginas = Math.max(1, Math.ceil(filtrados.length / limite_tickets_pagina));
  if (pagina_actual_tickets > total_paginas) {
    pagina_actual_tickets = total_paginas;
  }
  if (pagina_actual_tickets < 1) {
    pagina_actual_tickets = 1;
  }

  const indice_inicio = (pagina_actual_tickets - 1) * limite_tickets_pagina;
  const filtrados_pagina = filtrados.slice(indice_inicio, indice_inicio + limite_tickets_pagina);

  const html_tarjetas = filtrados_pagina.map((item, idx_vista) => {
    const index_real = solicitudes.findIndex(s => s.folio === item.folio);
    const tiene_fecha_limite = Boolean(item.fecha_limite && item.fecha_limite.trim() !== '');
    
    const estado_actual = calcular_estado_automatico(item);
    const sufijo_estado = estado_actual.replace(' ', '-');
    const clase_estado = 'estado-' + sufijo_estado;
    const lista_notas = obtener_arreglo_notas(item.observaciones);
    const estado_com_actual = obtener_estado_comunicacion_solicitud(item);
    const info_denegacion = obtener_info_denegacion(item);
    const es_denegada = info_denegacion.denegada;
    const etiqueta_estado_visual = es_denegada ? 'Denegada' : estado_actual;
    const clase_estado_visual = es_denegada ? 'estado-Denegada' : clase_estado;
    const clase_borde_visual = es_denegada ? 'borde-Denegada' : `borde-${sufijo_estado}`;
    const delay_anim = Math.min(idx_vista * 0.05, 0.35);

    const lista_responsables = parsear_responsables(item.responsable);
    const titular_opt = normalizar_opcion_responsable(lista_responsables[0] || 'Sin asignar');
    const valor_select = titular_opt.select;
    const es_chico_servicio = titular_opt.es_ss;
    const nombre_manual_ss = titular_opt.nombre_ss;

    const tiene_responsable_activo = !es_denegada && lista_responsables.length > 0;
    const tiene_planta_wa = lista_responsables.some(r => !r.toLowerCase().startsWith('chico(a) de servicio'));
    const folio_mayus_id = String(item.folio || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const folio_mayus = esc(String(item.folio || '').toUpperCase());
    const servicio_titulo = esc(capitalizar_inicial(String(item.servicio || '').replace(/&#x2F;/gi, '/')));
    const esta_abierta = tickets_abiertos_panel.has(folio_mayus_id);
    const info_sello = obtener_info_sello_conformidad(item);
    const sello_resumen_html = (!es_denegada && info_sello.activo)
      ? `<span class="pi-badge-sello" title="Sello de conformidad emitido${info_sello.fecha_texto ? ' el ' + esc(info_sello.fecha_texto) : ''}"><i data-lucide="badge-check"></i> Sello de conformidad</span>`
      : '';
    const sello_detalle_html = (!es_denegada && info_sello.activo)
      ? `<div class="pi-sello-detalle"><i data-lucide="badge-check"></i><span><strong>Sello de conformidad:</strong> Avalado por el área solicitante${info_sello.fecha_texto ? ` (${esc(info_sello.fecha_texto)})` : ''} — ${info_sello.cancelable ? 'Cancelable (24 h)' : 'Definitivo'}</span></div>`
      : '';

    const texto_responsable_cerrado = lista_responsables.length > 0
      ? lista_responsables.join(', ')
      : 'Sin asignar';

    const opciones_catalogo_staff = Object.keys(catalogo_responsables).filter(n => n !== 'Sin asignar');

    let apoyos_html = '';
    for (let s_idx = 1; s_idx < lista_responsables.length; s_idx++) {
      const ap_opt = normalizar_opcion_responsable(lista_responsables[s_idx]);
      apoyos_html += `
        <div class="bloque-apoyo-item">
          <div class="fila-apoyo-responsable">
            <select class="select-apoyo-tom" data-index="${index_real}" data-slot="${s_idx}" aria-label="Apoyo ${s_idx}">
              ${opciones_catalogo_staff.map(n => `<option value="${esc(n)}" ${ap_opt.select === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}
            </select>
            <button type="button" class="btn-quitar-apoyo" data-accion="quitar-apoyo" data-index="${index_real}" data-slot="${s_idx}" title="Quitar apoyo">✕</button>
          </div>
          <div id="bloque-ss-apoyo-${index_real}-${s_idx}" class="caja-servicio-social-manual ${ap_opt.es_ss ? '' : 'oculto'}">
            <input type="text" id="input-ss-apoyo-${index_real}-${s_idx}" value="${esc(ap_opt.nombre_ss)}" maxlength="80" placeholder="Nombre del prestador(a) de servicio..." data-enter="guardar-ss-apoyo" data-index="${index_real}" data-slot="${s_idx}" autocomplete="off">
            <button type="button" class="btn-confirmar-ss" data-accion="guardar-ss-apoyo" data-index="${index_real}" data-slot="${s_idx}">
              <i data-lucide="check"></i> Asignar
            </button>
          </div>
        </div>
      `;
    }

    if (folios_slot_apoyo_nuevo.has(folio_mayus_id) && lista_responsables.length < 3) {
      const nuevo_slot_idx = lista_responsables.length;
      apoyos_html += `
        <div class="bloque-apoyo-item">
          <div class="fila-apoyo-responsable">
            <select class="select-apoyo-tom" data-index="${index_real}" data-slot="${nuevo_slot_idx}" data-nuevo="1" aria-label="Nuevo apoyo">
              <option value="">Seleccionar apoyo...</option>
              ${opciones_catalogo_staff.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
            </select>
            <button type="button" class="btn-quitar-apoyo" data-accion="cancelar-slot-apoyo" data-index="${index_real}" title="Cancelar apoyo">✕</button>
          </div>
          <div id="bloque-ss-apoyo-${index_real}-${nuevo_slot_idx}" class="caja-servicio-social-manual oculto">
            <input type="text" id="input-ss-apoyo-${index_real}-${nuevo_slot_idx}" value="" maxlength="80" placeholder="Nombre del prestador(a) de servicio..." data-enter="guardar-ss-apoyo" data-index="${index_real}" data-slot="${nuevo_slot_idx}" autocomplete="off">
            <button type="button" class="btn-confirmar-ss" data-accion="guardar-ss-apoyo" data-index="${index_real}" data-slot="${nuevo_slot_idx}">
              <i data-lucide="check"></i> Asignar
            </button>
          </div>
        </div>
      `;
    }

    const btn_agregar_apoyo_html = (tiene_responsable_activo && lista_responsables.length < 3 && !folios_slot_apoyo_nuevo.has(folio_mayus_id))
      ? `<button type="button" class="btn-agregar-apoyo" data-accion="agregar-apoyo" data-index="${index_real}"><i data-lucide="user-plus"></i> + Apoyo</button>`
      : '';
    const texto_fecha_limite_cerrado = tiene_fecha_limite
      ? esc(item.fecha_limite)
      : 'Sin fecha límite asignada';

    const col_izq_cerrada = item.aplica_evento
      ? `<span class="pi-fecha-destacada">${esc(item.fecha_evento)}</span>
         <span class="pi-hora-destacada">(${esc(item.hora_evento)} hrs)</span>`
      : `<span class="pi-sin-evento-cerrado">Sin evento presencial asociado</span>`;

    const lugar_cerrado_html = item.aplica_evento
      ? `<div class="pi-lugar-cerrado"><i data-lucide="map-pin"></i> <span>Lugar: ${esc(item.lugar_evento)}</span></div>`
      : '';

    const html_notas = lista_notas.length > 0
      ? lista_notas.map((nota_texto, idx_nota) => {
          const match_nota = String(nota_texto).match(/^(\[[^\]]+\])\s*(.*)$/);
          const col_meta_nota = match_nota ? match_nota[1] : '';
          const col_cuerpo_nota = match_nota ? match_nota[2] : nota_texto;
          return `
          <div class="pi-nota-fila">
            <div class="pi-nota-col-meta">${esc(col_meta_nota)}</div>
            <div class="pi-nota-col-texto">
              <span>${esc(col_cuerpo_nota)}</span>
              <div class="pi-nota-acciones">
                <button type="button" class="btn-icono-nota" data-accion="editar-nota" data-index="${index_real}" data-nota-index="${idx_nota}" title="Editar nota">
                  <i data-lucide="pencil"></i>
                </button>
                <button type="button" class="btn-icono-nota borrar" data-accion="eliminar-nota" data-index="${index_real}" data-nota-index="${idx_nota}" title="Eliminar nota">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          </div>
        `;
        }).join('')
      : `<div class="sin-fecha-aviso">Sin notas registradas.</div>`;

    return `
      <div class="ticket-item pi-fila-solicitud ${clase_borde_visual} ${esta_abierta ? 'pi-abierta' : ''}" id="ticket-${folio_mayus_id}" style="--t-delay: ${delay_anim}s">
        <div class="pi-cabecera-expandible" role="button" tabindex="0" aria-expanded="${esta_abierta ? 'true' : 'false'}" data-accion="alternar-ticket-panel" data-folio="${folio_mayus_id}">
          <div class="pi-col-evento">
            ${col_izq_cerrada}
          </div>
          <div class="pi-col-resumen">
            <div class="pi-resumen-principal">
              <div class="ticket-servicio">${servicio_titulo}</div>
              <div class="pi-depto-cerrado">
                <svg class="icono-persona-compu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="5.5" r="3.2"></circle>
                  <path d="M8.9 5c1.5.5 3.1.2 4.3-.9.7.6 1.3.9 2 .9"></path>
                  <path d="M5.5 13c.8-2.2 2.8-3.5 6.5-3.5s5.7 1.3 6.5 3.5"></path>
                  <path d="M9.6 9.8L12 13l2.4-3.2"></path>
                  <path d="M4.5 13h15l-1.5 8H6L4.5 13z"></path>
                  <circle cx="12" cy="17" r="1.25"></circle>
                </svg>
                <span class="tag-solicitante-color">${esc(item.solicitante)}</span>
              </div>
              ${lugar_cerrado_html}
            </div>
            <div class="pi-resumen-inferior">
              <span class="badge-estado-actual ${clase_estado_visual}">
                <span class="punto-estado"></span>
                <span>${esc(etiqueta_estado_visual)}</span>
              </span>
              ${es_denegada ? '' : `
              <span class="pi-dato-plano">
                <span class="pi-etiqueta-plana">Responsable asignado:</span>
                <strong>${esc(texto_responsable_cerrado)}</strong>
              </span>
              <span class="pi-dato-plano">
                <span class="pi-etiqueta-plana">Fecha límite de entrega:</span>
                <strong>${texto_fecha_limite_cerrado}</strong>
              </span>
              ${sello_resumen_html}
              `}
            </div>
          </div>
        </div>

        <div class="pi-cuerpo-expandible">
          <div class="ticket-grid-principal">
            <div class="ticket-col-info">
              <div class="ticket-meta-sup">
                <span class="ticket-folio"><i data-lucide="hash"></i>${folio_mayus}</span>
                <span class="ticket-meta-fecha"><i data-lucide="calendar"></i>Solicitado: ${esc(item.fecha_solicitud)}</span>
              </div>
              <div class="ticket-detalles">
                <div class="ticket-dato-linea">
                  <i data-lucide="file-text"></i>
                  <span class="texto-descripcion-color">${formatear_descripcion_color(item.descripcion)}</span>
                </div>
              </div>
              ${sello_detalle_html}
            </div>

            <div class="ticket-col-gestion">
              <div class="selector-estado-contenedor">
                <span class="selector-estado-label">Estado</span>
                <div class="fila-estado-acciones">
                  <span class="badge-estado-actual ${clase_estado_visual}">
                    <span class="punto-estado"></span>
                    <span>${esc(etiqueta_estado_visual)}</span>
                  </span>
                  <button type="button" class="btn-denegar-solicitud ${es_denegada ? 'activa' : ''}" data-accion="denegar-solicitud" data-index="${index_real}" title="${es_denegada ? 'Reactivar solicitud' : 'Denegar solicitud y registrar motivo'}">
                    <i data-lucide="${es_denegada ? 'rotate-ccw' : 'ban'}"></i>
                    <span>${es_denegada ? 'Reactivar' : 'Denegar'}</span>
                  </button>
                </div>
              </div>

              ${es_denegada ? '' : `
              <div class="panel-gestion-interno">
                <div class="campo-interno">
                  <label>Responsable asignado</label>
                  <div class="fila-responsable-acciones">
                    <select class="select-responsable-tom" data-index="${index_real}">
                      <option value="Sin asignar" ${valor_select === 'Sin asignar' ? 'selected' : ''}>Sin asignar</option>
                      ${Object.keys(catalogo_responsables)
                        .filter(nombre_resp => nombre_resp !== 'Sin asignar')
                        .map(nombre_resp => `<option value="${esc(nombre_resp)}" ${valor_select === nombre_resp ? 'selected' : ''}>${esc(nombre_resp)}</option>`)
                        .join('')}
                    </select>
                    ${tiene_responsable_activo && tiene_planta_wa
                      ? `<button type="button" class="btn-notificar-wa" data-accion="enviar-wa" data-index="${index_real}" title="Enviar recordatorio por WhatsApp">
                          <svg viewBox="0 0 24 24" fill="currentColor" style="width: 15px; height: 15px;"><path d="M12.031 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.993L2 22l5.233-1.237a9.994 9.994 0 0 0 4.779 1.217h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.037-5.176-2.922-7.062A9.935 9.935 0 0 0 12.031 2zm5.829 14.144c-.245.693-1.43 1.326-1.981 1.408-.507.075-1.148.107-1.855-.117-.428-.135-.978-.316-1.682-.62-2.961-1.278-4.896-4.261-5.044-4.459-.148-.197-1.204-1.601-1.204-3.054 0-1.453.763-2.167 1.034-2.463.271-.296.591-.37.788-.37.197 0 .394.002.566.01.182.009.426-.069.666.508.246.591.838 2.045.912 2.193.074.148.123.32.025.517-.098.197-.148.32-.296.493-.148.172-.311.385-.444.517-.148.148-.302.308-.13.604.172.296.766 1.264 1.645 2.047 1.13 1.007 2.083 1.319 2.379 1.467.296.148.468.123.641-.074.172-.197.739-.862.936-1.158.197-.296.394-.246.665-.148.271.098 1.725.813 2.02.961.296.148.493.222.567.345.074.123.074.714-.171 1.407z"></path></svg> WhatsApp
                        </button>`
                      : ''
                    }
                  </div>
                  <div id="bloque-ss-${index_real}" class="caja-servicio-social-manual ${es_chico_servicio ? '' : 'oculto'}">
                    <input type="text" id="input-ss-${index_real}" value="${esc(nombre_manual_ss)}" maxlength="80" placeholder="Escribe el nombre del prestador(a) de servicio..." data-enter="guardar-ss" data-index="${index_real}" autocomplete="off">
                    <button type="button" class="btn-confirmar-ss" data-accion="guardar-ss" data-index="${index_real}">
                      <i data-lucide="check"></i> Asignar
                    </button>
                  </div>
                  ${apoyos_html}
                  ${btn_agregar_apoyo_html}
                </div>

                <div class="campo-interno">
                  <label>Comunicación (Reporte)</label>
                  <div class="grupo-checks-comunicacion">
                    <label class="check-comunicacion-item">
                      <input type="checkbox" ${estado_com_actual.interna ? 'checked' : ''} data-cambio="tipo-comunicacion" data-tipo="interna" data-index="${index_real}">
                      <span>Interna</span>
                    </label>
                    <label class="check-comunicacion-item">
                      <input type="checkbox" ${estado_com_actual.externa ? 'checked' : ''} data-cambio="tipo-comunicacion" data-tipo="externa" data-index="${index_real}">
                      <span>Externa</span>
                    </label>
                  </div>
                </div>

                <div class="campo-interno">
                  <div class="cabecera-fecha-opcional">
                    <label style="margin-bottom: 0;">Fecha límite de entrega</label>
                    <label class="toggle-fecha-manual">
                      <input type="checkbox" ${tiene_fecha_limite ? 'checked' : ''} data-cambio="fecha-limite-manual" data-index="${index_real}">
                      <span>Habilitar</span>
                    </label>
                  </div>
                  ${tiene_fecha_limite 
                    ? `<div class="contenedor-input-calendario">
                        <input type="text" class="input-fecha-limite-panel input-fecha-con-icono" data-index="${index_real}" value="${esc(item.fecha_limite)}" placeholder="dd/mm/aaaa" autocomplete="off">
                        <i data-lucide="calendar" class="icono-calendario-fijo"></i>
                      </div>`
                    : `<div class="sin-fecha-aviso">Sin fecha límite asignada</div>`
                  }
                </div>
              </div>
              `}
            </div>
          </div>

          <div class="pi-area-notas">
            <div class="encabezado-notas">
              <span class="titulo-notas"><i data-lucide="message-square"></i> Notas del seguimiento</span>
              <span class="ayuda-notas">Comentarios y acuerdos de la solicitud</span>
            </div>
            <div class="pi-lista-notas">
              ${html_notas}
            </div>
            <div class="pi-input-nota-grupo">
              <input type="text" id="nota-input-${index_real}" maxlength="350" placeholder="Escribe un avance o acuerdo..." autocomplete="off">
              <button type="button" class="pi-btn-agregar-nota" data-accion="agregar-nota" data-index="${index_real}">
                <i data-lucide="plus"></i> Agregar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  let html_paginacion = '';
  if (total_paginas > 1) {
    let botones_nums = '';
    for (let p = 1; p <= total_paginas; p++) {
      botones_nums += `<button type="button" class="btn-pagina-ticket ${p === pagina_actual_tickets ? 'activo' : ''}" data-accion="cambiar-pagina-tickets" data-pagina="${p}">${p}</button>`;
    }

    const desde_num = indice_inicio + 1;
    const hasta_num = Math.min(indice_inicio + limite_tickets_pagina, filtrados.length);

    html_paginacion = `
      <div class="barra-paginacion-tickets">
        <span class="info-paginacion-tickets">Mostrando <strong>${desde_num}–${hasta_num}</strong> de <strong>${filtrados.length}</strong> solicitudes</span>
        <div class="controles-paginacion-tickets">
          <button type="button" class="btn-pagina-ticket nav" data-accion="cambiar-pagina-tickets" data-pagina="${pagina_actual_tickets - 1}" ${pagina_actual_tickets === 1 ? 'disabled' : ''} title="Página anterior">
            <i data-lucide="chevron-left"></i>
          </button>
          ${botones_nums}
          <button type="button" class="btn-pagina-ticket nav" data-accion="cambiar-pagina-tickets" data-pagina="${pagina_actual_tickets + 1}" ${pagina_actual_tickets === total_paginas ? 'disabled' : ''} title="Página siguiente">
            <i data-lucide="chevron-right"></i>
          </button>
        </div>
      </div>
    `;
  }

  contenedor.innerHTML = html_tarjetas + html_paginacion;

  refrescar_iconos();
  inicializar_calendarios_panel_interno();
  inicializar_selectores_responsable_tarjetas();
  renderizar_calendario_panel();
}

function contar_frecuencias(lista, propiedad) {
  const mapa = {};
  lista.forEach(item => {
    const clave = capitalizar_inicial((item[propiedad] || 'Sin especificar').trim());
    mapa[clave] = (mapa[clave] || 0) + 1;
  });
  return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
}

function generar_filas_frecuencia(arreglo, total) {
  if (arreglo.length === 0) {
    return `<tr><td colspan="3" class="num-centro">Sin registros en este periodo</td></tr>`;
  }
  return arreglo.map(([concepto, cant]) => {
    const porc = total > 0 ? ((cant / total) * 100).toFixed(1) : '0.0';
    return `
      <tr>
        <td>${esc(concepto)}</td>
        <td class="num-centro"><strong>${cant}</strong></td>
        <td class="num-centro">${porc}%</td>
      </tr>
    `;
  }).join('');
}

function abrir_modal_reporte() {
  if (!sesion_autorizada) {
    return;
  }

  const lista_periodo = obtener_solicitudes_por_periodo();
  const nombre_periodo = nombres_meses[mes_filtro_activo] || nombres_meses[mes_actual_sistema];
  document.getElementById('titulo-mes-reporte').textContent = `Reporte Oficial — ${nombre_periodo}`;

  const total_filas_minimas = 20;
  const total_filas_render = Math.max(total_filas_minimas, lista_periodo.length);
  let filas_formato_exacto = '';

  for (let i = 0; i < total_filas_render; i++) {
    const item = lista_periodo[i];
    if (item) {
      const { actividad, medios } = extraer_actividad_y_medios(item);
      const emisor = item.solicitante || '';
      const fecha_recepcion = item.fecha_solicitud || '';
      const folio_rep = String(item.folio || '').toUpperCase();
      const info_den_rep = obtener_info_denegacion(item);

      if (info_den_rep.denegada) {
        filas_formato_exacto += `
          <tr>
            <td>${esc(actividad)}</td>
            <td>${esc(emisor)}</td>
            <td class="num-centro">${esc(fecha_recepcion)}</td>
            <td class="num-centro">&nbsp;</td>
            <td class="num-centro">&nbsp;</td>
            <td class="num-centro">&nbsp;</td>
            <td>&nbsp;</td>
            <td>${esc(`${folio_rep} — Denegada`)}</td>
          </tr>
        `;
      } else {
        const fecha_vencimiento = (item.fecha_limite && item.fecha_limite.trim() !== '')
          ? item.fecha_limite
          : (item.aplica_evento && item.fecha_evento ? item.fecha_evento : '');
        const estado_com = obtener_estado_comunicacion_solicitud(item);
        const marca_interna = estado_com.interna ? 'X' : '';
        const marca_externa = estado_com.externa ? 'X' : '';
        const resp_rep = capitalizar_inicial((item.responsable || 'Sin asignar').trim());
        const observaciones_txt = `${folio_rep} — Asignado a: ${resp_rep}`;

        // interpolación con escape html estricto en todas las celdas del reporte oficial
        filas_formato_exacto += `
          <tr>
            <td>${esc(actividad)}</td>
            <td>${esc(emisor)}</td>
            <td class="num-centro">${esc(fecha_recepcion)}</td>
            <td class="num-centro">${esc(fecha_vencimiento)}</td>
            <td class="num-centro">${marca_interna}</td>
            <td class="num-centro">${marca_externa}</td>
            <td>${esc(medios)}</td>
            <td>${esc(observaciones_txt)}</td>
          </tr>
        `;
      }
    } else {
      filas_formato_exacto += `
        <tr>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      `;
    }
  }

  const contenedor_rep = document.getElementById('contenido-imprimible-reporte');
  contenedor_rep.innerHTML = `
    <div class="hoja-oficio-itp hoja-bitacora-horizontal">
      <div class="contenido-sobre-marca contenedor-bitacora-iso">
        <div class="bloque-superior-bitacora">
          <table class="tabla-encabezado-bitacora-iso">
            <tbody>
              <tr>
                <td colspan="4" class="celda-iso-inst">Instituto Tecnológico de Pachuca</td>
              </tr>
              <tr>
                <td colspan="4" class="celda-iso-pag">Periodo: ${esc(nombre_periodo)} — ${lista_periodo.length} ${lista_periodo.length === 1 ? 'solicitud' : 'solicitudes'}</td>
              </tr>
              <tr>
                <td rowspan="2" class="celda-iso-logo">
                  <img src="img/TecPachuca.png" alt="ITP" class="logo-iso-itp" data-ocultar-error="1">
                </td>
                <td class="celda-iso-meta">Código: <strong>ITPAC-PL-PO-001-03</strong></td>
                <td class="celda-iso-meta">Versión: 2</td>
                <td class="celda-iso-meta">Norma: ISO <span class="subrayado-iso-azul">9001:2015  Requisitos</span>:7.4</td>
              </tr>
              <tr>
                <td colspan="3" class="celda-iso-titulo-doc">Bitácora de Comunicación Institucional</td>
              </tr>
            </tbody>
          </table>

          <table class="tabla-formato-exacto-reporte">
            <thead>
              <tr>
                <th rowspan="2" class="col-bit-actividad">Actividad</th>
                <th rowspan="2" class="col-bit-emisor">Emisor</th>
                <th rowspan="2" class="col-bit-fecha">Fecha de<br>recepción</th>
                <th rowspan="2" class="col-bit-fecha">Fecha de<br>vencimiento</th>
                <th colspan="2" class="col-bit-com">Comunicación</th>
                <th rowspan="2" class="col-bit-medios">Medios a<br>utilizar</th>
                <th rowspan="2" class="col-bit-obs">Observaciones</th>
              </tr>
              <tr>
                <th class="col-bit-subcom">Interna</th>
                <th class="col-bit-subcom">Externa</th>
              </tr>
            </thead>
            <tbody>
              ${filas_formato_exacto}
            </tbody>
          </table>
        </div>

        <div class="pie-bitacora-iso">
          <div class="fila-codigos-pie-iso">
            <span>ITPAC-PL-PO-001-03</span>
            <span>Ver.2</span>
          </div>
          <div class="leyenda-copia-no-controlada">
            “Toda copia en PAPEL o ARCHIVO ELECTRÓNICO es un Documento No Controlado a excepción del original”
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-reporte').classList.remove('oculto');
  contenedor_rep.scrollTop = 0;
}

function cerrar_modal_reporte() {
  document.getElementById('modal-reporte').classList.add('oculto');
}

async function imprimir_reporte_pdf() {
  window.print();

  if (mes_filtro_activo === 'sem-1' || mes_filtro_activo === 'sem-2') {
    setTimeout(() => {
      confirmar_purga_post_reporte_semestral();
    }, 500);
  }
}

async function confirmar_purga_post_reporte_semestral() {
  if (!sesion_autorizada) {
    return;
  }

  const icono_advertencia_gordito = `
    <div class="alerta-icono-minimal ambar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17.2" x2="12.01" y2="17.2"></line>
      </svg>
    </div>
  `;

  const aviso_1 = await Swal.fire({
    html: `
      ${icono_advertencia_gordito}
      <span class="alerta-tag-sup">Aviso de Cierre Semestral</span>
      <h3 class="alerta-titulo-custom">Corte Semestral de Base de Datos</h3>
      <p class="alerta-cuerpo-custom">
        Al concluir el reporte semestral se eliminarán todos los registros.
        <span class="alerta-pregunta-resaltada">¿Ya guardaste o imprimiste con éxito el PDF del reporte?</span>
      </p>
    `,
    showCancelButton: true,
    confirmButtonColor: '#1B396A',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sí, ya guardé con éxito el PDF',
    cancelButtonText: 'No, aún no lo guardo'
  });

  if (!aviso_1.isConfirmed) return;

  const icono_seguridad_gordito = `
    <div class="alerta-icono-minimal rojo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
  `;

  const aviso_2 = await Swal.fire({
    html: `
      ${icono_seguridad_gordito}
      <span class="alerta-tag-sup" style="color: #dc2626; background: #fef2f2;">Verificación de Seguridad</span>
      <h3 class="alerta-titulo-custom">Confirmación Definitiva</h3>
      <p class="alerta-cuerpo-custom">
        Esta acción vaciará toda la base de datos y reiniciará el contador de folios a <strong>1</strong>. Escribe la palabra <strong style="color: #dc2626;">ELIMINAR</strong> para confirmar:
      </p>
    `,
    input: 'text',
    inputPlaceholder: 'Escribe ELIMINAR',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Vaciar Base de Datos',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: {
      popup: ''
    },
    inputValidator: (value) => {
      if (value !== 'ELIMINAR') {
        return 'Debes escribir exactamente la palabra ELIMINAR';
      }
    }
  });

  if (!aviso_2.isConfirmed) return;

  if (usar_nube && cliente_db) {
    const { error: error_rpc } = await cliente_db.rpc('reiniciar_tabla_solicitudes');

    if (error_rpc) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Supabase',
        text: error_rpc.message,
        confirmButtonColor: '#1B396A'
      });
      return;
    }
  } else {
    localStorage.removeItem('tickets_itp_v6');
  }

  solicitudes = [];
  cerrar_modal_reporte();
  await actualizar_folio_preview();
  renderizar_tickets();
  actualizar_notificaciones_ios();

  Swal.fire({
    icon: 'success',
    title: 'Base de Datos Reiniciada',
    text: 'Se eliminaron todas las solicitudes y el contador volverá a iniciar desde el folio e ID 1.',
    confirmButtonColor: '#1B396A'
  });
}

async function alternar_fecha_limite_manual(index, habilitado) {
  if (habilitado) {
    const hoy_iso = new Date().toISOString().split('T')[0];
    await actualizar_campo(index, 'fecha_limite', hoy_iso);
  } else {
    await actualizar_campo(index, 'fecha_limite', '');
  }
}

async function actualizar_campo(index, campo, valor) {
  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }

  solicitudes[index][campo] = valor;
  const item = solicitudes[index];
  const nuevo_estado = calcular_estado_automatico(item);
  item.estado = nuevo_estado;

  if (usar_nube && cliente_db && item.id) {
    const datos_update = {};
    datos_update[campo] = valor;
    datos_update['estado'] = nuevo_estado;
    await cliente_db.from('solicitudes').update(datos_update).eq('id', item.id);
  } else {
    localStorage.setItem('tickets_itp_v6', JSON.stringify(solicitudes));
  }

  renderizar_tickets();
  actualizar_notificaciones_ios();
}

async function agregar_nota(index) {
  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }

  const input = document.getElementById(`nota-input-${index}`);
  const texto = sanitizar_texto(input ? input.value.trim() : '').replace(/\|/g, '/').slice(0, 350);
  if (!texto) return;

  const item = solicitudes[index];
  const lista = obtener_arreglo_notas(item.observaciones);
  lista.push(`[${new Date().toLocaleDateString('es-MX')}] ${texto}`);
  const prefijo_com = obtener_prefijo_comunicacion(item.observaciones);
  const prefijo_den = obtener_prefijo_denegacion(item.observaciones);
  const nueva_cadena = [prefijo_com, prefijo_den, ...lista].filter(Boolean).join(' | ');

  await actualizar_campo(index, 'observaciones', nueva_cadena);
}

async function editar_nota(index_ticket, index_nota) {
  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }

  const item = solicitudes[index_ticket];
  const lista = obtener_arreglo_notas(item.observaciones);
  const texto_actual = lista[index_nota];

  const { value: nuevo_texto } = await Swal.fire({
    title: 'Editar nota de seguimiento',
    input: 'text',
    inputValue: texto_actual,
    inputAttributes: {
      maxlength: '350'
    },
    showCancelButton: true,
    confirmButtonColor: '#1B396A',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: {
      popup: ''
    }
  });

  if (nuevo_texto !== undefined && nuevo_texto.trim() !== '') {
    lista[index_nota] = sanitizar_texto(nuevo_texto.trim()).replace(/\|/g, '/').slice(0, 350);
    const prefijo_com = obtener_prefijo_comunicacion(item.observaciones);
    const prefijo_den = obtener_prefijo_denegacion(item.observaciones);
    await actualizar_campo(index_ticket, 'observaciones', [prefijo_com, prefijo_den, ...lista].filter(Boolean).join(' | '));
  }
}

async function eliminar_nota(index_ticket, index_nota) {
  if (!sesion_autorizada) {
    intentar_abrir_panel();
    return;
  }

  const item = solicitudes[index_ticket];
  const lista = obtener_arreglo_notas(item.observaciones);

  const resultado = await Swal.fire({
    title: '¿Eliminar nota?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    showCloseButton: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    hideClass: {
      popup: ''
    }
  });

  if (resultado.isConfirmed) {
    lista.splice(index_nota, 1);
    const prefijo_com = obtener_prefijo_comunicacion(item.observaciones);
    const prefijo_den = obtener_prefijo_denegacion(item.observaciones);
    await actualizar_campo(index_ticket, 'observaciones', [prefijo_com, prefijo_den, ...lista].filter(Boolean).join(' | '));
  }
}

function cambiar_vista(vista) {
  const v_form = document.getElementById('vista-formulario');
  const v_panel = document.getElementById('vista-panel');
  const b_nueva = document.getElementById('btn-nueva');
  const b_panel = document.getElementById('btn-panel');

  if (vista === 'formulario') {
    v_form.classList.remove('oculto');
    v_panel.classList.add('oculto');
    b_nueva.classList.add('activo');
    b_panel.classList.remove('activo');
  } else {
    if (!sesion_autorizada) {
      intentar_abrir_panel();
      return;
    }
    v_form.classList.add('oculto');
    v_panel.classList.remove('oculto');
    b_nueva.classList.remove('activo');
    b_panel.classList.add('activo');
    actualizar_metricas_panel();
    actualizar_notificaciones_ios();
  }
}

function cerrar_modal() {
  document.getElementById('modal-exito').classList.add('oculto');
  volver_catalogo();
}

function abrir_modal_manual() {
  const modal = document.getElementById('modal-manual');
  if (!modal) return;

  const tiene_acceso_admin = Boolean(sesion_autorizada);
  const tab_admin = document.getElementById('tab-manual-admin');
  const v_panel = document.getElementById('vista-panel');
  const esta_en_panel = v_panel && !v_panel.classList.contains('oculto');

  if (tab_admin) {
    if (tiene_acceso_admin) {
      tab_admin.classList.remove('oculto');
    } else {
      tab_admin.classList.add('oculto');
    }
  }

  if (tiene_acceso_admin && esta_en_panel) {
    cambiar_tab_manual('admin');
  } else {
    cambiar_tab_manual('publico');
  }

  modal.classList.remove('oculto');
  refrescar_iconos();
}

function cerrar_modal_manual() {
  const modal = document.getElementById('modal-manual');
  if (modal) modal.classList.add('oculto');
}

function cambiar_tab_manual(tipo) {
  const tiene_acceso_admin = Boolean(sesion_autorizada);
  const sec_pub = document.getElementById('seccion-manual-publico');
  const sec_adm = document.getElementById('seccion-manual-admin');
  const tab_pub = document.getElementById('tab-manual-publico');
  const tab_adm = document.getElementById('tab-manual-admin');
  const cuerpo = document.getElementById('cuerpo-modal-manual');

  if (tipo === 'admin' && tiene_acceso_admin) {
    if (sec_pub) sec_pub.classList.add('oculto');
    if (sec_adm) sec_adm.classList.remove('oculto');
    if (tab_pub) tab_pub.classList.remove('activo');
    if (tab_adm) tab_adm.classList.add('activo');
  } else {
    if (sec_pub) sec_pub.classList.remove('oculto');
    if (sec_adm) sec_adm.classList.add('oculto');
    if (tab_pub) tab_pub.classList.add('activo');
    if (tab_adm) tab_adm.classList.remove('activo');
  }

  if (cuerpo) cuerpo.scrollTop = 0;
}

inicializar();
