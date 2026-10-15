/* =========================================================
   AUTOGO - APLICACIÓN
   Rutas por hash: #/ruta/parametro?filtros
========================================================= */

const { $, $$, esc, icon, fmt, hoy, sumarDias, diasEntre, etq, badge, METODOS } = UI;

const raiz = $('#raiz');

let renderId = 0;
let haySesion = !!Api.sesion();
let pendientes = null;
let notificacionesCache = null;
let filtroNotificaciones = 'todas';

const usuario = () => (Api.sesion() || {}).usuario;
const esAdmin = () => !!usuario() && /^admin/i.test(usuario().rol);
const inicio = () => (!Api.sesion() ? 'login' : esAdmin() ? 'dashboard' : 'inicio');

const opcionesMetodo = (vacio) =>
  (vacio ? [{ valor: '', texto: vacio }] : []).concat(METODOS.map(m => ({ valor: m, texto: etq(m) })));

const metodoTxt = m => (m === 'WALLET' ? 'Wallet GO' : etq(m));

const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};


/* =========================================================
   RUTAS
========================================================= */

const LEMA = ['Tu destino, nuestra ruta', 'Renta el vehículo ideal y disfruta el camino con comodidad, seguridad y confianza.'];

const RUTAS = {
  'login': { vista: vLogin, acceso: 'publica', layout: 'auth', titulo: 'Iniciar sesión' },
  'registro': { vista: vRegistro, acceso: 'publica', layout: 'auth', titulo: 'Crear cuenta', lema: ['Comienza tu aventura', 'Regístrate y accede a una flota de vehículos confiables, seguros y al mejor precio.'] },
  'recuperar': { vista: vRecuperar, acceso: 'publica', layout: 'auth', titulo: 'Recuperar contraseña' },
  'restablecer': { vista: vRestablecer, acceso: 'libre', layout: 'auth', titulo: 'Restablecer contraseña' },
  'cambiar-password': { vista: vCambiarPassword, acceso: 'sesion', titulo: 'Cambiar contraseña', sub: 'Usa al menos 8 caracteres con letras y números.' },

  'catalogo': { vista: vCatalogo, acceso: 'libre', titulo: 'Catálogo', sub: 'Elige tus fechas y encuentra el vehículo ideal.' },

  'inicio': { vista: vInicioCliente, acceso: 'cliente', titulo: 'Inicio' },
  'mis-alquileres': { vista: vMisAlquileres, acceso: 'cliente', titulo: 'Mis alquileres', sub: 'Consulta, revisa o cancela tus reservas.' },
  'mis-facturas': { vista: vMisFacturas, acceso: 'cliente', titulo: 'Mis facturas', sub: 'Todas las facturas y notas de crédito de tus alquileres.' },
  'perfil': { vista: vPerfil, acceso: 'sesion', titulo: 'Mi perfil' },
  'factura': { vista: vFactura, acceso: 'sesion', titulo: 'Factura', nav: () => (esAdmin() ? 'facturas' : 'mis-facturas') },

  'dashboard': { vista: vDashboard, acceso: 'admin', titulo: 'Panel de control', sub: 'Resumen de la flota, los alquileres y los ingresos.' },
  'nuevo-alquiler': { vista: vNuevoAlquiler, acceso: 'admin', titulo: 'Registrar alquiler', sub: 'Registro de alquiler en mostrador.' },
  'alquileres': { vista: vAlquileres, acceso: 'admin', titulo: 'Gestionar alquileres', sub: 'Modifica, cancela o registra devoluciones.' },
  'flota': { vista: vFlota, acceso: 'admin', titulo: 'Flota', sub: 'Vehículos, estados y fotos.' },
  'clientes': { vista: vClientes, acceso: 'admin', titulo: 'Clientes', sub: 'Clientes del portal y de mostrador.' },
  'facturas': { vista: vFacturas, acceso: 'admin', titulo: 'Facturación', sub: 'Facturas emitidas. No se editan ni se eliminan.' },
  'configuracion': { vista: vConfiguracion, acceso: 'admin', titulo: 'Configuración', sub: 'Parámetros generales del sistema.' },
  'administradores': { vista: vAdministradores, acceso: 'admin', titulo: 'Administradores', sub: 'Alta de nuevos usuarios administradores.' }
};

const NAV = {
  admin: [
    ['dashboard', 'Panel', 'grid'],
    ['alquileres', 'Alquileres', 'calendar'],
    ['flota', 'Flota', 'car'],
    ['clientes', 'Clientes', 'users'],
    ['facturas', 'Facturación', 'receipt'],
    ['reportes', 'Reportes', 'pulse'],
    ['configuracion', 'Configuración', 'gear'],
    ['administradores', 'Administradores', 'shield']
  ],
  cliente: [
    ['inicio', 'Inicio', 'home'],
    ['catalogo', 'Catálogo', 'car'],
    ['mis-alquileres', 'Mis alquileres', 'calendar'],
    ['mis-facturas', 'Mis facturas', 'receipt'],
    ['perfil', 'Mi perfil', 'user']
  ],
  publico: [
    ['catalogo', 'Catálogo', 'car'],
    ['login', 'Iniciar sesión', 'key'],
    ['registro', 'Crear cuenta', 'user']
  ]
};

function leerHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [camino, qs = ''] = h.split('?');
  const [ruta = '', param = null] = camino.split('/');
  return { ruta, param: param ? decodeURIComponent(param) : null, q: new URLSearchParams(qs) };
}

function ir(ruta) {
  const h = '#/' + ruta;
  if (location.hash === h) render();
  else location.hash = h;
}

function cambiarQuery(ruta, params) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== false)
  ).toString();
  history.replaceState(null, '', '#/' + ruta + (qs ? '?' + qs : ''));
}

async function render() {
  cerrarMenu();
  cerrarNotificaciones();
  $('#app')?.classList.remove('menu-abierto');
  $('[data-menu-movil]')?.setAttribute('aria-expanded','false');

  const { ruta, param, q } = leerHash();
  const def = RUTAS[ruta];
  document.body.classList.toggle('panel-admin', ruta === 'dashboard');
  const s = Api.sesion();

  haySesion = !!s;

  if (!def) return ir(inicio());
  if (s && s.usuario.debeCambiarPassword && ruta !== 'cambiar-password') return ir('cambiar-password');
  if (def.acceso === 'publica' && s) return ir(inicio());
  if (['sesion', 'cliente', 'admin'].includes(def.acceso) && !s) {
    return ir('login?next=' + encodeURIComponent(location.hash.replace(/^#\//, '')));
  }
  if (def.acceso === 'cliente' && esAdmin()) return ir('dashboard');
  if (def.acceso === 'admin' && !esAdmin()) return ir(inicio());

  const id = ++renderId;
  const forzado = !!(s && s.usuario.debeCambiarPassword);
  const enAuth = def.layout === 'auth' || (ruta === 'cambiar-password' && forzado);

  // El entorno visual Glass del panel administrativo debe mantenerse en
  // todos sus módulos, no solamente en el Dashboard. Esta clase permite
  // que fondo, sidebar, tarjetas, formularios y capas flotantes reaccionen
  // juntos al modo día/noche sin alterar las pantallas públicas/auth.
  document.body.classList.toggle('entorno-admin', !!s && esAdmin() && !enAuth);
  document.body.classList.toggle('entorno-cliente', !!s && !esAdmin() && !enAuth);
  document.body.classList.toggle('shell-activa', !enAuth);
  document.documentElement.classList.toggle('shell-activa', !enAuth);

  const cont = enAuth ? montarAuth(def) : montarShell(ruta, def);

  document.title = `${def.titulo} · AutoGo Rent a Car`;

  const ctx = {
    ruta, param, q, forzado,
    vigente: () => id === renderId,
    titulo: t => {
      const h = $('#titulo');
      if (h && id === renderId) h.textContent = t;
    },
    acciones: html => {
      const a = $('#accVista');
      if (a && id === renderId) a.innerHTML = html;
      return a;
    }
  };

  try {
    await def.vista(cont, ctx);
  } catch (e) {
    if (ctx.vigente()) falloCarga(cont, e);
  }
}


/* =========================================================
   ESTRUCTURAS
========================================================= */

function montarAuth(def) {
  const [titulo, texto] = def.lema || LEMA;

  raiz.innerHTML = `
    <main class="auth">
      <section class="auth-foto">
        <div>
          <a href="#/catalogo" class="marca"><img src="logo.png" alt="AutoGo Rent a Car"></a>
          <h1>${esc(titulo)}</h1>
          <p>${esc(texto)}</p>
        </div>
        <div class="chips">
          <span class="chip">${icon('calendar')}Reserva en línea</span>
          <span class="chip">${icon('receipt')}Factura inmediata</span>
          <span class="chip">${icon('shield')}Vehículos revisados</span>
        </div>
      </section>
      <section class="auth-panel">
        <div class="contenido" id="vista"></div>
      </section>
    </main>`;

  return $('#vista');
}

const menuExpandido = () => {
  try { return localStorage.getItem('autogo.menu') !== '0'; } catch (e) { return false; }
};

function montarShell(ruta, def) {
  if (!$('#app')) {
    raiz.innerHTML = `
      <div class="app${menuExpandido() ? ' expandida' : ''}" id="app">
        <aside class="side">
          <div class="side-top">
            <button class="icon-btn cuadro" id="bMenu" type="button" aria-label="Expandir menú" aria-expanded="${menuExpandido()}">${icon('menu')}</button>
            <a class="side-logo" href="#/"><img src="logo.png" alt="AutoGo Rent a Car"></a>
          </div>
          <nav class="nav" id="nav" aria-label="Menú principal"></nav>
          <div class="side-pie" id="sidePie"></div>
        </aside>

        <section class="main" id="main">
          <header class="topbar"><button class="icon-btn cuadro menu-movil" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav" data-menu-movil>${icon('menu')}</button>
            <a class="marca" href="#/"><img src="logo.png" alt="AutoGo Rent a Car"></a>
            <div>
              <h1 id="titulo"></h1>
              <p class="sub" id="subtitulo"></p>
            </div>
            <div class="top-acc">
              <div id="accVista"></div>
              <div class="acc-fijas" id="accFijas"></div>
            </div>
          </header>
          <div id="vista"></div>
        </section>
      </div>`;

    $('#bMenu').onclick = () => {
      const app = $('#app');
      const si = !app.classList.contains('expandida');
      app.classList.toggle('expandida', si);
      $('#bMenu').setAttribute('aria-expanded', si);
      try { localStorage.setItem('autogo.menu', si ? '1' : '0'); } catch (e) { /* preferencia no guardada */ }
    };
  }

  $('#app').classList.toggle('admin-shell', esAdmin());
  const activa = typeof def.nav === 'function' ? def.nav() : def.nav || ruta;

  pintarNav(activa);
  pintarFijas();

  $('#titulo').textContent = def.titulo;
  $('#subtitulo').textContent = def.sub || '';
  $('#subtitulo').hidden = !def.sub;
  $('#accVista').innerHTML = '';

  const vieja = $('#vista');
  const nueva = vieja.cloneNode(false);
  vieja.replaceWith(nueva);

  $('#main').scrollTop = 0;
  window.scrollTo(0, 0);

  if (esAdmin() && pendientes === null) refrescarPendientes();
  if (esAdmin() && notificacionesCache === null) cargarNotificaciones();

  return nueva;
}

function pintarNav(activa) {
  const items = !Api.sesion() ? NAV.publico : esAdmin() ? NAV.admin : NAV.cliente;

  $('#nav').innerHTML = items.map(([r, texto, ic]) => {
    if (esAdmin() && r === 'alquileres') return `<details class="nav-grupo" ${['alquileres','nuevo-alquiler'].includes(activa) ? 'open' : ''}><summary title="Alquileres">${icon(ic)}<span>Alquileres</span><b class="nav-chevron">⌄</b></summary><div class="nav-sub"><a href="#/nuevo-alquiler" class="${activa === 'nuevo-alquiler' ? 'act' : ''}"><span>Registrar alquiler</span></a><a href="#/alquileres" class="${activa === 'alquileres' ? 'act' : ''}"><span>Gestionar alquileres</span></a></div></details>`;
    if (r === 'reportes') return `<button type="button" class="nav-pendiente" data-modulo-pendiente="${esc(texto)}" title="${esc(texto)}: pendiente de implementar">${icon(ic)}<span>${esc(texto)}<small>Próximamente</small></span></button>`;
    return `<a href="#/${r}" class="${r === activa ? 'act' : ''}" title="${esc(texto)}"${r === activa ? ' aria-current="page"' : ''}>${icon(ic)}<span>${esc(texto)}</span></a>`;
  }).join('');
  const u = usuario();
  $('#sidePie').innerHTML = u ? `<button class="yo" type="button" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="Abrir opciones de mi cuenta" title="Mi cuenta">${UI.avatar(u.nombre)}<div><b>${esc(u.nombre)}</b><small>${esc(u.rol)}</small></div></button><button type="button" class="pie-accion" data-salir title="Cerrar sesión">${icon('logout')}<span>Cerrar sesión</span></button>` : '';

}

function pintarFijas() {
  const u = usuario();
  const noLeidas = notificacionesCache ? notificacionesCache.filter(n => !n.leida).length : (pendientes || 0);
  $('#accFijas').innerHTML = `<button class="icon-btn cuadro" type="button" data-tema-global aria-label="Cambiar modo día o noche">${document.documentElement.getAttribute('data-tema') === 'noche' ? '☀' : '☾'}</button>` +
    (esAdmin() ? `<button class="icon-btn campana" type="button" data-notificaciones aria-haspopup="dialog" aria-expanded="false" title="Notificaciones" aria-label="Notificaciones${noLeidas ? ': '+noLeidas+' sin leer' : ''}">${icon('bell')}${noLeidas ? `<span class="punto">${Math.min(noLeidas,99)}</span>` : ''}</button>` : '') +
    (!u ? '<a class="btn sm" href="#/login">Iniciar sesión</a>' : !esAdmin() ? `<button class="icon-btn" type="button" data-menu aria-label="Mi cuenta">${icon('user')}</button>` : '');
}


/* =========================================================
   NOTIFICACIONES DEL PANEL
   Se construyen con datos ya disponibles en la API. El estado leído/no leído
   se guarda por usuario en el navegador hasta que el backend exponga una
   entidad de notificaciones propia.
========================================================= */

function claveNotifLeidas() {
  const u = usuario();
  return `autogo.notificaciones.leidas.${u ? u.id || u.correo : 'anon'}`;
}

function leerNotifLeidas() {
  try { return new Set(JSON.parse(localStorage.getItem(claveNotifLeidas()) || '[]')); }
  catch (_) { return new Set(); }
}

function guardarNotifLeidas(ids) {
  try { localStorage.setItem(claveNotifLeidas(), JSON.stringify([...ids])); } catch (_) {}
}

function fechaNotif(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function textoTiempoNotif(fecha) {
  const d = fechaNotif(fecha);
  if (!d) return '';
  const dif = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(dif / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  return d.toLocaleDateString('es-DO', { day:'2-digit', month:'short' });
}

function normalizarNotif(n, leidas) {
  return { ...n, leida: leidas.has(n.id) };
}

async function cargarNotificaciones({ repintar = true } = {}) {
  if (!esAdmin()) return [];
  const leidas = leerNotifLeidas();
  const lista = [];
  const hoyStr = hoy();
  const limiteReciente = Date.now() - 3 * 24 * 60 * 60 * 1000;

  try {
    const r = await Api.alquileres({ first: 80, orden: 'vencimiento' });
    (r.nodes || []).forEach(a => {
      const nombre = a.clienteNombre || 'Cliente';
      const veh = a.vehiculo || a.placa || 'vehículo';
      if (a.estado === 'ACTIVO' && a.vencido) {
        lista.push({ id:`alquiler-vencido-${a.id}`, tipo:'alerta', icono:'alert', titulo:'Devolución vencida', texto:`${nombre} · ${veh} · ${a.diasRetraso || 1} día(s) de retraso`, fecha:a.fechaFinPactada, ruta:`#/alquileres?filtro=vencidos` });
      } else if (a.estado === 'ACTIVO' && a.fechaFinPactada === hoyStr) {
        lista.push({ id:`alquiler-hoy-${a.id}`, tipo:'aviso', icono:'calendar', titulo:'Devolución para hoy', texto:`${nombre} debe devolver ${veh} hoy.`, fecha:a.fechaFinPactada, ruta:`#/alquileres?filtro=activos` });
      } else if (a.estado === 'ACTIVO' && a.fechaFinPactada) {
        const fin = new Date(a.fechaFinPactada + 'T23:59:59');
        const dias = Math.ceil((fin - new Date()) / 86400000);
        if (dias > 0 && dias <= 2) lista.push({ id:`alquiler-proximo-${a.id}`, tipo:'info', icono:'clock', titulo:'Alquiler próximo a vencer', texto:`${nombre} · ${veh} · vence en ${dias} día${dias === 1 ? '' : 's'}.`, fecha:a.fechaFinPactada, ruta:`#/alquileres?filtro=activos` });
      }
      const creada = fechaNotif(a.fechaCreacion);
      if (creada && creada.getTime() >= limiteReciente) {
        lista.push({ id:`alquiler-nuevo-${a.id}`, tipo:'nuevo', icono:'calendar', titulo:'Nuevo alquiler registrado', texto:`${nombre} · ${veh}`, fecha:a.fechaCreacion, ruta:`#/alquileres` });
      }
      if (a.estado === 'DEVUELTO' && a.fechaDevolucion) {
        const dev = fechaNotif(a.fechaDevolucion);
        if (dev && dev.getTime() >= limiteReciente) lista.push({ id:`alquiler-devuelto-${a.id}`, tipo:'ok', icono:'check', titulo:'Vehículo devuelto', texto:`${veh} · devolución de ${nombre}`, fecha:a.fechaDevolucion, ruta:`#/alquileres` });
      }
    });
  } catch (_) {}

  try {
    const r = await Api.facturas({ first: 30 });
    (r.nodes || []).forEach(f => {
      const d = fechaNotif(f.fechaEmision);
      if (d && d.getTime() >= limiteReciente) lista.push({ id:`factura-${f.id}`, tipo:'pago', icono:'receipt', titulo:'Factura emitida', texto:`${f.clienteNombre || 'Cliente'} · ${fmt(f.monto)} · ${metodoTxt(f.metodoPago)}`, fecha:f.fechaEmision, ruta:`#/factura/${f.id}` });
    });
  } catch (_) {}

  if (Api.ADMIN_EXTRA && Api.administradores) {
    try {
      const r = await Api.administradores({});
      const admins = r.nodes || r || [];
      admins.forEach(a => {
        const d = fechaNotif(a.fechaCreacion);
        if (d && d.getTime() >= limiteReciente && String(a.id) !== String(usuario()?.id)) lista.push({ id:`admin-${a.id}`, tipo:'admin', icono:'shield', titulo:'Cuenta administrativa creada', texto:`${a.nombre} · ${a.perfil || a.rol || 'Administrador'}`, fecha:a.fechaCreacion, ruta:'#/administradores' });
      });
    } catch (_) {}
  }

  const unicas = [...new Map(lista.map(n => [n.id, n])).values()]
    .map(n => normalizarNotif(n, leidas))
    .sort((a,b) => (fechaNotif(b.fecha)?.getTime() || 0) - (fechaNotif(a.fecha)?.getTime() || 0));

  notificacionesCache = unicas;
  if (repintar && $('#app')) pintarFijas();
  return unicas;
}

function cerrarNotificaciones() {
  const p = $('#panelNotificaciones');
  if (p) p.remove();
  $('[data-notificaciones]')?.setAttribute('aria-expanded','false');
  document.removeEventListener('click', clicFueraNotificaciones, true);
}

function clicFueraNotificaciones(e) {
  if (!e.target.closest('#panelNotificaciones') && !e.target.closest('[data-notificaciones]')) cerrarNotificaciones();
}

function pintarListaNotificaciones() {
  const panel = $('#panelNotificaciones');
  if (!panel) return;
  const lista = (notificacionesCache || []).filter(n => filtroNotificaciones === 'no-leidas' ? !n.leida : true);
  const cont = $('[data-lista-notificaciones]', panel);
  if (!cont) return;
  cont.innerHTML = lista.length ? lista.map(n => `
    <button type="button" class="notif-item ${n.leida ? 'leida' : 'nueva'}" data-notif-id="${esc(n.id)}" data-notif-ruta="${esc(n.ruta || '')}">
      <span class="notif-ico ${esc(n.tipo)}">${icon(n.icono || 'bell')}</span>
      <span class="notif-cuerpo"><b>${esc(n.titulo)}</b><span>${esc(n.texto)}</span><small>${esc(textoTiempoNotif(n.fecha))}</small></span>
      ${n.leida ? '' : '<i class="notif-no-leida" aria-label="Sin leer"></i>'}
    </button>`).join('') : `<div class="notif-vacio">${icon('bell')}<b>${filtroNotificaciones === 'no-leidas' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones por ahora'}</b><span>Cuando haya actividad importante aparecerá aquí.</span></div>`;

  $$('[data-filtro-notif]', panel).forEach(b => b.classList.toggle('act', b.dataset.filtroNotif === filtroNotificaciones));
  const noLeidas = (notificacionesCache || []).filter(n => !n.leida).length;
  $('[data-contador-notif]', panel).textContent = noLeidas ? `${noLeidas} sin leer` : 'Todo al día';
  const todas = $('[data-marcar-todas]', panel);
  if (todas) todas.disabled = !noLeidas;
}

async function abrirNotificaciones(btn) {
  if ($('#panelNotificaciones')) return cerrarNotificaciones();
  cerrarMenu();
  btn.setAttribute('aria-expanded','true');
  const p = document.createElement('section');
  p.id = 'panelNotificaciones';
  p.className = 'panel-notificaciones';
  p.setAttribute('role','dialog');
  p.setAttribute('aria-label','Notificaciones');
  p.innerHTML = `
    <header class="notif-cabecera"><div><h3>Notificaciones</h3><span data-contador-notif>Cargando…</span></div><button class="icon-btn notif-cerrar" type="button" data-cerrar-notif aria-label="Cerrar">×</button></header>
    <div class="notif-herramientas"><div class="notif-filtros"><button type="button" data-filtro-notif="todas" class="act">Todas</button><button type="button" data-filtro-notif="no-leidas">Sin leer</button></div><button type="button" class="notif-marcar" data-marcar-todas>Marcar todas como leídas</button></div>
    <div class="notif-lista" data-lista-notificaciones><div class="notif-cargando">Cargando notificaciones…</div></div>`;
  document.body.appendChild(p);
  const r = btn.getBoundingClientRect();
  const ancho = Math.min(430, innerWidth - 24);
  p.style.width = ancho + 'px';
  p.style.right = Math.max(12, innerWidth - r.right) + 'px';
  p.style.top = Math.min(r.bottom + 10, innerHeight - 120) + 'px';
  await cargarNotificaciones({ repintar:false });
  pintarListaNotificaciones();
  setTimeout(() => document.addEventListener('click', clicFueraNotificaciones, true));
}

function marcarNotificacion(id, navegar = true) {
  const leidas = leerNotifLeidas(); leidas.add(id); guardarNotifLeidas(leidas);
  if (notificacionesCache) notificacionesCache = notificacionesCache.map(n => n.id === id ? { ...n, leida:true } : n);
  pintarFijas();
  const n = notificacionesCache?.find(x => x.id === id);
  if (navegar && n?.ruta) { cerrarNotificaciones(); location.hash = n.ruta; }
  else pintarListaNotificaciones();
}

function marcarTodasNotificaciones() {
  const leidas = leerNotifLeidas();
  (notificacionesCache || []).forEach(n => leidas.add(n.id));
  guardarNotifLeidas(leidas);
  notificacionesCache = (notificacionesCache || []).map(n => ({ ...n, leida:true }));
  pintarFijas(); pintarListaNotificaciones();
}

async function refrescarPendientes() {
  if (!esAdmin()) return;

  try {
    const d = await Api.dashboard();
    pendientes = d.pendientesDevolucion || 0;
  } catch (e) {
    pendientes = 0;
  }

  if ($('#app')) {
    const actual = $('#nav a.act');
    pintarNav(actual ? actual.getAttribute('href').slice(2) : '');
    pintarFijas();
  }
}


/* Menú de usuario */

function abrirMenu(btn) {
  cerrarMenu();

  const u = usuario();
  if (!u) return;

  const m = document.createElement('div');
  m.className = 'menu-usuario';
  m.id = 'menuUsuario';
  m.setAttribute('role', 'menu');
  m.innerHTML = `
    <div class="quien">
      ${UI.avatar(u.nombre, 'sm')}
      <div><b>${esc(u.nombre)}</b><small>${esc(u.correo)}</small></div>
    </div>
    <a href="#/perfil" role="menuitem">${icon('user')}Mi perfil</a>
    <a href="#/cambiar-password" role="menuitem">${icon('lock')}Cambiar contraseña</a>
    ${!esAdmin() ? `<button type="button" role="menuitem" data-salir>${icon('logout')}Cerrar sesión</button>` : ''}`;

  document.body.appendChild(m);
  btn.setAttribute('aria-expanded', 'true');

  const r = btn.getBoundingClientRect();
  const ancho = 260;
  let left = r.left < innerWidth / 2 ? r.left : r.right - ancho;
  left = Math.max(12, Math.min(left, innerWidth - ancho - 12));

  if (r.top > innerHeight / 2) m.style.bottom = (innerHeight - r.top + 8) + 'px';
  else m.style.top = (r.bottom + 8) + 'px';
  m.style.left = left + 'px';

  const primero = m.querySelector('a, button');
  if (primero) primero.focus();

  setTimeout(() => document.addEventListener('click', clicFuera));
}

function clicFuera(e) {
  if (!e.target.closest('#menuUsuario')) cerrarMenu();
}

function cerrarMenu() {
  $$('[data-menu][aria-expanded]').forEach(b => b.setAttribute('aria-expanded','false'));
  const m = $('#menuUsuario');
  if (m) m.remove();
  document.removeEventListener('click', clicFuera);
}

async function salir() {
  cerrarMenu();
  const ok = await UI.confirmar('Cerrar sesión', '¿Deseas cerrar sesión?', { boton: 'Cerrar sesión' });
  if (!ok) return;

  Api.cerrarSesion();
  pendientes = null;
  notificacionesCache = null;
  UI.toast('Sesión cerrada.', 'info');
  ir('login');
}


/* =========================================================
   MANEJO DE ERRORES
========================================================= */

function manejarSesion(e) {
  if (e.code === 'AUTH_NOT_AUTHENTICATED') {
    Api.cerrarSesion();
    pendientes = null;
    notificacionesCache = null;
    UI.toast('Tu sesión expiró. Inicia sesión de nuevo.', 'warn');
    ir('login');
    return true;
  }

  if (e.code === 'AUTH_NOT_AUTHORIZED' && usuario() && usuario().debeCambiarPassword) {
    ir('cambiar-password');
    return true;
  }

  return false;
}

function mensajeError(e) {
  if (['AUTH_NOT_AUTHORIZED', 'ACCESO_DENEGADO'].includes(e.code)) return 'No tienes permiso para realizar esta acción.';
  if (e.code === 'ERROR_INTERNO') return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  if (e.code === 'ESTADO_CAMBIADO') return 'Otro usuario modificó este registro al mismo tiempo. Recarga e inténtalo de nuevo.';
  return e.message || 'Ocurrió un error inesperado.';
}

function avisarError(e) {
  if (manejarSesion(e)) return;
  UI.toast(mensajeError(e), 'bad');
}

const ERRORES_DE_FORMULARIO = [
  'DATO_INVALIDO', 'FECHAS_INVALIDAS', 'CREDENCIALES_INVALIDAS', 'PASSWORD_REPETIDA', 'TOKEN_INVALIDO',
  'REGLA_NEGOCIO', 'VEHICULO_NO_DISPONIBLE', 'CEDULA_DUPLICADA', 'CORREO_DUPLICADO', 'PLACA_DUPLICADA',
  'CATEGORIA_DUPLICADA', 'ALQUILER_NO_ACTIVO', 'CANCELACION_NO_PERMITIDA', 'ESTADO_CAMBIADO', 'SIN_CONEXION'
];

function errorEnForm(form, e, campos = {}) {
  if (manejarSesion(e)) return;
  if (campos[e.code]) return UI.errorCampo(form, campos[e.code], e.message);
  if (ERRORES_DE_FORMULARIO.includes(e.code)) return UI.errorForm(form, mensajeError(e));
  avisarError(e);
}

function falloCarga(cont, e, reintentar = render) {
  if (manejarSesion(e)) return;

  const noExiste = e.code === 'NO_ENCONTRADO';
  const sinPermiso = ['ACCESO_DENEGADO', 'AUTH_NOT_AUTHORIZED'].includes(e.code);

  const texto = noExiste
    ? 'No encontramos lo que buscas. Es posible que se haya eliminado o que el enlace no sea correcto.'
    : sinPermiso ? 'No tienes permiso para ver este contenido.' : mensajeError(e);

  const boton = noExiste || sinPermiso
    ? `<a class="btn ghost sm" href="#/${inicio()}">Ir al inicio</a>`
    : `<button class="btn ghost sm" type="button" data-reintentar>Reintentar</button>`;

  cont.innerHTML = `<div class="card">${UI.vacio(esc(texto), noExiste ? 'search' : 'alert', boton)}</div>`;

  const b = $('[data-reintentar]', cont);
  if (b) b.onclick = () => reintentar();
}

const formErr = '<div class="form-err" data-err-form hidden></div>';


/* =========================================================
   PIEZAS COMPARTIDAS
========================================================= */

const fotoVeh = v => (v && v.fotoUrl
  ? `<img src="${esc(Api.media(v.fotoUrl))}" alt="${esc(v.marca + ' ' + v.modelo)}" loading="lazy" data-veh>`
  : UI.sinFoto());

const tarjetaVeh = (v, { accion = 'rentar', texto = 'Rentar', sel = false, registro = false } = {}) => `
  <article class="card veh-card${sel ? ' sel' : ''}${registro ? ' veh-card-registro' : ''}"${registro ? ` data-card-veh="${v.id}"` : ''}>
    <div class="veh-foto">
      ${fotoVeh(v)}
      <div class="veh-foto-etiquetas">
        ${badge(null, v.categoria, 'neutro')}
        ${registro ? badge(null, 'Disponible', 'ok') : ''}
      </div>
      ${registro && sel ? `<span class="veh-seleccion-check">${icon('check')} Seleccionado</span>` : ''}
    </div>
    <div class="veh-cuerpo">
      <div class="veh-titulo-linea">
        <div>
          <h3>${esc(v.marca)} ${esc(v.modelo)}</h3>
          <span class="meta">${esc(v.anio)} · Placa ${esc(v.placa)}</span>
        </div>
      </div>
      ${registro ? `<div class="veh-datos-rapidos">
        ${v.transmision ? `<span>${icon('settings')} ${esc(etq(v.transmision))}</span>` : ''}
        ${v.color ? `<span>${icon('tag')} ${esc(v.color)}</span>` : ''}
        <span>${icon('calendar')} ${esc(v.anio)}</span>
      </div>` : ''}
      <div class="veh-pie">
        <div class="precio"><small>${registro ? 'Tarifa diaria' : ''}</small><b>${fmt.dinero(v.precioDia)}</b> <span>/ día</span></div>
        <button class="btn sm${sel ? ' veh-btn-elegido' : ''}" type="button" data-${accion}="${v.id}">${texto}</button>
      </div>
    </div>
  </article>`;

function estadoOperativoAlquiler(a) {
  const h = hoy();

  if (a.estado === 'COMPLETADO') return { clave: 'completado', texto: 'Completado', tono: 'ok' };
  if (a.estado === 'CANCELADO') return { clave: 'cancelado', texto: 'Cancelado', tono: 'cancelado' };

  if (a.estado === 'ACTIVO') {
    if (a.vencido || (a.fechaFinPactada && a.fechaFinPactada < h)) {
      return { clave: 'vencido', texto: 'Vencido', tono: 'bad' };
    }
    if (a.fechaInicio > h) {
      return { clave: 'reserva', texto: 'Reserva', tono: 'reserva' };
    }
    if (a.fechaFinPactada === h) {
      return { clave: 'por_devolver', texto: 'Por devolver', tono: 'warn' };
    }
    return { clave: 'activo', texto: 'Activo', tono: 'info' };
  }

  return { clave: String(a.estado || '').toLowerCase(), texto: etq(a.estado), tono: 'neutro' };
}

function estadoAlquiler(a) {
  const e = estadoOperativoAlquiler(a);
  return `<div class="badges">${badge(null, e.texto, e.tono)}</div>`;
}

function claseFilaAlquiler(a) {
  const e = estadoOperativoAlquiler(a).clave;
  if (e === 'vencido') return 'fila-alerta';
  if (e === 'reserva') return 'fila-reserva';
  if (e === 'por_devolver') return 'fila-por-devolver';
  if (e === 'cancelado') return 'fila-cancelado';
  return '';
}

const puedeCancelar = a => a.estado === 'ACTIVO' && a.fechaInicio > hoy();
const puedeDevolver = a => a.estado === 'ACTIVO' && a.fechaInicio <= hoy();

function tipoFactura(f) {
  return f.tipo === 'AJUSTE' && Number(f.monto) < 0 ? badge(null, 'Nota de crédito', 'ok') : badge(f.tipo);
}

const montoFactura = m => `<span class="${Number(m) < 0 ? 'negativo' : ''}">${fmt.dinero(m)}</span>`;

function avisoOperacion(texto, facturaId) {
  UI.toast(texto, 'ok', facturaId ? { texto: 'Ver factura', href: `#/factura/${facturaId}` } : null);
}

function modalExito({ titulo, texto, facturaId, extra = '' }) {
  const m = UI.modal({
    titulo: 'Operación completada',
    ancho: 460,
    cuerpo: `
      <div class="exito">
        <div class="sello">${icon('check')}</div>
        <h4>${esc(titulo)}</h4>
        <p>${texto}</p>
        <div class="modal-acc">
          ${extra}
          ${facturaId ? `<a class="btn" href="#/factura/${facturaId}" data-cerrar>${icon('receipt')} Ver factura</a>` : ''}
        </div>
      </div>`
  });

  $$('a[data-cerrar]', m.el).forEach(a => {
    a.onclick = () => m.cerrar();
  });

  return m;
}

function paginador(r, offset) {
  if (!r.totalCount) return '';
  const desde = offset + 1;
  const hasta = offset + r.nodes.length;

  return `
    <div class="paginador">
      <span>${desde}–${hasta} de ${r.totalCount}</span>
      <div>
        <button class="btn ghost sm" type="button" data-pag="prev"${offset > 0 ? '' : ' disabled'}>${icon('chevL')} Anterior</button>
        <button class="btn ghost sm" type="button" data-pag="next"${r.pageInfo.hasNextPage ? '' : ' disabled'}>Siguiente ${icon('chevR')}</button>
      </div>
    </div>`;
}

/* Listado paginado con cursores */
function listado({ cont, cargar, pintar, porPagina = 12, vigente }) {
  let pag = { first: porPagina };
  let offset = 0;
  let ultimo = null;
  let direccion = null;

  async function recargar(reiniciar) {
    if (reiniciar) {
      pag = { first: porPagina };
      offset = 0;
      direccion = null;
    }

    cont.innerHTML = UI.cargando(5);

    try {
      const r = await cargar(pag);
      if (vigente && !vigente()) return;

      if (direccion === 'prev') offset = Math.max(0, offset - r.nodes.length);
      direccion = null;

      ultimo = r;
      cont.innerHTML = pintar(r) + paginador(r, offset);

      $$('[data-pag]', cont).forEach(b => {
        b.onclick = () => {
          if (b.dataset.pag === 'next') {
            offset += ultimo.nodes.length;
            pag = { first: porPagina, after: ultimo.pageInfo.endCursor };
          } else {
            direccion = 'prev';
            pag = { last: porPagina, before: ultimo.pageInfo.startCursor };
          }
          recargar();
        };
      });
    } catch (e) {
      falloCarga(cont, e, () => recargar());
    }
  }

  return {
    recargar,
    nodos: () => (ultimo ? ultimo.nodes : [])
  };
}


/* =========================================================
   CUENTA: LOGIN, REGISTRO, RECUPERACIÓN
========================================================= */

function vLogin(c, ctx) {
  c.innerHTML = `
    <h2>Inicia sesión</h2>
    <p class="sub">Accede a tu cuenta para gestionar tus alquileres.</p>

    <form class="form" id="f" novalidate>
      ${UI.campo({ name: 'correo', label: 'Correo electrónico', tipo: 'email', placeholder: 'tucorreo@ejemplo.com', attrs: 'autocomplete="email" required' })}
      ${UI.campo({ name: 'password', label: 'Contraseña', tipo: 'password', placeholder: '••••••••', attrs: 'autocomplete="current-password" required' })}

      <div class="fila-sb">
        <label class="check"><input type="checkbox" name="recordar" checked> Recordarme</label>
        <a href="#/recuperar" class="link">¿Olvidaste tu contraseña?</a>
      </div>

      ${formErr}
      <button class="btn block" type="submit">Iniciar sesión</button>
    </form>

    <p class="pie">¿No tienes cuenta? <a href="#/registro" class="link">Regístrate</a></p>
    <p class="pie"><a href="#/catalogo" class="link suave">Ver vehículos disponibles ${icon('arrowRight')}</a></p>

    ${Api.DEMO ? `
      <div class="nota-demo">
        Modo demostración. Entra como
        <button type="button" data-demo="admin@autogo.com|Admin2026">administrador</button> o como
        <button type="button" data-demo="ana@correo.com|Clave2026">cliente</button>.
      </div>` : ''}`;

  const f = $('#f', c);

  $$('[data-demo]', c).forEach(b => {
    b.onclick = () => {
      const [correo, pass] = b.dataset.demo.split('|');
      f.correo.value = correo;
      f.password.value = pass;
      f.requestSubmit();
    };
  });

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);
    if (!d.correo) return UI.errorCampo(f, 'correo', 'Ingresa tu correo electrónico.');
    if (!UI.correoValido(d.correo)) return UI.errorCampo(f, 'correo', 'El correo no tiene un formato válido.');
    if (!d.password) return UI.errorCampo(f, 'password', 'Ingresa tu contraseña.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const r = await Api.login(d.correo, d.password);
      Api.guardarSesion(r, d.recordar);
      pendientes = null;

      if (r.usuario.debeCambiarPassword) return ir('cambiar-password');

      UI.toast(`¡Bienvenido, ${fmt.primerNombre(r.usuario.nombre)}!`);
      ir(ctx.q.get('next') || inicio());
    } catch (err) {
      errorEnForm(f, err);
    } finally {
      UI.ocupado(btn, false);
    }
  };
}

function vRegistro(c) {
  c.innerHTML = `
    <h2>Crear cuenta</h2>
    <p class="sub">Regístrate y comienza a rentar el vehículo que necesitas.</p>

    <form class="form" id="f" novalidate>
      <div class="grid2">
        ${UI.campo({ name: 'nombre', label: 'Nombre completo', requerido: true, clase: 'todo', attrs: 'autocomplete="name"' })}
        ${UI.campo({ name: 'correo', label: 'Correo electrónico', tipo: 'email', requerido: true, clase: 'todo', attrs: 'autocomplete="email"' })}
        ${UI.campo({ name: 'cedula', label: 'Cédula', requerido: true, placeholder: '000-0000000-0', attrs: 'inputmode="numeric" data-mascara="cedula"' })}
        ${UI.campo({ name: 'telefono', label: 'Teléfono', tipo: 'tel', placeholder: '809-000-0000', attrs: 'data-mascara="telefono" autocomplete="tel"' })}
        ${UI.campo({ name: 'licenciaConducir', label: 'Licencia de conducir', clase: 'todo' })}
        ${UI.campo({ name: 'password', label: 'Contraseña', tipo: 'password', requerido: true, ayuda: 'Mínimo 8 caracteres, con letras y números.', attrs: 'autocomplete="new-password"' })}
        ${UI.campo({ name: 'password2', label: 'Confirmar contraseña', tipo: 'password', requerido: true, attrs: 'autocomplete="new-password"' })}
      </div>

      <label class="check"><input type="checkbox" name="terminos"> Acepto los Términos y Condiciones y la Política de Privacidad</label>

      ${formErr}
      <button class="btn block" type="submit">Crear cuenta</button>
    </form>

    <p class="pie">¿Ya tienes cuenta? <a href="#/login" class="link">Inicia sesión</a></p>`;

  const f = $('#f', c);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);

    if (!d.nombre) return UI.errorCampo(f, 'nombre', 'Escribe tu nombre completo.');
    if (!UI.correoValido(d.correo)) return UI.errorCampo(f, 'correo', 'Escribe un correo válido.');
    if (d.cedula.replace(/\D/g, '').length !== 11) return UI.errorCampo(f, 'cedula', 'La cédula debe tener 11 dígitos.');
    if (!UI.passwordValida(d.password)) return UI.errorCampo(f, 'password', 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (d.password !== d.password2) return UI.errorCampo(f, 'password2', 'Las contraseñas no coinciden.');
    if (!d.terminos) return UI.errorForm(f, 'Debes aceptar los términos y condiciones.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const r = await Api.registrarCliente({
        nombre: d.nombre,
        correo: d.correo,
        password: d.password,
        cedula: d.cedula,
        telefono: d.telefono || null,
        licenciaConducir: d.licenciaConducir || null
      });

      Api.guardarSesion(r, true);
      UI.toast('¡Tu cuenta está lista!');
      ir(inicio());
    } catch (err) {
      errorEnForm(f, err, { CEDULA_DUPLICADA: 'cedula', CORREO_DUPLICADO: 'correo' });
    } finally {
      UI.ocupado(btn, false);
    }
  };
}

