/* =========================================================
   AUTOGO · MENÚ MÓVIL
   Mejora el drawer existente sin tocar la lógica de navegación.
   También corrige el scroll raíz del shell en móvil/tablet.
========================================================= */
(function () {
  const MQ = window.matchMedia('(max-width: 860px)');

  /* El CSS base deja html.shell-activa con overflow:hidden para escritorio.
     En móvil el documento completo debe volver a ser el área desplazable. */
  const style = document.createElement('style');
  style.id = 'autogo-mobile-scroll-fix';
  style.textContent = `
    @media (max-width: 1180px) {
      html.shell-activa {
        height: auto !important;
        min-height: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
      }

      body.shell-activa {
        height: auto !important;
        min-height: 100dvh !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
      }

      body.shell-activa .app,
      body.shell-activa .app.expandida {
        max-height: none !important;
      }
    }

    @media (max-width: 860px) {
      html.shell-activa,
      body.shell-activa {
        touch-action: pan-y !important;
        overscroll-behavior-y: auto !important;
        -webkit-overflow-scrolling: touch;
      }

      html.shell-activa .main,
      body.shell-activa .main,
      html.shell-activa #raiz,
      body.shell-activa #raiz {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }

      html.menu-movil-abierto,
      body.menu-movil-abierto {
        height: 100% !important;
        overflow: hidden !important;
        touch-action: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  function app() { return document.getElementById('app'); }
  function boton() { return document.querySelector('[data-menu-movil]'); }

  function marcarBloqueo(abierto) {
    document.body.classList.toggle('menu-movil-abierto', abierto);
    document.documentElement.classList.toggle('menu-movil-abierto', abierto);
  }

  function asegurarBackdrop() {
    let b = document.querySelector('.menu-movil-backdrop');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'menu-movil-backdrop';
      b.setAttribute('aria-label', 'Cerrar menú');
      document.body.appendChild(b);
      b.addEventListener('click', cerrar);
    }
    return b;
  }

  function sincronizar() {
    const a = app();
    const bt = boton();
    if (!a || !bt) {
      marcarBloqueo(false);
      return;
    }

    const abierto = MQ.matches && a.classList.contains('menu-abierto');
    marcarBloqueo(abierto);
    bt.setAttribute('aria-expanded', String(abierto));
    bt.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    if (MQ.matches) asegurarBackdrop();
  }

  function cerrar() {
    const a = app();
    if (a) a.classList.remove('menu-abierto');
    marcarBloqueo(false);
    const bt = boton();
    if (bt) {
      bt.setAttribute('aria-expanded', 'false');
      bt.setAttribute('aria-label', 'Abrir menú');
    }
  }

  /* app.js hace el toggle principal. Este listener corre después y
     sincroniza overlay, aria y bloqueo de scroll con el estado resultante. */
  document.addEventListener('click', function (e) {
    if (!MQ.matches) return;

    if (e.target.closest('[data-menu-movil]')) {
      requestAnimationFrame(sincronizar);
      return;
    }

    const a = app();
    if (!a || !a.classList.contains('menu-abierto')) return;

    /* Navegar desde el drawer debe cerrarlo de inmediato. */
    if (e.target.closest('.side a[href]') || e.target.closest('.side [data-salir]')) {
      cerrar();
      return;
    }

    /* Click fuera del drawer y del botón. */
    if (!e.target.closest('.side')) cerrar();
  }, false);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrar();
  });

  window.addEventListener('hashchange', cerrar);
  window.addEventListener('resize', function () {
    if (!MQ.matches) cerrar();
    else sincronizar();
  });

  if (MQ.addEventListener) MQ.addEventListener('change', function (e) {
    if (!e.matches) cerrar();
    else sincronizar();
  });

  /* El shell se recrea/cambia entre login, cliente y admin. */
  const raiz = document.getElementById('raiz');
  if (raiz) {
    new MutationObserver(function () {
      if (MQ.matches) requestAnimationFrame(sincronizar);
    }).observe(raiz, { childList: true, subtree: true });
  }

  sincronizar();
})();
