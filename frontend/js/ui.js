/* =========================================================
   UTILIDADES DE INTERFAZ
========================================================= */

const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


  /* Íconos */

  const ICONOS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    car: '<path d="M5 16v-5l2.2-4.6A2 2 0 0 1 9 5.3h6a2 2 0 0 1 1.8 1.1L19 11v5"/><path d="M3 16h18v2.5a.5.5 0 0 1-.5.5H18a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H3.5a.5.5 0 0 1-.5-.5z"/><path d="M5 11h14"/><path d="M7.5 13.5h1M15.5 13.5h1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.2"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>'
  };

  const icon = (n, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONOS[n] || ''}</svg>`;

  const autoSvg = (cls = '') =>
    `<svg class="auto-svg ${cls}" viewBox="0 0 64 36" aria-hidden="true"><use href="#auto"></use></svg>`;


  const sinFoto = (mini = false) =>
    `<span class="sin-foto">${icon('car')}${mini ? '' : '<small>Foto no disponible</small>'}</span>`;


  /* Formatos */

  const MONEDA = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 });
  const COMPACTO = new Intl.NumberFormat('es-DO', { notation: 'compact', maximumFractionDigits: 1 });

  const aUtc = v => new Date(/Z$|[+-]\d\d:?\d\d$/.test(v) ? v : v + 'Z');

  const fmt = {
    dinero: n => (n == null ? '—' : MONEDA.format(Number(n))),
    compacto: n => 'RD$ ' + COMPACTO.format(Number(n) || 0),
    fecha: d => {
      if (!d) return '—';
      const [y, m, dd] = String(d).slice(0, 10).split('-');
      return `${dd}/${m}/${y}`;
    },
    fechaCorta: d => {
      if (!d) return '—';
      const x = new Date(String(d).slice(0, 10) + 'T12:00:00');
      return x.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }).replace('.', '');
    },
    fechaHora: d => (d ? aUtc(d).toLocaleString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—'),
    fechaLarga: d => (d ? aUtc(d).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'),
    hace: d => {
      if (!d) return '';
      const s = Math.round((Date.now() - aUtc(d).getTime()) / 1000);
      if (s < 60) return 'hace un momento';
      const m = Math.round(s / 60);
      if (m < 60) return `hace ${m} min`;
      const h = Math.round(m / 60);
      if (h < 24) return `hace ${h} h`;
      const dd = Math.round(h / 24);
      if (dd < 30) return dd === 1 ? 'ayer' : `hace ${dd} días`;
      return fmt.fechaLarga(d);
    },
    numFactura: id => 'No. ' + String(id).padStart(4, '0'),
    iniciales: n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(),
    primerNombre: n => String(n || '').trim().split(/\s+/)[0]
  };

  const hoy = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  const sumarDias = (f, n) => {
    const d = new Date(f + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);


  /* Etiquetas de enums */

  const ETQ = {
    DISPONIBLE: 'Disponible', ALQUILADO: 'Alquilado', MANTENIMIENTO: 'Mantenimiento', FUERA_DE_SERVICIO: 'Fuera de servicio',
    ACTIVO: 'Activo', COMPLETADO: 'Completado', CANCELADO: 'Cancelado',
    MOSTRADOR: 'Mostrador', PORTAL: 'Portal',
    ALQUILER: 'Alquiler', MORA: 'Mora', AJUSTE: 'Ajuste',
    EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia',
    ADMINISTRADOR: 'Administrador', CLIENTE: 'Cliente'
  };

  const TONO = {
    DISPONIBLE: 'ok', ALQUILADO: 'info', MANTENIMIENTO: 'warn', FUERA_DE_SERVICIO: 'bad',
    ACTIVO: 'info', COMPLETADO: 'ok', CANCELADO: 'neutro',
    ALQUILER: 'info', MORA: 'warn', AJUSTE: 'neutro'
  };

  const etq = v => ETQ[v] || v || '—';
  const badge = (v, texto, tono) =>
    `<span class="badge ${tono || TONO[v] || 'neutro'}">${esc(texto ?? etq(v))}</span>`;

  const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];


  /* Avisos */

  function toast(msg, tipo = 'ok', accion) {
    let pila = $('#avisos');

    if (!pila) {
      pila = document.createElement('div');
      pila.id = 'avisos';
      pila.className = 'avisos';
      pila.setAttribute('role', 'status');
      pila.setAttribute('aria-live', 'polite');
      document.body.appendChild(pila);
    }

    const t = document.createElement('div');
    const ic = { ok: 'check', warn: 'alert', bad: 'alert', info: 'info' }[tipo] || 'info';

    t.className = `aviso ${tipo}`;
    t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>` +
      (accion ? `<a href="${esc(accion.href)}">${esc(accion.texto)}</a>` : '');

    pila.appendChild(t);
    requestAnimationFrame(() => t.classList.add('on'));

    const quitar = () => {
      t.classList.remove('on');
      setTimeout(() => t.remove(), 250);
    };

    t.addEventListener('click', quitar);
    setTimeout(quitar, accion ? 6500 : 4000);
  }


  /* Modales */

  function modal({ titulo, cuerpo, ancho, alCerrar }) {
    const bg = document.createElement('div');
    const previo = document.activeElement;

    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"${ancho ? ` style="max-width:${ancho}px"` : ''}>
        <div class="modal-h">
          <h3>${esc(titulo)}</h3>
          <button class="icon-btn sm" type="button" data-cerrar aria-label="Cerrar">${icon('x')}</button>
        </div>
        <div class="modal-c">${cuerpo}</div>
      </div>`;

    document.body.appendChild(bg);
    document.body.classList.add('con-modal');
    requestAnimationFrame(() => bg.classList.add('on'));

    let cerrado = false;

    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      bg.classList.remove('on');
      document.removeEventListener('keydown', teclas);
      setTimeout(() => {
        bg.remove();
        if (!$('.modal-bg')) document.body.classList.remove('con-modal');
      }, 200);
      if (previo && previo.focus) previo.focus();
      if (alCerrar) alCerrar();
    };

    const teclas = e => {
      if (e.key === 'Escape' && bg === $$('.modal-bg').pop()) cerrar();
    };

    document.addEventListener('keydown', teclas);
    bg.addEventListener('mousedown', e => { if (e.target === bg) cerrar(); });
    $$('[data-cerrar]', bg).forEach(b => { b.onclick = cerrar; });

    const primero = $('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea', bg);
    setTimeout(() => (primero || $('[data-cerrar]', bg)).focus(), 30);

    return { el: $('.modal', bg), cerrar };
  }

  function confirmar(titulo, texto, { boton = 'Confirmar', peligro = false, motivo = false } = {}) {
    return new Promise(resolver => {
      let respuesta = null;

      const m = modal({
        titulo,
        ancho: 440,
        cuerpo: `
          <p class="texto">${texto}</p>
          ${motivo ? campo({ name: 'motivo', label: 'Motivo (opcional)', tipo: 'textarea', placeholder: 'Escribe el motivo…' }) : ''}
          <div class="modal-acc">
            <button class="btn ghost" type="button" data-cerrar>Volver</button>
            <button class="btn ${peligro ? 'danger' : ''}" type="button" data-ok>${esc(boton)}</button>
          </div>`,
        alCerrar: () => resolver(respuesta)
      });

      $('[data-ok]', m.el).onclick = () => {
        const t = $('textarea', m.el);
        respuesta = { motivo: t ? t.value.trim() || null : null };
        m.cerrar();
      };
    });
  }


  /* Formularios */

  function campo({ name, label, tipo = 'text', value = '', placeholder = '', requerido = false, opciones, ayuda, attrs = '', clase = '' }) {
    const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 7);
    let control;

    if (tipo === 'select') {
      control = `<select id="${id}" name="${name}" ${attrs}>${(opciones || []).map(o =>
        `<option value="${esc(o.valor)}"${String(o.valor) === String(value) ? ' selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
    } else if (tipo === 'textarea') {
      control = `<textarea id="${id}" name="${name}" rows="3" placeholder="${esc(placeholder)}" ${attrs}>${esc(value)}</textarea>`;
    } else if (tipo === 'password') {
      control = `<div class="con-boton">
        <input id="${id}" name="${name}" type="password" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>
        <button type="button" class="ver-pass" data-ver-pass aria-label="Mostrar contraseña">${icon('eye')}</button>
      </div>`;
    } else {
      control = `<input id="${id}" name="${name}" type="${tipo}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>`;
    }

    return `<div class="campo ${clase}" data-campo="${name}">
      <label for="${id}">${esc(label)}${requerido ? ' <i>*</i>' : ''}</label>
      ${control}
      ${ayuda ? `<small class="ayuda">${ayuda}</small>` : ''}
      <small class="err" aria-live="polite"></small>
    </div>`;
  }

  function datos(form) {
    const d = {};

    [...form.elements].forEach(el => {
      if (!el.name) return;
      if (el.type === 'checkbox') d[el.name] = el.checked;
      else if (el.type === 'password' || el.type === 'file') d[el.name] = el.value;
      else d[el.name] = el.value.trim();
    });

    return d;
  }

  function errorCampo(form, name, msg) {
    const c = $(`[data-campo="${name}"]`, form);
    if (!c) return errorForm(form, msg);
    c.classList.add('invalido');
    $('.err', c).textContent = msg;
    const el = $('input, select, textarea', c);
    if (el) el.focus();
    return false;
  }

  function errorForm(form, msg) {
    const e = $('[data-err-form]', form);
    if (e) {
      e.textContent = msg;
      e.hidden = false;
    } else {
      toast(msg, 'bad');
    }
    return false;
  }

  function limpiarErrores(form) {
    $$('.campo.invalido', form).forEach(c => {
      c.classList.remove('invalido');
      $('.err', c).textContent = '';
    });
    const e = $('[data-err-form]', form);
    if (e) {
      e.textContent = '';
      e.hidden = true;
    }
  }

  function ocupado(btn, si) {
    if (!btn) return;
    btn.disabled = si;
    btn.classList.toggle('cargando', si);
  }

  const mascaraCedula = v => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
  };

  const mascaraTelefono = v => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const passwordValida = p => p.length >= 8 && /[a-zñ]/i.test(p) && /\d/.test(p);
  const correoValido = c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

  // Mostrar u ocultar contraseña y máscaras de entrada
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ver-pass]');
    if (!b) return;
    const i = b.parentElement.querySelector('input');
    const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    b.innerHTML = icon(ver ? 'eyeOff' : 'eye');
    b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.mascara === 'cedula') el.value = mascaraCedula(el.value);
    if (el.dataset.mascara === 'telefono') el.value = mascaraTelefono(el.value);
    if (el.dataset.mascara === 'placa') el.value = el.value.toUpperCase().replace(/[\s-]/g, '');

    const c = el.closest && el.closest('.campo.invalido');
    if (c) {
      c.classList.remove('invalido');
      $('.err', c).textContent = '';
    }
  });


  /* Estados de carga y vacío */

  const cargando = (filas = 3) =>
    `<div class="esqueleto">${Array.from({ length: filas }, () => '<span></span>').join('')}</div>`;

  const vacio = (texto, ic = 'info', extra = '') =>
    `<div class="vacio">${icon(ic)}<p>${texto}</p>${extra}</div>`;

  const avatar = (nombre, cls = '') =>
    `<span class="avatar ${cls}" aria-hidden="true">${esc(fmt.iniciales(nombre))}</span>`;

  return {
    $, $$, esc, icon, autoSvg, sinFoto, fmt, hoy, sumarDias, diasEntre, etq, badge, METODOS,
    toast, modal, confirmar, campo, datos, errorCampo, errorForm, limpiarErrores, ocupado,
    passwordValida, correoValido, cargando, vacio, avatar
  };
})();