function vRecuperar(c) {
  c.innerHTML = `
    <h2>Recuperar contraseña</h2>
    <p class="sub">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>

    <form class="form" id="f" novalidate>
      ${UI.campo({ name: 'correo', label: 'Correo electrónico', tipo: 'email', placeholder: 'tucorreo@ejemplo.com', attrs: 'autocomplete="email"' })}
      ${formErr}
      <button class="btn block" type="submit">Enviar enlace</button>
    </form>

    <p class="pie"><a href="#/login" class="link suave">${icon('arrowLeft')} Volver a iniciar sesión</a></p>`;

  const f = $('#f', c);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const { correo } = UI.datos(f);
    if (!UI.correoValido(correo)) return UI.errorCampo(f, 'correo', 'Escribe un correo válido.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      await Api.solicitarRecuperacionPassword(correo);
    } catch (err) {
      if (err.code === 'SIN_CONEXION') {
        UI.ocupado(btn, false);
        return UI.errorForm(f, err.message);
      }
    }

    // Siempre el mismo mensaje, exista o no el correo
    f.outerHTML = `
      <div class="form-ok">${icon('mail')}
        <div>Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
        El enlace vence en 30 minutos y solo puede usarse una vez.</div>
      </div>`;
  };
}

function vRestablecer(c, ctx) {
  const token = ctx.q.get('token');

  if (!token) {
    c.innerHTML = `
      <h2>Enlace no válido</h2>
      <p class="sub">El enlace de recuperación está incompleto. Solicita uno nuevo.</p>
      <a class="btn block" href="#/recuperar">Solicitar otro enlace</a>`;
    return;
  }

  c.innerHTML = `
    <h2>Nueva contraseña</h2>
    <p class="sub">Crea una contraseña nueva para tu cuenta.</p>

    <form class="form" id="f" novalidate>
      ${UI.campo({ name: 'password', label: 'Contraseña nueva', tipo: 'password', ayuda: 'Mínimo 8 caracteres, con letras y números.', attrs: 'autocomplete="new-password"' })}
      ${UI.campo({ name: 'password2', label: 'Confirmar contraseña', tipo: 'password', attrs: 'autocomplete="new-password"' })}
      ${formErr}
      <button class="btn block" type="submit">Guardar contraseña</button>
    </form>

    <p class="pie"><a href="#/login" class="link suave">${icon('arrowLeft')} Volver a iniciar sesión</a></p>`;

  const f = $('#f', c);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);
    if (!UI.passwordValida(d.password)) return UI.errorCampo(f, 'password', 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (d.password !== d.password2) return UI.errorCampo(f, 'password2', 'Las contraseñas no coinciden.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      await Api.restablecerPassword(token, d.password);
      UI.toast('Contraseña actualizada. Ya puedes iniciar sesión.');
      Api.cerrarSesion();
      ir('login');
    } catch (err) {
      if (err.code === 'TOKEN_INVALIDO') {
        UI.errorForm(f, 'El enlace venció o ya fue usado.');
        $('[data-err-form]', f).insertAdjacentHTML('beforeend', ' <a class="link" href="#/recuperar">Solicitar otro enlace</a>');
      } else {
        errorEnForm(f, err);
      }
    } finally {
      UI.ocupado(btn, false);
    }
  };
}

function vCambiarPassword(c, ctx) {
  const contenido = `
    <form class="form" id="f" novalidate>
      ${UI.campo({ name: 'actual', label: 'Contraseña actual', tipo: 'password', attrs: 'autocomplete="current-password"' })}
      ${UI.campo({ name: 'nueva', label: 'Contraseña nueva', tipo: 'password', ayuda: 'Mínimo 8 caracteres, con letras y números.', attrs: 'autocomplete="new-password"' })}
      ${UI.campo({ name: 'nueva2', label: 'Confirmar contraseña nueva', tipo: 'password', attrs: 'autocomplete="new-password"' })}
      ${formErr}
      <button class="btn${ctx.forzado ? ' block' : ''}" type="submit">Guardar contraseña</button>
    </form>`;

  if (ctx.forzado) {
    c.innerHTML = `
      <h2>Cambia tu contraseña</h2>
      <p class="sub">Por seguridad debes reemplazar tu contraseña temporal antes de continuar.</p>
      ${contenido}
      <p class="pie"><button type="button" class="link suave" data-salir>${icon('logout')} Cerrar sesión</button></p>`;
  } else {
    c.innerHTML = `<div class="card angosta">${contenido}</div>`;
  }

  const f = $('#f', c);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);
    if (!d.actual) return UI.errorCampo(f, 'actual', 'Escribe tu contraseña actual.');
    if (!UI.passwordValida(d.nueva)) return UI.errorCampo(f, 'nueva', 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
    if (d.nueva === d.actual) return UI.errorCampo(f, 'nueva', 'La nueva contraseña debe ser distinta de la actual.');
    if (d.nueva !== d.nueva2) return UI.errorCampo(f, 'nueva2', 'Las contraseñas no coinciden.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const r = await Api.cambiarPassword(d.actual, d.nueva);
      Api.guardarSesion(r);
      UI.toast('Contraseña actualizada.');
      ir(inicio());
    } catch (err) {
      errorEnForm(f, err, { CREDENCIALES_INVALIDAS: 'actual', PASSWORD_REPETIDA: 'nueva' });
    } finally {
      UI.ocupado(btn, false);
    }
  };
}


/* =========================================================
   CATÁLOGO Y CONFIRMACIÓN DE ALQUILER
========================================================= */

async function vCatalogo(c, ctx) {
  const h = hoy();
  let ini = ctx.q.get('desde') || h;
  if (ini < h) ini = h;
  let fin = ctx.q.get('hasta') || sumarDias(ini, 3);
  if (fin <= ini) fin = sumarDias(ini, 3);
  let cat = ctx.q.get('cat') || '';
  let autoVeh = ctx.q.get('veh');
  let lista = [];

  c.innerHTML = `
    <form class="card buscador" id="fb" novalidate>
      ${UI.campo({ name: 'desde', label: 'Fecha de salida', tipo: 'date', value: ini, attrs: `min="${h}"` })}
      ${UI.campo({ name: 'hasta', label: 'Fecha de entrega', tipo: 'date', value: fin, attrs: `min="${sumarDias(ini, 1)}" max="${sumarDias(ini, 90)}"` })}
      ${UI.campo({ name: 'cat', label: 'Categoría', tipo: 'select', opciones: [{ valor: '', texto: 'Todas las categorías' }] })}
      <button class="btn" type="submit">${icon('search')} Buscar</button>
      ${formErr}
    </form>
    <div class="resultado-info" id="info"></div>
    <div id="res"></div>`;

  const f = $('#fb', c);
  const res = $('#res', c);

  Api.categorias().then(cs => {
    if (!ctx.vigente()) return;
    f.cat.innerHTML = `<option value="">Todas las categorías</option>` +
      cs.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
    f.cat.value = cat;
  }).catch(() => { /* el filtro queda solo con "Todas" */ });

  f.desde.addEventListener('change', () => {
    const d = f.desde.value;
    if (!d) return;
    f.hasta.min = sumarDias(d, 1);
    f.hasta.max = sumarDias(d, 90);
    if (!f.hasta.value || f.hasta.value <= d) f.hasta.value = sumarDias(d, 3);
  });

  f.onsubmit = e => {
    e.preventDefault();
    buscar();
  };

  f.cat.onchange = () => buscar();

  async function buscar() {
    UI.limpiarErrores(f);

    ini = f.desde.value;
    fin = f.hasta.value;
    cat = f.cat.value;

    if (!ini || !fin) return UI.errorForm(f, 'Indica la fecha de salida y la de entrega.');
    if (ini < hoy()) return UI.errorCampo(f, 'desde', 'La fecha de salida no puede ser pasada.');
    if (fin <= ini) return UI.errorCampo(f, 'hasta', 'La entrega debe ser posterior a la salida.');
    if (diasEntre(ini, fin) > 90) return UI.errorCampo(f, 'hasta', 'El alquiler no puede superar 90 días.');

    cambiarQuery('catalogo', { desde: ini, hasta: fin, cat });

    $('#info', c).innerHTML = '';
    res.innerHTML = `<div class="card">${UI.cargando(4)}</div>`;

    try {
      lista = await Api.vehiculosDisponibles(ini, fin, cat ? +cat : null);
      if (!ctx.vigente()) return;

      $('#info', c).innerHTML = `
        <span><b>${lista.length}</b> vehículo(s) disponible(s) del <b>${fmt.fecha(ini)}</b> al <b>${fmt.fecha(fin)}</b></span>
        ${!Api.sesion() ? `<span class="pastilla">${icon('info')} Inicia sesión para confirmar tu alquiler</span>` : ''}`;

      res.innerHTML = lista.length
        ? `<div class="veh-grid">${lista.map(v => tarjetaVeh(v)).join('')}</div>`
        : `<div class="card">${UI.vacio('No hay vehículos disponibles para esas fechas. Prueba con otro rango o categoría.', 'car')}</div>`;

      if (autoVeh) {
        const v = lista.find(x => x.id === +autoVeh);
        autoVeh = null;
        if (v && Api.sesion() && !esAdmin()) confirmarAlquiler(v, ini, fin, buscar);
      }
    } catch (err) {
      if (!ctx.vigente()) return;
      if (err.code === 'FECHAS_INVALIDAS') {
        res.innerHTML = '';
        return UI.errorForm(f, err.message);
      }
      falloCarga(res, err, buscar);
    }
  }

  res.addEventListener('click', e => {
    const b = e.target.closest('[data-rentar]');
    if (!b) return;

    const v = lista.find(x => x.id === +b.dataset.rentar);
    if (!v) return;

    if (!Api.sesion()) {
      const destino = `catalogo?desde=${ini}&hasta=${fin}${cat ? '&cat=' + cat : ''}&veh=${v.id}`;
      UI.toast('Inicia sesión o crea una cuenta para rentar.', 'info');
      return ir('login?next=' + encodeURIComponent(destino));
    }

    if (esAdmin()) return ir(`nuevo-alquiler?veh=${v.id}&desde=${ini}&hasta=${fin}`);

    confirmarAlquiler(v, ini, fin, buscar);
  });

  await buscar();
}

function confirmarAlquiler(v, ini, fin, refrescar) {
  const m = UI.modal({
    titulo: 'Confirmar alquiler',
    cuerpo: `
      <div class="resumen-veh">
        <div class="foto-mini">${fotoVeh(v)}</div>
        <div><b>${esc(v.marca)} ${esc(v.modelo)} ${esc(v.anio)}</b><span>${esc(v.categoria)} · Placa ${esc(v.placa)}</span></div>
      </div>

      <dl class="dl">
        <dt>Salida</dt><dd>${fmt.fecha(ini)}</dd>
        <dt>Entrega</dt><dd>${fmt.fecha(fin)}</dd>
        <dt>Días</dt><dd data-k="dias">…</dd>
        <dt>Precio por día</dt><dd data-k="precio">…</dd>
      </dl>

      <div class="total"><span>Monto total</span><b data-k="total">…</b></div>

      <form class="form" id="fc" novalidate style="margin-top:18px">
        <div class="wallet-uso" id="cajaWallet" hidden>
          <label class="check"><input type="checkbox" name="usarWallet" checked> Usar mi saldo Wallet GO (<b data-k="wsaldo"></b>)</label>
          <small data-k="wdet"></small>
        </div>
        <div id="cajaMetodo">${UI.campo({ name: 'metodoPago', label: 'Método de pago', tipo: 'select', opciones: opcionesMetodo() })}</div>
        <div class="info-banda">${icon('info')}<span>La factura se emite al confirmar. Si cancelas antes de la fecha de salida, el monto pagado queda en tu Wallet GO.</span></div>
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Volver</button>
          <button class="btn" type="submit" disabled>Confirmar alquiler</button>
        </div>
      </form>`
  });

  const f = $('#fc', m.el);
  const btn = $('[type=submit]', f);

  let cotizacion = null;
  let saldoWallet = 0;
  const cajaW = $('#cajaWallet', m.el);
  const cajaM = $('#cajaMetodo', m.el);

  function pintarWallet() {
    if (!cotizacion) return;
    const total = Number(cotizacion.total);
    const usa = saldoWallet > 0 && f.usarWallet.checked;
    const usado = usa ? Math.min(saldoWallet, total) : 0;
    const resto = Math.round((total - usado) * 100) / 100;

    cajaW.hidden = !(saldoWallet > 0);
    $('[data-k=wsaldo]', m.el).textContent = fmt.dinero(saldoWallet);
    $('[data-k=wdet]', m.el).innerHTML = !usa ? '' : resto > 0
      ? `Se descontarán <b>${fmt.dinero(usado)}</b> de tu Wallet GO y pagarás <b>${fmt.dinero(resto)}</b> con el método elegido.`
      : `Se descontarán <b>${fmt.dinero(usado)}</b> de tu Wallet GO. No tendrás que pagar nada más.`;
    cajaM.hidden = resto <= 0;
  }

  f.usarWallet.onchange = pintarWallet;
  Api.miWallet().then(w => { saldoWallet = Number(w.saldo) || 0; pintarWallet(); }).catch(() => { /* sin wallet: se paga normal */ });

  Api.cotizarAlquiler(v.id, ini, fin).then(cot => {
    $('[data-k=dias]', m.el).textContent = cot.dias;
    $('[data-k=precio]', m.el).textContent = fmt.dinero(cot.precioDia);
    $('[data-k=total]', m.el).textContent = fmt.dinero(cot.total);
    btn.disabled = false;
    cotizacion = cot;
    pintarWallet();
  }).catch(err => errorEnForm(f, err));

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);
    UI.ocupado(btn, true);

    try {
      const r = await Api.crearAlquiler({ vehiculoId: v.id, fechaInicio: ini, fechaFin: fin, metodoPago: f.metodoPago.value, usarWallet: !cajaW.hidden && f.usarWallet.checked });
      m.cerrar();

      modalExito({
        titulo: '¡Alquiler confirmado!',
        texto: `Tu alquiler <b>#${r.alquiler.id}</b> del ${esc(r.alquiler.vehiculo)} quedó registrado del ${fmt.fecha(r.alquiler.fechaInicio)} al ${fmt.fecha(r.alquiler.fechaFinPactada)}.`,
        facturaId: r.facturaId,
        extra: '<a class="btn ghost" href="#/mis-alquileres" data-cerrar>Mis alquileres</a>'
      });

      if (refrescar) refrescar();
    } catch (err) {
      UI.ocupado(btn, false);

      if (err.code === 'VEHICULO_NO_DISPONIBLE') {
        m.cerrar();
        UI.toast('Este vehículo acaba de ser reservado para esas fechas. Elige otro o cambia las fechas.', 'warn');
        if (refrescar) refrescar();
        return;
      }

      errorEnForm(f, err);
    }
  };
}


