(() => {
  'use strict';

  function inyectarFiltroSvg() {
    if (document.getElementById('lente-liquida')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `
      <filter id="lente-liquida" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="ruido"/>
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="18" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    document.body.appendChild(svg);
  }

  const SELECTOR = '.icon-btn.cuadro, .menu-usuario, .modal .modal-h .icon-btn, .top-acc .icon-btn, .demo-ico';
  let activo = null;
  let rafId = null;
  let pendiente = null;

  function aplicar(el, x, y) {
    const r = el.getBoundingClientRect();
    const mx = ((x - r.left) / r.width) * 100;
    const my = ((y - r.top) / r.height) * 100;
    el.style.setProperty('--mx', `${mx}%`);
    el.style.setProperty('--my', `${my}%`);
    el.style.setProperty('--mxn', String((mx / 100 + my / 100) / 2));
  }

  function onMove(e) {
    const el = e.target.closest ? e.target.closest(SELECTOR) : null;

    if (activo && activo !== el) {
      activo.classList.remove('liquido-activo');
      activo = null;
    }

    if (!el) return;

    if (activo !== el) {
      activo = el;
      el.classList.add('liquido-activo');
    }

    pendiente = { el, x: e.clientX, y: e.clientY };
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (pendiente && pendiente.el.isConnected) aplicar(pendiente.el, pendiente.x, pendiente.y);
      pendiente = null;
    });
  }

  function onLeaveVentana() {
    if (activo) {
      activo.classList.remove('liquido-activo');
      activo = null;
    }
  }

  function iniciar() {
    inyectarFiltroSvg();
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeaveVentana, { passive: true });
    window.addEventListener('blur', onLeaveVentana);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
