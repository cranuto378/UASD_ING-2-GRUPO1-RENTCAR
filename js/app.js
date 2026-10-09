/* =========================================================
   AUTOGO - APLICACIÓN
   Rutas por hash: #/ruta/parametro?filtros
========================================================= */

const { $, $$, esc, icon, fmt, hoy, sumarDias, diasEntre, etq, badge, METODOS } = UI;

const raiz = $('#raiz');

let renderId = 0;
let haySesion = !!Api.sesion();
let pendientes = null;

const usuario = () => (Api.sesion() || {}).usuario;
const esAdmin = () => !!usuario() && /^admin/i.test(usuario().rol);
const inicio = () => (!Api.sesion() ? 'login' : esAdmin() ? 'dashboard' : 'inicio');

const opcionesMetodo = (vacio) =>
  (vacio ? [{ valor: '', texto: vacio }] : []).concat(METODOS.map(m => ({ valor: m, texto: etq(m) })));

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
  'perfil': { vista: vPerfil, acceso: 'cliente', titulo: 'Mi perfil' },
  'factura': { vista: vFactura, acceso: 'sesion', titulo: 'Factura', nav: () => (esAdmin() ? 'facturas' : 'mis-facturas') },

  'dashboard': { vista: vDashboard, acceso: 'admin', titulo: 'Panel de control', sub: 'Resumen de la flota, los alquileres y los ingresos.' },
  'nuevo-alquiler': { vista: vNuevoAlquiler, acceso: 'admin', titulo: 'Nuevo alquiler', sub: 'Registro de alquiler en mostrador.' },
  'alquileres': { vista: vAlquileres, acceso: 'admin', titulo: 'Alquileres', sub: 'Modifica, cancela o registra devoluciones.' },
  'flota': { vista: vFlota, acceso: 'admin', titulo: 'Flota', sub: 'Vehículos, estados, fotos y categorías.' },
  'clientes': { vista: vClientes, acceso: 'admin', titulo: 'Clientes', sub: 'Clientes del portal y de mostrador.' },
  'facturas': { vista: vFacturas, acceso: 'admin', titulo: 'Facturación', sub: 'Facturas emitidas. No se editan ni se eliminan.' },
  'administradores': { vista: vAdministradores, acceso: 'admin', titulo: 'Administradores', sub: 'Alta de nuevos usuarios administradores.' }
};