/* =========================================================
   PORTAL DEL CLIENTE
========================================================= */

async function vInicioCliente(c, ctx) {
  const u = usuario();
  ctx.titulo(`¡Hola, ${fmt.primerNombre(u.nombre)}!`);
  ctx.acciones(`<a class="btn" href="#/catalogo">${icon('car')} Rentar un vehículo</a>`);

  c.innerHTML = UI.cargando(4);

  const [alquileres, facturas] = await Promise.all([Api.misAlquileres(), Api.misFacturas()]);
  if (!ctx.vigente()) return;

  const h = hoy();
  const activos = alquileres.filter(a => a.estado === 'ACTIVO');
  const enCurso = activos.filter(a => a.fechaInicio <= h);
  const reservas = activos.filter(a => a.fechaInicio > h);
  const vencidos = activos.filter(a => a.vencido);
  const proxima = enCurso.map(a => a.fechaFinPactada).sort()[0];
  const facturado = facturas.reduce((t, x) => t + Number(x.monto), 0);

  c.innerHTML = `
    <div class="seccion cliente-inicio">
      ${vencidos.length ? `
        <div class="aviso-banda">${icon('alert')}
          <span>Tienes ${vencidos.length} alquiler(es) con la entrega vencida. Devuelve el vehículo lo antes posible para evitar más cargos por mora.</span>
          <a class="btn sm" href="#/mis-alquileres">Ver</a>
        </div>` : ''}

      <div class="kpis cliente-kpis">
        <div class="card kpi cliente-kpi tono-blue"><span class="etq"><span class="cliente-kpi-ico">${icon('car')}</span> En curso</span><span class="valor">${enCurso.length}</span><span class="nota">Alquileres activos</span></div>
        <div class="card kpi cliente-kpi tono-purple"><span class="etq"><span class="cliente-kpi-ico">${icon('calendar')}</span> Reservas</span><span class="valor">${reservas.length}</span><span class="nota">Próximas salidas</span></div>
        <div class="card kpi cliente-kpi tono-orange"><span class="etq"><span class="cliente-kpi-ico">${icon('clock')}</span> Próxima entrega</span><span class="valor">${proxima ? fmt.fechaCorta(proxima) : '—'}</span><span class="nota">${proxima ? fmt.fecha(proxima) : 'Sin entregas pendientes'}</span></div>
        <div class="card kpi cliente-kpi tono-green"><span class="etq"><span class="cliente-kpi-ico">${icon('wallet')}</span> Total facturado</span><span class="valor">${fmt.dinero(facturado)}</span><span class="nota">${facturas.length} factura(s)</span></div>
      </div>

      <div class="dos-col">
        <section class="card">
          <div class="card-h"><h3>Alquileres recientes</h3><a class="link suave" href="#/mis-alquileres">Ver todos ${icon('arrowRight')}</a></div>
          ${alquileres.length ? `<div class="lista">${alquileres.slice(0, 5).map(a => `
            <div class="item">
              <span class="avatar sm">${icon('car')}</span>
              <div><b>${esc(a.vehiculo)}</b><small>${fmt.fecha(a.fechaInicio)} → ${fmt.fecha(a.fechaFinPactada)} · ${esc(a.placa)}</small></div>
              ${estadoAlquiler(a)}
            </div>`).join('')}</div>`
            : UI.vacio('Aún no tienes alquileres. Elige tus fechas en el catálogo y reserva en minutos.', 'car', '<a class="btn sm" href="#/catalogo">Ir al catálogo</a>')}
        </section>

        <section class="card">
          <div class="card-h"><h3>Accesos rápidos</h3></div>
          <div class="accesos">
            <a class="acceso" href="#/catalogo">${icon('search')}<b>Catálogo</b><small>Vehículos libres por fechas</small></a>
            <a class="acceso" href="#/mis-facturas">${icon('receipt')}<b>Facturas</b><small>Consulta e imprime</small></a>
            <a class="acceso" href="#/perfil">${icon('user')}<b>Mi perfil</b><small>Tus datos de cliente</small></a>
            <a class="acceso" href="#/cambiar-password">${icon('lock')}<b>Seguridad</b><small>Cambia tu contraseña</small></a>
          </div>
        </section>
      </div>
    </div>`;
}

async function vMisAlquileres(c, ctx) {
  let filtro = ctx.q.get('filtro') || 'activos';
  let todos = [];

  ctx.acciones(`<a class="btn" href="#/catalogo">${icon('plus')} Nuevo alquiler</a>`);

  c.innerHTML = `
    <div class="herramientas">
      <div class="segmentos" role="tablist">
        <button type="button" data-f="activos">Activos y reservas</button>
        <button type="button" data-f="historial">Historial</button>
        <button type="button" data-f="todos">Todos</button>
      </div>
    </div>
    <div class="card" id="lista">${UI.cargando(4)}</div>`;

  const caja = $('#lista', c);

  const pintar = () => {
    $$('[data-f]', c).forEach(b => {
      b.classList.toggle('act', b.dataset.f === filtro);
      b.setAttribute('aria-selected', b.dataset.f === filtro);
    });

    const lista = todos.filter(a =>
      filtro === 'todos' || (filtro === 'activos' ? a.estado === 'ACTIVO' : a.estado !== 'ACTIVO'));

    caja.innerHTML = lista.length ? `
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>#</th><th>Vehículo</th><th>Salida</th><th>Entrega</th><th class="num">Días</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
          <tbody>${lista.map(a => `
            <tr>
              <td class="nowrap">#${a.id}</td>
              <td class="principal"><b>${esc(a.vehiculo)}</b><small>${esc(a.placa)}</small></td>
              <td class="nowrap">${fmt.fecha(a.fechaInicio)}</td>
              <td class="nowrap">${fmt.fecha(a.fechaDevolucion || a.fechaFinPactada)}</td>
              <td class="num">${a.dias}</td>
              <td class="num">${fmt.dinero(a.montoTotal)}</td>
              <td>${estadoAlquiler(a)}</td>
              <td><div class="acciones">
                <button class="icon-btn" type="button" data-ver="${a.id}" title="Ver detalle" aria-label="Ver detalle">${icon('eye')}</button>
                <button class="icon-btn" type="button" data-cancelar="${a.id}" title="Cancelar" aria-label="Cancelar"${puedeCancelar(a) ? '' : ' disabled'}>${icon('ban')}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
      : UI.vacio(filtro === 'historial' ? 'Todavía no tienes alquileres completados o cancelados.' : 'No tienes alquileres activos ni reservas.', 'calendar',
        filtro !== 'historial' ? '<a class="btn sm" href="#/catalogo">Buscar vehículos</a>' : '');
  };

  async function cargar() {
    caja.innerHTML = UI.cargando(4);
    try {
      todos = await Api.misAlquileres();
      if (ctx.vigente()) pintar();
    } catch (e) {
      falloCarga(caja, e, cargar);
    }
  }

  c.addEventListener('click', async e => {
    const t = e.target.closest('[data-f], [data-ver], [data-cancelar]');
    if (!t) return;

    if (t.dataset.f) {
      filtro = t.dataset.f;
      cambiarQuery('mis-alquileres', { filtro });
      return pintar();
    }

    const a = todos.find(x => x.id === +(t.dataset.ver || t.dataset.cancelar));
    if (!a) return;

    if (t.dataset.ver) return detalleAlquiler(a, { alCambiar: cargar });
    cancelarAlquiler(a, cargar);
  });

  await cargar();
}

async function detalleAlquiler(a, { alCambiar } = {}) {
  const admin = esAdmin();

  const m = UI.modal({
    titulo: `Alquiler #${a.id}`,
    ancho: 600,
    cuerpo: `
      <div class="detalle-alq-head">
        <div class="detalle-alq-foto" data-detalle-foto>${UI.sinFoto(true)}</div>
        <div class="detalle-alq-identidad">
          <span class="detalle-alq-eyebrow">VEHÍCULO DEL ALQUILER</span>
          <b>${esc(a.vehiculo)}</b>
          <span>Placa ${esc(a.placa)} · ${etq(a.canal)}</span>
          <div class="detalle-alq-meta" data-detalle-veh-meta><span>${fmt.dinero(a.precioDia)} / día</span></div>
        </div>
        <div class="detalle-alq-estado">${estadoAlquiler(a)}</div>
      </div>

      <dl class="dl">
        ${admin ? `<dt>Cliente</dt><dd>${esc(a.clienteNombre)} · ${esc(a.clienteCedula)}</dd>` : ''}
        <dt>Salida</dt><dd>${fmt.fecha(a.fechaInicio)}</dd>
        <dt>Entrega pactada</dt><dd>${fmt.fecha(a.fechaFinPactada)}</dd>
        ${a.fechaDevolucion ? `<dt>Devuelto</dt><dd>${fmt.fecha(a.fechaDevolucion)}</dd>` : ''}
        <dt>Días</dt><dd>${a.dias}</dd>
        <dt>Precio por día</dt><dd>${fmt.dinero(a.precioDia)}</dd>
        <dt>Monto base</dt><dd>${fmt.dinero(a.montoBase)}</dd>
        ${a.diasMora ? `<dt>Mora (${a.diasMora} día(s))</dt><dd>${fmt.dinero(a.montoMora)}</dd>` : ''}
        <dt>Total facturado</dt><dd>${fmt.dinero(a.totalFacturado)}</dd>
        ${a.observaciones ? `<dt>Observaciones</dt><dd>${esc(a.observaciones)}</dd>` : ''}
        <dt>Registrado</dt><dd>${fmt.fechaHora(a.fechaCreacion)}</dd>
      </dl>

      <div class="total"><span>Monto total</span><b>${fmt.dinero(a.montoTotal)}</b></div>

      <div id="estimado"></div>

      <h4 style="margin:20px 0 8px;font-size:14px">Facturas</h4>
      <div id="facs">${UI.cargando(1)}</div>

      <div class="modal-acc">
        ${admin && a.estado === 'ACTIVO' ? `
          <button class="btn ghost" type="button" data-acc="modificar">${icon('edit')} Modificar</button>
          ${puedeDevolver(a) ? `<button class="btn" type="button" data-acc="devolver">${icon('undo')} Registrar devolución</button>` : ''}` : ''}
        ${puedeCancelar(a) ? `<button class="btn danger" type="button" data-acc="cancelar">${icon('ban')} Cancelar alquiler</button>` : ''}
        <button class="btn ghost" type="button" data-cerrar>Cerrar</button>
      </div>`
  });

  // Completa el encabezado con la ficha real del vehículo (foto, año, categoría y datos extra).
  if (a.vehiculoId) {
    Api.vehiculo(a.vehiculoId).then(v => {
      const foto = $('[data-detalle-foto]', m.el);
      const meta = $('[data-detalle-veh-meta]', m.el);
      if (foto) foto.innerHTML = fotoVeh(v);
      if (meta) {
        const extras = [
          v.anio ? String(v.anio) : null,
          v.categoria || null,
          v.transmision || null,
          v.color || null
        ].filter(Boolean);
        meta.innerHTML = `<span>${fmt.dinero(v.precioDia)} / día</span>${extras.map(x => `<span>${esc(x)}</span>`).join('')}`;
      }
    }).catch(() => { /* La información base del alquiler sigue visible. */ });
  }

  $$('[data-acc]', m.el).forEach(b => {
    b.onclick = () => {
      m.cerrar();
      if (b.dataset.acc === 'modificar') modificarAlquiler(a, alCambiar);
      if (b.dataset.acc === 'devolver') devolverAlquiler(a, alCambiar);
      if (b.dataset.acc === 'cancelar') cancelarAlquiler(a, alCambiar);
    };
  });

  // Vista previa de mora para el cliente si el alquiler ya salió
  if (!admin && puedeDevolver(a)) {
    Api.cotizarDevolucion(a.id).then(d => {
      $('#estimado', m.el).innerHTML = `
        <div class="info-banda" style="margin-top:16px">${icon('info')}
          <span>Si lo devuelves hoy: ${d.diasMora ? `${d.diasMora} día(s) de mora por <b>${fmt.dinero(d.montoMora)}</b>, total <b>${fmt.dinero(d.montoTotal)}</b>.` : 'sin cargos por mora.'}</span>
        </div>`;
    }).catch(() => { /* la vista previa es opcional */ });
  }

  try {
    const facturas = admin
      ? (await Api.facturas({ alquilerId: a.id, first: 50 })).nodes
      : (await Api.misFacturas()).filter(f => f.alquilerId === a.id);

    $('#facs', m.el).innerHTML = facturas.length ? `<div class="lista">${facturas.map(f => `
      <div class="item">
        <span class="avatar sm">${icon('receipt')}</span>
        <div><b>${fmt.numFactura(f.id)} · ${esc(f.concepto)}</b><small>${fmt.fechaHora(f.fechaEmision)}${f.metodoPago ? ' · ' + metodoTxt(f.metodoPago) : ''}</small></div>
        <span class="monto">${montoFactura(f.monto)}</span>
        <a class="icon-btn sm" href="#/factura/${f.id}" title="Ver factura" aria-label="Ver factura" data-cerrar>${icon('arrowRight')}</a>
      </div>`).join('')}</div>` : '<p class="texto">Sin facturas.</p>';

    $$('#facs a[data-cerrar]', m.el).forEach(x => { x.onclick = () => m.cerrar(); });
  } catch (e) {
    $('#facs', m.el).innerHTML = `<p class="texto">${esc(mensajeError(e))}</p>`;
  }
}

async function cancelarAlquiler(a, alCambiar) {
  const r = await UI.confirmar(
    `Cancelar alquiler #${a.id}`,
    `Se cancelará el alquiler del <b>${esc(a.vehiculo)}</b> (${fmt.fecha(a.fechaInicio)} → ${fmt.fecha(a.fechaFinPactada)}) y se emitirá una nota de crédito. El monto pagado quedará como saldo en la <b>Wallet GO</b> ${esAdmin() ? 'del cliente' : 'de tu perfil'}: podrá usarse en otro alquiler y, si se retira, solo se devuelve el 30 %.`,
    { boton: 'Cancelar alquiler', peligro: true, motivo: true }
  );

  if (!r) return;

  try {
    const op = await Api.cancelarAlquiler(a.id, r.motivo);
    avisoOperacion('Alquiler cancelado. El monto pagado se abonó a la Wallet GO.', op.facturaId);
    if (alCambiar) alCambiar();
  } catch (e) {
    if (e.code === 'CANCELACION_NO_PERMITIDA') {
      UI.toast(esAdmin() ? 'El alquiler ya comenzó: registra la devolución en su lugar.' : 'El alquiler ya comenzó y no puede cancelarse. Devuelve el vehículo en la sucursal.', 'warn');
      if (alCambiar) alCambiar();
      return;
    }
    if (e.code === 'ALQUILER_NO_ACTIVO') {
      UI.toast(e.message, 'warn');
      if (alCambiar) alCambiar();
      return;
    }
    avisarError(e);
  }
}

async function vMisFacturas(c, ctx) {
  c.innerHTML = `<div class="card">${UI.cargando(5)}</div>`;

  const lista = await Api.misFacturas();
  if (!ctx.vigente()) return;

  c.innerHTML = `<div class="card">${lista.length ? tablaFacturas(lista, false) : UI.vacio('Aún no tienes facturas.', 'receipt')}</div>`;
}

