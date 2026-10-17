/* =========================================================
   AUTOGO · CONSISTENCIA DE CATÁLOGOS
   Unifica la información visible de los vehículos en:
   - Catálogo público
   - Catálogo del cliente
   - Selección de vehículo del administrador

   La acción cambia según el contexto, pero los datos base visibles
   deben ser los mismos: categoría, disponibilidad, marca/modelo,
   año, placa, transmisión, color y tarifa diaria.
========================================================= */
(function () {
  const cache = new Map();
  const procesando = new WeakSet();

  function rutaActual() {
    return (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0] || '');
  }

  function esVistaVehiculos() {
    return ['catalogo', 'nuevo-alquiler'].includes(rutaActual());
  }

  function texto(v) {
    if (v == null) return '';
    return String(v);
  }

  function etiqueta(v) {
    const s = texto(v).trim();
    if (!s) return '';
    return s
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function ico(nombre) {
    try {
      return window.UI && typeof UI.icon === 'function' ? UI.icon(nombre) : '';
    } catch (_) {
      return '';
    }
  }

  function idVehiculo(card) {
    if (card.dataset.cardVeh) return card.dataset.cardVeh;

    const rentar = card.querySelector('[data-rentar]');
    if (rentar && rentar.dataset.rentar) return rentar.dataset.rentar;

    const candidatos = card.querySelectorAll('button, a');
    for (const el of candidatos) {
      for (const [k, v] of Object.entries(el.dataset || {})) {
        if (/veh|rentar|elegir|seleccionar/i.test(k) && /^\d+$/.test(String(v))) return v;
      }
    }
    return null;
  }

  async function obtenerVehiculo(id) {
    const clave = String(id);
    if (cache.has(clave)) return cache.get(clave);

    const promesa = (async () => {
      try {
        return await Api.vehiculo(Number(id));
      } catch (_) {
        return null;
      }
    })();

    cache.set(clave, promesa);
    return promesa;
  }

  function asegurarDisponible(card) {
    const etiquetas = card.querySelector('.veh-foto-etiquetas');
    if (!etiquetas) return;

    const ya = Array.from(etiquetas.children).some(el => /disponible/i.test(el.textContent || ''));
    if (ya) return;

    const span = document.createElement('span');
    span.className = 'badge ok catalogo-disponible';
    span.textContent = 'Disponible';
    etiquetas.appendChild(span);
  }

  function asegurarDetalles(card, v) {
    const cuerpo = card.querySelector('.veh-cuerpo');
    const titulo = card.querySelector('.veh-titulo-linea');
    if (!cuerpo || !titulo) return;

    if (!card.querySelector('.veh-datos-rapidos')) {
      const detalles = document.createElement('div');
      detalles.className = 'veh-datos-rapidos catalogo-datos-completos';

      const datos = [];
      if (v && v.transmision) datos.push(`${ico('settings')} ${etiqueta(v.transmision)}`);
      if (v && v.color) datos.push(`${ico('tag')} ${texto(v.color)}`);
      if (v && v.anio) datos.push(`${ico('calendar')} ${texto(v.anio)}`);

      detalles.innerHTML = datos.map(d => `<span>${d}</span>`).join('');
      titulo.insertAdjacentElement('afterend', detalles);
    }

    const precio = card.querySelector('.precio');
    if (precio && !precio.querySelector('small')) {
      const small = document.createElement('small');
      small.textContent = 'Tarifa diaria';
      precio.insertBefore(small, precio.firstChild);
    }
  }

  async function completar(card) {
    if (!card || procesando.has(card)) return;
    procesando.add(card);

    /* Registrar alquiler ya trae la tarjeta completa desde app.js.
       Solo aseguramos la misma marca visual. */
    if (card.querySelector('.veh-datos-rapidos')) {
      asegurarDisponible(card);
      const precio = card.querySelector('.precio');
      if (precio && !precio.querySelector('small')) {
        const small = document.createElement('small');
        small.textContent = 'Tarifa diaria';
        precio.insertBefore(small, precio.firstChild);
      }
      card.classList.add('veh-card-completa');
      return;
    }

    const id = idVehiculo(card);
    if (!id) return;

    const v = await obtenerVehiculo(id);
    if (!card.isConnected) return;

    asegurarDisponible(card);
    asegurarDetalles(card, v);
    card.classList.add('veh-card-completa');
  }

  function procesar() {
    document.body.classList.toggle('catalogo-unificado', esVistaVehiculos());
    if (!esVistaVehiculos()) return;

    document.querySelectorAll('.veh-card').forEach(completar);
  }

  const raiz = document.getElementById('raiz');
  if (raiz) {
    new MutationObserver(function () {
      requestAnimationFrame(procesar);
    }).observe(raiz, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', function () {
    requestAnimationFrame(procesar);
  });

  window.addEventListener('load', procesar);
  procesar();
})();