const NAV = {
  admin: [
    ['dashboard', 'Panel', 'grid'],
    ['nuevo-alquiler', 'Nuevo alquiler', 'plusCircle'],
    ['alquileres', 'Alquileres', 'calendar'],
    ['flota', 'Flota', 'car'],
    ['clientes', 'Clientes', 'users'],
    ['facturas', 'Facturas', 'receipt'],
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

  const { ruta, param, q } = leerHash();
  const def = RUTAS[ruta];
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
  try { return localStorage.getItem('autogo.menu') === '1'; } catch (e) { return false; }
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
          <header class="topbar">
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

  return nueva;
}

function pintarNav(activa) {
  const items = !Api.sesion() ? NAV.publico : esAdmin() ? NAV.admin : NAV.cliente;

  $('#nav').innerHTML = items.map(([r, texto, ic]) => {
    const cuenta = r === 'alquileres' && pendientes ? `<b class="contador" aria-label="${pendientes} pendientes">${pendientes}</b>` : '';
    return `<a href="#/${r}" class="${r === activa ? 'act' : ''}" title="${esc(texto)}"${r === activa ? ' aria-current="page"' : ''}>${icon(ic)}<span>${esc(texto)}</span>${cuenta}</a>`;
  }).join('');

  const u = usuario();

  $('#sidePie').innerHTML = u ? `
    <button class="yo" type="button" data-menu aria-label="Menú de usuario">
      ${UI.avatar(u.nombre)}
      <div><b>${esc(u.nombre)}</b><small>${esc(etq(String(u.rol).toUpperCase()))}</small></div>
    </button>` : '';
}

function pintarFijas() {
  const u = usuario();
  const f = $('#accFijas');

  if (!u) {
    f.innerHTML = `
      <a class="btn ghost sm" href="#/registro">Crear cuenta</a>
      <a class="btn sm" href="#/login">Iniciar sesión</a>`;
    return;
  }

  f.innerHTML = `
    ${esAdmin() ? `
      <a class="icon-btn campana" href="#/alquileres?filtro=activos" title="Devoluciones pendientes" aria-label="Devoluciones pendientes${pendientes ? ': ' + pendientes : ''}">
        ${icon('bell')}${pendientes ? `<span class="punto">${pendientes}</span>` : ''}
      </a>` : ''}
    <button class="icon-btn" type="button" data-menu title="Cuenta" aria-label="Opciones de la cuenta">${icon('gear')}</button>`;
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
    ${!esAdmin() ? `<a href="#/perfil" role="menuitem">${icon('user')}Mi perfil</a>` : ''}
    <a href="#/cambiar-password" role="menuitem">${icon('lock')}Cambiar contraseña</a>
    <button type="button" role="menuitem" data-salir>${icon('logout')}Cerrar sesión</button>`;

  document.body.appendChild(m);

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

const tarjetaVeh = (v, { accion = 'rentar', texto = 'Rentar', sel = false } = {}) => `
  <article class="card veh-card${sel ? ' sel' : ''}">
    <div class="veh-foto">${fotoVeh(v)}${badge(null, v.categoria, 'neutro')}</div>
    <div class="veh-cuerpo">
      <h3>${esc(v.marca)} ${esc(v.modelo)}</h3>
      <span class="meta">${esc(v.anio)} · Placa ${esc(v.placa)}</span>
      <div class="veh-pie">
        <div class="precio"><b>${fmt.dinero(v.precioDia)}</b> <span>/ día</span></div>
        <button class="btn sm" type="button" data-${accion}="${v.id}">${texto}</button>
      </div>
    </div>
  </article>`;

function estadoAlquiler(a) {
  const h = hoy();
  let extra = '';

  if (a.estado === 'ACTIVO') {
    if (a.vencido) extra = badge(null, `${a.diasRetraso} día(s) de retraso`, 'bad');
    else if (a.fechaFinPactada === h) extra = badge(null, 'Entrega hoy', 'warn');
    else if (a.fechaInicio > h) extra = badge(null, 'Reserva', 'neutro');
  }

  return `<div class="badges">${badge(a.estado)}${extra}</div>`;
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
        ${UI.campo({ name: 'metodoPago', label: 'Método de pago', tipo: 'select', opciones: opcionesMetodo() })}
        <div class="info-banda">${icon('info')}<span>La factura se emite al confirmar. Puedes cancelar sin cargo antes de la fecha de salida.</span></div>
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Volver</button>
          <button class="btn" type="submit" disabled>Confirmar alquiler</button>
        </div>
      </form>`
  });

  const f = $('#fc', m.el);
  const btn = $('[type=submit]', f);

  Api.cotizarAlquiler(v.id, ini, fin).then(cot => {
    $('[data-k=dias]', m.el).textContent = cot.dias;
    $('[data-k=precio]', m.el).textContent = fmt.dinero(cot.precioDia);
    $('[data-k=total]', m.el).textContent = fmt.dinero(cot.total);
    btn.disabled = false;
  }).catch(err => errorEnForm(f, err));

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);
    UI.ocupado(btn, true);

    try {
      const r = await Api.crearAlquiler({ vehiculoId: v.id, fechaInicio: ini, fechaFin: fin, metodoPago: f.metodoPago.value });
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
    <div class="seccion">
      ${vencidos.length ? `
        <div class="aviso-banda">${icon('alert')}
          <span>Tienes ${vencidos.length} alquiler(es) con la entrega vencida. Devuelve el vehículo lo antes posible para evitar más cargos por mora.</span>
          <a class="btn sm" href="#/mis-alquileres">Ver</a>
        </div>` : ''}

      <div class="kpis">
        <div class="card kpi"><span class="etq">${icon('car')} En curso</span><span class="valor">${enCurso.length}</span><span class="nota">Alquileres activos</span></div>
        <div class="card kpi"><span class="etq">${icon('calendar')} Reservas</span><span class="valor">${reservas.length}</span><span class="nota">Próximas salidas</span></div>
        <div class="card kpi"><span class="etq">${icon('clock')} Próxima entrega</span><span class="valor">${proxima ? fmt.fechaCorta(proxima) : '—'}</span><span class="nota">${proxima ? fmt.fecha(proxima) : 'Sin entregas pendientes'}</span></div>
        <div class="card kpi"><span class="etq">${icon('wallet')} Total facturado</span><span class="valor">${fmt.dinero(facturado)}</span><span class="nota">${facturas.length} factura(s)</span></div>
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
      <div class="resumen-veh">
        <div class="foto-mini">${UI.sinFoto(true)}</div>
        <div><b>${esc(a.vehiculo)}</b><span>Placa ${esc(a.placa)} · ${etq(a.canal)}</span></div>
        <div style="margin-left:auto">${estadoAlquiler(a)}</div>
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
        <div><b>${fmt.numFactura(f.id)} · ${esc(f.concepto)}</b><small>${fmt.fechaHora(f.fechaEmision)}${f.metodoPago ? ' · ' + etq(f.metodoPago) : ''}</small></div>
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
    `Se cancelará el alquiler del <b>${esc(a.vehiculo)}</b> (${fmt.fecha(a.fechaInicio)} → ${fmt.fecha(a.fechaFinPactada)}) y se emitirá una nota de crédito por el reembolso total.`,
    { boton: 'Cancelar alquiler', peligro: true, motivo: true }
  );

  if (!r) return;

  try {
    const op = await Api.cancelarAlquiler(a.id, r.motivo);
    avisoOperacion('Alquiler cancelado. Se emitió la nota de crédito.', op.facturaId);
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
            <td>${f.metodoPago ? etq(f.metodoPago) : '—'}</td>
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
        <span>Método de pago: <b>${f.metodoPago ? etq(f.metodoPago) : '—'}</b></span>
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

async function vPerfil(c, ctx) {
  ctx.acciones(`<a class="btn ghost" href="#/cambiar-password">${icon('lock')} Cambiar contraseña</a>`);
  c.innerHTML = `<div class="card angosta">${UI.cargando(5)}</div>`;

  const p = await Api.miPerfil();
  if (!ctx.vigente()) return;

  c.innerHTML = `
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
    </div>`;
}


/* =========================================================
   PANEL DE CONTROL (ADMINISTRADOR)
========================================================= */

async function vDashboard(c, ctx) {
  ctx.acciones(`<a class="btn" href="#/nuevo-alquiler">${icon('plus')} Nuevo alquiler</a>`);

  const tarjeta = (area, titulo, extra = '') =>
    `<section class="card ${area}"><div class="card-h"><h3>${titulo}</h3>${extra}</div><div data-cuerpo>${UI.cargando(3)}</div></section>`;

  c.innerHTML = `
    <div class="seccion">
      <div class="kpis" id="kpis">${Array.from({ length: 5 }, () => `<div class="card kpi">${UI.cargando(1)}</div>`).join('')}</div>
      <div class="dash">
        ${tarjeta('a-act', 'Actividad reciente')}
        ${tarjeta('a-graf', 'Ingresos', '<span class="pastilla" id="crec">Últimos 6 meses</span>')}
        ${tarjeta('a-flota', 'Estado de la flota')}
        ${tarjeta('a-pend', 'Por devolver')}
      </div>
    </div>`;

  const cuerpo = sel => $(`${sel} [data-cuerpo]`, c);

  // Indicadores y flota
  Api.dashboard().then(d => {
    if (!ctx.vigente()) return;

    pendientes = d.pendientesDevolucion;
    pintarFijas();
    pintarNav('dashboard');

    $('#kpis', c).innerHTML = `
      <div class="card kpi"><span class="etq">${icon('wallet')} Ingresos del mes</span><span class="valor">${fmt.dinero(d.ingresosMes)}</span><span class="nota">Total histórico ${fmt.dinero(d.ingresosTotales)}</span></div>
      <div class="card kpi"><span class="etq">${icon('calendar')} Alquileres activos</span><span class="valor">${d.alquileresActivos}</span><span class="nota">Incluye reservas futuras</span></div>
      <div class="card kpi"><span class="etq">${icon('alert')} Vencidos</span><span class="valor">${d.alquileresVencidos}</span><span class="nota">${d.pendientesDevolucion} pendiente(s) de devolución</span></div>
      <div class="card kpi"><span class="etq">${icon('car')} Disponibles</span><span class="valor">${d.vehiculosDisponibles}<small style="font-size:15px;color:var(--txt-3)"> / ${d.totalVehiculos}</small></span><span class="nota">Vehículos listos para rentar</span></div>
      <div class="card kpi"><span class="etq">${icon('users')} Clientes</span><span class="valor">${d.totalClientes}</span><span class="nota">Registrados y activos</span></div>`;

    const partes = [
      ['Disponibles', d.vehiculosDisponibles, 'c-ok'],
      ['Alquilados', d.vehiculosAlquilados, 'c-info'],
      ['Mantenimiento', d.vehiculosEnMantenimiento, 'c-warn'],
      ['Fuera de servicio', d.vehiculosFueraDeServicio, 'c-bad']
    ];
    const total = d.totalVehiculos || 1;

    cuerpo('.a-flota').innerHTML = `
      <div class="total-flota"><b>${d.totalVehiculos}</b><span>vehículos activos</span></div>
      <div class="barra-flota" role="img" aria-label="${partes.map(p => `${p[0]}: ${p[1]}`).join(', ')}">
        ${partes.filter(p => p[1] > 0).map(p => `<span class="${p[2]}" style="width:${(p[1] / total) * 100}%" title="${p[0]}: ${p[1]}"></span>`).join('')}
      </div>
      <div class="leyenda">${partes.map(p => `<div><i class="${p[2]}"></i>${p[0]}<b>${p[1]}</b></div>`).join('')}</div>`;
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
  Api.alquileres({ estado: 'ACTIVO', orden: 'vencimiento', first: 20 }).then(r => {
    if (!ctx.vigente()) return;
    const h = hoy();
    const lista = r.nodes.filter(a => a.fechaFinPactada <= h);
    const caja = cuerpo('.a-pend');

    caja.innerHTML = lista.length ? `<div class="lista">${lista.slice(0, 5).map(a => `
      <div class="item">
        <span class="avatar sm">${icon(a.vencido ? 'alert' : 'clock')}</span>
        <div><b>${esc(a.clienteNombre)}</b><small>${esc(a.placa)} · ${a.vencido ? `${a.diasRetraso} día(s) de retraso` : 'Entrega hoy'}</small></div>
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

  return meses.map(k => ({ clave: k, etq: nombreMes(k), valor: Math.round(suma[k] * 100) / 100 }));
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

    tip.innerHTML = `<span>${esc(serie[i].etq)} ${serie[i].clave.slice(0, 4)}</span><b>${fmt.dinero(serie[i].valor)}</b>`;
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
  activos: { texto: 'Activos', args: { estado: 'ACTIVO', orden: 'vencimiento' } },
  vencidos: { texto: 'Vencidos', args: { soloVencidos: true, orden: 'vencimiento' } },
  completados: { texto: 'Completados', args: { estado: 'COMPLETADO' } },
  cancelados: { texto: 'Cancelados', args: { estado: 'CANCELADO' } }
};

async function vAlquileres(c, ctx) {
  let filtro = FILTROS_ALQ[ctx.q.get('filtro')] ? ctx.q.get('filtro') : 'todos';
  const clienteId = +ctx.q.get('cliente') || null;
  const clienteNombre = ctx.q.get('nombre');

  ctx.acciones(`<a class="btn" href="#/nuevo-alquiler${clienteId ? '?cliente=' + clienteId : ''}">${icon('plus')} Nuevo alquiler</a>`);

  c.innerHTML = `
    <div class="herramientas">
      <div class="segmentos" role="tablist">
        ${Object.entries(FILTROS_ALQ).map(([k, f]) => `<button type="button" data-f="${k}">${f.texto}</button>`).join('')}
      </div>
      ${clienteId ? `<span class="filtro-activo">Cliente: <b>${esc(clienteNombre || '#' + clienteId)}</b><a href="#/alquileres" aria-label="Quitar filtro de cliente">${icon('x')}</a></span>` : ''}
    </div>
    <div class="card" id="lista"></div>`;

  const marcar = () => $$('[data-f]', c).forEach(b => {
    b.classList.toggle('act', b.dataset.f === filtro);
    b.setAttribute('aria-selected', b.dataset.f === filtro);
  });

  const l = listado({
    cont: $('#lista', c),
    vigente: ctx.vigente,
    cargar: pag => Api.alquileres({ ...FILTROS_ALQ[filtro].args, clienteId, ...pag }),
    pintar: r => (r.nodes.length ? `
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>#</th><th>Cliente</th><th>Vehículo</th><th>Salida</th><th>Entrega</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
          <tbody>${r.nodes.map(a => `
            <tr>
              <td class="nowrap">#${a.id}<br><small style="color:var(--txt-3)">${etq(a.canal)}</small></td>
              <td class="principal"><b>${esc(a.clienteNombre)}</b><small>${esc(a.clienteCedula)}</small></td>
              <td class="principal"><b>${esc(a.vehiculo)}</b><small>${esc(a.placa)}</small></td>
              <td class="nowrap">${fmt.fecha(a.fechaInicio)}</td>
              <td class="nowrap">${fmt.fecha(a.fechaDevolucion || a.fechaFinPactada)}</td>
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
      </div>` : UI.vacio('No hay alquileres con este filtro.', 'calendar'))
  });

  const recargar = () => {
    l.recargar();
    refrescarPendientes();
  };

  c.addEventListener('click', e => {
    const f = e.target.closest('[data-f]');

    if (f) {
      filtro = f.dataset.f;
      marcar();
      cambiarQuery('alquileres', { filtro, cliente: clienteId, nombre: clienteNombre });
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
  await l.recargar(true);
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
  const m = UI.modal({
    titulo: `Registrar devolución #${a.id}`,
    ancho: 560,
    cuerpo: `
      <div class="resumen-veh">
        <div class="foto-mini">${UI.sinFoto(true)}</div>
        <div><b>${esc(a.vehiculo)} · ${esc(a.placa)}</b><span>${esc(a.clienteNombre)} · entrega pactada ${fmt.fecha(a.fechaFinPactada)}</span></div>
      </div>

      <form class="form" id="fd" novalidate>
        ${UI.campo({ name: 'fechaDevolucion', label: 'Fecha de devolución', tipo: 'date', value: hoy(), attrs: `min="${a.fechaInicio}" max="${hoy()}"` })}

        <dl class="dl">
          <dt>Monto base</dt><dd data-k="base">…</dd>
          <dt>Días de mora</dt><dd data-k="dias">…</dd>
          <dt>Monto de mora</dt><dd data-k="mora">…</dd>
        </dl>
        <div class="total" style="margin-top:0"><span>Total del alquiler</span><b data-k="total">…</b></div>

        <div data-k="pago" hidden>
          ${UI.campo({ name: 'metodoPagoMora', label: 'Método de pago de la mora', tipo: 'select', opciones: opcionesMetodo() })}
        </div>

        <div class="info-banda">${icon('info')}<span>Al registrar la devolución, el vehículo pasa a mantenimiento hasta el siguiente día laborable.</span></div>

        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Volver</button>
          <button class="btn" type="submit" disabled>Registrar devolución</button>
        </div>
      </form>`
  });

  const f = $('#fd', m.el);
  const btn = $('[type=submit]', f);
  let cot = null;

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
    UI.ocupado(btn, true);

    try {
      const r = await Api.registrarDevolucion({
        alquilerId: a.id,
        fechaDevolucion: f.fechaDevolucion.value || null,
        metodoPagoMora: cot.diasMora > 0 ? f.metodoPagoMora.value : null
      });

      m.cerrar();
      avisoOperacion(r.facturaId ? 'Devolución registrada. Se emitió la factura de mora.' : 'Devolución registrada sin cargos de mora.', r.facturaId);
      refrescarPendientes();
      if (alCambiar) alCambiar();
    } catch (err) {
      UI.ocupado(btn, false);
      errorEnForm(f, err);
    }
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
    preVeh: +ctx.q.get('veh') || null
  };
  st.fin = ctx.q.get('hasta') && ctx.q.get('hasta') > st.ini ? ctx.q.get('hasta') : sumarDias(st.ini, 3);

  c.innerHTML = `
    <div class="dos-col">
      <div class="pasos">
        <section class="card">
          <div class="paso-h" id="p1"><i>1</i><h3>Cliente</h3></div>
          <div id="cli"></div>
        </section>

        <section class="card">
          <div class="paso-h" id="p2"><i>2</i><h3>Fechas y vehículo</h3></div>
          <form class="buscador" id="fv" novalidate style="margin-bottom:16px">
            ${UI.campo({ name: 'desde', label: 'Salida', tipo: 'date', value: st.ini, attrs: `min="${h}"` })}
            ${UI.campo({ name: 'hasta', label: 'Entrega', tipo: 'date', value: st.fin, attrs: `min="${sumarDias(st.ini, 1)}" max="${sumarDias(st.ini, 90)}"` })}
            ${UI.campo({ name: 'cat', label: 'Categoría', tipo: 'select', opciones: [{ valor: '', texto: 'Todas' }] })}
            <button class="btn ghost" type="submit">${icon('search')} Buscar</button>
            ${formErr}
          </form>
          <div id="vehs"></div>
        </section>
      </div>

      <aside class="card pegajoso" id="resumen"></aside>
    </div>`;

  const fv = $('#fv', c);

  Api.categorias().then(cs => {
    if (!ctx.vigente()) return;
    fv.cat.innerHTML = '<option value="">Todas</option>' + cs.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
  }).catch(() => { /* filtro opcional */ });


  /* Paso 1: cliente */

  function pintarCliente() {
    const caja = $('#cli', c);
    $('#p1', c).classList.toggle('hecho', !!st.cliente);

    if (st.cliente) {
      caja.innerHTML = `
        <div class="elegido">
          ${UI.avatar(st.cliente.nombre, 'sm')}
          <div><b>${esc(st.cliente.nombre)}</b><small>${esc(st.cliente.cedula)}${st.cliente.telefono ? ' · ' + esc(st.cliente.telefono) : ''}</small></div>
          <button class="btn ghost sm" type="button" data-cambiar>Cambiar</button>
        </div>`;
      $('[data-cambiar]', caja).onclick = () => {
        st.cliente = null;
        pintarCliente();
        pintarResumen();
      };
      return;
    }

    caja.innerHTML = `
      <div class="herramientas" style="margin-bottom:0">
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
        res.innerHTML = '';
        return;
      }

      res.innerHTML = UI.cargando(2);

      try {
        const r = await Api.clientes({ texto: t, first: 6 });
        ultimos = r.nodes;
        res.innerHTML = ultimos.length ? ultimos.map(x => `
          <button type="button" data-cli="${x.id}">
            ${UI.avatar(x.nombre, 'sm')}
            <div><b>${esc(x.nombre)}</b><small>${esc(x.cedula)}${x.correo ? ' · ' + esc(x.correo) : ''}</small></div>
          </button>`).join('') : '<p class="texto" style="color:var(--txt-3)">Sin resultados. Puedes registrarlo como cliente nuevo.</p>';
      } catch (e) {
        res.innerHTML = '';
        avisarError(e);
      }
    });

    q.addEventListener('input', buscar);
    q.focus();

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
    $('#vehs', c).innerHTML = st.vehiculos.length
      ? `<div class="veh-grid">${st.vehiculos.map(v => tarjetaVeh(v, {
        accion: 'elegir',
        texto: st.vehiculo && st.vehiculo.id === v.id ? `${icon('check')} Elegido` : 'Elegir',
        sel: st.vehiculo && st.vehiculo.id === v.id
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
    if (!b) return;
    const v = st.vehiculos.find(x => x.id === +b.dataset.elegir);
    if (v) elegirVehiculo(v);
  });


  /* Resumen y confirmación */

  function pintarResumen() {
    const r = $('#resumen', c);
    const listo = st.cliente && st.vehiculo && st.cot;

    r.innerHTML = `
      <div class="card-h"><h3>Resumen</h3></div>
      <dl class="dl">
        <dt>Cliente</dt><dd>${st.cliente ? esc(st.cliente.nombre) : '—'}</dd>
        <dt>Vehículo</dt><dd>${st.vehiculo ? `${esc(st.vehiculo.marca)} ${esc(st.vehiculo.modelo)}` : '—'}</dd>
        <dt>Placa</dt><dd>${st.vehiculo ? esc(st.vehiculo.placa) : '—'}</dd>
        <dt>Salida</dt><dd>${fmt.fecha(st.ini)}</dd>
        <dt>Entrega</dt><dd>${fmt.fecha(st.fin)}</dd>
        <dt>Días</dt><dd>${st.cot ? st.cot.dias : '—'}</dd>
        <dt>Precio por día</dt><dd>${st.cot ? fmt.dinero(st.cot.precioDia) : '—'}</dd>
      </dl>
      <div class="total"><span>Total</span><b>${st.cot ? fmt.dinero(st.cot.total) : '—'}</b></div>

      <form class="form" id="fr" novalidate style="margin-top:18px">
        ${UI.campo({ name: 'metodoPago', label: 'Método de pago', tipo: 'select', opciones: opcionesMetodo() })}
        ${formErr}
        <button class="btn block" type="submit"${listo ? '' : ' disabled'}>${icon('check')} Confirmar alquiler</button>
      </form>`;

    const fr = $('#fr', r);

    fr.onsubmit = async e => {
      e.preventDefault();
      UI.limpiarErrores(fr);
      const btn = $('[type=submit]', fr);
      UI.ocupado(btn, true);

      try {
        const op = await Api.crearAlquiler({
          clienteId: st.cliente.id,
          vehiculoId: st.vehiculo.id,
          fechaInicio: st.ini,
          fechaFin: st.fin,
          metodoPago: fr.metodoPago.value
        });

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
          UI.toast('El vehículo ya no está disponible en esas fechas. Elige otro.', 'warn');
          return buscarVehiculos();
        }
        errorEnForm(fr, err);
      }
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

async function vFlota(c, ctx) {
  let categorias = [];
  const filtros = { texto: '', categoriaId: '', incluirInactivos: false };

  ctx.acciones(`<button class="btn" type="button" data-nuevo-veh>${icon('plus')} Nuevo vehículo</button>`);

  c.innerHTML = `
    <div class="herramientas">
      <div class="buscar">${icon('search')}<input type="search" id="qVeh" placeholder="Buscar por placa, marca o modelo" aria-label="Buscar vehículo"></div>
      <select id="catVeh" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option></select>
      <label class="check"><input type="checkbox" id="inacVeh"> Incluir inactivos</label>
      <div class="derecha"><button class="btn ghost" type="button" data-nueva-cat>${icon('tag')} Nueva categoría</button></div>
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
    cargar: pag => Api.vehiculos({
      texto: filtros.texto || null,
      categoriaId: filtros.categoriaId ? +filtros.categoriaId : null,
      incluirInactivos: filtros.incluirInactivos,
      ...pag
    }),
    pintar: r => (r.nodes.length ? `
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th></th><th>Vehículo</th><th>Placa</th><th class="num">Precio/día</th><th>Estado</th><th></th></tr></thead>
          <tbody>${r.nodes.map(v => `
            <tr class="${v.activo ? '' : 'inactivo'}">
              <td><div class="foto-mini">${fotoVeh(v)}</div></td>
              <td class="principal"><b>${esc(v.marca)} ${esc(v.modelo)}</b><small>${esc(v.anio)} · ${esc(v.categoria)}</small></td>
              <td class="nowrap">${esc(v.placa)}</td>
              <td class="num">${fmt.dinero(v.precioDia)}</td>
              <td><div class="badges">
                ${v.activo ? badge(v.estadoActual) : badge(null, 'Inactivo', 'neutro')}
                ${v.activo && v.estadoActual === 'MANTENIMIENTO' && v.mantenimientoHasta ? `<small style="color:var(--txt-3)">hasta ${fmt.fecha(v.mantenimientoHasta)}</small>` : ''}
              </div></td>
              <td><div class="acciones">
                <button class="icon-btn" type="button" data-acc="editar" data-id="${v.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <button class="icon-btn" type="button" data-acc="estado" data-id="${v.id}" title="Cambiar estado" aria-label="Cambiar estado"${v.activo ? '' : ' disabled'}>${icon('pulse')}</button>
                <button class="icon-btn" type="button" data-acc="foto" data-id="${v.id}" title="Foto" aria-label="Subir foto">${icon('camera')}</button>
                <button class="icon-btn" type="button" data-acc="baja" data-id="${v.id}" title="Desactivar" aria-label="Desactivar"${v.activo ? '' : ' disabled'}>${icon('ban')}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : UI.vacio('No hay vehículos que coincidan con la búsqueda.', 'car'))
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
  $('#inacVeh', c).onchange = e => {
    filtros.incluirInactivos = e.target.checked;
    l.recargar(true);
  };

  $('[data-nuevo-veh]').onclick = () => editarVehiculo(null, categorias, () => l.recargar());
  $('[data-nueva-cat]', c).onclick = () => nuevaCategoria(cat => {
    categorias.push(cat);
    pintarCategorias();
  });

  $('#lista', c).addEventListener('click', async e => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const v = l.nodos().find(x => x.id === +b.dataset.id);
    if (!v) return;

    if (b.dataset.acc === 'editar') return editarVehiculo(v, categorias, () => l.recargar());
    if (b.dataset.acc === 'estado') return estadoVehiculo(v, () => l.recargar());
    if (b.dataset.acc === 'foto') return fotoVehiculo(v, () => l.recargar());

    const ok = await UI.confirmar('Desactivar vehículo',
      `El <b>${esc(v.marca)} ${esc(v.modelo)}</b> (${esc(v.placa)}) dejará de aparecer en el catálogo. No es posible si tiene alquileres activos o futuros.`,
      { boton: 'Desactivar', peligro: true });
    if (!ok) return;

    try {
      await Api.desactivarVehiculo(v.id);
      UI.toast('Vehículo desactivado.');
      l.recargar();
    } catch (err) {
      avisarError(err);
    }
  });

  try {
    categorias = await Api.categorias();
    if (ctx.vigente()) pintarCategorias();
  } catch (e) { /* el filtro queda vacío */ }

  await l.recargar(true);
}

function editarVehiculo(v, categorias, alGuardar) {
  const tope = new Date().getFullYear() + 1;

  const m = UI.modal({
    titulo: v ? 'Editar vehículo' : 'Nuevo vehículo',
    cuerpo: `
      <form class="form" id="fv" novalidate>
        <div class="grid2">
          ${UI.campo({ name: 'placa', label: 'Placa', value: v ? v.placa : '', requerido: true, placeholder: 'A123456', attrs: 'data-mascara="placa" maxlength="12"' })}
          ${UI.campo({ name: 'categoriaId', label: 'Categoría', tipo: 'select', requerido: true, value: v ? v.categoriaId : '', opciones: [{ valor: '', texto: 'Selecciona…' }].concat(categorias.map(x => ({ valor: x.id, texto: x.nombre }))) })}
          ${UI.campo({ name: 'marca', label: 'Marca', value: v ? v.marca : '', requerido: true })}
          ${UI.campo({ name: 'modelo', label: 'Modelo', value: v ? v.modelo : '', requerido: true })}
          ${UI.campo({ name: 'anio', label: 'Año', tipo: 'number', value: v ? v.anio : '', requerido: true, attrs: `min="1950" max="${tope}" step="1"` })}
          ${UI.campo({ name: 'precioDia', label: 'Precio por día (RD$)', tipo: 'number', value: v ? v.precioDia : '', requerido: true, attrs: 'min="0.01" step="0.01"' })}
        </div>
        ${formErr}
        <div class="modal-acc">
          <button class="btn ghost" type="button" data-cerrar>Cancelar</button>
          <button class="btn" type="submit">${v ? 'Guardar cambios' : 'Crear vehículo'}</button>
        </div>
      </form>`
  });

  const f = $('#fv', m.el);

  f.onsubmit = async e => {
    e.preventDefault();
    UI.limpiarErrores(f);

    const d = UI.datos(f);
    const placa = d.placa.toUpperCase().replace(/[\s-]/g, '');
    const anio = +d.anio;
    const precio = +d.precioDia;

    if (!placa) return UI.errorCampo(f, 'placa', 'La placa es obligatoria.');
    if (!d.categoriaId) return UI.errorCampo(f, 'categoriaId', 'Selecciona una categoría.');
    if (!d.marca) return UI.errorCampo(f, 'marca', 'La marca es obligatoria.');
    if (!d.modelo) return UI.errorCampo(f, 'modelo', 'El modelo es obligatorio.');
    if (!(Number.isInteger(anio) && anio >= 1950 && anio <= tope)) return UI.errorCampo(f, 'anio', `El año debe estar entre 1950 y ${tope}.`);
    if (!(precio > 0)) return UI.errorCampo(f, 'precioDia', 'El precio debe ser mayor que 0.');

    const input = { placa, categoriaId: +d.categoriaId, marca: d.marca, modelo: d.modelo, anio, precioDia: precio };
    const btn = $('[type=submit]', f);
    UI.ocupado(btn, true);

    try {
      if (v) await Api.actualizarVehiculo(v.id, input);
      else await Api.crearVehiculo(input);

      m.cerrar();
      UI.toast(v ? 'Vehículo actualizado.' : 'Vehículo creado.');
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
   CLIENTES
========================================================= */

async function vClientes(c, ctx) {
  const filtros = { texto: '', incluirInactivos: false };

  ctx.acciones(`<button class="btn" type="button" data-nuevo-cli>${icon('plus')} Nuevo cliente</button>`);

  c.innerHTML = `
    <div class="herramientas">
      <div class="buscar">${icon('search')}<input type="search" id="qCli" placeholder="Buscar por nombre, cédula o correo" aria-label="Buscar cliente"></div>
      <label class="check"><input type="checkbox" id="inacCli"> Incluir inactivos</label>
    </div>
    <div class="card" id="lista"></div>`;

  const l = listado({
    cont: $('#lista', c),
    vigente: ctx.vigente,
    cargar: pag => Api.clientes({ texto: filtros.texto || null, incluirInactivos: filtros.incluirInactivos, ...pag }),
    pintar: r => (r.nodes.length ? `
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>Cliente</th><th>Cédula</th><th>Teléfono</th><th>Cuenta</th><th>Estado</th><th></th></tr></thead>
          <tbody>${r.nodes.map(x => `
            <tr class="${x.activo ? '' : 'inactivo'}">
              <td><div style="display:flex;align-items:center;gap:12px">${UI.avatar(x.nombre, 'sm')}
                <div class="principal"><b>${esc(x.nombre)}</b><small>${esc(x.correo || 'Sin correo')}</small></div></div></td>
              <td class="nowrap">${esc(x.cedula)}</td>
              <td class="nowrap">${esc(x.telefono || '—')}</td>
              <td>${x.tieneCuenta ? badge(null, 'Portal', 'info') : badge(null, 'Mostrador', 'neutro')}</td>
              <td>${x.activo ? badge(null, 'Activo', 'ok') : badge(null, 'Inactivo', 'neutro')}</td>
              <td><div class="acciones">
                <button class="icon-btn" type="button" data-acc="editar" data-id="${x.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <a class="icon-btn" href="#/alquileres?cliente=${x.id}&nombre=${encodeURIComponent(x.nombre)}" title="Ver alquileres" aria-label="Ver alquileres">${icon('calendar')}</a>
                <a class="icon-btn" href="#/nuevo-alquiler?cliente=${x.id}" title="Nuevo alquiler" aria-label="Nuevo alquiler"${x.activo ? '' : ' hidden'}>${icon('plusCircle')}</a>
                <button class="icon-btn" type="button" data-acc="baja" data-id="${x.id}" title="Desactivar" aria-label="Desactivar"${x.activo ? '' : ' disabled'}>${icon('ban')}</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : UI.vacio('No hay clientes que coincidan con la búsqueda.', 'users'))
  });

  const nuevaBusqueda = debounce(() => l.recargar(true));

  $('#qCli', c).addEventListener('input', e => {
    filtros.texto = e.target.value.trim();
    nuevaBusqueda();
  });
  $('#inacCli', c).onchange = e => {
    filtros.incluirInactivos = e.target.checked;
    l.recargar(true);
  };

  $('[data-nuevo-cli]').onclick = () => editarCliente(null, () => l.recargar());

  $('#lista', c).addEventListener('click', async e => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    const x = l.nodos().find(y => y.id === +b.dataset.id);
    if (!x) return;

    if (b.dataset.acc === 'editar') return editarCliente(x, () => l.recargar());

    const ok = await UI.confirmar('Desactivar cliente',
      `<b>${esc(x.nombre)}</b> quedará inactivo${x.tieneCuenta ? ' y su cuenta del portal se desactivará' : ''}. No es posible si tiene alquileres activos.`,
      { boton: 'Desactivar', peligro: true });
    if (!ok) return;

    try {
      await Api.desactivarCliente(x.id);
      UI.toast('Cliente desactivado.');
      l.recargar();
    } catch (err) {
      avisarError(err);
    }
  });

  await l.recargar(true);
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

function vAdministradores(c) {
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