function tablaFacturas(lista, admin) {
  return `
    <div class="tabla-wrap">
      <table class="tabla">
        <thead><tr>
          <th>No.</th><th>Emisión</th><th>Tipo</th>${admin ? '<th>Cliente</th>' : ''}<th>Vehículo</th><th>Concepto</th><th>Método</th><th class="num">Monto</th><th></th>
        </tr></thead>
        <tbody>${lista.map(f => `
          <tr>
            <td class="nowrap"><b>${String(f.id).padStart(4, '0')}</b></td>
            <td class="nowrap">${fmt.fechaHora(f.fechaEmision)}</td>
            <td>${tipoFactura(f)}</td>
            ${admin ? `<td class="principal"><b>${esc(f.clienteNombre)}</b><small>${esc(f.clienteCedula)}</small></td>` : ''}
            <td class="principal"><b>${esc(f.vehiculo)}</b><small>${esc(f.placa)}</small></td>
            <td>${esc(f.concepto)}</td>
            <td>${f.metodoPago ? metodoTxt(f.metodoPago) : '—'}</td>
            <td class="num">${montoFactura(f.monto)}</td>
            <td><div class="acciones"><a class="icon-btn" href="#/factura/${f.id}" title="Ver factura" aria-label="Ver factura ${f.id}">${icon('eye')}</a></div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function vFactura(c, ctx) {
  const id = parseInt(ctx.param, 10);
  if (!id) throw new Api.ApiError('NO_ENCONTRADO', 'Factura no encontrada.');

  ctx.acciones(`
    <button class="btn ghost" type="button" data-volver>${icon('arrowLeft')} Volver</button>
    <button class="btn" type="button" data-imprimir>${icon('printer')} Imprimir</button>`);

  $('[data-volver]').onclick = () => (history.length > 1 ? history.back() : ir(esAdmin() ? 'facturas' : 'mis-facturas'));
  $('[data-imprimir]').onclick = () => window.print();

  c.innerHTML = `<div class="card factura">${UI.cargando(6)}</div>`;

  const f = await Api.factura(id);
  if (!ctx.vigente()) return;

  ctx.titulo(`Factura ${String(f.id).padStart(4, '0')}`);
  const credito = Number(f.monto) < 0;

  c.innerHTML = `
    <article class="card factura">
      <header class="fac-h">
        <div class="empresa">
          <img src="logo.png" alt="AutoGo Rent a Car">
          <small>AutoGo Rent a Car</small>
        </div>
        <div class="fac-num">
          <span>${credito ? 'Nota de crédito' : 'Factura'}</span>
          <b>${fmt.numFactura(f.id)}</b>
          ${tipoFactura(f)}
        </div>
      </header>

      <div class="fac-meta">
        <span>Emitida: <b>${fmt.fechaHora(f.fechaEmision)}</b></span>
        <span>Alquiler: <b>#${f.alquilerId}</b></span>
        <span>Método de pago: <b>${f.metodoPago ? metodoTxt(f.metodoPago) : '—'}</b></span>
      </div>

      <div class="fac-cols">
        <section>
          <h4>Cliente</h4>
          <dl class="dl izq">
            <dt>Nombre</dt><dd>${esc(f.clienteNombre)}</dd>
            <dt>Cédula</dt><dd>${esc(f.clienteCedula)}</dd>
            <dt>Teléfono</dt><dd>${esc(f.clienteTelefono || '—')}</dd>
            <dt>Correo</dt><dd>${esc(f.clienteCorreo || '—')}</dd>
          </dl>
        </section>
        <section>
          <h4>Vehículo</h4>
          <dl class="dl izq">
            <dt>Vehículo</dt><dd>${esc(f.vehiculo)}</dd>
            <dt>Placa</dt><dd>${esc(f.placa)}</dd>
            <dt>Categoría</dt><dd>${esc(f.categoria)}</dd>
            <dt>Precio por día</dt><dd>${fmt.dinero(f.precioDia)}</dd>
          </dl>
        </section>
      </div>

      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>Concepto</th><th>Salida</th><th>Entrega pactada</th><th class="num">Días</th><th class="num">Monto</th></tr></thead>
          <tbody><tr>
            <td>${esc(f.concepto)}</td>
            <td class="nowrap">${fmt.fecha(f.fechaInicio)}</td>
            <td class="nowrap">${fmt.fecha(f.fechaFinPactada)}</td>
            <td class="num">${f.dias}</td>
            <td class="num">${fmt.dinero(f.monto)}</td>
          </tr></tbody>
        </table>
      </div>

      <div class="fac-total">
        <span>${credito ? 'Total acreditado' : 'Total pagado'}</span>
        <b>${fmt.dinero(f.monto)}</b>
      </div>

      <p class="fac-pie">Gracias por preferir AutoGo Rent a Car. Montos expresados en pesos dominicanos (RD$).</p>
    </article>`;
}

function tarjetaWallet(w) {
  const saldo = Number(w.saldo) || 0;
  const movs = (w.movimientos || []).slice(0, 4);

  return `
    <section class="card wallet-card" id="wallet">
      <div class="wallet-h">${icon('wallet')}<h3>Wallet GO</h3></div>
      <p class="wallet-lbl">Saldo disponible</p>
      <div class="wallet-saldo">${fmt.dinero(saldo)}</div>
      <p class="wallet-nota">Aquí se guardan los pagos de reservas canceladas o que AutoGo no pudo atender. Úsalos en tu próximo alquiler; si el saldo no alcanza, pagas la diferencia.</p>
      <div class="wallet-acc">
        <a class="btn" href="#/catalogo">${icon('car')} Hacer reserva</a>
        <button class="btn ghost" type="button" data-retiro${saldo > 0 ? '' : ' disabled'}>${icon('logout')} Retiro</button>
      </div>
      ${movs.length ? `<ul class="wallet-mov">${movs.map(m => `
        <li>
          <div><b>${esc(m.concepto)}</b><small>${fmt.fechaHora(m.fecha)}</small></div>
          <span class="${m.tipo === 'ABONO' ? 'mas' : 'menos'}">${m.tipo === 'ABONO' ? '+' : '−'} ${fmt.dinero(m.monto)}</span>
        </li>`).join('')}</ul>` : ''}
    </section>`;
}

async function retirarWallet(w, alCambiar) {
  const saldo = Number(w.saldo) || 0;
  const pct = w.porcentajeRetiro || 30;
  const aCliente = Math.round(saldo * pct) / 100;
  const aEmpresa = Math.round((saldo - aCliente) * 100) / 100;

  const ok = await UI.confirmar(
    'Retirar fondos de Wallet GO',
    `Esto es lo que conlleva hacer el retiro:
     <ul class="retiro-lista" style="margin-top:12px">
       <li>Recibirás únicamente el <b>${pct} %</b> de tu saldo: <b>${fmt.dinero(aCliente)}</b>.</li>
       <li>AutoGo retiene el <b>${100 - pct} %</b> restante: <b>${fmt.dinero(aEmpresa)}</b>.</li>
       <li>Tu saldo quedará en <b>${fmt.dinero(0)}</b> y la acción <b>no se puede deshacer</b>.</li>
     </ul>
     Si usas el saldo completo en un alquiler no pierdes nada: la retención solo aplica al retirar.`,
    { boton: 'Confirmar retiro', peligro: true }
  );

  if (!ok) return;

  try {
    const r = await Api.retirarWallet();
    modalExito({
      titulo: 'Retiro registrado',
      texto: `Recibirás <b>${fmt.dinero(r.montoCliente)}</b>. AutoGo retuvo ${fmt.dinero(r.montoEmpresa)}.`
    });
    if (alCambiar) alCambiar();
  } catch (e) {
    avisarError(e);
  }
}

async function vPerfil(c, ctx) {
  if (esAdmin()) {
    const u = usuario();
    c.innerHTML = `<section class="card angosta"><div class="perfil-cab">${UI.avatar(u.nombre,'lg')}<div><h2>${esc(u.nombre)}</h2><p>Mi perfil</p></div></div><dl class="dl"><dt>Correo</dt><dd>${esc(u.correo)}</dd><dt>Rol</dt><dd>${esc(u.rol)}</dd></dl><a class="btn" style="margin-top:24px" href="#/cambiar-password">${icon('lock')} Cambiar contraseña</a></section>`;
    return;
  }
  ctx.acciones(`<a class="btn ghost" href="#/cambiar-password">${icon('lock')} Cambiar contraseña</a>`);
  c.innerHTML = `<div class="card angosta">${UI.cargando(5)}</div>`;

  const [p, wallet] = await Promise.all([Api.miPerfil(), Api.miWallet().catch(() => null)]);
  if (!ctx.vigente()) return;

  c.innerHTML = `
    <div class="perfil-grid">
    <div class="card angosta">
      <div class="perfil-cab">
        ${UI.avatar(p.nombre, 'lg')}
        <div>
          <h2>${esc(p.nombre)}</h2>
          <p>Cliente desde ${fmt.fechaLarga(p.fechaCreacion)}</p>
        </div>
      </div>

      <dl class="dl">
        <dt>Correo</dt><dd>${esc(p.correo || '—')}</dd>
        <dt>Cédula</dt><dd>${esc(p.cedula)}</dd>
        <dt>Teléfono</dt><dd>${esc(p.telefono || '—')}</dd>
        <dt>Licencia de conducir</dt><dd>${esc(p.licenciaConducir || '—')}</dd>
        <dt>Estado</dt><dd>${p.activo ? badge('ACTIVO', 'Activa', 'ok') : badge(null, 'Inactiva', 'bad')}</dd>
      </dl>

      <div class="info-banda" style="margin-top:20px">${icon('info')}
        <span>Para actualizar tus datos personales, comunícate con cualquier sucursal de AutoGo.</span>
      </div>
    </div>
    ${wallet ? tarjetaWallet(wallet) : ''}
    </div>`;

  const retiro = $('[data-retiro]', c);
  if (retiro) retiro.onclick = () => retirarWallet(wallet, () => render());
}


/* =========================================================
   PANEL DE CONTROL (ADMINISTRADOR)
========================================================= */

async function vDashboard(c, ctx) {
  ctx.acciones(`<span class="panel-fecha">${fmt.fecha(hoy())}</span>`);

  const tarjeta = (area, titulo, extra = '') =>
    `<section class="card ${area}"><div class="card-h"><h3>${titulo}</h3>${extra}</div><div data-cuerpo>${UI.cargando(3)}</div></section>`;

  c.innerHTML = `
    <div class="seccion panel-resumen">
      <div class="panel-intro"><span class="panel-eyebrow">OPERACIÓN DIARIA</span><span class="panel-demo">${Api.DEMO ? "Modo demostración · datos locales" : "Resumen del sistema"}</span></div>
      <div class="kpis" id="kpis">${Array.from({ length: 5 }, () => `<div class="card kpi">${UI.cargando(1)}</div>`).join('')}</div>
      <div class="dash">
        ${tarjeta('a-act', 'Actividad reciente')}
        ${tarjeta('a-graf', 'Ingresos', '<span class="pastilla" id="crec">Últimos 6 meses</span>')}
        ${tarjeta('a-flota', 'Estado de la flota', '<a class="panel-link" href="#/flota">Ver toda la flota →</a>')}
        ${tarjeta('a-pend', 'Por devolver', '<a class="panel-link" href="#/alquileres?filtro=activos">Ver alquileres →</a>')}
        <section class="card a-atajos"><div class="card-h"><h3>Accesos rápidos</h3></div>
          <div class="panel-atajos">
            <a href="#/nuevo-alquiler" class="tono-blue">${icon('plusCircle')}<span>Nuevo alquiler</span>${icon('chevR')}</a>
            <a href="#/flota" class="tono-green">${icon('car')}<span>Gestionar flota</span>${icon('chevR')}</a>
            <a href="#/clientes" class="tono-purple">${icon('users')}<span>Ver clientes</span>${icon('chevR')}</a>
            <a href="#/facturas" class="tono-blue">${icon('receipt')}<span>Facturación</span>${icon('chevR')}</a>
          </div>
          <p class="panel-proximos">Reportes y Configuración: pendientes de implementar.</p>
        </section>
      </div>
    </div>`;

  const cuerpo = sel => $(`${sel} [data-cuerpo]`, c);

  // Indicadores y flota
  Api.dashboard().then(d => {
    if (!ctx.vigente()) return;

    pendientes = d.pendientesDevolucion;
    pintarFijas();
    pintarNav('dashboard');

    const mes = hoy().slice(0, 7) + '-01';
    const kpi = (titulo, valor, nota, ic, tono, ruta) => `<a class="card kpi panel-kpi tono-${tono}" href="#/${ruta}"><span class="panel-kpi-top"><span class="panel-icon">${icon(ic)}</span>${icon('chevR')}</span><span class="etq">${titulo}</span><span class="valor">${valor}</span><span class="nota">${nota}</span></a>`;
    $('#kpis', c).innerHTML =
      kpi('Ingresos del mes', fmt.dinero(d.ingresosMes), 'Ver facturación del período', 'wallet', 'green', `facturas?desde=${mes}&hasta=${hoy()}`) +
      kpi('Alquileres activos', d.alquileresActivos, 'Incluye reservas futuras', 'calendar', 'blue', 'alquileres?filtro=activos') +
      kpi('Vencidos', d.alquileresVencidos, 'Revisar entregas atrasadas', 'alert', 'coral', 'alquileres?filtro=vencidos') +
      kpi('Vehículos disponibles', `${d.vehiculosDisponibles}<small> / ${d.totalVehiculos}</small>`, 'Ver vehículos disponibles', 'car', 'purple', 'flota?estado=DISPONIBLE') +
      kpi('Clientes', d.totalClientes, 'Ver clientes registrados', 'users', 'blue', 'clientes');

    const partes = [
      ['Disponibles', d.vehiculosDisponibles, 'c-ok'],
      ['Alquilados', d.vehiculosAlquilados, 'c-info'],
      ['Mantenimiento', d.vehiculosEnMantenimiento, 'panel-mantenimiento'],
      ['Fuera de servicio', d.vehiculosFueraDeServicio, 'c-bad']
    ];
    const total = d.totalVehiculos || 1;

    cuerpo('.a-flota').innerHTML = `
      <div class="total-flota"><b>${d.totalVehiculos}</b><span>vehículos activos</span></div>
      <div class="barra-flota" role="img" aria-label="${partes.map(p => `${p[0]}: ${p[1]}`).join(', ')}">
        ${partes.filter(p => p[1] > 0).map(p => `<span class="${p[2]}" style="width:${(p[1] / total) * 100}%" title="${p[0]}: ${p[1]}"></span>`).join('')}
      </div>
      <div class="leyenda">${partes.map(p => `<div><i class="${p[2]}"></i>${p[0]}<b>${p[1]} <small>${Math.round(p[1] / total * 100)} %</small></b></div>`).join('')}</div><div class="panel-por-devolver">${icon('clock')}<span><b>${d.pendientesDevolucion} por devolver</b><small>Incluidos en los alquileres activos · hoy o vencidos</small></span></div>`;
  }).catch(e => {
    if (!ctx.vigente()) return;
    falloCarga($('#kpis', c), e, () => render());
    cuerpo('.a-flota').innerHTML = '';
  });

  // Actividad reciente
  Api.alquileres({ first: 6, orden: 'reciente' }).then(r => {
    if (!ctx.vigente()) return;
    const caja = cuerpo('.a-act');

    caja.innerHTML = r.nodes.length ? `<div class="lista">${r.nodes.map(a => `
      <div class="item">
        ${UI.avatar(a.clienteNombre, 'sm')}
        <div><b>${esc(a.clienteNombre)}</b><small>${esc(a.vehiculo)} · ${fmt.hace(a.fechaCreacion)}</small></div>
        <button class="icon-btn sm" type="button" data-alq="${a.id}" title="Ver detalle" aria-label="Ver alquiler ${a.id}">${icon('chevR')}</button>
      </div>`).join('')}</div>
      <a class="btn ghost block" href="#/alquileres">Ver todos los alquileres</a>`
      : UI.vacio('Todavía no hay alquileres registrados.', 'calendar');

    caja.onclick = e => {
      const b = e.target.closest('[data-alq]');
      if (!b) return;
      const a = r.nodes.find(x => x.id === +b.dataset.alq);
      if (a) detalleAlquiler(a, { alCambiar: () => render() });
    };
  }).catch(e => ctx.vigente() && falloCarga(cuerpo('.a-act'), e, () => render()));

  // Pendientes de devolución (vencidos o con entrega hoy)
  panelTodas(p => Api.alquileres({ estado: 'ACTIVO', orden: 'vencimiento', ...p })).then(async r => {
    if (!ctx.vigente()) return;
    const h = hoy();
    const lista = r.nodes.filter(a => String(a.fechaFinPactada).slice(0, 10) <= h);
    const fotos = new Map();
    await Promise.all([...new Set(lista.slice(0, 5).map(a => a.vehiculoId))].map(async id => {
      try { fotos.set(id, await Api.vehiculo(id)); } catch (_) { /* ícono de respaldo */ }
    }));
    if (!ctx.vigente()) return;
    const caja = cuerpo('.a-pend');

    caja.innerHTML = lista.length ? `<div class="lista">${lista.slice(0, 5).map(a => `
      <div class="item">
        <div class="foto-mini">${fotoVeh(fotos.get(a.vehiculoId))}</div>
        <div><b>${esc(a.vehiculo)}</b><small>${esc(a.placa)} · ${esc(a.clienteNombre)}</small><small>Entrega: ${fmt.fecha(a.fechaFinPactada)} · ${a.vencido ? 'Vencido' : 'Hoy'}</small></div>
        <button class="btn ghost sm" type="button" data-dev="${a.id}">Recibir</button>
      </div>`).join('')}</div>`
      : UI.vacio('No hay devoluciones pendientes para hoy.', 'check');

    caja.onclick = e => {
      const b = e.target.closest('[data-dev]');
      if (!b) return;
      const a = lista.find(x => x.id === +b.dataset.dev);
      if (a) devolverAlquiler(a, () => render());
    };
  }).catch(e => ctx.vigente() && falloCarga(cuerpo('.a-pend'), e, () => render()));

  // Ingresos de los últimos seis meses
  serieIngresos().then(serie => {
    if (!ctx.vigente()) return;
    const caja = cuerpo('.a-graf');
    caja.innerHTML = graficoLinea(serie);
    activarGrafico(caja, serie);

    const [prev, act] = serie.slice(-2).map(p => p.valor);
    if (prev > 0) {
      const v = Math.round(((act - prev) / prev) * 100);
      $('#crec', c).textContent = `Mes actual ${v >= 0 ? '+' : ''}${v}%`;
    }
  }).catch(e => ctx.vigente() && falloCarga(cuerpo('.a-graf'), e, () => render()));
}

const mesLocal = iso => {
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const nombreMes = k => {
  const n = new Date(k + '-15T12:00:00').toLocaleDateString('es-DO', { month: 'short' }).replace('.', '');
  return n.charAt(0).toUpperCase() + n.slice(1);
};

async function serieIngresos() {
  const h = hoy();
  const [y, m] = h.split('-').map(Number);
  const meses = [];

  for (let i = 5; i >= 0; i--) {
    meses.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }

  const suma = Object.fromEntries(meses.map(k => [k, 0]));
  const deWallet = Object.fromEntries(meses.map(k => [k, 0]));
  let after = null;
  let vueltas = 0;

  do {
    const r = await Api.facturas({ desde: meses[0] + '-01', hasta: h, first: 200, after });
    r.nodes.forEach(f => {
      const k = mesLocal(f.fechaEmision);
      if (k in suma) suma[k] += Number(f.monto);
    });
    after = r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
  } while (after && ++vueltas < 25);

  // Retiros de Wallet GO: la retención de la empresa también es ingreso del mes
  try {
    const iw = await Api.ingresosWallet({ desde: meses[0] + '-01', hasta: h });
    (iw || []).forEach(i => {
      const k = mesLocal(i.fecha);
      if (k in suma) {
        suma[k] += Number(i.monto);
        deWallet[k] += Number(i.monto);
      }
    });
  } catch (e) { /* si no hay datos de wallet, la serie queda solo con facturas */ }

  return meses.map(k => ({
    clave: k, etq: nombreMes(k),
    valor: Math.round(suma[k] * 100) / 100,
    wallet: Math.round(deWallet[k] * 100) / 100
  }));
}

const GRAF = { W: 640, H: 236, izq: 64, der: 14, arr: 14, aba: 30 };

function escalaMax(v) {
  if (v <= 0) return 1000;
  const e = 10 ** Math.floor(Math.log10(v));
  const n = v / e;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * e;
}

function puntosGrafico(serie) {
  const { W, H, izq, der, arr, aba } = GRAF;
  const max = escalaMax(Math.max(0, ...serie.map(p => p.valor)));
  const ancho = W - izq - der;
  const x = i => izq + (serie.length === 1 ? ancho / 2 : (i * ancho) / (serie.length - 1));
  const y = v => arr + (H - arr - aba) * (1 - Math.max(0, v) / max);
  return { max, pts: serie.map((p, i) => [x(i), y(p.valor)]) };
}

function curva(p) {
  const piso = GRAF.H - GRAF.aba;
  let d = `M${p[0][0]},${p[0][1]}`;

  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(piso, p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(piso, p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }

  return d;
}

function graficoLinea(serie) {
  const { W, H, izq, der, aba } = GRAF;
  const { max, pts } = puntosGrafico(serie);
  const piso = H - aba;
  const linea = curva(pts);
  const area = `${linea} L${pts[pts.length - 1][0]},${piso} L${pts[0][0]},${piso} Z`;
  const paso = pts.length > 1 ? pts[1][0] - pts[0][0] : W - izq - der;

  const rejilla = [0, 1, 2, 3, 4].map(k => {
    const v = (max * k) / 4;
    const yy = GRAF.arr + (H - GRAF.arr - aba) * (1 - k / 4);
    return `<line class="rejilla" x1="${izq}" x2="${W - der}" y1="${yy}" y2="${yy}"/>
      <text class="eje" x="${izq - 10}" y="${yy + 4}" text-anchor="end">${esc(fmt.compacto(v))}</text>`;
  }).join('');

  return `
    <div class="grafico">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos de los últimos ${serie.length} meses">
        <defs>
          <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity=".34"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${rejilla}
        ${serie.map((p, i) => `<text class="eje" x="${pts[i][0]}" y="${H - 8}" text-anchor="middle">${esc(p.etq)}</text>`).join('')}
        <path d="${area}" fill="url(#gArea)"/>
        <path class="linea" d="${linea}"/>
        <line class="guia" data-guia x1="0" x2="0" y1="${GRAF.arr}" y2="${piso}" visibility="hidden"/>
        <circle class="marca-punto" r="5" cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}"/>
        ${pts.map((pt, i) => `<rect class="zona" data-i="${i}" x="${pt[0] - paso / 2}" y="0" width="${paso}" height="${H}"/>`).join('')}
      </svg>
      <div class="tip" data-tip></div>
      <table class="oculto-visual">
        <caption>Ingresos por mes</caption>
        <thead><tr><th>Mes</th><th>Ingresos</th></tr></thead>
        <tbody>${serie.map(p => `<tr><td>${esc(p.etq)}</td><td>${fmt.dinero(p.valor)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function activarGrafico(caja, serie) {
  const svg = $('svg', caja);
  const tip = $('[data-tip]', caja);
  const guia = $('[data-guia]', caja);
  const punto = $('.marca-punto', caja);
  const { pts } = puntosGrafico(serie);
  const ultimo = pts.length - 1;

  const mostrar = i => {
    const [x, y] = pts[i];
    const k = svg.getBoundingClientRect().width / GRAF.W;

    guia.setAttribute('x1', x);
    guia.setAttribute('x2', x);
    guia.setAttribute('visibility', 'visible');
    punto.setAttribute('cx', x);
    punto.setAttribute('cy', y);

    tip.innerHTML = `<span>${esc(serie[i].etq)} ${serie[i].clave.slice(0, 4)}</span><b>${fmt.dinero(serie[i].valor)}</b>${serie[i].wallet > 0 ? `<span>Incluye ${fmt.dinero(serie[i].wallet)} de Wallet GO</span>` : ''}`;
    tip.style.left = x * k + 'px';
    tip.style.top = y * k + 'px';
    tip.classList.add('on');
  };

  const ocultar = () => {
    guia.setAttribute('visibility', 'hidden');
    punto.setAttribute('cx', pts[ultimo][0]);
    punto.setAttribute('cy', pts[ultimo][1]);
    tip.classList.remove('on');
  };

  $$('.zona', svg).forEach(z => {
    z.addEventListener('mouseenter', () => mostrar(+z.dataset.i));
    z.addEventListener('touchstart', () => mostrar(+z.dataset.i), { passive: true });
  });

  svg.addEventListener('mouseleave', ocultar);
}


/* =========================================================
   ALQUILERES (ADMINISTRADOR)
========================================================= */

const FILTROS_ALQ = {
  todos: { texto: 'Todos', args: {} },
  activos: {
    texto: 'Activos',
    args: { estado: 'ACTIVO', orden: 'vencimiento' },
    local: a => estadoOperativoAlquiler(a).clave === 'activo'
  },
  reservas: {
    texto: 'Reservas',
    args: { estado: 'ACTIVO', orden: 'vencimiento' },
    local: a => estadoOperativoAlquiler(a).clave === 'reserva'
  },
  vencidos: {
    texto: 'Vencidos',
    args: { estado: 'ACTIVO', orden: 'vencimiento' },
    local: a => estadoOperativoAlquiler(a).clave === 'vencido'
  },
  por_devolver: {
    texto: 'Por devolver',
    args: { estado: 'ACTIVO', orden: 'vencimiento' },
    local: a => estadoOperativoAlquiler(a).clave === 'por_devolver'
  },
  completados: { texto: 'Completados', args: { estado: 'COMPLETADO' } },
  cancelados: { texto: 'Cancelados', args: { estado: 'CANCELADO' } }
};

function textoAlquiler(a) {
  return `${a.id} ${a.clienteNombre || ''} ${a.clienteCedula || ''} ${a.vehiculo || ''} ${a.placa || ''}`.toLowerCase();
}

async function alquileresFiltrados({ filtro = 'todos', texto = '', canal = '', desde = '', hasta = '', first = 12, after = null, last = null, before = null } = {}) {
  const def = FILTROS_ALQ[filtro] || FILTROS_ALQ.todos;
  const r = await panelTodas(p => Api.alquileres({ ...def.args, ...p }));
  let lista = r.nodes;

  if (def.local) lista = lista.filter(def.local);
  const q = texto.trim().toLowerCase();
  if (q) lista = lista.filter(a => textoAlquiler(a).includes(q));
  if (canal) lista = lista.filter(a => a.canal === canal);
  if (desde) lista = lista.filter(a => a.fechaInicio >= desde);
  if (hasta) lista = lista.filter(a => a.fechaInicio <= hasta);

  const cantidad = last || first;
  const inicio = before !== null ? Math.max(0, Number(before) - cantidad) : Number(after) || 0;
  const nodes = lista.slice(inicio, inicio + cantidad);
  return {
    nodes,
    totalCount: lista.length,
    pageInfo: {
      hasNextPage: inicio + cantidad < lista.length,
      endCursor: String(inicio + cantidad),
      hasPreviousPage: inicio > 0,
      startCursor: String(inicio)
    }
  };
}

async function resumenAlquileres() {
  const r = await panelTodas(p => Api.alquileres({ orden: 'vencimiento', ...p }));
  const h = hoy();
  const vigentes = r.nodes.filter(a => a.estado === 'ACTIVO');
  const operativos = vigentes.map(a => ({ a, estado: estadoOperativoAlquiler(a).clave }));

  return {
    total: r.nodes.length,
    activos: operativos.filter(x => x.estado === 'activo').length,
    reservas: operativos.filter(x => x.estado === 'reserva').length,
    vencidos: operativos.filter(x => x.estado === 'vencido').length,
    porDevolver: operativos.filter(x => x.estado === 'por_devolver').length
  };
}

async function vAlquileres(c, ctx) {
  let filtro = FILTROS_ALQ[ctx.q.get('filtro')] ? ctx.q.get('filtro') : 'todos';
  const clienteId = +ctx.q.get('cliente') || null;
  const clienteNombre = ctx.q.get('nombre');
  const vehiculoId = +ctx.q.get('vehiculo') || null;
  const vehiculoNombre = ctx.q.get('vehiculoNombre');
  const filtros = { texto: '', canal: '', desde: '', hasta: '' };

  ctx.acciones(`<a class="btn" href="#/nuevo-alquiler${clienteId ? '?cliente=' + clienteId : ''}">${icon('plus')} Nuevo alquiler</a>`);

  c.innerHTML = `
    <div class="alq-resumen" id="alqResumen">
      ${Array.from({ length: 4 }, () => '<div class="card alq-mini"><span class="skeleton"></span></div>').join('')}
    </div>

    <div class="herramientas alq-herramientas">
      <div class="segmentos" role="tablist" aria-label="Estado de alquileres">
        ${Object.entries(FILTROS_ALQ).map(([k, f]) => `<button type="button" data-f="${k}">${f.texto}</button>`).join('')}
      </div>
      ${clienteId ? `<span class="filtro-activo">Cliente: <b>${esc(clienteNombre || '#' + clienteId)}</b><a href="#/alquileres" aria-label="Quitar filtro de cliente">${icon('x')}</a></span>` : ''}
      ${vehiculoId ? `<span class="filtro-activo">Vehículo: <b>${esc(vehiculoNombre || '#' + vehiculoId)}</b><a href="#/alquileres" aria-label="Quitar filtro de vehículo">${icon('x')}</a></span>` : ''}
    </div>

    <div class="card alq-filtros">
      <div class="buscar">${icon('search')}<input type="search" id="qAlq" placeholder="Buscar cliente, cédula, vehículo, placa o #" aria-label="Buscar alquiler" autocomplete="off"></div>
      <select id="canalAlq" aria-label="Filtrar por canal">
        <option value="">Todos los canales</option>
        <option value="MOSTRADOR">Mostrador</option>
        <option value="PORTAL">Portal</option>
      </select>
      <label class="alq-fecha"><span>Desde</span><input type="date" id="desdeAlq"></label>
      <label class="alq-fecha"><span>Hasta</span><input type="date" id="hastaAlq"></label>
      <button class="btn ghost sm" type="button" id="limpiarAlq">Limpiar</button>
    </div>

    <div class="card" id="lista"></div>`;

  const marcar = () => $$('[data-f]', c).forEach(b => {
    b.classList.toggle('act', b.dataset.f === filtro);
    b.setAttribute('aria-selected', b.dataset.f === filtro);
  });

  const l = listado({
    cont: $('#lista', c),
    vigente: ctx.vigente,
    cargar: pag => clienteId
      ? panelAlquileresCliente({ clienteId, filtro, filtros, ...pag })
      : vehiculoId
        ? panelAlquileresVehiculo({ vehiculoId, filtro, filtros, ...pag })
        : alquileresFiltrados({ filtro, ...filtros, ...pag }),
    pintar: r => (r.nodes.length ? `
      <div class="tabla-wrap">
        <table class="tabla tabla-alquileres">
          <thead><tr><th>#</th><th>Cliente</th><th>Vehículo</th><th>Salida</th><th>Entrega</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
          <tbody>${r.nodes.map(a => `
            <tr class="${claseFilaAlquiler(a)}">
              <td class="nowrap"><b>#${a.id}</b><br><small>${etq(a.canal)}</small></td>
              <td class="principal"><b>${esc(a.clienteNombre)}</b><small>${esc(a.clienteCedula)}</small></td>
              <td class="principal"><b>${esc(a.vehiculo)}</b><small>${esc(a.placa)}</small></td>
              <td class="nowrap">${fmt.fecha(a.fechaInicio)}</td>
              <td class="nowrap">${fmt.fecha(a.fechaDevolucion || a.fechaFinPactada)}${a.vencido ? `<small class="alq-atraso">${a.diasRetraso || 1} día(s) tarde</small>` : (a.estado === 'ACTIVO' && a.fechaFinPactada === hoy() ? '<small class="alq-entrega-hoy">Entrega hoy</small>' : '')}</td>
              <td class="num">${fmt.dinero(a.montoTotal)}</td>
              <td>${estadoAlquiler(a)}</td>
              <td><div class="acciones">
                <button class="icon-btn" type="button" data-acc="ver" data-id="${a.id}" title="Ver detalle" aria-label="Ver detalle">${icon('eye')}</button>
                <button class="icon-btn" type="button" data-acc="modificar" data-id="${a.id}" title="Modificar" aria-label="Modificar"${a.estado === 'ACTIVO' ? '' : ' disabled'}>${icon('edit')}</button>
                <button class="icon-btn" type="button" data-acc="devolver" data-id="${a.id}" title="Registrar devolución" aria-label="Registrar devolución"${puedeDevolver(a) ? '' : ' disabled'}>${icon('undo')}</button>
                <button class="icon-btn" type="button" data-acc="cancelar" data-id="${a.id}" title="Cancelar" aria-label="Cancelar"${puedeCancelar(a) ? '' : ' disabled'}>${icon('ban')}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : UI.vacio('No hay alquileres que coincidan con los filtros.', 'calendar'))
  });

  async function actualizarResumen() {
    const caja = $('#alqResumen', c);
    try {
      const d = await resumenAlquileres();
      if (!ctx.vigente()) return;
      caja.innerHTML = `
        <button type="button" class="card alq-mini tono-blue" data-res="activos"><span class="alq-mini-ico">${icon('calendar')}</span><span><small>Activos</small><b>${d.activos}</b><em>En curso</em></span></button>
        <button type="button" class="card alq-mini tono-purple" data-res="reservas"><span class="alq-mini-ico">${icon('clock')}</span><span><small>Reservas</small><b>${d.reservas}</b><em>Salidas próximas</em></span></button>
        <button type="button" class="card alq-mini tono-coral ${d.vencidos ? 'alerta' : ''}" data-res="vencidos"><span class="alq-mini-ico">${icon('alert')}</span><span><small>Vencidos</small><b>${d.vencidos}</b><em>Requieren atención</em></span></button>
        <button type="button" class="card alq-mini tono-orange" data-res="por_devolver"><span class="alq-mini-ico">${icon('undo')}</span><span><small>Por devolver</small><b>${d.porDevolver}</b><em>Entrega prevista hoy</em></span></button>`;
    } catch (_) {
      caja.innerHTML = '';
    }
  }

  const recargar = () => {
    l.recargar();
    actualizarResumen();
    refrescarPendientes();
  };

  const aplicarFiltros = debounce(() => l.recargar(true), 220);
  $('#qAlq', c).addEventListener('input', e => { filtros.texto = e.target.value; aplicarFiltros(); });
  $('#canalAlq', c).addEventListener('change', e => { filtros.canal = e.target.value; l.recargar(true); });
  $('#desdeAlq', c).addEventListener('change', e => {
    filtros.desde = e.target.value;
    const hasta = $('#hastaAlq', c);
    if (filtros.desde) hasta.min = filtros.desde;
    l.recargar(true);
  });
  $('#hastaAlq', c).addEventListener('change', e => {
    filtros.hasta = e.target.value;
    l.recargar(true);
  });
  $('#limpiarAlq', c).onclick = () => {
    filtros.texto = filtros.canal = filtros.desde = filtros.hasta = '';
    $('#qAlq', c).value = '';
    $('#canalAlq', c).value = '';
    $('#desdeAlq', c).value = '';
    $('#hastaAlq', c).value = '';
    $('#hastaAlq', c).removeAttribute('min');
    l.recargar(true);
  };

  c.addEventListener('click', e => {
    const resumen = e.target.closest('[data-res]');
    if (resumen) {
      filtro = resumen.dataset.res;
      marcar();
      cambiarQuery('alquileres', { filtro, cliente: clienteId, nombre: clienteNombre, vehiculo: vehiculoId, vehiculoNombre });
      return l.recargar(true);
    }

    const f = e.target.closest('[data-f]');
    if (f) {
      filtro = f.dataset.f;
      marcar();
      cambiarQuery('alquileres', { filtro, cliente: clienteId, nombre: clienteNombre, vehiculo: vehiculoId, vehiculoNombre });
      return l.recargar(true);
    }

    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const a = l.nodos().find(x => x.id === +b.dataset.id);
    if (!a) return;

    ({
      ver: () => detalleAlquiler(a, { alCambiar: recargar }),
      modificar: () => modificarAlquiler(a, recargar),
      devolver: () => devolverAlquiler(a, recargar),
      cancelar: () => cancelarAlquiler(a, recargar)
    })[b.dataset.acc]();
  });

  marcar();
  actualizarResumen();
  await l.recargar(true);
}

async function panelAlquileresCliente({ clienteId, filtro = 'todos', filtros = {}, first = 12, after = null, last = null, before = null }) {
  const def = FILTROS_ALQ[filtro] || FILTROS_ALQ.todos;
  const r = await panelTodas(p => Api.alquileres({ clienteId, ...def.args, ...p }));
  let lista = r.nodes;
  if (def.local) lista = lista.filter(def.local);
  const q = (filtros.texto || '').trim().toLowerCase();
  if (q) lista = lista.filter(a => textoAlquiler(a).includes(q));
  if (filtros.canal) lista = lista.filter(a => a.canal === filtros.canal);
  if (filtros.desde) lista = lista.filter(a => a.fechaInicio >= filtros.desde);
  if (filtros.hasta) lista = lista.filter(a => a.fechaInicio <= filtros.hasta);
  const cantidad = last || first;
  const inicio = before !== null ? Math.max(0, Number(before) - cantidad) : Number(after) || 0;
  const nodes = lista.slice(inicio, inicio + cantidad);
  return { nodes, totalCount: lista.length, pageInfo: { hasNextPage: inicio + cantidad < lista.length, endCursor: String(inicio + cantidad), hasPreviousPage: inicio > 0, startCursor: String(inicio) } };
}

async function panelAlquileresVehiculo({ vehiculoId, filtro = 'todos', filtros = {}, first = 12, after = null, last = null, before = null }) {
  const def = FILTROS_ALQ[filtro] || FILTROS_ALQ.todos;
  const r = await panelTodas(p => Api.alquileres({ vehiculoId, ...def.args, ...p }));
  let lista = r.nodes;
  if (def.local) lista = lista.filter(def.local);
  const q = (filtros.texto || '').trim().toLowerCase();
  if (q) lista = lista.filter(a => textoAlquiler(a).includes(q));
  if (filtros.canal) lista = lista.filter(a => a.canal === filtros.canal);
  if (filtros.desde) lista = lista.filter(a => a.fechaInicio >= filtros.desde);
  if (filtros.hasta) lista = lista.filter(a => a.fechaInicio <= filtros.hasta);
  const cantidad = last || first;
  const inicio = before !== null ? Math.max(0, Number(before) - cantidad) : Number(after) || 0;
  const nodes = lista.slice(inicio, inicio + cantidad);
  return { nodes, totalCount: lista.length, pageInfo: { hasNextPage: inicio + cantidad < lista.length, endCursor: String(inicio + cantidad), hasPreviousPage: inicio > 0, startCursor: String(inicio) } };
}

function modificarAlquiler(a, alCambiar) {
  const comenzo = a.fechaInicio <= hoy();
  const minFin = comenzo ? [sumarDias(a.fechaInicio, 1), hoy()].sort().pop() : sumarDias(a.fechaInicio, 1);

  const m = UI.modal({
    titulo: `Modificar alquiler #${a.id}`,
    ancho: 600,
    cuerpo: `
      <p class="texto">${esc(a.clienteNombre)} · ${esc(a.vehiculo)} (${esc(a.placa)})</p>
      ${comenzo ? `<div class="info-banda" style="margin-bottom:14px">${icon('info')}<span>El alquiler ya comenzó: solo se puede cambiar la fecha de entrega.</span></div>` : ''}

      <form class="form" id="fm" novalidate>
        <div class="grid2">
          ${UI.campo({ name: 'fechaInicio', label: 'Fecha de salida', tipo: 'date', value: a.fechaInicio, attrs: `min="${hoy()}"${comenzo ? ' disabled' : ''}` })}
          ${UI.campo({ name: 'fechaFin', label: 'Fecha de entrega', tipo: 'date', value: a.fechaFinPactada, attrs: `min="${minFin}"` })}
          ${UI.campo({ name: 'vehiculoId', label: 'Vehículo', tipo: 'select', clase: 'todo', opciones: [{ valor: a.vehiculoId, texto: `${a.vehiculo} · ${a.placa} (actual)` }], attrs: comenzo ? 'disabled' : '' })}
        </div>

        <dl class="dl">
          <dt>Monto actual</dt><dd>${fmt.dinero(a.montoBase)}</dd>
          <dt>Nuevo monto</dt><dd data-k="nuevo">…</dd>
          <dt>Días</dt><dd data-k="dias">…</dd>
        </dl>

        ${UI.campo({ name: 'metodoPago', label: 'Método de pago', tipo: 'select', opciones: opcionesMetodo('Sin cobro adicional'), ayuda: 'Obligatorio si el monto aumenta (se emite una factura de ajuste). Si disminuye, se emite una nota de crédito.' })}

        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Volver</button>
          <button class="btn" type="submit">Guardar cambios</button>
        </div>
      </form>`
  });

  const f = $('#fm', m.el);
  let cargaVeh = 0;

  async function vehiculosLibres() {
    if (comenzo) return;
    const ini = f.fechaInicio.value;
    const fin = f.fechaFin.value;
    if (!ini || !fin || fin <= ini) return;

    const n = ++cargaVeh;

    try {
      const lista = await Api.vehiculosDisponibles(ini, fin);
      if (n !== cargaVeh) return;
      const actual = f.vehiculoId.value;
      f.vehiculoId.innerHTML = `<option value="${a.vehiculoId}">${esc(a.vehiculo)} · ${esc(a.placa)} (actual)</option>` +
        lista.filter(v => v.id !== a.vehiculoId).map(v =>
          `<option value="${v.id}">${esc(v.marca)} ${esc(v.modelo)} · ${esc(v.placa)} · ${fmt.dinero(v.precioDia)}/día</option>`).join('');
      f.vehiculoId.value = [...f.vehiculoId.options].some(o => o.value === actual) ? actual : a.vehiculoId;
    } catch (e) { /* se mantiene la lista anterior */ }
  }

  async function cotizar() {
    UI.limpiarErrores(f);
    const ini = f.fechaInicio.value;
    const fin = f.fechaFin.value;

    $('[data-k=nuevo]', m.el).textContent = '…';
    $('[data-k=dias]', m.el).textContent = '…';

    if (!ini || !fin || fin <= ini) {
      $('[data-k=nuevo]', m.el).textContent = '—';
      $('[data-k=dias]', m.el).textContent = '—';
      return;
    }

    try {
      const cot = await Api.cotizarAlquiler(+f.vehiculoId.value, ini, fin);
      $('[data-k=nuevo]', m.el).textContent = fmt.dinero(cot.total);
      $('[data-k=dias]', m.el).textContent = cot.dias;
    } catch (e) {
      $('[data-k=nuevo]', m.el).textContent = '—';
      $('[data-k=dias]', m.el).textContent = '—';
      errorEnForm(f, e);
    }
  }

  f.fechaInicio.addEventListener('change', () => {
    if (f.fechaInicio.value) f.fechaFin.min = sumarDias(f.fechaInicio.value, 1);
    vehiculosLibres().then(cotizar);
  });
  f.fechaFin.addEventListener('change', () => vehiculosLibres().then(cotizar));
  f.vehiculoId.addEventListener('change', cotizar);

  vehiculosLibres().then(cotizar);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const ini = f.fechaInicio.value;
    const fin = f.fechaFin.value;
    if (!fin || fin <= ini) return UI.errorCampo(f, 'fechaFin', 'La entrega debe ser posterior a la salida.');
    if (diasEntre(ini, fin) > 90) return UI.errorCampo(f, 'fechaFin', 'El alquiler no puede superar 90 días.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const r = await Api.modificarAlquiler({
        alquilerId: a.id,
        vehiculoId: +f.vehiculoId.value,
        fechaInicio: ini,
        fechaFin: fin,
        metodoPago: f.metodoPago.value || null
      });

      m.cerrar();
      avisoOperacion(r.facturaId ? 'Alquiler modificado. Se emitió el documento de ajuste.' : 'Alquiler modificado.', r.facturaId);
      if (alCambiar) alCambiar();
    } catch (err) {
      UI.ocupado(btn, false);
      if (err.code === 'VEHICULO_NO_DISPONIBLE') vehiculosLibres();
      errorEnForm(f, err);
    }
  };
}

function devolverAlquiler(a, alCambiar) {
  const inspeccionKey = `autogo_inspeccion_dev_${a.id}`;
  let fotosInspeccion = [];

  const m = UI.modal({
    titulo: `Registrar devolución #${a.id}`,
    ancho: 720,
    cuerpo: `
      <div class="devolucion-cab">
        <div class="devolucion-foto" data-dev-foto>${UI.sinFoto(true)}</div>
        <div class="devolucion-identidad">
          <span class="devolucion-eyebrow">VEHÍCULO A RECIBIR</span>
          <h3>${esc(a.vehiculo)}</h3>
          <p>${esc(a.placa)} · ${esc(a.clienteNombre)}</p>
          <div class="devolucion-fechas">
            <span><small>Salida</small><b>${fmt.fecha(a.fechaInicio)}</b></span>
            <span><small>Entrega pactada</small><b>${fmt.fecha(a.fechaFinPactada)}</b></span>
          </div>
        </div>
        <div class="devolucion-estado">${estadoAlquiler(a)}</div>
      </div>

      <form class="form devolucion-form" id="fd" novalidate>
        <section class="devolucion-bloque">
          <div class="devolucion-bloque-h">
            <div><span class="devolucion-num">1</span><div><b>Fecha y cargos</b><small>Confirma cuándo fue recibido el vehículo.</small></div></div>
          </div>
          ${UI.campo({ name: 'fechaDevolucion', label: 'Fecha de devolución', tipo: 'date', value: hoy(), attrs: `min="${a.fechaInicio}" max="${hoy()}"` })}

          <dl class="dl devolucion-costos">
            <dt>Monto base</dt><dd data-k="base">…</dd>
            <dt>Días de mora</dt><dd data-k="dias">…</dd>
            <dt>Monto de mora</dt><dd data-k="mora">…</dd>
          </dl>
          <div class="total devolucion-total"><span>Total actual del alquiler</span><b data-k="total">…</b></div>

          <div data-k="pago" hidden>
            ${UI.campo({ name: 'metodoPagoMora', label: 'Método de pago de la mora', tipo: 'select', opciones: opcionesMetodo() })}
          </div>
        </section>

        <section class="devolucion-bloque">
          <div class="devolucion-bloque-h">
            <div><span class="devolucion-num">2</span><div><b>Inspección de devolución</b><small>Registra únicamente incidencias relevantes.</small></div></div>
          </div>

          <div class="devolucion-danos">
            <span>¿Se encontraron daños?</span>
            <div class="devolucion-opciones" role="radiogroup" aria-label="Daños encontrados">
              <label><input type="radio" name="danos" value="NO" checked><span>No</span></label>
              <label><input type="radio" name="danos" value="SI"><span>Sí</span></label>
            </div>
          </div>

          <label class="campo devolucion-observaciones">
            <span>Observaciones <small>(opcional)</small></span>
            <textarea name="observaciones" rows="3" maxlength="500" placeholder="Ej.: rayón en puerta derecha, retrovisor golpeado, sin novedades..."></textarea>
            <small class="campo-ayuda">Úsalo para dejar constancia de cualquier incidencia o comentario de la recepción.</small>
          </label>

          <div class="devolucion-fotos">
            <div class="devolucion-fotos-h">
              <div><b>Fotos de devolución</b><small>Opcional · sirven como respaldo visual de la inspección.</small></div>
              <label class="btn ghost sm dev-subir-foto">${icon('camera')} Añadir fotos<input type="file" id="devFotos" accept="image/*" multiple hidden></label>
            </div>
            <div class="devolucion-fotos-grid" id="devFotosGrid"><div class="devolucion-fotos-vacio">${icon('camera')}<span>Aún no se han añadido fotos.</span></div></div>
          </div>
        </section>

        <div class="info-banda devolucion-mantenimiento">${icon('info')}<span>Al registrar la devolución, el vehículo pasa automáticamente a <b>Mantenimiento</b> hasta el siguiente día laborable.</span></div>

        ${formErr}
        <div class="modal-acc devolucion-acciones">
          <button class="btn ghost" type="button" data-cerrar>Volver</button>
          <button class="btn" type="submit" disabled>${icon('check')} Revisar y registrar devolución</button>
        </div>
      </form>`
  });

  const f = $('#fd', m.el);
  const btn = $('[type=submit]', f);
  let cot = null;

  // Cargar la foto real del vehículo cuando esté disponible.
  if (a.vehiculoId) {
    Api.vehiculo(a.vehiculoId).then(v => {
      const caja = $('[data-dev-foto]', m.el);
      if (caja) caja.innerHTML = fotoVeh(v);
    }).catch(() => {});
  }

  const pintarFotos = () => {
    const g = $('#devFotosGrid', m.el);
    if (!g) return;
    if (!fotosInspeccion.length) {
      g.innerHTML = `<div class="devolucion-fotos-vacio">${icon('camera')}<span>Aún no se han añadido fotos.</span></div>`;
      return;
    }
    g.innerHTML = fotosInspeccion.map((x, i) => `
      <figure class="devolucion-foto-item">
        <img src="${x.url}" alt="Foto de devolución ${i + 1}">
        <button type="button" data-quitar-foto="${i}" aria-label="Quitar foto">${icon('x')}</button>
      </figure>`).join('');
  };

  $('#devFotos', m.el).addEventListener('change', e => {
    const archivos = [...e.target.files].filter(x => x.type.startsWith('image/')).slice(0, Math.max(0, 6 - fotosInspeccion.length));
    archivos.forEach(file => fotosInspeccion.push({ file, url: URL.createObjectURL(file) }));
    e.target.value = '';
    pintarFotos();
  });

  $('#devFotosGrid', m.el).addEventListener('click', e => {
    const b = e.target.closest('[data-quitar-foto]');
    if (!b) return;
    const i = +b.dataset.quitarFoto;
    const x = fotosInspeccion[i];
    if (x) URL.revokeObjectURL(x.url);
    fotosInspeccion.splice(i, 1);
    pintarFotos();
  });

  async function cotizar() {
    UI.limpiarErrores(f);
    btn.disabled = true;
    ['base', 'dias', 'mora', 'total'].forEach(k => { $(`[data-k=${k}]`, m.el).textContent = '…'; });

    try {
      cot = await Api.cotizarDevolucion(a.id, f.fechaDevolucion.value || null);
      $('[data-k=base]', m.el).textContent = fmt.dinero(cot.montoBase);
      $('[data-k=dias]', m.el).textContent = cot.diasMora;
      $('[data-k=mora]', m.el).textContent = fmt.dinero(cot.montoMora);
      $('[data-k=total]', m.el).textContent = fmt.dinero(cot.montoTotal);
      $('[data-k=pago]', m.el).hidden = !(cot.diasMora > 0);
      btn.disabled = false;
    } catch (e) {
      ['base', 'dias', 'mora', 'total'].forEach(k => { $(`[data-k=${k}]`, m.el).textContent = '—'; });
      errorEnForm(f, e);
    }
  }

  f.fechaDevolucion.addEventListener('change', cotizar);
  cotizar();

  f.onsubmit = async e => {
    e.preventDefault();
    if (!cot) return;
    UI.limpiarErrores(f);

    const danos = f.danos.value === 'SI';
    const observaciones = f.observaciones.value.trim();
    if (danos && !observaciones) {
      const err = $('.form-err', f);
      err.textContent = 'Describe brevemente los daños encontrados antes de continuar.';
      err.style.display = 'block';
      f.observaciones.focus();
      return;
    }

    const metodo = cot.diasMora > 0 ? f.metodoPagoMora.value : null;
    const resumen = UI.modal({
      titulo: 'Confirmar devolución',
      ancho: 520,
      cuerpo: `
        <div class="devolucion-confirmar">
          <div class="devolucion-confirmar-veh"><b>${esc(a.vehiculo)}</b><span>${esc(a.placa)} · ${esc(a.clienteNombre)}</span></div>
          <div class="revision-grid">
            <div><small>Fecha de devolución</small><b>${fmt.fecha(f.fechaDevolucion.value)}</b></div>
            <div><small>Mora</small><b>${cot.diasMora ? `${cot.diasMora} día(s)` : 'Sin mora'}</b><span>${fmt.dinero(cot.montoMora)}</span></div>
            <div><small>Inspección</small><b>${danos ? 'Con daños reportados' : 'Sin daños reportados'}</b><span>${fotosInspeccion.length} foto(s)</span></div>
            <div><small>Pago de mora</small><b>${cot.diasMora ? etq(metodo) : 'No aplica'}</b></div>
          </div>
          ${observaciones ? `<div class="devolucion-confirmar-obs"><small>Observaciones</small><p>${esc(observaciones)}</p></div>` : ''}
          <div class="revision-total"><span>Total actual del alquiler</span><b>${fmt.dinero(cot.montoTotal)}</b></div>
          <div class="info-banda">${icon('info')}<span>El vehículo quedará en mantenimiento automáticamente después de registrar la devolución.</span></div>
          <div class="modal-acc">
            <button class="btn ghost" type="button" data-volver-dev>Volver y revisar</button>
            <button class="btn" type="button" data-confirmar-dev>${icon('check')} Confirmar devolución</button>
          </div>
        </div>`
    });

    $('[data-volver-dev]', resumen.el).onclick = () => resumen.cerrar();
    $('[data-confirmar-dev]', resumen.el).onclick = async () => {
      const confirmar = $('[data-confirmar-dev]', resumen.el);
      UI.ocupado(confirmar, true);
      try {
        const r = await Api.registrarDevolucion({
          alquilerId: a.id,
          fechaDevolucion: f.fechaDevolucion.value || null,
          metodoPagoMora: metodo
        });

        // El backend actual aún no expone campos para inspección. Se conserva una
        // referencia local de apoyo para el prototipo sin alterar DevolucionInput.
        try {
          localStorage.setItem(inspeccionKey, JSON.stringify({
            alquilerId: a.id,
            danos,
            observaciones,
            fotos: fotosInspeccion.map(x => x.file.name),
            fechaRegistro: new Date().toISOString()
          }));
        } catch (_) {}

        fotosInspeccion.forEach(x => URL.revokeObjectURL(x.url));
        resumen.cerrar();
        m.cerrar();
        avisoOperacion(r.facturaId ? 'Devolución registrada. Se emitió la factura de mora.' : 'Devolución registrada sin cargos de mora.', r.facturaId);
        refrescarPendientes();
        if (alCambiar) alCambiar();
      } catch (err) {
        UI.ocupado(confirmar, false);
        resumen.cerrar();
        errorEnForm(f, err);
      }
    };
  };
}


/* =========================================================
   NUEVO ALQUILER EN MOSTRADOR
========================================================= */

async function vNuevoAlquiler(c, ctx) {
  const h = hoy();
  const st = {
    cliente: null,
    ini: ctx.q.get('desde') && ctx.q.get('desde') >= h ? ctx.q.get('desde') : h,
    fin: null,
    cat: '',
    vehiculos: [],
    vehiculo: null,
    cot: null,
    preVeh: +ctx.q.get('veh') || null,
    metodoPago: METODOS[0] || 'EFECTIVO'
  };
  st.fin = ctx.q.get('hasta') && ctx.q.get('hasta') > st.ini ? ctx.q.get('hasta') : sumarDias(st.ini, 3);

  c.innerHTML = `
    <div class="registro-alquiler-cab">
      <div>
        <span class="eyebrow">Proceso de mostrador</span>
        <h2>Registrar un nuevo alquiler</h2>
        <p>Selecciona el cliente, define las fechas, elige un vehículo disponible y revisa los datos antes de confirmar.</p>
      </div>
      <div class="registro-progreso" aria-label="Progreso del registro">
        <span class="activo" data-prog="1"><i>1</i> Cliente</span>
        <b></b>
        <span data-prog="2"><i>2</i> Vehículo</span>
        <b></b>
        <span data-prog="3"><i>3</i> Confirmación</span>
      </div>
    </div>

    <div class="dos-col registro-alquiler-layout">
      <div class="pasos">
        <section class="card registro-paso">
          <div class="paso-h" id="p1"><i>1</i><div><h3>Cliente</h3><small>Busca un cliente existente o registra uno nuevo.</small></div></div>
          <div id="cli"></div>
        </section>

        <section class="card registro-paso">
          <div class="paso-h" id="p2"><i>2</i><div><h3>Fechas y vehículo</h3><small>Solo se mostrarán vehículos disponibles para el período seleccionado.</small></div></div>
          <form class="buscador buscador-alquiler" id="fv" novalidate>
            ${UI.campo({ name: 'desde', label: 'Salida', tipo: 'date', value: st.ini, attrs: `min="${h}"` })}
            ${UI.campo({ name: 'hasta', label: 'Entrega', tipo: 'date', value: st.fin, attrs: `min="${sumarDias(st.ini, 1)}" max="${sumarDias(st.ini, 90)}"` })}
            ${UI.campo({ name: 'cat', label: 'Categoría', tipo: 'select', opciones: [{ valor: '', texto: 'Todas' }] })}
            <button class="btn ghost buscar-disponibles" type="submit">${icon('search')} Buscar disponibles</button>
            ${formErr}
          </form>
          <div id="vehs"></div>
        </section>
      </div>

      <aside class="card pegajoso registro-resumen" id="resumen"></aside>
    </div>`;

  const fv = $('#fv', c);

  const actualizarProgreso = () => {
    const paso = st.cliente && st.vehiculo && st.cot ? 3 : st.cliente ? 2 : 1;
    $$('[data-prog]', c).forEach(x => {
      const n = +x.dataset.prog;
      x.classList.toggle('activo', n === paso);
      x.classList.toggle('hecho', n < paso);
    });
  };

  Api.categorias().then(cs => {
    if (!ctx.vigente()) return;
    fv.cat.innerHTML = '<option value="">Todas</option>' + cs.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
  }).catch(() => { /* filtro opcional */ });


  /* Paso 1: cliente */

  function pintarCliente() {
    const caja = $('#cli', c);
    $('#p1', c).classList.toggle('hecho', !!st.cliente);
    actualizarProgreso();

    if (st.cliente) {
      const cl = st.cliente;
      const sinLicencia = !cl.licenciaConducir;
      const inactivo = cl.activo === false;
      caja.innerHTML = `
        <div class="cliente-seleccionado${inactivo ? ' cliente-inactivo' : ''}">
          <div class="cliente-seleccionado-h">
            ${UI.avatar(cl.nombre, 'sm')}
            <div class="cliente-identidad">
              <b>${esc(cl.nombre)}</b>
              <span>${esc(cl.cedula)}</span>
            </div>
            ${badge(null, inactivo ? 'Inactivo' : 'Activo', inactivo ? 'bad' : 'ok')}
            <button class="btn ghost sm" type="button" data-cambiar>Cambiar</button>
          </div>
          <div class="cliente-datos-grid">
            <div><small>Teléfono</small><b>${cl.telefono ? esc(cl.telefono) : 'No registrado'}</b></div>
            <div><small>Correo</small><b>${cl.correo ? esc(cl.correo) : 'No registrado'}</b></div>
            <div><small>Licencia</small><b>${cl.licenciaConducir ? esc(cl.licenciaConducir) : 'No registrada'}</b></div>
            <div><small>Cuenta</small><b>${cl.tieneCuenta ? 'Con acceso al portal' : 'Cliente de mostrador'}</b></div>
          </div>
          ${inactivo ? `<div class="info-banda alerta">${icon('alert')}<span>Este cliente está inactivo. Debes activarlo antes de registrar un alquiler.</span></div>` : ''}
          ${!inactivo && sinLicencia ? `<div class="info-banda aviso">${icon('info')}<span>Este cliente no tiene una licencia de conducir registrada. Verifica el documento antes de confirmar el alquiler.</span></div>` : ''}
        </div>`;
      $('[data-cambiar]', caja).onclick = () => {
        st.cliente = null;
        pintarCliente();
        pintarResumen();
      };
      return;
    }

    caja.innerHTML = `
      <div class="herramientas cliente-buscador" style="margin-bottom:0">
        <div class="buscar">${icon('search')}<input type="search" id="qCli" placeholder="Buscar por nombre, cédula o correo" aria-label="Buscar cliente" autocomplete="off"></div>
        <button class="btn ghost" type="button" data-nuevo>${icon('plus')} Cliente nuevo</button>
      </div>
      <div class="resultados-cli" id="resCli"></div>`;

    const q = $('#qCli', caja);
    const res = $('#resCli', caja);
    let ultimos = [];

    const buscar = debounce(async () => {
      const t = q.value.trim();
      if (t.length < 2) {
        res.innerHTML = '<p class="texto ayuda-busqueda">Escribe al menos 2 caracteres para buscar.</p>';
        return;
      }

      res.innerHTML = UI.cargando(2);

      try {
        const r = await Api.clientes({ texto: t, first: 6 });
        ultimos = r.nodes;
        res.innerHTML = ultimos.length ? ultimos.map(x => `
          <button type="button" data-cli="${x.id}"${x.activo === false ? ' class="cliente-resultado-inactivo"' : ''}>
            ${UI.avatar(x.nombre, 'sm')}
            <div><b>${esc(x.nombre)}</b><small>${esc(x.cedula)}${x.telefono ? ' · ' + esc(x.telefono) : ''}${x.correo ? ' · ' + esc(x.correo) : ''}</small></div>
            ${badge(null, x.activo === false ? 'Inactivo' : 'Seleccionar', x.activo === false ? 'bad' : 'neutro')}
          </button>`).join('') : '<p class="texto" style="color:var(--txt-3)">Sin resultados. Puedes registrarlo como cliente nuevo.</p>';
      } catch (e) {
        res.innerHTML = '';
        avisarError(e);
      }
    });

    q.addEventListener('input', buscar);
    q.focus();
    res.innerHTML = '<p class="texto ayuda-busqueda">Busca el cliente antes de continuar.</p>';

    res.onclick = e => {
      const b = e.target.closest('[data-cli]');
      if (!b) return;
      st.cliente = ultimos.find(x => x.id === +b.dataset.cli);
      pintarCliente();
      pintarResumen();
    };

    $('[data-nuevo]', caja).onclick = () => editarCliente(null, nuevo => {
      st.cliente = nuevo;
      pintarCliente();
      pintarResumen();
    });
  }


  /* Paso 2: vehículo */

  fv.desde.addEventListener('change', () => {
    const d = fv.desde.value;
    if (!d) return;
    fv.hasta.min = sumarDias(d, 1);
    fv.hasta.max = sumarDias(d, 90);
    if (!fv.hasta.value || fv.hasta.value <= d) fv.hasta.value = sumarDias(d, 3);
    buscarVehiculos();
  });
  fv.hasta.addEventListener('change', buscarVehiculos);
  fv.cat.addEventListener('change', buscarVehiculos);
  fv.onsubmit = e => {
    e.preventDefault();
    buscarVehiculos();
  };

  async function buscarVehiculos() {
    UI.limpiarErrores(fv);
    st.ini = fv.desde.value;
    st.fin = fv.hasta.value;
    st.cat = fv.cat.value;

    const previo = st.vehiculo ? st.vehiculo.id : st.preVeh;
    st.vehiculo = null;
    st.cot = null;
    pintarResumen();

    if (!st.ini || !st.fin) return UI.errorForm(fv, 'Indica la fecha de salida y la de entrega.');
    if (st.ini < hoy()) return UI.errorCampo(fv, 'desde', 'La salida no puede ser pasada.');
    if (st.fin <= st.ini) return UI.errorCampo(fv, 'hasta', 'La entrega debe ser posterior a la salida.');
    if (diasEntre(st.ini, st.fin) > 90) return UI.errorCampo(fv, 'hasta', 'Máximo 90 días.');

    const caja = $('#vehs', c);
    caja.innerHTML = UI.cargando(3);

    try {
      st.vehiculos = await Api.vehiculosDisponibles(st.ini, st.fin, st.cat ? +st.cat : null);
      if (!ctx.vigente()) return;

      st.preVeh = null;
      const elegido = st.vehiculos.find(v => v.id === previo);
      if (elegido) elegirVehiculo(elegido);
      else pintarVehiculos();
    } catch (e) {
      if (e.code === 'FECHAS_INVALIDAS') {
        caja.innerHTML = '';
        return UI.errorForm(fv, e.message);
      }
      falloCarga(caja, e, buscarVehiculos);
    }
  }

  function pintarVehiculos() {
    $('#p2', c).classList.toggle('hecho', !!st.vehiculo);
    actualizarProgreso();
    $('#vehs', c).innerHTML = st.vehiculos.length
      ? `<div class="vehiculos-disponibles-cab"><span><b>${st.vehiculos.length}</b> vehículo(s) disponible(s)</span><small>${fmt.fecha(st.ini)} → ${fmt.fecha(st.fin)}</small></div><div class="veh-grid veh-grid-registro">${st.vehiculos.map(v => tarjetaVeh(v, {
        accion: 'elegir',
        texto: st.vehiculo && st.vehiculo.id === v.id ? `${icon('check')} Elegido` : 'Elegir vehículo',
        sel: st.vehiculo && st.vehiculo.id === v.id,
        registro: true
      })).join('')}</div>`
      : UI.vacio('No hay vehículos disponibles para esas fechas.', 'car');
  }

  async function elegirVehiculo(v) {
    st.vehiculo = v;
    st.cot = null;
    pintarVehiculos();
    pintarResumen();

    try {
      const cot = await Api.cotizarAlquiler(v.id, st.ini, st.fin);
      if (st.vehiculo === v) {
        st.cot = cot;
        pintarResumen();
      }
    } catch (e) {
      avisarError(e);
    }
  }

  $('#vehs', c).addEventListener('click', e => {
    const b = e.target.closest('[data-elegir]');
    const card = e.target.closest('[data-card-veh]');
    const id = b ? +b.dataset.elegir : card ? +card.dataset.cardVeh : null;
    if (!id) return;
    const v = st.vehiculos.find(x => x.id === id);
    if (v) elegirVehiculo(v);
  });


  /* Paso 3: resumen, revisión y confirmación */

  async function confirmarRegistro(fr) {
    const v = st.vehiculo;
    const cl = st.cliente;
    const cot = st.cot;
    const metodo = fr.metodoPago.value;
    const estadoPrevisto = st.ini > hoy()
      ? { texto: 'Reserva', tono: 'reserva' }
      : (st.fin === hoy() ? { texto: 'Por devolver', tono: 'warn' } : { texto: 'Activo', tono: 'info' });
    const datosVehiculo = [v.transmision ? etq(v.transmision) : null, v.color || null].filter(Boolean).join(' · ');

    const m = UI.modal({
      titulo: 'Confirmar alquiler',
      ancho: 700,
      cuerpo: `
        <div class="revision-alquiler revision-alquiler-final">
          <div class="revision-cabecera">
            <div>
              <span class="eyebrow">Paso final</span>
              <h3>Revisa los datos antes de registrar</h3>
              <p>Confirma que el cliente, el vehículo, las fechas y el pago sean correctos.</p>
            </div>
            ${badge(null, estadoPrevisto.texto, estadoPrevisto.tono)}
          </div>

          <section class="revision-vehiculo revision-bloque-principal">
            <div class="revision-vehiculo-foto">${fotoVeh(v)}</div>
            <div class="revision-vehiculo-datos">
              <span class="revision-label">Vehículo</span>
              <h3>${esc(v.marca)} ${esc(v.modelo)}</h3>
              <p>${esc(v.anio)} · ${esc(v.categoria)} · Placa ${esc(v.placa)}</p>
              ${datosVehiculo ? `<p class="revision-meta-extra">${esc(datosVehiculo)}</p>` : ''}
              <div class="revision-tarifa"><b>${fmt.dinero(cot.precioDia)}</b><small>/ día</small></div>
            </div>
          </section>

          <div class="revision-secciones">
            <section class="revision-seccion-card">
              <div class="revision-seccion-head">${icon('user')}<span>Cliente</span></div>
              <div class="revision-dato-principal"><b>${esc(cl.nombre)}</b><span>${esc(cl.cedula)}</span></div>
              <div class="revision-mini-grid">
                <div><small>Teléfono</small><b>${cl.telefono ? esc(cl.telefono) : 'No registrado'}</b></div>
                <div><small>Correo</small><b>${cl.correo ? esc(cl.correo) : 'No registrado'}</b></div>
                <div class="todo"><small>Licencia</small><b class="${cl.licenciaConducir ? '' : 'revision-aviso-texto'}">${cl.licenciaConducir ? esc(cl.licenciaConducir) : 'No registrada'}</b></div>
              </div>
            </section>

            <section class="revision-seccion-card">
              <div class="revision-seccion-head">${icon('calendar')}<span>Período</span></div>
              <div class="revision-periodo">
                <div><small>Salida</small><b>${fmt.fecha(st.ini)}</b></div>
                <span class="revision-flecha">→</span>
                <div><small>Entrega</small><b>${fmt.fecha(st.fin)}</b></div>
              </div>
              <div class="revision-dias">${cot.dias} día(s) de alquiler</div>
            </section>
          </div>

          ${!cl.licenciaConducir ? `<div class="info-banda aviso revision-alerta">${icon('info')}<span>La licencia de conducir no está registrada. Verifica físicamente la licencia antes de confirmar el alquiler.</span></div>` : ''}

          <section class="revision-pago">
            <div class="revision-seccion-head">${icon('receipt')}<span>Pago y total</span></div>
            <div class="revision-pago-filas">
              <div><span>Método de pago</span><b>${esc(metodoTxt(metodo))}</b></div>
              <div><span>Tarifa diaria</span><b>${fmt.dinero(cot.precioDia)}</b></div>
              <div><span>Días</span><b>${cot.dias}</b></div>
              <div class="revision-subtotal"><span>Subtotal del alquiler</span><b>${fmt.dinero(cot.total)}</b></div>
            </div>
            <div class="revision-total revision-total-final"><span>Total actual</span><b>${fmt.dinero(cot.total)}</b></div>
          </section>

          <p class="revision-nota">Al confirmar se registrará el alquiler y se generará la factura correspondiente. Los impuestos se incorporarán cuando se configure el módulo de Facturación.</p>

          <div class="modal-acc revision-acciones-finales">
            <button class="btn ghost" type="button" data-cerrar>${icon('edit')} Volver y revisar</button>
            <button class="btn" type="button" data-confirmar-final>${icon('check')} Confirmar alquiler</button>
          </div>
        </div>`
    });

    $('[data-confirmar-final]', m.el).onclick = async () => {
      const btn = $('[data-confirmar-final]', m.el);
      UI.ocupado(btn, true);
      try {
        const op = await Api.crearAlquiler({
          clienteId: cl.id,
          vehiculoId: v.id,
          fechaInicio: st.ini,
          fechaFin: st.fin,
          metodoPago: metodo
        });

        m.cerrar();
        modalExito({
          titulo: 'Alquiler registrado',
          texto: `Alquiler <b>#${op.alquiler.id}</b> de ${esc(op.alquiler.clienteNombre)} · ${esc(op.alquiler.vehiculo)} (${esc(op.alquiler.placa)}).`,
          facturaId: op.facturaId,
          extra: '<a class="btn ghost" href="#/alquileres" data-cerrar>Ver alquileres</a>'
        });

        st.vehiculo = null;
        st.cot = null;
        buscarVehiculos();
      } catch (err) {
        UI.ocupado(btn, false);
        if (err.code === 'VEHICULO_NO_DISPONIBLE') {
          m.cerrar();
          UI.toast('El vehículo ya no está disponible en esas fechas. Elige otro.', 'warn');
          return buscarVehiculos();
        }
        avisarError(err);
      }
    };
  }

  function pintarResumen() {
    const r = $('#resumen', c);
    const clienteValido = st.cliente && st.cliente.activo !== false;
    const listo = clienteValido && st.vehiculo && st.cot;
    actualizarProgreso();

    const veh = st.vehiculo;
    const cl = st.cliente;

    r.innerHTML = `
      <div class="registro-resumen-h">
        <div><span class="eyebrow">Paso 3</span><h3>Resumen del alquiler</h3></div>
        ${listo ? badge(null, 'Listo para revisar', 'ok') : badge(null, 'Pendiente', 'neutro')}
      </div>

      ${veh ? `
        <div class="resumen-vehiculo-registro">
          <div class="resumen-vehiculo-foto">${fotoVeh(veh)}</div>
          <div>
            <b>${esc(veh.marca)} ${esc(veh.modelo)}</b>
            <span>${esc(veh.anio)} · ${esc(veh.categoria)}</span>
            <small>Placa ${esc(veh.placa)}${veh.transmision ? ' · ' + esc(veh.transmision) : ''}${veh.color ? ' · ' + esc(veh.color) : ''}</small>
          </div>
        </div>` : `
        <div class="resumen-vacio-registro">${icon('car')}<div><b>Selecciona un vehículo</b><span>La información y cotización aparecerán aquí.</span></div></div>`}

      <div class="resumen-seccion">
        <span class="resumen-seccion-titulo">Cliente</span>
        <div class="resumen-fila"><span>Nombre</span><b>${cl ? esc(cl.nombre) : '—'}</b></div>
        <div class="resumen-fila"><span>Cédula</span><b>${cl ? esc(cl.cedula) : '—'}</b></div>
        ${cl ? `<div class="resumen-fila"><span>Licencia</span><b class="${cl.licenciaConducir ? '' : 'texto-aviso'}">${cl.licenciaConducir ? esc(cl.licenciaConducir) : 'No registrada'}</b></div>` : ''}
      </div>

      <div class="resumen-seccion">
        <span class="resumen-seccion-titulo">Período</span>
        <div class="resumen-fila"><span>Salida</span><b>${fmt.fecha(st.ini)}</b></div>
        <div class="resumen-fila"><span>Entrega</span><b>${fmt.fecha(st.fin)}</b></div>
        <div class="resumen-fila"><span>Días</span><b>${st.cot ? st.cot.dias : '—'}</b></div>
      </div>

      <div class="resumen-seccion costo-alquiler">
        <span class="resumen-seccion-titulo">Costos</span>
        <div class="resumen-fila"><span>Precio por día</span><b>${st.cot ? fmt.dinero(st.cot.precioDia) : '—'}</b></div>
        <div class="resumen-fila"><span>Subtotal actual</span><b>${st.cot ? fmt.dinero(st.cot.total) : '—'}</b></div>
      </div>

      <div class="total total-registro"><span>Total</span><b>${st.cot ? fmt.dinero(st.cot.total) : '—'}</b></div>

      <form class="form" id="fr" novalidate>
        ${UI.campo({ name: 'metodoPago', label: 'Método de pago', tipo: 'select', value: st.metodoPago, opciones: opcionesMetodo() })}
        ${cl && cl.activo === false ? `<div class="form-err" style="display:block">El cliente está inactivo y no puede continuar.</div>` : formErr}
        <button class="btn block" type="submit"${listo ? '' : ' disabled'}>${icon('check')} Revisar y confirmar</button>
      </form>`;

    const fr = $('#fr', r);
    fr.metodoPago.addEventListener('change', () => { st.metodoPago = fr.metodoPago.value; });
    fr.onsubmit = e => {
      e.preventDefault();
      UI.limpiarErrores(fr);
      st.metodoPago = fr.metodoPago.value;
      if (!listo) return;
      confirmarRegistro(fr);
    };
  }

  const preCliente = +ctx.q.get('cliente');

  if (preCliente) {
    try {
      st.cliente = await Api.cliente(preCliente);
    } catch (e) { /* se elige manualmente */ }
  }

  pintarCliente();
  pintarResumen();
  await buscarVehiculos();
}


/* =========================================================
   FLOTA
========================================================= */

function claseFilaVehiculo(v) {
  if (!v.activo) return 'fila-veh-inactivo';
  return ({
    DISPONIBLE: 'fila-veh-disponible',
    ALQUILADO: 'fila-veh-alquilado',
    MANTENIMIENTO: 'fila-veh-mantenimiento',
    FUERA_DE_SERVICIO: 'fila-veh-fuera'
  })[v.estadoActual] || '';
}

async function resumenFlota() {
  const [d, r] = await Promise.all([
    Api.dashboard(),
    Api.vehiculos({ incluirInactivos: true, first: 200 })
  ]);
  const lista = r.nodes || [];
  return {
    total: d.totalVehiculos || 0,
    disponibles: d.vehiculosDisponibles || 0,
    alquilados: d.vehiculosAlquilados || 0,
    mantenimiento: d.vehiculosEnMantenimiento || 0,
    fuera: d.vehiculosFueraDeServicio || 0,
    inactivos: lista.filter(v => v.activo === false).length
  };
}

async function historialVehiculo(v) {
  const m = UI.modal({
    titulo: `Historial · ${esc(v.marca)} ${esc(v.modelo)}`,
    ancho: 760,
    cuerpo: `<div class="historial-veh-cargando"><span class="skeleton"></span><p>Cargando historial del vehículo…</p></div>`
  });
  try {
    const r = await Api.alquileres({ vehiculoId: v.id, first: 100 });
    const lista = [...(r.nodes || [])].sort((a,b) => String(b.fechaCreacion || b.fechaInicio).localeCompare(String(a.fechaCreacion || a.fechaInicio)));
    const estadoAhora = v.activo ? badge(v.estadoActual) : badge(null, 'Inactivo', 'neutro');
    m.cuerpo.innerHTML = `
      <div class="historial-veh-head">
        <div class="historial-veh-foto">${fotoVeh(v)}</div>
        <div><span class="eyebrow">${esc(v.placa)}</span><h3>${esc(v.marca)} ${esc(v.modelo)}</h3><div class="badges">${estadoAhora}</div></div>
      </div>
      ${v.estadoActual === 'MANTENIMIENTO' ? `<div class="info-banda aviso">${icon('pulse')}<span>Mantenimiento actual${v.mantenimientoHasta ? ` hasta <b>${fmt.fecha(v.mantenimientoHasta)}</b>` : ' sin fecha de finalización'}.</span></div>` : ''}
      <div class="historial-veh-resumen">
        <div><small>Alquileres registrados</small><b>${lista.length}</b></div>
        <div><small>Completados</small><b>${lista.filter(a=>a.estado==='COMPLETADO').length}</b></div>
        <div><small>Cancelados</small><b>${lista.filter(a=>a.estado==='CANCELADO').length}</b></div>
      </div>
      <div class="historial-veh-lista">
        ${lista.length ? lista.map(a => `
          <article class="historial-veh-item">
            <div class="historial-veh-linea"><span></span></div>
            <div class="historial-veh-contenido">
              <div class="historial-veh-titulo"><b>Alquiler #${a.id}</b>${estadoAlquiler(a)}</div>
              <p>${esc(a.clienteNombre)} · ${esc(a.clienteCedula)}</p>
              <div class="historial-veh-meta"><span>${fmt.fecha(a.fechaInicio)} → ${fmt.fecha(a.fechaDevolucion || a.fechaFinPactada)}</span><b>${fmt.dinero(a.montoTotal)}</b></div>
            </div>
          </article>`).join('') : UI.vacio('Este vehículo todavía no tiene alquileres registrados.', 'calendar')}
      </div>
      <div class="modal-acc"><button class="btn ghost" type="button" data-cerrar>Cerrar</button></div>`;
  } catch (err) {
    m.cuerpo.innerHTML = `<div class="vacio"><h4>No se pudo cargar el historial</h4><p>${esc(err.message || 'Inténtalo de nuevo.')}</p></div>`;
  }
}

function detalleVehiculo(v, alActualizar) {
  const extra = !!Api.VEHICULO_EXTRA;
  const m = UI.modal({
    titulo: 'Detalle del vehículo',
    ancho: 720,
    cuerpo: `
      <div class="detalle-veh">
        <div class="detalle-veh-foto">${fotoVeh(v)}</div>
        <div class="detalle-veh-info">
          <span class="detalle-veh-eyebrow">VEHÍCULO #${v.id}</span>
          <h3>${esc(v.marca)} ${esc(v.modelo)}</h3>
          <p>${esc(v.placa)} · ${esc(v.categoria || 'Sin categoría')}</p>
          <div class="badges">${v.activo ? badge(v.estadoActual) : badge(null, 'Inactivo', 'neutro')}</div>
        </div>
      </div>
      <div class="detalle-veh-grid">
        <div><small>Año</small><b>${esc(v.anio)}</b></div>
        <div><small>Precio por día</small><b>${fmt.dinero(v.precioDia)}</b></div>
        <div><small>Categoría</small><b>${esc(v.categoria || '—')}</b></div>
        <div><small>Placa</small><b>${esc(v.placa)}</b></div>
        ${extra ? `<div><small>Transmisión</small><b>${esc(etq(v.transmision) || '—')}</b></div>
        <div><small>Color</small><b>${esc(v.color || '—')}</b></div>
        <div><small>Capacidad</small><b>${v.capacidad ? `${esc(v.capacidad)} pasajeros` : '—'}</b></div>` : ''}
        ${v.estadoActual === 'MANTENIMIENTO' ? `<div><small>Mantenimiento hasta</small><b>${v.mantenimientoHasta ? fmt.fecha(v.mantenimientoHasta) : 'Sin fecha definida'}</b></div>` : ''}
      </div>
      ${extra && v.observaciones ? `<div class="detalle-veh-obs"><small>Observaciones</small><p>${esc(v.observaciones)}</p></div>` : ''}
      <div class="modal-acc">
        <button class="btn ghost" type="button" data-cerrar>Cerrar</button>
        <button class="btn ghost" type="button" data-historial-detalle>${icon('clock')} Historial</button>
        <a class="btn ghost" href="#/alquileres?vehiculo=${v.id}&vehiculoNombre=${encodeURIComponent(`${v.marca} ${v.modelo} · ${v.placa}`)}" data-cerrar>${icon('calendar')} Ver alquileres</a>
        ${!v.activo ? `<button class="btn" type="button" data-reactivar-detalle>${icon('undo')} Reactivar</button>` : `<button class="btn" type="button" data-editar-detalle>${icon('edit')} Editar vehículo</button>`}
      </div>`
  });
  const hist = $('[data-historial-detalle]', m.el);
  if (hist) hist.onclick = () => historialVehiculo(v);
  const editar = $('[data-editar-detalle]', m.el);
  if (editar) editar.onclick = () => {
    m.cerrar();
    location.hash = '#/flota?editar=' + v.id;
  };
  const reactivar = $('[data-reactivar-detalle]', m.el);
  if (reactivar) reactivar.onclick = async () => {
    UI.ocupado(reactivar, true);
    try {
      await Api.reactivarVehiculo(v.id);
      UI.toast('Vehículo reactivado.');
      m.cerrar();
      alActualizar?.();
    } catch (err) {
      UI.ocupado(reactivar, false);
      avisarError(err);
    }
  };
}

async function vFlota(c, ctx) {
  let categorias = [];
  const ESTADOS_PANEL_FLOTA = ['DISPONIBLE', 'ALQUILADO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'INACTIVO'];
  const estadoPanel = ESTADOS_PANEL_FLOTA.includes(ctx.q.get('estado')) ? ctx.q.get('estado') : null;
  const filtros = { texto: '', categoriaId: '' };

  ctx.acciones(`<button class="btn" type="button" data-nuevo-veh>${icon('plus')} Nuevo vehículo</button>`);

  c.innerHTML = `
    <div class="flota-resumen" id="flotaResumen">
      ${Array.from({ length: 4 }, () => '<div class="card flota-mini"><span class="skeleton"></span></div>').join('')}
    </div>
    <div class="herramientas">
      ${estadoPanel ? `<span class="filtro-activo">Estado: <b>${esc(etq(estadoPanel))}</b><a href="#/flota" aria-label="Quitar filtro de estado">×</a></span>` : ''}
      <div class="buscar">${icon('search')}<input type="search" id="qVeh" placeholder="Buscar por placa, marca o modelo" aria-label="Buscar vehículo"></div>
      <select id="catVeh" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option></select>
    </div>
    <div class="card" id="lista"></div>`;

  const pintarCategorias = () => {
    const s = $('#catVeh', c);
    const v = s.value;
    s.innerHTML = '<option value="">Todas las categorías</option>' + categorias.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
    s.value = v;
  };

  const l = listado({
    cont: $('#lista', c),
    vigente: ctx.vigente,
    cargar: pag => (estadoPanel ? p => panelFlotaEstado(estadoPanel, p) : Api.vehiculos)({
      texto: filtros.texto || null,
      categoriaId: filtros.categoriaId ? +filtros.categoriaId : null,
      incluirInactivos: estadoPanel === 'INACTIVO',
      ...pag
    }),
    pintar: r => (r.nodes.length ? `
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th></th><th>Vehículo</th><th>Placa</th><th class="num">Precio/día</th><th>Estado</th><th>Mantenimiento hasta</th><th></th></tr></thead>
          <tbody>${r.nodes.map(v => `
            <tr class="${claseFilaVehiculo(v)}">
              <td><div class="foto-mini">${fotoVeh(v)}</div></td>
              <td class="principal"><b>${esc(v.marca)} ${esc(v.modelo)}</b><small>${esc(v.anio)} · ${esc(v.categoria)}</small></td>
              <td class="nowrap">${esc(v.placa)}</td>
              <td class="num">${fmt.dinero(v.precioDia)}</td>
              <td><div class="badges">
                ${v.activo ? badge(v.estadoActual) : badge(null, 'Inactivo', 'neutro')}
                </div></td>
              <td class="nowrap">${v.estadoActual === 'MANTENIMIENTO' ? (v.mantenimientoHasta ? fmt.fecha(v.mantenimientoHasta) : 'Sin fecha') : '—'}</td>
              <td><div class="acciones">
                <button class="icon-btn" type="button" data-acc="ver" data-id="${v.id}" title="Ver detalle" aria-label="Ver detalle">${icon('eye')}</button>
                <button class="icon-btn" type="button" data-acc="historial" data-id="${v.id}" title="Historial" aria-label="Historial">${icon('clock')}</button>
                <button class="icon-btn" type="button" data-acc="editar" data-id="${v.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <button class="icon-btn" type="button" data-acc="estado" data-id="${v.id}" title="Cambiar estado" aria-label="Cambiar estado"${v.activo ? '' : ' disabled'}>${icon('pulse')}</button>
                <button class="icon-btn" type="button" data-acc="foto" data-id="${v.id}" title="Foto" aria-label="Subir foto">${icon('camera')}</button>
                <button class="icon-btn" type="button" data-acc="${v.activo ? 'baja' : 'reactivar'}" data-id="${v.id}" title="${v.activo ? 'Desactivar' : 'Reactivar'}" aria-label="${v.activo ? 'Desactivar' : 'Reactivar'}">${icon(v.activo ? 'ban' : 'undo')}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : UI.vacio('No hay vehículos que coincidan con la búsqueda.', 'car'))
  });

  async function actualizarResumenFlota() {
    const caja = $('#flotaResumen', c);
    try {
      const d = await resumenFlota();
      if (!ctx.vigente()) return;
      caja.innerHTML = `
        <button type="button" class="card flota-mini tono-green ${estadoPanel === 'DISPONIBLE' ? 'act' : ''}" data-flota-estado="DISPONIBLE" aria-pressed="${estadoPanel === 'DISPONIBLE'}"><span class="flota-mini-ico">${icon('check')}</span><span><small>Disponibles</small><b>${d.disponibles}</b><em>Listos para alquilar</em></span></button>
        <button type="button" class="card flota-mini tono-blue ${estadoPanel === 'ALQUILADO' ? 'act' : ''}" data-flota-estado="ALQUILADO" aria-pressed="${estadoPanel === 'ALQUILADO'}"><span class="flota-mini-ico">${icon('car')}</span><span><small>Alquilados</small><b>${d.alquilados}</b><em>Actualmente en uso</em></span></button>
        <button type="button" class="card flota-mini tono-orange ${estadoPanel === 'MANTENIMIENTO' ? 'act' : ''}" data-flota-estado="MANTENIMIENTO" aria-pressed="${estadoPanel === 'MANTENIMIENTO'}"><span class="flota-mini-ico">${icon('pulse')}</span><span><small>Mantenimiento</small><b>${d.mantenimiento}</b><em>Temporalmente no disponibles</em></span></button>
        <button type="button" class="card flota-mini tono-coral ${estadoPanel === 'FUERA_DE_SERVICIO' ? 'act' : ''}" data-flota-estado="FUERA_DE_SERVICIO" aria-pressed="${estadoPanel === 'FUERA_DE_SERVICIO'}"><span class="flota-mini-ico">${icon('alert')}</span><span><small>Fuera de servicio</small><b>${d.fuera}</b><em>Requieren atención</em></span></button>
        <button type="button" class="card flota-mini tono-gray ${estadoPanel === 'INACTIVO' ? 'act' : ''}" data-flota-estado="INACTIVO" aria-pressed="${estadoPanel === 'INACTIVO'}"><span class="flota-mini-ico">${icon('ban')}</span><span><small>Inactivos</small><b>${d.inactivos}</b><em>Vehículos desactivados</em></span></button>`;
    } catch (_) { caja.innerHTML = ''; }
  }

  $('#flotaResumen', c).addEventListener('click', e => {
    const b = e.target.closest('[data-flota-estado]');
    if (!b) return;
    const estado = b.dataset.flotaEstado;
    location.hash = estadoPanel === estado ? '#/flota' : `#/flota?estado=${estado}`;
  });

  const nuevaBusqueda = debounce(() => l.recargar(true));

  $('#qVeh', c).addEventListener('input', e => {
    filtros.texto = e.target.value.trim();
    nuevaBusqueda();
  });
  $('#catVeh', c).onchange = e => {
    filtros.categoriaId = e.target.value;
    l.recargar(true);
  };
  $('[data-nuevo-veh]').onclick = () => editarVehiculo(null, categorias, () => { l.recargar(); actualizarResumenFlota(); });
  $('#lista', c).addEventListener('click', async e => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const v = l.nodos().find(x => x.id === +b.dataset.id);
    if (!v) return;

    if (b.dataset.acc === 'ver') return detalleVehiculo(v, () => { l.recargar(); actualizarResumenFlota(); });
    if (b.dataset.acc === 'historial') return historialVehiculo(v);
    if (b.dataset.acc === 'editar') return editarVehiculo(v, categorias, () => { l.recargar(); actualizarResumenFlota(); });
    if (b.dataset.acc === 'estado') return estadoVehiculo(v, () => { l.recargar(); actualizarResumenFlota(); });
    if (b.dataset.acc === 'foto') return fotoVehiculo(v, () => l.recargar());
    if (b.dataset.acc === 'reactivar') {
      const ok = await UI.confirmar('Reactivar vehículo', `El <b>${esc(v.marca)} ${esc(v.modelo)}</b> (${esc(v.placa)}) volverá a estar disponible para la operación.`, { boton: 'Reactivar' });
      if (!ok) return;
      try {
        await Api.reactivarVehiculo(v.id);
        UI.toast('Vehículo reactivado.');
        l.recargar();
        actualizarResumenFlota();
      } catch (err) { avisarError(err); }
      return;
    }

    const ok = await UI.confirmar('Desactivar vehículo',
      `El <b>${esc(v.marca)} ${esc(v.modelo)}</b> (${esc(v.placa)}) dejará de aparecer en el catálogo. No es posible si tiene alquileres activos o futuros.`,
      { boton: 'Desactivar', peligro: true });
    if (!ok) return;

    try {
      await Api.desactivarVehiculo(v.id);
      UI.toast('Vehículo desactivado.');
      l.recargar();
      actualizarResumenFlota();
    } catch (err) {
      avisarError(err);
    }
  });

  try {
    categorias = await Api.categorias();
    if (ctx.vigente()) pintarCategorias();
  } catch (e) { /* el filtro queda vacío */ }

  actualizarResumenFlota();
  await l.recargar(true);

  const editarId = +ctx.q.get('editar');
  if (editarId) {
    try {
      const veh = await Api.vehiculo(editarId);
      if (ctx.vigente() && veh) editarVehiculo(veh, categorias, () => { cambiarQuery('flota', {}); l.recargar(); actualizarResumenFlota(); });
    } catch (_) { /* si no existe, se mantiene el listado */ }
  }
}

const COLORES_VEH = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Rojo', 'Azul', 'Verde', 'Beige', 'Marrón', 'Amarillo', 'Naranja', 'Otro'];
const TRANSMISIONES_VEH = [{ valor: 'AUTOMATICA', texto: 'Automática' }, { valor: 'MANUAL', texto: 'Manual' }];
const ESTADOS_INICIALES = ['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'];
const ICO_IMAGEN = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L6 21"/></svg>';

function editarVehiculo(v, categorias, alGuardar) {
  const tope = new Date().getFullYear() + 1;
  const nuevo = !v;
  const extra = !!Api.VEHICULO_EXTRA; // color, transmisión, capacidad y observaciones
  let archivo = null;
  let urlPrev = null;

  const m = UI.modal({
    titulo: nuevo ? 'Agregar nuevo vehículo' : 'Editar vehículo',
    ancho: 760,
    alCerrar: () => { if (urlPrev) URL.revokeObjectURL(urlPrev); },
    cuerpo: `
      <form class="form vh" id="fv" novalidate>
        <div class="vh-grid">
          ${UI.campo({ name: 'placa', label: 'Placa', value: v ? v.placa : '', requerido: true, placeholder: 'A123456', clase: 'c3', attrs: 'data-mascara="placa" maxlength="12"' })}
          ${UI.campo({ name: 'categoriaId', label: 'Categoría', tipo: 'select', requerido: true, value: v ? v.categoriaId : '', clase: 'c3', opciones: [{ valor: '', texto: 'Selecciona una categoría…' }].concat(categorias.map(x => ({ valor: x.id, texto: x.nombre }))) })}
          ${UI.campo({ name: 'marca', label: 'Marca', value: v ? v.marca : '', requerido: true, placeholder: 'Ej. Toyota', clase: 'c3' })}
          ${UI.campo({ name: 'modelo', label: 'Modelo', value: v ? v.modelo : '', requerido: true, placeholder: 'Ej. Corolla', clase: 'c3' })}
          ${UI.campo({ name: 'anio', label: 'Año', tipo: 'number', value: v ? v.anio : '', requerido: true, placeholder: 'Ej. 2023', clase: extra ? 'c2' : 'c3', attrs: `min="1950" max="${tope}" step="1"` })}
          ${extra ? `
            ${UI.campo({ name: 'color', label: 'Color', tipo: 'select', requerido: nuevo, value: v && v.color || '', clase: 'c2', opciones: [{ valor: '', texto: 'Selecciona un color…' }].concat(COLORES_VEH.map(x => ({ valor: x, texto: x }))) })}
            ${UI.campo({ name: 'transmision', label: 'Transmisión', tipo: 'select', requerido: nuevo, value: v && v.transmision || '', clase: 'c2', opciones: [{ valor: '', texto: 'Selecciona…' }].concat(TRANSMISIONES_VEH) })}
            ${UI.campo({ name: 'capacidad', label: 'Capacidad de pasajeros', tipo: 'number', requerido: nuevo, value: v && v.capacidad || '', placeholder: 'Ej. 5', clase: 'c3', attrs: 'min="1" max="60" step="1"' })}` : ''}
          ${UI.campo({ name: 'precioDia', label: 'Precio por día (RD$)', tipo: 'number', value: v ? v.precioDia : '', requerido: true, placeholder: 'Ej. 2500.00', clase: 'c3', attrs: 'min="0.01" step="0.01"' })}
          ${nuevo ? `
            ${UI.campo({ name: 'estado', label: 'Estado inicial', tipo: 'select', requerido: true, value: 'DISPONIBLE', clase: 'c3', opciones: ESTADOS_INICIALES.map(x => ({ valor: x, texto: etq(x) })) })}
            <div class="c3"></div>` : ''}

          <div class="campo ${extra ? 'c3' : 'c6'}">
            <label>Foto del vehículo${nuevo ? ' <i>*</i>' : ''}</label>
            <div class="dz" id="dz" role="button" tabindex="0" aria-label="Seleccionar foto del vehículo">
              <div class="dz-prev" id="dzPrev"></div>
              <div class="dz-txt">
                ${ICO_IMAGEN}
                <b>Arrastra una imagen aquí</b>
                <span>o haz clic para seleccionar</span>
                <small>JPG, PNG (máx. 5 MB)</small>
              </div>
            </div>
            <input type="file" id="vhFoto" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden>
            <span class="err" id="errFoto"></span>
          </div>

          ${extra ? `
            <div class="campo c3">
              <label for="vhObs">Observaciones</label>
              <div class="vh-obs">
                <textarea id="vhObs" name="observaciones" maxlength="500" placeholder="Información adicional del vehículo...">${esc(v && v.observaciones || '')}</textarea>
                <span class="vh-cont" id="vhCont">0/500</span>
              </div>
            </div>` : ''}
        </div>

        ${formErr}
        <div class="modal-acc vh-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit">${icon('car')} ${nuevo ? 'Guardar vehículo' : 'Guardar cambios'}</button>
        </div>
      </form>`
  });

  const f = $('#fv', m.el);

  // Subtítulo bajo el título
  const h3 = $('.modal-h h3', m.el);
  if (h3) {
    const cab = document.createElement('div');
    h3.replaceWith(cab);
    cab.append(h3);
    cab.insertAdjacentHTML('beforeend', `<p class="modal-sub">${nuevo ? 'Completa la información del vehículo para incluirlo en la flota.' : 'Actualiza los datos del vehículo.'}</p>`);
  }

  // Iconos dentro de los campos
  const prefijo = (nombre, html) => {
    const el = f.elements[nombre];
    if (!el) return;
    const w = document.createElement('div');
    w.className = 'con-pref';
    el.replaceWith(w);
    w.insertAdjacentHTML('afterbegin', `<span class="pref">${html}</span>`);
    w.appendChild(el);
    return w;
  };

  prefijo('capacidad', icon('users'));
  prefijo('precioDia', '$');

  if (nuevo) {
    const w = prefijo('estado', '<i class="pe pe-DISPONIBLE"></i>');
    f.estado.onchange = () => { $('.pe', w).className = 'pe pe-' + f.estado.value; };
  }

  // Contador de observaciones
  if (extra) {
    const t = $('#vhObs', f);
    const cont = $('#vhCont', f);
    const cuenta = () => { cont.textContent = `${t.value.length}/500`; };
    t.addEventListener('input', cuenta);
    cuenta();
  }

  // Foto: clic, teclado o arrastrar y soltar
  const dz = $('#dz', f);
  const inputFoto = $('#vhFoto', f);
  const errFoto = $('#errFoto', f);

  const pintarFoto = src => {
    $('#dzPrev', f).innerHTML = src ? `<img src="${esc(src)}" alt="Vista previa">` : '';
    dz.classList.toggle('tiene', !!src);
  };

  if (v && v.fotoUrl) pintarFoto(Api.media(v.fotoUrl));

  function elegirFoto(file) {
    errFoto.textContent = '';
    if (!file) return;

    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) { errFoto.textContent = 'Formato no permitido. Usa JPG, PNG o WEBP.'; return; }
    if (file.size > 5 * 1024 * 1024) { errFoto.textContent = 'La imagen supera 5 MB.'; return; }

    if (urlPrev) URL.revokeObjectURL(urlPrev);
    urlPrev = URL.createObjectURL(file);
    archivo = file;
    pintarFoto(urlPrev);
  }

  dz.onclick = () => inputFoto.click();
  dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputFoto.click(); } };
  inputFoto.onchange = () => { elegirFoto(inputFoto.files[0]); inputFoto.value = ''; };

  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('sobre'); }));
  ['dragleave', 'dragend'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('sobre')));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('sobre');
    elegirFoto(e.dataTransfer && e.dataTransfer.files[0]);
  });

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);
    errFoto.textContent = '';

    const d = UI.datos(f);
    const placa = (d.placa || '').toUpperCase().replace(/[\s-]/g, '');
    const anio = +d.anio;
    const precio = +d.precioDia;
    const cap = d.capacidad ? +d.capacidad : null;

    if (!placa) return UI.errorCampo(f, 'placa', 'La placa es obligatoria.');
    if (!d.categoriaId) return UI.errorCampo(f, 'categoriaId', 'Selecciona una categoría.');
    if (!d.marca) return UI.errorCampo(f, 'marca', 'La marca es obligatoria.');
    if (!d.modelo) return UI.errorCampo(f, 'modelo', 'El modelo es obligatorio.');
    if (!(Number.isInteger(anio) && anio >= 1950 && anio <= tope)) return UI.errorCampo(f, 'anio', `El año debe estar entre 1950 y ${tope}.`);

    if (extra) {
      if (nuevo && !d.color) return UI.errorCampo(f, 'color', 'Selecciona un color.');
      if (nuevo && !d.transmision) return UI.errorCampo(f, 'transmision', 'Selecciona la transmisión.');
      if ((nuevo || cap != null) && !(Number.isInteger(cap) && cap >= 1 && cap <= 60)) return UI.errorCampo(f, 'capacidad', 'Indica la capacidad (1 a 60 pasajeros).');
    }

    if (!(precio > 0)) return UI.errorCampo(f, 'precioDia', 'El precio debe ser mayor que 0.');

    if (nuevo && !archivo) {
      errFoto.textContent = 'Selecciona una foto del vehículo.';
      return dz.focus();
    }

    const input = { placa, categoriaId: +d.categoriaId, marca: d.marca, modelo: d.modelo, anio, precioDia: precio };

    if (extra) {
      Object.assign(input, {
        color: d.color || null,
        transmision: d.transmision || null,
        capacidad: cap,
        observaciones: ($('#vhObs', f).value || '').trim() || null
      });
    }

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    const avisos = [];

    try {
      let id;

      if (v) {
        await Api.actualizarVehiculo(v.id, input);
        id = v.id;
      } else {
        const creado = await Api.crearVehiculo(input);
        id = creado.id;

        if (d.estado && d.estado !== 'DISPONIBLE') {
          try {
            await Api.cambiarEstadoVehiculo({ vehiculoId: id, estado: d.estado, mantenimientoHasta: null });
          } catch (e2) {
            avisos.push('no se pudo fijar el estado inicial');
          }
        }
      }

      if (archivo) {
        try {
          await Api.subirFotoVehiculo(id, archivo);
        } catch (e3) {
          avisos.push('no se pudo subir la foto (puedes hacerlo desde la flota)');
        }
      }

      m.cerrar();
      UI.toast(v ? 'Vehículo actualizado.' : 'Vehículo creado.');
      if (avisos.length) UI.toast('Atención: ' + avisos.join(' y ') + '.', 'warn');
      alGuardar();
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err, { PLACA_DUPLICADA: 'placa' });
    }
  };
}

