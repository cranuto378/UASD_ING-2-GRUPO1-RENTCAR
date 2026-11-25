(() => {
  'use strict';

  // Elementos pequeños y fijos de la interfaz: botones, íconos, chips, badges,
  // navegación, avatar, pestañas de menú. Deliberadamente EXCLUIDOS: .card,
  // .app, .side, .main, .lista, .modal (el contenedor grande), .grafico — son
  // grandes y/o hacen scroll, y el filtro SVG + backdrop-filter ahí sí cuesta.
  const SELECTOR = [
    '.btn', '.icon-btn', '.nav a', '.chip', '.badge', '.pastilla',
    '.avatar', '.menu-usuario', '.campana', '.side-logo', '.demo-ico',
    '.demo-btn', '.filtro-activo a', '.modal-h .icon-btn', '.tab', '.kpi',
    '.top-acc > *', '.acciones .icon-btn', '.tema-login',
    '.yo', '.side-cerrar-sesion', '.side-pie a', '.side-pie button'
  ].join(', ');

  function inyectarFiltroSvg() {
    if (document.getElementById('lente-liquida')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `
      <filter id="lente-liquida" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="ruido"/>
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="16" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    document.body.appendChild(svg);
  }

  function etiquetar(raiz) {
    const nodos = raiz.matches && raiz.matches(SELECTOR) ? [raiz] : [];
    if (raiz.querySelectorAll) nodos.push(...raiz.querySelectorAll(SELECTOR));
    for (const el of nodos) el.classList.add('glass-obj');
  }

  function observarCambios() {
    etiquetar(document.body);
    const obs = new MutationObserver(muts => {
      for (const m of muts)
        for (const nodo of m.addedNodes)
          if (nodo.nodeType === 1) etiquetar(nodo);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Si el mouse se queda quieto sobre el mismo elemento este tiempo, el
  // contorno se apaga (vuelve a blanco/neutro) aunque el cursor siga encima.
  const QUIETO_MS = 2000;

  let activo = null;
  let rafId = null;
  let pendiente = null;
  let quietoTimer = null;

  function aplicar(el, x, y) {
    const r = el.getBoundingClientRect();
    const mx = ((x - r.left) / r.width) * 100;
    const my = ((y - r.top) / r.height) * 100;
    el.style.setProperty('--mx', `${mx}%`);
    el.style.setProperty('--my', `${my}%`);
    el.style.setProperty('--mxn', String((mx / 100 + my / 100) / 2));
  }

  function apagar(el) {
    el.classList.remove('liquido-activo');
    if (activo === el) activo = null;
  }

  function reprogramarApagado(el) {
    if (quietoTimer) clearTimeout(quietoTimer);
    quietoTimer = setTimeout(() => {
      quietoTimer = null;
      if (el.isConnected) apagar(el);
    }, QUIETO_MS);
  }

  function onMove(e) {
    const el = e.target.closest ? e.target.closest('.glass-obj') : null;

    if (activo && activo !== el) apagar(activo);

    if (!el) {
      if (quietoTimer) { clearTimeout(quietoTimer); quietoTimer = null; }
      return;
    }

    if (activo !== el) {
      activo = el;
      el.classList.add('liquido-activo');
    }
    reprogramarApagado(el);

    pendiente = { el, x: e.clientX, y: e.clientY };
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (pendiente && pendiente.el.isConnected) aplicar(pendiente.el, pendiente.x, pendiente.y);
      pendiente = null;
    });
  }

  function onLeaveVentana() {
    if (quietoTimer) { clearTimeout(quietoTimer); quietoTimer = null; }
    if (activo) apagar(activo);
  }

  function iniciar() {
    inyectarFiltroSvg();
    observarCambios();
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeaveVentana, { passive: true });
    window.addEventListener('blur', onLeaveVentana);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
