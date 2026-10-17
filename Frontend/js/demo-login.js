/* Accesos de desarrollo disponibles solo con LOCAL_DB=true. */
(function () {
    var cfg = window.AUTOGO_CONFIG || {};
    if (cfg.LOCAL_DB !== true) return;

    var raiz = document.getElementById('raiz');
    if (!raiz) return;

    function expiraDemo() {
        return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    }

    function entrarDemo(tipo) {
        if (typeof Api === 'undefined' || !Api.guardarSesion) return;

        var esSuperadmin = tipo === 'superadmin';
        var auth = {
            token: esSuperadmin ? 'AUTOGO-DEMO-SUPERADMIN' : 'AUTOGO-DEMO-CLIENTE',
            expiraEnUtc: expiraDemo(),
            usuario: esSuperadmin ? {
                id: -1001,
                nombre: 'Superadmin Demo',
                correo: 'superadmin.demo@autogo.local',
                rol: 'ADMINISTRADOR',
                perfil: 'Superadministrador',
                debeCambiarPassword: false,
                clienteId: null
            } : {
                id: -1002,
                nombre: 'Cliente Demo',
                correo: 'cliente.demo@autogo.local',
                rol: 'CLIENTE',
                perfil: null,
                debeCambiarPassword: false,
                clienteId: -1002
            }
        };

        Api.guardarSesion(auth, false);

        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(esSuperadmin ? 'Sesión demo: Superadministrador' : 'Sesión demo: Cliente');
        }

        location.hash = esSuperadmin ? '#/dashboard' : '#/inicio';
    }

    function agregarBotones() {
        var ruta = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'login');
        if (ruta !== 'login') return;

        var panel = document.querySelector('.auth-panel .contenido');
        var form = panel && panel.querySelector('#f');
        if (!panel || !form || panel.querySelector('.demo-login')) return;

        var demo = document.createElement('div');
        demo.className = 'demo-login';
        demo.innerHTML = [
            '<div class="demo-login-sep"><span>Acceso rápido para pruebas</span></div>',
            '<div class="demo-login-botones">',
            '  <button type="button" class="demo-btn demo-admin" data-demo-login="superadmin">',
            '    <span class="demo-ico">A</span><span><b>Superadmin</b><small>Entrar en modo demo</small></span>',
            '  </button>',
            '  <button type="button" class="demo-btn demo-cliente" data-demo-login="cliente">',
            '    <span class="demo-ico">C</span><span><b>Cliente</b><small>Entrar en modo demo</small></span>',
            '  </button>',
            '</div>'
        ].join('');

        form.insertAdjacentElement('afterend', demo);
    }

    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-demo-login]');
        if (!b) return;
        entrarDemo(b.getAttribute('data-demo-login'));
    });

    new MutationObserver(agregarBotones).observe(raiz, { childList: true, subtree: true });
    window.addEventListener('hashchange', function () { setTimeout(agregarBotones, 0); });
    agregarBotones();
})();