function estadoVehiculo(v, alGuardar) {
  if (v.estadoActual === 'ALQUILADO') {
    UI.modal({
      titulo: 'Cambiar estado',
      ancho: 460,
      cuerpo: `
        <div class="info-banda">${icon('info')}<span>El <b>${esc(v.marca)} ${esc(v.modelo)}</b> está alquilado. Registra la devolución antes de cambiar su estado.</span></div>
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cerrar</button>
          <a class="btn" href="#/alquileres?filtro=activos" data-cerrar>Ir a alquileres</a>
        </div>`
    });
    return;
  }

  const m = UI.modal({
    titulo: 'Cambiar estado',
    ancho: 480,
    cuerpo: `
      <p class="texto">${esc(v.marca)} ${esc(v.modelo)} · ${esc(v.placa)} — estado actual: ${badge(v.estadoActual)}</p>
      <form class="form" id="fe" novalidate>
        ${UI.campo({
          name: 'estado', label: 'Nuevo estado', tipo: 'select', value: v.estadoOperativo,
          opciones: ['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'].map(x => ({ valor: x, texto: etq(x) }))
        })}
        <div data-hasta>
          ${UI.campo({ name: 'mantenimientoHasta', label: 'En mantenimiento hasta (opcional)', tipo: 'date', value: v.mantenimientoHasta || '', attrs: `min="${hoy()}"`, ayuda: 'Si lo dejas vacío, seguirá en mantenimiento hasta que lo cambies.' })}
        </div>
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit">Guardar estado</button>
        </div>
      </form>`
  });

  const f = $('#fe', m.el);
  const ver = () => { $('[data-hasta]', f).hidden = f.estado.value !== 'MANTENIMIENTO'; };
  f.estado.onchange = ver;
  ver();

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);
    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      await Api.cambiarEstadoVehiculo({
        vehiculoId: v.id,
        estado: f.estado.value,
        mantenimientoHasta: f.estado.value === 'MANTENIMIENTO' ? f.mantenimientoHasta.value || null : null
      });

      m.cerrar();
      UI.toast('Estado actualizado.');
      alGuardar();
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err);
    }
  };
}

