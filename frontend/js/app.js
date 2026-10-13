/* =========================================================
   AUTOGO - VISTA ADMIN CON EL DISEÑO DEL PDF
   No cambia la lógica de app.js: solo retoca lo que ya se dibuja
   (igual que los scripts del index.html). Va después de app.js.
========================================================= */

(function () {
    'use strict';

    var raiz = document.getElementById('raiz');
    if (!raiz) return;

    /* Carga admin-pdf.css (queda junto a styles.css, después de él) */
    (function cargarEstilos() {
        var yo = document.currentScript;
        var href = 'admin-pdf.css?v=1';
        if (yo && yo.src) href = yo.src.replace(/js\/admin-pdf\.js.*$/, 'admin-pdf.css?v=1');
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
    })();

    function ic(nombre) {
        try { return UI.icon(nombre); } catch (e) { return ''; }
    }

    function ruta() {
        return (location.hash.split('/')[1] || '').split('?')[0];
    }

    /* Es la vista del administrador si el menú trae el enlace al Panel */
    function esAdmin() {
        var nav = document.querySelector('.app .nav');
        return !!(nav && nav.querySelector('a[href="#/dashboard"]'));
    }

    function marcar() {
        var admin = esAdmin();
        var app = document.querySelector('.app');
        document.body.classList.toggle('vista-admin', admin);
        if (app) app.classList.toggle('admin-pdf', admin);
        return admin;
    }

    /* Alquileres con submenú: Registrar alquiler / Gestionar alquileres */
    function submenu() {
        var nav = document.querySelector('.app .nav');
        if (!nav || nav.querySelector('.nav-sub')) return;

        var alq = nav.querySelector('a[href="#/alquileres"]');
        var nuevo = nav.querySelector('a[href="#/nuevo-alquiler"]');
        if (!alq || !nuevo) return;

        var r = ruta();
        var abierto = r === 'alquileres' || r === 'nuevo-alquiler';

        var sub = document.createElement('div');
        sub.className = 'nav-sub' + (abierto ? ' abierto' : '');
        sub.innerHTML =
            '<a href="#/nuevo-alquiler" class="' + (r === 'nuevo-alquiler' ? 'act' : '') + '">' +
            ic('plusCircle') + '<span>Registrar alquiler</span></a>' +
            '<a href="#/alquileres" class="' + (r === 'alquileres' ? 'act' : '') + '">' +
            ic('calendar') + '<span>Gestionar alquileres</span></a>';

        alq.parentNode.insertBefore(sub, alq.nextSibling);
        alq.classList.add('tiene-sub');
        if (abierto) alq.classList.add('abierto');
        nuevo.classList.add('nav-top-oculto');

        /* En el submenú el activo es el hijo, no el padre */
        if (r === 'alquileres') alq.classList.remove('act');
    }

    /* Panel de control */
    var ICONOS_TARJETA = {
        'Actividad reciente': 'users',
        'Ingresos': 'wallet',
        'Estado de la flota': 'car',
        'Por devolver': 'clock',
        'Accesos rápidos': 'grid'
    };

    var ACCESOS = [
        ['#/nuevo-alquiler', 'Nuevo alquiler', 'plusCircle', '120,170,255'],
        ['#/flota', 'Gestionar flota', 'car', '110,231,160'],
        ['#/clientes', 'Ver clientes', 'users', '190,150,255'],
        ['#/facturas', 'Ver facturas', 'receipt', '255,185,90'],
        ['#/alquileres', 'Alquileres', 'calendar', '120,170,255'],
        ['#/administradores', 'Administradores', 'shield', '180,190,215']
    ];

    function panel() {
        var dash = document.querySelector('.app.admin-pdf .dash');
        if (!dash) return;

        /* Tarjeta de accesos rápidos */
        if (!dash.querySelector('.a-acc')) {
            var s = document.createElement('section');
            s.className = 'card a-acc';
            s.innerHTML =
                '<div class="card-h"><h3>Accesos rápidos</h3></div>' +
                '<div class="accesos-pdf">' +
                ACCESOS.map(function (a) {
                    return '<a href="' + a[0] + '" style="--t:' + a[3] + '">' + ic(a[2]) + '<span>' + a[1] + '</span></a>';
                }).join('') +
                '</div>';
            dash.appendChild(s);
        }

        /* Ícono en el título de cada tarjeta */
        Array.prototype.forEach.call(dash.querySelectorAll('.card-h h3'), function (h) {
            if (h.getAttribute('data-ico')) return;
            var nombre = ICONOS_TARJETA[h.textContent.trim()];
            if (!nombre) return;
            h.setAttribute('data-ico', '1');
            h.insertAdjacentHTML('afterbegin', ic(nombre));
        });

        /* Porcentaje de cada estado de la flota */
        var totalEl = dash.querySelector('.total-flota b');
        var total = totalEl ? parseInt(totalEl.textContent, 10) : 0;
        if (total > 0) {
            Array.prototype.forEach.call(dash.querySelectorAll('.leyenda > div'), function (fila) {
                if (fila.querySelector('.pct')) return;
                var b = fila.querySelector('b');
                if (!b) return;
                var n = parseInt(b.textContent, 10) || 0;
                b.insertAdjacentHTML('afterend', '<em class="pct">' + Math.round((n / total) * 100) + '%</em>');
            });
        }
    }

    var pendiente = false;

    function aplicar() {
        pendiente = false;
        if (!marcar()) return;
        submenu();
        panel();
    }

    function programar() {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(aplicar);
    }

    new MutationObserver(programar).observe(raiz, { childList: true, subtree: true });
    window.addEventListener('hashchange', programar);
    aplicar();
})();