function fotoVehiculo(v, alGuardar) {
  const m = UI.modal({
    titulo: 'Foto del vehículo',
    ancho: 480,
    cuerpo: `
      <div class="preview-foto" id="prev">${fotoVeh(v)}</div>
      <form class="form" id="ff" novalidate>
        ${UI.campo({ name: 'foto', label: 'Imagen', tipo: 'file', attrs: 'accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"', ayuda: 'JPG, JPEG, PNG o WEBP. Máximo 5 MB.' })}
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit" disabled>Subir foto</button>
        </div>
      </form>`,
    alCerrar: () => { if (url) URL.revokeObjectURL(url); }
  });

  const f = $('#ff', m.el);
  const btn = $('[type=submit]', f);
  let url = null;

  f.foto.onchange = () => {
    UI.limpiarErrores(f);
    btn.disabled = true;
    const file = f.foto.files[0];
    if (!file) return;

    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) return UI.errorCampo(f, 'foto', 'Formato no permitido. Usa JPG, JPEG, PNG o WEBP.');
    if (file.size > 5 * 1024 * 1024) return UI.errorCampo(f, 'foto', 'La imagen supera 5 MB.');

    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    $('#prev', m.el).innerHTML = `<img src="${url}" alt="Vista previa">`;
    btn.disabled = false;
  };

  f.onsubmit = async e => {
    e.preventDefault();
    const file = f.foto.files[0];
    if (!file) return;
    UI.ocupado(btn, true);

    try {
      await Api.subirFotoVehiculo(v.id, file);
      m.cerrar();
      UI.toast('Foto actualizada.');
      alGuardar();
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err);
    }
  };
}

function nuevaCategoria(alGuardar) {
  const m = UI.modal({
    titulo: 'Nueva categoría',
    ancho: 440,
    cuerpo: `
      <form class="form" id="fc" novalidate>
        ${UI.campo({ name: 'nombre', label: 'Nombre', placeholder: 'Ej.: Pickup' })}
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit">Crear categoría</button>
        </div>
      </form>`
  });

  const f = $('#fc', m.el);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);
    const { nombre } = UI.datos(f);
    if (!nombre) return UI.errorCampo(f, 'nombre', 'Escribe el nombre de la categoría.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const cat = await Api.crearCategoria(nombre);
      m.cerrar();
      UI.toast('Categoría creada.');
      alGuardar(cat);
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err, { CATEGORIA_DUPLICADA: 'nombre' });
    }
  };
}


/* =========================================================
   CONFIGURACIÓN
========================================================= */

async function vConfiguracion(c, ctx) {
  let categorias = [];

  c.innerHTML = `
    <div class="config-grid">
      <section class="card config-card">
        <div class="config-card-h">
          <div>
            <span class="config-card-ico">${icon('tag')}</span>
            <div>
              <h3>Categorías de vehículos</h3>
              <p>Organiza la flota por tipo de vehículo. Estas categorías se utilizan al registrar y filtrar vehículos.</p>
            </div>
          </div>
          <button class="btn sm" type="button" data-config-nueva-cat>${icon('plus')} Nueva categoría</button>
        </div>
        <div class="categorias-lista" id="configCategorias"><span class="skeleton" style="height:44px"></span></div>
      </section>

      <aside class="card config-info">
        <h3>Configuración del sistema</h3>
        <p>Este módulo concentrará los parámetros administrativos que no forman parte de la operación diaria. Por ahora comenzamos con las categorías de la flota.</p>
        <div class="info-banda">${icon('info')}<span>Crear una categoría aquí la hará disponible inmediatamente al crear o editar un vehículo.</span></div>
      </aside>
    </div>`;

  const lista = $('#configCategorias', c);

  const pintar = () => {
    lista.innerHTML = categorias.length ? categorias.map(cat => `
      <div class="categoria-item">
        <div><span class="categoria-dot"></span><b>${esc(cat.nombre)}</b></div>
        <small>ID ${esc(cat.id)}</small>
      </div>`).join('') : UI.vacio('No hay categorías registradas.', 'tag');
  };

  const cargar = async () => {
    try {
      categorias = await Api.categorias();
      if (ctx.vigente()) pintar();
    } catch (err) {
      lista.innerHTML = UI.vacio('No se pudieron cargar las categorías.', 'alert');
    }
  };

  $('[data-config-nueva-cat]', c).onclick = () => nuevaCategoria(cat => {
    categorias.push(cat);
    categorias.sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    pintar();
  });

  await cargar();
}


/* =========================================================
   CLIENTES
========================================================= */

async function resumenClientes() {
  const r = await Api.clientes({ incluirInactivos: true, first: 200 });
  const lista = r.nodes || [];
  return {
    total: lista.length,
    activos: lista.filter(x => x.activo !== false).length,
    portal: lista.filter(x => x.activo !== false && x.tieneCuenta).length,
    mostrador: lista.filter(x => x.activo !== false && !x.tieneCuenta).length,
    inactivos: lista.filter(x => x.activo === false).length
  };
}

async function panelClientesFiltro({ filtro = 'todos', texto = '', first = 12, after = null, last = null, before = null }) {
  const r = await Api.clientes({ texto: texto || null, incluirInactivos: true, first: 200 });
  let lista = r.nodes || [];
  if (filtro === 'activos') lista = lista.filter(x => x.activo !== false);
  else if (filtro === 'portal') lista = lista.filter(x => x.activo !== false && x.tieneCuenta);
  else if (filtro === 'mostrador') lista = lista.filter(x => x.activo !== false && !x.tieneCuenta);
  else if (filtro === 'inactivos') lista = lista.filter(x => x.activo === false);
  else lista = lista.filter(x => x.activo !== false);

  const cantidad = last || first;
  const inicio = before !== null ? Math.max(0, Number(before) - cantidad) : Number(after) || 0;
  const nodes = lista.slice(inicio, inicio + cantidad);
  return {
    nodes,
    totalCount: lista.length,
    pageInfo: {
      hasNextPage: inicio + cantidad < lista.length,
      endCursor: String(inicio + cantidad),
      hasPreviousPage: inicio > 0,
      startCursor: String(inicio)
    }
  };
}

async function detalleCliente(x) {
  const m = UI.modal({
    titulo: 'Detalle del cliente',
    ancho: 760,
    cuerpo: `<div class="historial-veh-cargando"><span class="skeleton"></span><p>Cargando información del cliente…</p></div>`
  });

  try {
    const [cl, alq] = await Promise.all([
      Api.cliente(x.id),
      Api.alquileres({ clienteId: x.id, first: 100 })
    ]);
    const lista = [...(alq.nodes || [])].sort((a,b) => String(b.fechaCreacion || b.fechaInicio).localeCompare(String(a.fechaCreacion || a.fechaInicio)));
    const activos = lista.filter(a => estadoOperativoAlquiler(a).clave === 'activo').length;
    const reservas = lista.filter(a => estadoOperativoAlquiler(a).clave === 'reserva').length;
    const completados = lista.filter(a => a.estado === 'COMPLETADO').length;

    m.cuerpo.innerHTML = `
      <div class="detalle-cliente-head">
        <div class="detalle-cliente-avatar">${UI.avatar(cl.nombre, 'lg')}</div>
        <div class="detalle-cliente-identidad">
          <span class="eyebrow">CLIENTE #${cl.id}</span>
          <h3>${esc(cl.nombre)}</h3>
          <p>${esc(cl.cedula)}</p>
          <div class="badges">
            ${cl.activo !== false ? badge(null, 'Activo', 'ok') : badge(null, 'Inactivo', 'neutro')}
            ${cl.tieneCuenta ? badge(null, 'Portal', 'info') : badge(null, 'Mostrador', 'neutro')}
          </div>
        </div>
      </div>

      <div class="detalle-cliente-grid">
        <div><small>Teléfono</small><b>${esc(cl.telefono || '—')}</b></div>
        <div><small>Correo</small><b>${esc(cl.correo || '—')}</b></div>
        <div><small>Licencia de conducir</small><b>${esc(cl.licenciaConducir || 'No registrada')}</b></div>
        <div><small>Tipo de cliente</small><b>${cl.tieneCuenta ? 'Portal' : 'Mostrador'}</b></div>
      </div>

      <div class="cliente-resumen-modal">
        <div><small>Alquileres</small><b>${lista.length}</b></div>
        <div><small>Activos</small><b>${activos}</b></div>
        <div><small>Reservas</small><b>${reservas}</b></div>
        <div><small>Completados</small><b>${completados}</b></div>
      </div>

      <section class="cliente-historial-seccion">
        <div class="seccion-titulo"><div><span class="eyebrow">Actividad</span><h4>Alquileres recientes</h4></div><a class="btn ghost sm" href="#/alquileres?cliente=${cl.id}&nombre=${encodeURIComponent(cl.nombre)}" data-cerrar>Ver todos</a></div>
        <div class="cliente-historial-lista">
          ${lista.length ? lista.slice(0, 6).map(a => `
            <article class="cliente-historial-item">
              <div class="cliente-historial-main"><b>#${a.id} · ${esc(a.vehiculo)}</b><span>${esc(a.placa)} · ${fmt.fecha(a.fechaInicio)} → ${fmt.fecha(a.fechaDevolucion || a.fechaFinPactada)}</span></div>
              <div class="cliente-historial-fin">${estadoAlquiler(a)}<b>${fmt.dinero(a.montoTotal)}</b></div>
            </article>`).join('') : UI.vacio('Este cliente todavía no tiene alquileres registrados.', 'calendar')}
        </div>
      </section>

      <div class="modal-acc">
        ${cl.activo !== false ? `<a class="btn ghost" href="#/nuevo-alquiler?cliente=${cl.id}" data-cerrar>${icon('plusCircle')} Nuevo alquiler</a>` : ''}
        <button class="btn ghost" type="button" data-editar-cliente>${icon('edit')} Editar</button>
        <button class="btn" type="button" data-cerrar>Cerrar</button>
      </div>`;

    const editar = $('[data-editar-cliente]', m.el);
    if (editar) editar.onclick = () => {
      m.cerrar();
      editarCliente(cl, () => { location.hash = '#/clientes'; });
    };
  } catch (err) {
    m.cuerpo.innerHTML = `<div class="vacio"><h4>No se pudo cargar el cliente</h4><p>${esc(err.message || 'Inténtalo de nuevo.')}</p></div>`;
  }
}

async function vClientes(c, ctx) {
  let filtro = ['todos','activos','portal','mostrador','inactivos'].includes(ctx.q.get('filtro')) ? ctx.q.get('filtro') : 'todos';
  const filtros = { texto: '' };

  ctx.acciones(`<button class="btn" type="button" data-nuevo-cli>${icon('plus')} Nuevo cliente</button>`);

  c.innerHTML = `
    <div class="clientes-resumen" id="clientesResumen">
      ${Array.from({length:4}, () => '<div class="card cliente-mini"><span class="skeleton"></span></div>').join('')}
    </div>

    <div class="herramientas cliente-herramientas">
      <div class="segmentos" role="tablist" aria-label="Filtrar clientes">
        <button type="button" data-cf="todos">Todos</button>
        <button type="button" data-cf="activos">Activos</button>
        <button type="button" data-cf="portal">Portal</button>
        <button type="button" data-cf="mostrador">Mostrador</button>
        <button type="button" data-cf="inactivos">Inactivos</button>
      </div>
    </div>

    <div class="card cliente-filtros">
      <div class="buscar">${icon('search')}<input type="search" id="qCli" placeholder="Buscar por nombre, cédula o correo" aria-label="Buscar cliente" autocomplete="off"></div>
      <button class="btn ghost sm" type="button" id="limpiarCli">Limpiar</button>
    </div>
    <div class="card" id="lista"></div>`;

  const marcar = () => $$('[data-cf]', c).forEach(b => {
    b.classList.toggle('act', b.dataset.cf === filtro);
    b.setAttribute('aria-selected', b.dataset.cf === filtro);
  });

  const l = listado({
    cont: $('#lista', c),
    vigente: ctx.vigente,
    cargar: pag => panelClientesFiltro({ filtro, texto: filtros.texto, ...pag }),
    pintar: r => (r.nodes.length ? `
      <div class="tabla-wrap">
        <table class="tabla tabla-clientes">
          <thead><tr><th>Cliente</th><th>Cédula</th><th>Teléfono</th><th>Cuenta</th><th>Estado</th><th></th></tr></thead>
          <tbody>${r.nodes.map(x => `
            <tr class="${x.activo !== false ? '' : 'inactivo fila-cliente-inactivo'}">
              <td><div class="cliente-celda">${UI.avatar(x.nombre, 'sm')}
                <div class="principal"><b>${esc(x.nombre)}</b><small>${esc(x.correo || 'Sin correo')}</small></div></div></td>
              <td class="nowrap">${esc(x.cedula)}</td>
              <td class="nowrap">${esc(x.telefono || '—')}</td>
              <td>${x.tieneCuenta ? badge(null, 'Portal', 'info') : badge(null, 'Mostrador', 'neutro')}</td>
              <td>${x.activo !== false ? badge(null, 'Activo', 'ok') : badge(null, 'Inactivo', 'neutro')}</td>
              <td><div class="acciones">
                <button class="icon-btn" type="button" data-acc="ver" data-id="${x.id}" title="Ver detalle" aria-label="Ver detalle">${icon('eye')}</button>
                <button class="icon-btn" type="button" data-acc="editar" data-id="${x.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <a class="icon-btn" href="#/alquileres?cliente=${x.id}&nombre=${encodeURIComponent(x.nombre)}" title="Ver alquileres" aria-label="Ver alquileres">${icon('calendar')}</a>
                <a class="icon-btn" href="#/nuevo-alquiler?cliente=${x.id}" title="Nuevo alquiler" aria-label="Nuevo alquiler"${x.activo !== false ? '' : ' hidden'}>${icon('plusCircle')}</a>
                <button class="icon-btn" type="button" data-acc="baja" data-id="${x.id}" title="Desactivar" aria-label="Desactivar"${x.activo !== false ? '' : ' disabled'}>${icon('ban')}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : UI.vacio('No hay clientes que coincidan con la búsqueda.', 'users'))
  });

  async function actualizarResumenClientes() {
    const caja = $('#clientesResumen', c);
    try {
      const d = await resumenClientes();
      if (!ctx.vigente()) return;
      caja.innerHTML = `
        <button type="button" class="card cliente-mini tono-blue" data-cr="activos"><span class="cliente-mini-ico">${icon('users')}</span><span><small>Activos</small><b>${d.activos}</b><em>Clientes habilitados</em></span></button>
        <button type="button" class="card cliente-mini tono-purple" data-cr="portal"><span class="cliente-mini-ico">${icon('user')}</span><span><small>Portal</small><b>${d.portal}</b><em>Con cuenta en línea</em></span></button>
        <button type="button" class="card cliente-mini tono-green" data-cr="mostrador"><span class="cliente-mini-ico">${icon('check')}</span><span><small>Mostrador</small><b>${d.mostrador}</b><em>Registro presencial</em></span></button>
        <button type="button" class="card cliente-mini tono-gray" data-cr="inactivos"><span class="cliente-mini-ico">${icon('ban')}</span><span><small>Inactivos</small><b>${d.inactivos}</b><em>Sin acceso operativo</em></span></button>`;
      $$('[data-cr]', caja).forEach(b => b.classList.toggle('activa', b.dataset.cr === filtro));
    } catch (_) { caja.innerHTML = ''; }
  }

  const recargar = () => { l.recargar(true); actualizarResumenClientes(); };
  const nuevaBusqueda = debounce(() => l.recargar(true), 220);

  $('#qCli', c).addEventListener('input', e => { filtros.texto = e.target.value.trim(); nuevaBusqueda(); });
  $('#limpiarCli', c).onclick = () => { filtros.texto = ''; $('#qCli', c).value = ''; l.recargar(true); };

  $('[data-nuevo-cli]').onclick = () => editarCliente(null, () => recargar());

  c.addEventListener('click', e => {
    const f = e.target.closest('[data-cf]');
    if (f) {
      filtro = f.dataset.cf;
      marcar();
      history.replaceState(null, '', '#/clientes' + (filtro !== 'todos' ? '?filtro=' + filtro : ''));
      l.recargar(true); actualizarResumenClientes(); return;
    }
    const r = e.target.closest('[data-cr]');
    if (r) {
      filtro = filtro === r.dataset.cr ? 'todos' : r.dataset.cr;
      marcar();
      history.replaceState(null, '', '#/clientes' + (filtro !== 'todos' ? '?filtro=' + filtro : ''));
      l.recargar(true); actualizarResumenClientes();
    }
  });

  $('#lista', c).addEventListener('click', async e => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const x = l.nodos().find(y => y.id === +b.dataset.id);
    if (!x) return;

    if (b.dataset.acc === 'ver') return detalleCliente(x);
    if (b.dataset.acc === 'editar') return editarCliente(x, () => recargar());

    const ok = await UI.confirmar('Desactivar cliente',
      `<b>${esc(x.nombre)}</b> quedará inactivo${x.tieneCuenta ? ' y su cuenta del portal se desactivará' : ''}. No es posible si tiene alquileres activos.`,
      { boton: 'Desactivar', peligro: true });
    if (!ok) return;

    try {
      await Api.desactivarCliente(x.id);
      UI.toast('Cliente desactivado.');
      recargar();
    } catch (err) { avisarError(err); }
  });

  marcar();
  await Promise.all([l.recargar(true), actualizarResumenClientes()]);
}

function editarCliente(x, alGuardar) {
  const m = UI.modal({
    titulo: x ? 'Editar cliente' : 'Nuevo cliente',
    cuerpo: `
      <form class="form" id="fc" novalidate>
        <div class="grid2">
          ${UI.campo({ name: 'nombre', label: 'Nombre completo', value: x ? x.nombre : '', requerido: true, clase: 'todo' })}
          ${UI.campo({ name: 'cedula', label: 'Cédula', value: x ? x.cedula : '', requerido: true, placeholder: '000-0000000-0', attrs: 'inputmode="numeric" data-mascara="cedula"' })}
          ${UI.campo({ name: 'telefono', label: 'Teléfono', tipo: 'tel', value: x ? x.telefono || '' : '', placeholder: '809-000-0000', attrs: 'data-mascara="telefono"' })}
          ${UI.campo({ name: 'correo', label: 'Correo electrónico', tipo: 'email', value: x ? x.correo || '' : '', clase: 'todo' })}
          ${UI.campo({ name: 'licenciaConducir', label: 'Licencia de conducir', value: x ? x.licenciaConducir || '' : '', clase: 'todo' })}
        </div>
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit">${x ? 'Guardar cambios' : 'Registrar cliente'}</button>
        </div>
      </form>`
  });

  const f = $('#fc', m.el);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);
    if (!d.nombre) return UI.errorCampo(f, 'nombre', 'El nombre es obligatorio.');
    if (d.cedula.replace(/\D/g, '').length !== 11) return UI.errorCampo(f, 'cedula', 'La cédula debe tener 11 dígitos.');
    if (d.correo && !UI.correoValido(d.correo)) return UI.errorCampo(f, 'correo', 'El correo no tiene un formato válido.');

    const input = {
      nombre: d.nombre,
      cedula: d.cedula,
      correo: d.correo || null,
      telefono: d.telefono || null,
      licenciaConducir: d.licenciaConducir || null
    };

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const r = x ? await Api.actualizarCliente(x.id, input) : await Api.crearCliente(input);
      m.cerrar();
      UI.toast(x ? 'Cliente actualizado.' : 'Cliente registrado.');
      alGuardar(r);
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err, { CEDULA_DUPLICADA: 'cedula', CORREO_DUPLICADO: 'correo' });
    }
  };
}


/* =========================================================
   FACTURACIÓN
========================================================= */

async function vFacturas(c, ctx) {
  const filtros = { desde: ctx.q.get('desde') || '', hasta: ctx.q.get('hasta') || '' };

  c.innerHTML = `
    <form class="herramientas con-campos" id="ff" novalidate>
      ${UI.campo({ name: 'desde', label: 'Desde', tipo: 'date', value: filtros.desde })}
      ${UI.campo({ name: 'hasta', label: 'Hasta', tipo: 'date', value: filtros.hasta })}
      <button class="btn ghost" type="button" data-limpiar>Limpiar</button>
    </form>
    <div class="card" id="lista"></div>`;

  const f = $('#ff', c);

  const l = listado({
    cont: $('#lista', c),
    vigente: ctx.vigente,
    porPagina: 15,
    cargar: pag => Api.facturas({ desde: filtros.desde || null, hasta: filtros.hasta || null, ...pag }),
    pintar: r => (r.nodes.length ? tablaFacturas(r.nodes, true) : UI.vacio('No hay facturas en ese período.', 'receipt'))
  });

  const aplicar = () => {
    UI.limpiarErrores(f);
    filtros.desde = f.desde.value;
    filtros.hasta = f.hasta.value;

    if (filtros.desde && filtros.hasta && filtros.hasta < filtros.desde) {
      return UI.errorCampo(f, 'hasta', 'Debe ser igual o posterior a "Desde".');
    }

    cambiarQuery('facturas', filtros);
    l.recargar(true);
  };

  f.desde.onchange = aplicar;
  f.hasta.onchange = aplicar;
  f.onsubmit = e => {
    e.preventDefault();
    aplicar();
  };

  $('[data-limpiar]', f).onclick = () => {
    f.desde.value = '';
    f.hasta.value = '';
    aplicar();
  };

  await l.recargar(true);
}


/* =========================================================
   ADMINISTRADORES
========================================================= */

function vAdministradoresBasico(c) {
  const generar = () => {
    const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '23456789';
    const todo = letras + nums;
    const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    let p = letras[r(letras.length)] + nums[r(nums.length)];
    while (p.length < 12) p += todo[r(todo.length)];
    return p.split('').sort(() => r(3) - 1).join('');
  };

  c.innerHTML = `
    <div class="dos-col">
      <section class="card">
        <div class="card-h"><h3>Nuevo administrador</h3></div>
        <form class="form" id="fa" novalidate>
          ${UI.campo({ name: 'nombre', label: 'Nombre completo', requerido: true })}
          ${UI.campo({ name: 'correo', label: 'Correo electrónico', tipo: 'email', requerido: true, attrs: 'autocomplete="off"' })}
          <div class="campo" data-campo="passwordTemporal">
            <label for="pt">Contraseña temporal <i>*</i></label>
            <div style="display:flex;gap:10px">
              <div class="con-boton" style="flex:1">
                <input id="pt" name="passwordTemporal" type="password" autocomplete="new-password">
                <button type="button" class="ver-pass" data-ver-pass aria-label="Mostrar contraseña">${icon('eye')}</button>
              </div>
              <button class="btn ghost" type="button" data-generar>Generar</button>
            </div>
            <small class="ayuda">Mínimo 8 caracteres, con letras y números.</small>
            <small class="err"></small>
          </div>
          ${formErr}
          <div><button class="btn" type="submit">${icon('shield')} Crear administrador</button></div>
        </form>
        <div id="ok" style="margin-top:16px"></div>
      </section>

      <section class="card">
        <div class="card-h"><h3>Cómo funciona</h3></div>
        <div class="lista">
          <div class="item"><span class="avatar sm">1</span><div><b>Crea la cuenta</b><small>Con nombre, correo y una contraseña temporal.</small></div></div>
          <div class="item"><span class="avatar sm">2</span><div><b>Comparte el acceso</b><small>Entrega la contraseña temporal por un medio seguro.</small></div></div>
          <div class="item"><span class="avatar sm">3</span><div><b>Primer inicio de sesión</b><small>El sistema le pedirá cambiarla antes de continuar.</small></div></div>
        </div>
      </section>
    </div>`;

  const f = $('#fa', c);

  $('[data-generar]', f).onclick = () => {
    f.passwordTemporal.value = generar();
    f.passwordTemporal.type = 'text';
    $('[data-ver-pass]', f).innerHTML = icon('eyeOff');
  };

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);
    $('#ok', c).innerHTML = '';

    const d = UI.datos(f);
    if (!d.nombre) return UI.errorCampo(f, 'nombre', 'El nombre es obligatorio.');
    if (!UI.correoValido(d.correo)) return UI.errorCampo(f, 'correo', 'Escribe un correo válido.');
    if (!UI.passwordValida(d.passwordTemporal)) return UI.errorCampo(f, 'passwordTemporal', 'Mínimo 8 caracteres, con letras y números.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const u = await Api.crearAdministrador({ nombre: d.nombre, correo: d.correo, passwordTemporal: d.passwordTemporal });
      $('#ok', c).innerHTML = `
        <div class="form-ok">${icon('check')}
          <div><b>${esc(u.nombre)}</b> ya puede entrar con <b>${esc(u.correo)}</b>.
          Deberá cambiar la contraseña temporal en su primer inicio de sesión.</div>
        </div>`;
      f.reset();
      f.passwordTemporal.type = 'password';
    } catch (err) {
      errorEnForm(f, err, { CORREO_DUPLICADO: 'correo' });
    } finally {
      UI.ocupado(btn, false);
    }
  };
}


/* =========================================================
   ADMINISTRADORES (gestión completa: lista, rol y estado)
========================================================= */

const PERFILES_ADM = ['Administrador', 'Facturación', 'Operaciones', 'Soporte'];
const SLUG_PERFIL = { 'Administrador': 'admin', 'Facturación': 'fact', 'Operaciones': 'oper', 'Soporte': 'sop' };

const svgAdm = d => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICO_ADM = {
  userPlus: svgAdm('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
  key: svgAdm('<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>'),
  trash: svgAdm('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>'),
  refresh: svgAdm('<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M16 16h5v5"/>'),
  bulb: svgAdm('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>'),
  shieldOk: svgAdm('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  file: svgAdm('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  copy: svgAdm('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>')
};

function claveTemporal() {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const nums = '23456789';
  const simb = '#@$%&*!?';
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const pick = s => s[r(s.length)];
  const p = [pick(letras), pick(letras.toUpperCase()), pick(nums), pick(nums), pick(simb)];

  while (p.length < 10) p.push(pick(letras + letras.toUpperCase() + nums));

  for (let i = p.length - 1; i > 0; i--) {
    const j = r(i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }

  return p.join('');
}

async function copiarTexto(t) {
  try {
    await navigator.clipboard.writeText(t);
    UI.toast('Copiado al portapapeles.');
  } catch (e) {
    UI.toast('No se pudo copiar. Selecciónala y cópiala manualmente.', 'warn');
  }
}

function prefijoCampo(f, nombre, html) {
  const el = f.elements[nombre];
  if (!el) return null;

  const w = document.createElement('div');
  w.className = 'con-pref';
  el.replaceWith(w);
  w.insertAdjacentHTML('afterbegin', `<span class="pref">${html}</span>`);
  w.appendChild(el);

  return w;
}

function modalClaveTemporal({ titulo, nombre, correo, clave, forzar = true }) {
  const m = UI.modal({
    titulo,
    ancho: 460,
    cuerpo: `
      <div class="exito">
        <div class="sello">${icon('check')}</div>
        <h4>${esc(nombre)}</h4>
        <p>Comparte esta contraseña temporal por un medio seguro.${forzar ? ' Deberá cambiarla al iniciar sesión.' : ''}</p>
        <div class="clave-caja"><code>${esc(clave)}</code><button type="button" class="btn ghost sm" data-copiar>${ICO_ADM.copy} Copiar</button></div>
        <small class="clave-correo">${esc(correo)}</small>
        <div class="modal-acc"><button class="btn" type="button" data-cerrar>Listo</button></div>
      </div>`
  });

  $('[data-copiar]', m.el).onclick = () => copiarTexto(clave);
}

const rolTag = p => `<span class="rol-tag rol-${SLUG_PERFIL[p] || 'admin'}">${esc(p || 'Administrador')}</span>`;
const estadoAdm = a => (a.activo ? badge(null, 'Activo', 'ok') : badge(null, 'Inactivo', 'bad'));

function verAdmin(a) {
  UI.modal({
    titulo: 'Detalle del administrador',
    ancho: 480,
    cuerpo: `
      <div class="perfil-cab">
        ${UI.avatar(a.nombre, 'lg')}
        <div><h2>${esc(a.nombre)}</h2><p>${esc(a.correo)}</p></div>
      </div>
      <dl class="dl">
        <dt>Rol</dt><dd>${rolTag(a.perfil)}</dd>
        <dt>Estado</dt><dd>${estadoAdm(a)}</dd>
        <dt>Último acceso</dt><dd>${a.ultimoAcceso ? fmt.fechaHora(a.ultimoAcceso) : 'Nunca'}</dd>
        <dt>Cuenta creada</dt><dd>${a.fechaCreacion ? fmt.fechaLarga(a.fechaCreacion) : '—'}</dd>
        <dt>Contraseña</dt><dd>${a.debeCambiarPassword ? 'Temporal: debe cambiarla' : 'Establecida por el usuario'}</dd>
      </dl>
      <div class="modal-acc"><button class="btn ghost" type="button" data-cerrar>Cerrar</button></div>`
  });
}

function editarAdmin(a, alGuardar) {
  const propia = a.id === usuario().id;

  const m = UI.modal({
    titulo: 'Editar administrador',
    ancho: 480,
    cuerpo: `
      <form class="form" id="fe" novalidate>
        ${UI.campo({ name: 'nombre', label: 'Nombre completo', value: a.nombre, requerido: true })}
        ${UI.campo({ name: 'correo', label: 'Correo electrónico', value: a.correo, attrs: 'disabled', ayuda: 'El correo no se puede cambiar.' })}
        ${UI.campo({ name: 'perfil', label: 'Rol', tipo: 'select', value: a.perfil || 'Administrador', opciones: PERFILES_ADM.map(x => ({ valor: x, texto: x })) })}
        ${UI.campo({ name: 'activo', label: 'Estado', tipo: 'select', value: a.activo ? '1' : '0', attrs: propia ? 'disabled' : '', ayuda: propia ? 'No puedes desactivar tu propia cuenta.' : '', opciones: [{ valor: '1', texto: 'Activo' }, { valor: '0', texto: 'Inactivo' }] })}
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit">Guardar cambios</button>
        </div>
      </form>`
  });

  const f = $('#fe', m.el);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const nombre = f.nombre.value.trim();
    if (!nombre) return UI.errorCampo(f, 'nombre', 'El nombre es obligatorio.');

    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      await Api.actualizarAdministrador(a.id, {
        nombre,
        perfil: f.perfil.value,
        activo: propia ? true : f.activo.value === '1'
      });

      m.cerrar();
      UI.toast('Administrador actualizado.');
      alGuardar();
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err);
    }
  };
}

async function restablecerClaveAdmin(a) {
  const ok = await UI.confirmar(
    'Restablecer contraseña',
    `Se generará una contraseña temporal nueva para <b>${esc(a.nombre)}</b>. La anterior dejará de funcionar y deberá cambiarla al iniciar sesión.`,
    { boton: 'Restablecer' }
  );

  if (!ok) return;

  const clave = claveTemporal();

  try {
    await Api.restablecerClaveAdministrador(a.id, clave);
    modalClaveTemporal({ titulo: 'Contraseña restablecida', nombre: a.nombre, correo: a.correo, clave });
  } catch (e) {
    avisarError(e);
  }
}

async function eliminarAdmin(a, alCambiar) {
  const ok = await UI.confirmar(
    'Eliminar administrador',
    `Se eliminará la cuenta de <b>${esc(a.nombre)}</b> (${esc(a.correo)}). Esta acción no se puede deshacer.`,
    { boton: 'Eliminar', peligro: true }
  );

  if (!ok) return;

  try {
    await Api.eliminarAdministrador(a.id);
    UI.toast('Administrador eliminado.');
    alCambiar();
  } catch (e) {
    avisarError(e);
  }
}

function vAdministradores(c, ctx) {
  if (!Api.ADMIN_EXTRA) return vAdministradoresBasico(c);

  const yo = usuario().id;
  let lista = [];

  const plano = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const buenas = [
    [ICO_ADM.shieldOk, 'Usa contraseñas seguras', 'Genera contraseñas complejas y únicas para cada administrador.'],
    [icon('users'), 'Asigna el rol adecuado', 'Identifica la función de cada persona dentro del equipo.'],
    [icon('lock'), 'Forza el cambio de contraseña', 'Recomendado para nuevos administradores.'],
    [icon('eye'), 'Revisa los accesos regularmente', 'Desactiva cuentas que ya no estén en uso.'],
    [ICO_ADM.file, 'Controla el último acceso', 'Consulta cuándo entró cada cuenta por última vez en la lista.']
  ];

  c.innerHTML = `
    <div class="seccion">
      <div class="adm-top">
        <section class="card">
          <div class="card-cab">
            ${ICO_ADM.userPlus}
            <div><h3>Crear nuevo administrador</h3><p>Completa la información para crear una nueva cuenta de administrador.</p></div>
          </div>

          <form class="adm-form" id="fa" novalidate>
            <div class="adm-col">
              ${UI.campo({ name: 'nombre', label: 'Nombre completo', requerido: true, placeholder: 'Ej. Juan Pérez Gómez', attrs: 'autocomplete="off"' })}
              ${UI.campo({ name: 'correo', label: 'Correo electrónico', tipo: 'email', requerido: true, placeholder: 'ejemplo@correo.com', attrs: 'autocomplete="off"' })}
              ${UI.campo({ name: 'perfil', label: 'Rol', tipo: 'select', requerido: true, value: 'Administrador', ayuda: 'Identifica la función del administrador.', opciones: PERFILES_ADM.map(x => ({ valor: x, texto: x })) })}
            </div>

            <div class="adm-col">
              <div class="campo" data-campo="passwordTemporal">
                <label for="pt">Contraseña temporal <i>*</i></label>
                <div class="pass-fila">
                  <div class="con-pref"><span class="pref">${icon('lock')}</span><input id="pt" name="passwordTemporal" type="text" autocomplete="off" spellcheck="false"></div>
                  <button class="btn ghost" type="button" data-generar>${ICO_ADM.refresh} Generar</button>
                </div>
                <small class="ayuda">Se generará una contraseña segura de forma automática.</small>
                <small class="err"></small>
              </div>

              ${UI.campo({ name: 'activo', label: 'Estado', tipo: 'select', requerido: true, value: '1', ayuda: 'El administrador podrá acceder al sistema.', opciones: [{ valor: '1', texto: 'Activo' }, { valor: '0', texto: 'Inactivo' }] })}

              <label class="adm-chk">
                <input type="checkbox" name="forzarCambio" checked>
                <b>Forzar cambio de contraseña al primer inicio</b>
                <small>El usuario deberá establecer una nueva contraseña al iniciar sesión.</small>
              </label>

            </div>

            ${formErr}
            <div class="adm-btns">
              <button class="btn ghost" type="button" data-limpiar>${ICO_ADM.trash} Limpiar</button>
              <button class="btn" type="submit">${ICO_ADM.userPlus} Crear administrador</button>
            </div>
          </form>
        </section>

        <section class="card">
          <div class="card-cab">
            <span class="adm-bulb">${ICO_ADM.bulb}</span>
            <div><h3>Buenas prácticas de acceso</h3><p>Recomendaciones para mantener la seguridad del sistema.</p></div>
          </div>
          <div class="adm-tips">
            ${buenas.map(([ic, t, d]) => `
              <div class="adm-tip"><span class="ico">${ic}</span><div><b>${t}</b><small>${d}</small></div></div>`).join('')}
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-h adm-lh">
          <div class="card-cab">
            ${icon('users')}
            <div><h3>Administradores del sistema</h3><p>Lista de cuentas administrativas registradas.</p></div>
          </div>
          <div class="herramientas adm-filtros">
            <div class="buscar">${icon('search')}<input type="search" id="fBuscar" placeholder="Buscar administrador..." aria-label="Buscar administrador" autocomplete="off"></div>
            <select id="fRol" aria-label="Filtrar por rol">
              <option value="">Todos los roles</option>
              ${PERFILES_ADM.map(x => `<option value="${x}">${x}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="tablaAdm">${UI.cargando(5)}</div>
      </section>
    </div>`;

  const f = $('#fa', c);
  const tabla = $('#tablaAdm', c);

  // Iconos dentro de los campos
  prefijoCampo(f, 'nombre', icon('user'));
  prefijoCampo(f, 'correo', icon('mail'));
  prefijoCampo(f, 'perfil', icon('shield'));
  const wEstado = prefijoCampo(f, 'activo', '<i class="pe pe-DISPONIBLE"></i>');
  f.activo.onchange = () => { $('.pe', wEstado).className = 'pe ' + (f.activo.value === '1' ? 'pe-DISPONIBLE' : 'pe-FUERA_DE_SERVICIO'); };

  const nuevaClave = () => { f.passwordTemporal.value = claveTemporal(); };
  nuevaClave();
  $('[data-generar]', f).onclick = nuevaClave;

  const limpiar = () => {
    f.reset();
    UI.limpiarErrores(f);
    f.activo.onchange();
    nuevaClave();
  };

  $('[data-limpiar]', f).onclick = limpiar;

  // Lista
  function pintar() {
    const t = plano($('#fBuscar', c).value);
    const rol = $('#fRol', c).value;

    const vis = lista
      .filter(a => !rol || (a.perfil || 'Administrador') === rol)
      .filter(a => !t || plano(`${a.nombre} ${a.correo}`).includes(t));

    tabla.innerHTML = vis.length ? `
      <div class="tabla-wrap">
        <table class="tabla adm-tabla">
          <thead><tr><th>Nombre</th><th>Correo electrónico</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th class="num">Acciones</th></tr></thead>
          <tbody>${vis.map(a => `
            <tr>
              <td><div class="adm-nom">${UI.avatar(a.nombre, 'sm')}<b>${esc(a.nombre)}</b>${a.id === yo ? '<span class="pastilla">Tú</span>' : ''}</div></td>
              <td>${esc(a.correo)}</td>
              <td>${rolTag(a.perfil)}</td>
              <td>${estadoAdm(a)}</td>
              <td class="nowrap">${a.ultimoAcceso ? fmt.fechaHora(a.ultimoAcceso) : 'Nunca'}</td>
              <td><div class="adm-acc">
                <button class="ab ab-ver" type="button" data-ver="${a.id}" title="Ver detalle" aria-label="Ver detalle de ${esc(a.nombre)}">${icon('eye')}</button>
                <button class="ab ab-edit" type="button" data-editar="${a.id}" title="Editar" aria-label="Editar a ${esc(a.nombre)}">${icon('edit')}</button>
                <button class="ab ab-clave" type="button" data-clave="${a.id}" title="Restablecer contraseña" aria-label="Restablecer contraseña de ${esc(a.nombre)}"${a.id === yo ? ' disabled' : ''}>${ICO_ADM.key}</button>
                <button class="ab ab-del" type="button" data-borrar="${a.id}" title="Eliminar" aria-label="Eliminar a ${esc(a.nombre)}"${a.id === yo ? ' disabled' : ''}>${ICO_ADM.trash}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
      : UI.vacio(lista.length ? 'Ningún administrador coincide con la búsqueda.' : 'Todavía no hay administradores registrados.', 'users');
  }

  async function cargar() {
    try {
      lista = await Api.administradores();
      if (ctx.vigente()) pintar();
    } catch (e) {
      if (ctx.vigente()) falloCarga(tabla, e, cargar);
    }
  }

  $('#fBuscar', c).oninput = pintar;
  $('#fRol', c).onchange = pintar;

  tabla.addEventListener('click', e => {
    const b = e.target.closest('[data-ver], [data-editar], [data-clave], [data-borrar]');
    if (!b || b.disabled) return;

    const a = lista.find(x => x.id === +(b.dataset.ver || b.dataset.editar || b.dataset.clave || b.dataset.borrar));
    if (!a) return;

    if (b.dataset.ver) verAdmin(a);
    else if (b.dataset.editar) editarAdmin(a, cargar);
    else if (b.dataset.clave) restablecerClaveAdmin(a);
    else eliminarAdmin(a, cargar);
  });

  // Crear
  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);
    if (!d.nombre) return UI.errorCampo(f, 'nombre', 'El nombre es obligatorio.');
    if (!UI.correoValido(d.correo)) return UI.errorCampo(f, 'correo', 'Escribe un correo válido.');
    if (!UI.passwordValida(d.passwordTemporal)) return UI.errorCampo(f, 'passwordTemporal', 'Mínimo 8 caracteres, con letras y números.');

    const forzar = f.forzarCambio.checked;
    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      const u = await Api.crearAdministrador({
        nombre: d.nombre,
        correo: d.correo,
        passwordTemporal: d.passwordTemporal,
        perfil: d.perfil,
        activo: d.activo === '1',
        forzarCambio: forzar
      });

      modalClaveTemporal({ titulo: 'Administrador creado', nombre: u.nombre, correo: u.correo, clave: d.passwordTemporal, forzar });
      limpiar();
      cargar();
    } catch (err) {
      errorEnForm(f, err, { CORREO_DUPLICADO: 'correo' });
    } finally {
      UI.ocupado(btn, false);
    }
  };

  return cargar();
}


/* =========================================================
   INICIO DE LA APLICACIÓN
========================================================= */

document.addEventListener('click', e => {
  const menu = e.target.closest('[data-menu]');
  if (menu) {
    e.stopPropagation();
    return $('#menuUsuario') ? cerrarMenu() : abrirMenu(menu);
  }

  if (e.target.closest('[data-salir]')) {
    e.preventDefault();
    salir();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarMenu();
});

// Si una foto no carga, se muestra el ícono del vehículo
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.hasAttribute('data-veh')) {
    img.outerHTML = UI.sinFoto(!!img.closest('.foto-mini'));
  }
}, true);

window.addEventListener('hashchange', render);

// Aviso cuando el token vence con la página abierta
setInterval(() => {
  if (haySesion && !Api.sesion()) {
    haySesion = false;
    pendientes = null;
    notificacionesCache = null;
    UI.toast('Tu sesión expiró. Inicia sesión de nuevo.', 'warn');
    ir('login');
  }
}, 60e3);

(async function iniciar() {
  // Enlace del correo de recuperación: <front>/restablecer-password?token=...
  const qs = new URLSearchParams(location.search);
  const token = qs.get('token');

  if (token && (!location.hash || /restablecer-password/.test(location.pathname))) {
    const base = location.pathname.replace(/restablecer-password\/?(index\.html)?$/, '');
    history.replaceState(null, '', `${base}#/restablecer?token=${encodeURIComponent(token)}`);
  }

  if (Api.sesion()) {
    try {
      Api.actualizarUsuario(await Api.me());
    } catch (e) {
      if (e.code === 'AUTH_NOT_AUTHENTICATED') Api.cerrarSesion();
    }
  }

  if (!leerHash().ruta) history.replaceState(null, '', '#/' + inicio());

  render();
})();

async function panelTodas(cargar) {
  const nodes = []; let after = null; const vistos = new Set();
  do {
    const r = await cargar({ first: 200, after });
    nodes.push(...r.nodes);
    if (!r.pageInfo.hasNextPage) break;
    after = r.pageInfo.endCursor;
    if (!after || vistos.has(after)) throw new Error('No se pudo completar la paginación.');
    vistos.add(after);
  } while (true);
  return { nodes };
}
async function panelFlotaEstado(estado, { first = 12, after = null, last = null, before = null, ...filtros }) {
  const r = await panelTodas(p => Api.vehiculos({ ...filtros, incluirInactivos: estado === 'INACTIVO', ...p }));
  const lista = estado === 'INACTIVO'
    ? r.nodes.filter(v => v.activo === false)
    : r.nodes.filter(v => v.activo && v.estadoActual === estado);
  const cantidad = last || first;
  const inicio = before !== null ? Math.max(0, Number(before) - cantidad) : Number(after) || 0;
  const nodes = lista.slice(inicio, inicio + cantidad);
  return { nodes, totalCount: lista.length, pageInfo: { hasNextPage: inicio + cantidad < lista.length, endCursor: String(inicio + cantidad), hasPreviousPage: inicio > 0, startCursor: String(inicio) } };
}
async function panelFlotaDisponible(p) { return panelFlotaEstado('DISPONIBLE', p); }

// Navegación y tema compartidos, sin controles duplicados en el menú lateral.
// Automático: día 06:00–17:59 y noche 18:00–05:59, según la hora local del navegador.
let ultimoPeriodoTema = window.AutoGoTema?.periodoActual?.() || ((new Date().getHours() >= 6 && new Date().getHours() < 18) ? 'dia' : 'noche');

function cambiarTemaManual() {
  const actual = document.documentElement.getAttribute('data-tema') === 'noche' ? 'noche' : 'dia';
  const nuevo = actual === 'noche' ? 'dia' : 'noche';
  const periodo = window.AutoGoTema?.periodoActual?.() || ultimoPeriodoTema;
  window.AutoGoTema?.aplicar?.(nuevo);
  if (!window.AutoGoTema) {
    if (nuevo === 'noche') document.documentElement.setAttribute('data-tema','noche');
    else document.documentElement.removeAttribute('data-tema');
  }
  try {
    localStorage.setItem('autogo-tema', nuevo);
    localStorage.setItem('autogo-tema-periodo', periodo);
  } catch (_) {}
  pintarFijas();
}

function comprobarTemaAutomatico() {
  const periodo = window.AutoGoTema?.periodoActual?.() || ((new Date().getHours() >= 6 && new Date().getHours() < 18) ? 'dia' : 'noche');
  if (periodo === ultimoPeriodoTema) return;
  ultimoPeriodoTema = periodo;
  try {
    localStorage.removeItem('autogo-tema');
    localStorage.removeItem('autogo-tema-periodo');
  } catch (_) {}
  if (window.AutoGoTema) window.AutoGoTema.aplicar(periodo);
  else if (periodo === 'noche') document.documentElement.setAttribute('data-tema','noche');
  else document.documentElement.removeAttribute('data-tema');
  pintarFijas();
}

setInterval(comprobarTemaAutomatico, 60e3);
window.addEventListener('focus', comprobarTemaAutomatico);
document.addEventListener('visibilitychange', () => { if (!document.hidden) comprobarTemaAutomatico(); });

document.addEventListener('click', e => {
  if (e.target.closest('[data-tema-global]')) {
    cambiarTemaManual();
  }
  const nb = e.target.closest('[data-notificaciones]');
  if (nb) { e.preventDefault(); e.stopPropagation(); abrirNotificaciones(nb); return; }
  if (e.target.closest('[data-cerrar-notif]')) { cerrarNotificaciones(); return; }
  const filtroN = e.target.closest('[data-filtro-notif]');
  if (filtroN) { filtroNotificaciones = filtroN.dataset.filtroNotif; pintarListaNotificaciones(); return; }
  if (e.target.closest('[data-marcar-todas]')) { marcarTodasNotificaciones(); return; }
  const itemN = e.target.closest('[data-notif-id]');
  if (itemN) { marcarNotificacion(itemN.dataset.notifId, true); return; }
  const pending = e.target.closest('[data-modulo-pendiente]');
  if (pending) UI.toast(pending.dataset.moduloPendiente + ': este módulo todavía no está implementado.', 'info');
  if (e.target.closest('[data-menu-movil]')) {
    const app = $('#app'); const abierto = app.classList.toggle('menu-abierto');
    e.target.closest('[data-menu-movil]').setAttribute('aria-expanded', String(abierto));
  }
  if (e.target.closest('.nav-grupo summary') && innerWidth > 860 && !$('#app').classList.contains('expandida')) {
    $('#app').classList.add('expandida');
    $('#bMenu').setAttribute('aria-expanded','true');
    try { localStorage.setItem('autogo.menu','1'); } catch (_) {}
  }
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') { cerrarNotificaciones(); $('#app')?.classList.remove('menu-abierto'); $('[data-menu-movil]')?.setAttribute('aria-expanded','false'); } });
