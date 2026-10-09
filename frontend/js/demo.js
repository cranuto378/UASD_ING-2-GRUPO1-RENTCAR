/* =========================================================
   MODO DEMOSTRACIÓN
   Replica las operaciones de la API con datos locales para
   poder usar el front sin backend. Sigue las mismas reglas
   de la guía (fechas, mora, facturas, permisos).
   Reiniciar datos: ?demo=reset
========================================================= */

const Demo = (() => {
  const CLAVE = 'autogo.demo.db';
  const VERSION = 2;

  class Fallo extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  const falla = (code, message) => { throw new Fallo(code, message); };

  const hoy = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  const mas = (f, n) => {
    const d = new Date(f + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const entre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const dinero = n => Math.round(n * 100) / 100;
  const emision = (fecha, hora = '10:30') => new Date(`${fecha}T${hora}:00`).toISOString();
  const copia = o => (o === undefined ? null : JSON.parse(JSON.stringify(o)));
  const plano = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let db = null;


  /* Datos iniciales */

  function semilla() {
    const h = hoy();

    const categorias = ['Compacto', 'Económico', 'Sedán', 'SUV', 'Van', 'Negocio']
      .map((nombre, i) => ({ id: i + 1, nombre }));

    const foto = (marca, modelo) => `img/vehiculos/${`${marca}-${modelo}`.toLowerCase().replace(/\s+/g, '-')}.jpg`;

    const v = (id, placa, categoriaId, marca, modelo, anio, precioDia, estadoOperativo = 'DISPONIBLE', mantenimientoHasta = null) =>
      ({ id, placa, categoriaId, marca, modelo, anio, precioDia, estadoOperativo, mantenimientoHasta, fotoUrl: foto(marca, modelo), activo: true });

    const vehiculos = [
      v(1, 'C112233', 1, 'Kia', 'Rio', 2023, 1800),
      v(2, 'C456789', 2, 'Nissan', 'Versa', 2018, 2000),
      v(3, 'C123456', 3, 'Toyota', 'Corolla', 2022, 2500),
      v(4, 'C567890', 4, 'Honda', 'CR-V', 2023, 3800),
      v(5, 'C345678', 3, 'Chevrolet', 'Cruze', 2021, 2400),
      v(6, 'C334455', 6, 'Toyota', 'Hilux', 2022, 5200),
      v(7, 'C556677', 4, 'Mazda', 'CX-5', 2023, 4300),
      v(8, 'C678901', 4, 'Ford', 'Explorer', 2021, 4500),
      v(9, 'C223344', 2, 'Suzuki', 'Celerio', 2022, 1500, 'MANTENIMIENTO', mas(h, 2)),
      v(10, 'L778899', 5, 'Suzuki', 'APV', 2020, 2600),
      v(11, 'C998877', 4, 'Hyundai', 'Tucson', 2022, 3200),
      v(12, 'C445566', 6, 'Nissan', 'Frontier', 2021, 4800, 'FUERA_DE_SERVICIO')
    ];

    const c = (id, nombre, cedula, correo, telefono, licenciaConducir, tieneCuenta, diasAtras) =>
      ({ id, nombre, cedula, correo, telefono, licenciaConducir, activo: true, tieneCuenta, fechaCreacion: emision(mas(h, -diasAtras), '09:15') });

    const clientes = [
      c(1, 'Ana Familia', '001-3456789-0', 'ana@correo.com', '849-555-2002', '00200002', true, 200),
      c(2, 'Juan Pérez', '001-1234567-8', null, '809-555-0000', null, false, 190),
      c(3, 'Carmen Sánchez', '001-5678901-2', 'carmen@correo.com', '829-555-2004', '00300003', false, 170),
      c(4, 'Luis Castillo', '001-4567890-1', 'luis@correo.com', '809-555-2003', null, false, 150),
      c(5, 'Pedro Martínez', '001-2345678-9', 'pedro@correo.com', '829-555-2001', '00500005', false, 120),
      c(6, 'María Rodríguez', '402-1122334-5', 'maria@correo.com', '809-555-3010', '00600006', false, 90)
    ];

    const usuarios = [
      { id: 1, nombre: 'Administrador AutoGo', correo: 'admin@autogo.com', password: 'Admin2026', rol: 'ADMINISTRADOR', debeCambiarPassword: false, clienteId: null, activo: true },
      { id: 2, nombre: 'Ana Familia', correo: 'ana@correo.com', password: 'Clave2026', rol: 'CLIENTE', debeCambiarPassword: false, clienteId: 1, activo: true }
    ];

    db = {
      version: VERSION,
      categorias, vehiculos, clientes, usuarios,
      alquileres: [], facturas: [], recuperaciones: {},
      seq: { categoria: 7, vehiculo: 13, cliente: 7, usuario: 3, alquiler: 1, factura: 1 }
    };

    // Historial de los últimos meses (generador fijo para que siempre salga igual)
    let s = 7;
    const azar = n => { s = (s * 9301 + 49297) % 233280; return Math.floor((s / 233280) * n); };

    for (let mes = 5; mes >= 1; mes--) {
      const cantidad = 3 + azar(3) + (5 - mes);

      for (let i = 0; i < cantidad; i++) {
        const ini = mas(h, -mes * 30 + azar(24));
        const fin = mas(ini, 2 + azar(5));
        const veh = vehiculos[azar(11)];
        const a = nuevoAlquiler(2 + azar(5), veh, ini, fin, ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'][azar(3)], 'MOSTRADOR', ini);
        cerrar(a, fin, null);
      }
    }

    // Alquileres de Ana
    const a1 = nuevoAlquiler(1, vehiculos[2], mas(h, -40), mas(h, -36), 'TARJETA', 'PORTAL', mas(h, -42));
    cerrar(a1, mas(h, -35), 'TARJETA');

    const a2 = nuevoAlquiler(1, vehiculos[1], mas(h, -20), mas(h, -17), 'TARJETA', 'PORTAL', mas(h, -25));
    a2.estado = 'CANCELADO';
    a2.observaciones = 'Cambio de planes';
    facturar(a2, 'AJUSTE', 'Nota de crédito por cancelación', -a2.montoBase, 'TARJETA', mas(h, -24));

    nuevoAlquiler(1, vehiculos[3], mas(h, -2), mas(h, 3), 'TARJETA', 'PORTAL', mas(h, -3));
    nuevoAlquiler(1, vehiculos[0], mas(h, 5), mas(h, 8), 'TRANSFERENCIA', 'PORTAL', mas(h, -1));

    // Operación del día
    nuevoAlquiler(3, vehiculos[4], mas(h, -6), mas(h, -2), 'EFECTIVO', 'MOSTRADOR', mas(h, -6));
    nuevoAlquiler(4, vehiculos[6], mas(h, -3), h, 'TARJETA', 'MOSTRADOR', mas(h, -3));
    nuevoAlquiler(5, vehiculos[7], mas(h, 2), mas(h, 6), 'EFECTIVO', 'MOSTRADOR', mas(h, -1));
    nuevoAlquiler(6, vehiculos[5], mas(h, -1), mas(h, 4), 'TRANSFERENCIA', 'MOSTRADOR', mas(h, -1));
    nuevoAlquiler(2, vehiculos[10], h, mas(h, 2), 'EFECTIVO', 'MOSTRADOR', h);
  }

  function cerrar(a, fechaDevolucion, metodoMora) {
    const diasMora = Math.max(0, entre(a.fechaFinPactada, fechaDevolucion));

    a.fechaDevolucion = fechaDevolucion;
    a.diasMora = diasMora;
    a.montoMora = dinero(a.precioDia * 1.3 * diasMora);
    a.estado = 'COMPLETADO';

    if (diasMora > 0) {
      facturar(a, 'MORA', `Mora por ${diasMora} día(s) de retraso`, a.montoMora, metodoMora || 'EFECTIVO', fechaDevolucion);
    }
  }


  /* Persistencia */

  function cargar() {
    if (new URLSearchParams(location.search).get('demo') === 'reset') {
      try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
    }

    try { db = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { db = null; }

    if (!db || !db.seq || db.version !== VERSION) {
      semilla();
      guardar();
    }
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch (e) { /* cuota llena: queda en memoria */ }
  }


  /* Reglas */

  function nuevoAlquiler(clienteId, veh, fechaInicio, fechaFin, metodoPago, canal, creado) {
    const dias = entre(fechaInicio, fechaFin);

    const a = {
      id: db.seq.alquiler++,
      clienteId,
      vehiculoId: veh.id,
      canal,
      fechaInicio,
      fechaFinPactada: fechaFin,
      fechaDevolucion: null,
      precioDia: veh.precioDia,
      dias,
      montoBase: dinero(dias * veh.precioDia),
      diasMora: 0,
      montoMora: 0,
      estado: 'ACTIVO',
      observaciones: null,
      fechaCreacion: emision(creado || hoy(), '09:40')
    };

    db.alquileres.push(a);
    facturar(a, 'ALQUILER', `Alquiler de vehículo por ${dias} día(s)`, a.montoBase, metodoPago, creado);

    return a;
  }

  function facturar(a, tipo, concepto, monto, metodoPago, fecha) {
    const f = {
      id: db.seq.factura++,
      alquilerId: a.id,
      tipo,
      concepto,
      monto: dinero(monto),
      metodoPago: metodoPago || null,
      fechaEmision: fecha ? emision(fecha, '11:' + String(10 + (db.seq.factura % 49)).padStart(2, '0')) : new Date().toISOString()
    };

    db.facturas.push(f);
    return f;
  }

  function validarRango(ini, fin) {
    if (!ini || !fin) falla('FECHAS_INVALIDAS', 'Indica la fecha de salida y la de entrega.');
    if (ini < hoy()) falla('FECHAS_INVALIDAS', 'La fecha de salida no puede ser pasada.');
    if (fin <= ini) falla('FECHAS_INVALIDAS', 'La fecha de entrega debe ser posterior a la salida.');
    if (entre(ini, fin) > 90) falla('FECHAS_INVALIDAS', 'El alquiler no puede superar 90 días.');
  }

  const finEfectivo = a => (a.fechaFinPactada <= hoy() ? mas(hoy(), 1) : a.fechaFinPactada);

  function libre(veh, ini, fin, excepto) {
    if (!veh.activo || veh.estadoOperativo === 'FUERA_DE_SERVICIO') return false;

    if (veh.estadoOperativo === 'MANTENIMIENTO' &&
        (!veh.mantenimientoHasta || veh.mantenimientoHasta >= ini)) return false;

    return !db.alquileres.some(a =>
      a.vehiculoId === veh.id &&
      a.estado === 'ACTIVO' &&
      a.id !== excepto &&
      a.fechaInicio < fin &&
      ini < finEfectivo(a)
    );
  }

  function estadoActual(veh) {
    const h = hoy();

    if (db.alquileres.some(a => a.vehiculoId === veh.id && a.estado === 'ACTIVO' && a.fechaInicio <= h)) {
      return 'ALQUILADO';
    }

    if (veh.estadoOperativo === 'MANTENIMIENTO' && veh.mantenimientoHasta && veh.mantenimientoHasta < h) {
      return 'DISPONIBLE';
    }

    return veh.estadoOperativo;
  }

  function siguienteLaborable(f) {
    let d = mas(f, 1);
    while ([0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())) d = mas(d, 1);
    return d;
  }

  function validarPassword(p) {
    if (!p || p.length < 8 || !/[a-zñ]/i.test(p) || !/\d/.test(p)) {
      falla('DATO_INVALIDO', 'La contraseña debe tener al menos 8 caracteres, con letras y números.');
    }
  }

  function normalizarCedula(c) {
    const d = String(c || '').replace(/\D/g, '');
    if (d.length !== 11) falla('DATO_INVALIDO', 'La cédula debe tener 11 dígitos.');
    return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
  }

  function validarCorreo(c, obligatorio) {
    if (!c) {
      if (obligatorio) falla('DATO_INVALIDO', 'El correo es obligatorio.');
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) falla('DATO_INVALIDO', 'El correo no tiene un formato válido.');
    return c.trim().toLowerCase();
  }

  function metodoValido(m, obligatorio) {
    if (!m) {
      if (obligatorio) falla('DATO_INVALIDO', 'Indica el método de pago.');
      return null;
    }
    if (!['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].includes(m)) falla('DATO_INVALIDO', 'Método de pago no válido.');
    return m;
  }


  /* Vistas de salida */

  const categoriaDe = id => (db.categorias.find(x => x.id === id) || {}).nombre || '—';
  const vehiculoDe = id => db.vehiculos.find(x => x.id === id);
  const clienteDe = id => db.clientes.find(x => x.id === id);

  const vVehiculo = veh => ({
    ...veh,
    categoria: categoriaDe(veh.categoriaId),
    estadoActual: estadoActual(veh),
    mantenimientoHasta: veh.estadoOperativo === 'MANTENIMIENTO' ? veh.mantenimientoHasta : null
  });

  function vAlquiler(a) {
    const veh = vehiculoDe(a.vehiculoId);
    const cli = clienteDe(a.clienteId);
    const h = hoy();
    const vencido = a.estado === 'ACTIVO' && h > a.fechaFinPactada;

    return {
      ...a,
      clienteNombre: cli.nombre,
      clienteCedula: cli.cedula,
      placa: veh.placa,
      vehiculo: `${veh.marca} ${veh.modelo}`,
      montoTotal: dinero(a.montoBase + a.montoMora),
      totalFacturado: dinero(db.facturas.filter(f => f.alquilerId === a.id).reduce((t, f) => t + f.monto, 0)),
      vencido,
      diasRetraso: vencido ? entre(a.fechaFinPactada, h) : 0
    };
  }

  function vFactura(f) {
    const a = db.alquileres.find(x => x.id === f.alquilerId);
    const veh = vehiculoDe(a.vehiculoId);
    const cli = clienteDe(a.clienteId);

    return {
      ...f,
      clienteId: cli.id,
      clienteNombre: cli.nombre,
      clienteCedula: cli.cedula,
      clienteTelefono: cli.telefono,
      clienteCorreo: cli.correo,
      vehiculoId: veh.id,
      placa: veh.placa,
      vehiculo: `${veh.marca} ${veh.modelo}`,
      categoria: categoriaDe(veh.categoriaId),
      fechaInicio: a.fechaInicio,
      fechaFinPactada: a.fechaFinPactada,
      dias: a.dias,
      precioDia: a.precioDia
    };
  }

  const vUsuario = u => ({
    id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol,
    debeCambiarPassword: u.debeCambiarPassword, clienteId: u.clienteId
  });

  const auth = u => ({
    token: `demo-${u.id}-${Date.now().toString(36)}`,
    expiraEnUtc: new Date(Date.now() + 8 * 3600e3).toISOString(),
    usuario: vUsuario(u)
  });

  function conexion(lista, { first, after, last, before }) {
    const total = lista.length;
    let ini = 0;
    let fin = total;

    if (after) ini = +atob(after) + 1;
    if (before) fin = +atob(before);

    if (first != null) fin = Math.min(fin, ini + Math.min(first, 200));
    else if (last != null) ini = Math.max(ini, fin - Math.min(last, 200));
    else fin = Math.min(fin, ini + 50);

    const nodes = lista.slice(ini, fin);

    return {
      totalCount: total,
      nodes,
      pageInfo: {
        hasPreviousPage: ini > 0,
        hasNextPage: fin < total,
        startCursor: nodes.length ? btoa(String(ini)) : null,
        endCursor: nodes.length ? btoa(String(fin - 1)) : null
      }
    };
  }


  /* Permisos */

  function usuarioDe(token) {
    const m = /^demo-(\d+)-/.exec(token || '');
    if (!m) return null;
    const u = db.usuarios.find(x => x.id === +m[1] && x.activo);
    return u || null;
  }

  function requiere(ctx, rol) {
    const u = ctx.u;
    if (!u) falla('AUTH_NOT_AUTHENTICATED', 'Debes iniciar sesión.');
    if (u.debeCambiarPassword) falla('AUTH_NOT_AUTHORIZED', 'Debes cambiar tu contraseña antes de continuar.');
    if (rol && u.rol !== rol) falla('AUTH_NOT_AUTHORIZED', 'No tienes permiso para realizar esta operación.');
    return u;
  }

  const admin = ctx => requiere(ctx, 'ADMINISTRADOR');
  const cliente = ctx => requiere(ctx, 'CLIENTE');

  function alquilerPropio(ctx, id) {
    const u = requiere(ctx);
    const a = db.alquileres.find(x => x.id === id);
    if (!a) falla('NO_ENCONTRADO', 'El alquiler no existe.');
    if (u.rol !== 'ADMINISTRADOR' && a.clienteId !== u.clienteId) falla('ACCESO_DENEGADO', 'No tienes acceso a este alquiler.');
    return a;
  }

  function activo(a) {
    if (a.estado !== 'ACTIVO') falla('ALQUILER_NO_ACTIVO', 'El alquiler ya no está activo.');
  }


  /* Operaciones */

  const H = {
    login({ correo, password }) {
      const u = db.usuarios.find(x => x.correo === plano(correo).trim() && x.activo);
      if (!u || u.password !== password) falla('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
      return auth(u);
    },

    registrarCliente({ input }) {
      const correo = validarCorreo(input.correo, true);
      if (!input.nombre || !input.nombre.trim()) falla('DATO_INVALIDO', 'El nombre es obligatorio.');
      validarPassword(input.password);
      const cedula = normalizarCedula(input.cedula);

      if (db.usuarios.some(x => x.correo === correo)) falla('CORREO_DUPLICADO', 'Ya existe una cuenta con ese correo.');

      let cli = db.clientes.find(x => x.cedula === cedula);
      if (cli && cli.tieneCuenta) falla('CEDULA_DUPLICADA', 'Ya existe una cuenta registrada con esa cédula.');

      if (cli) {
        Object.assign(cli, { correo, tieneCuenta: true, activo: true });
      } else {
        cli = {
          id: db.seq.cliente++, nombre: input.nombre.trim(), cedula, correo,
          telefono: input.telefono || null, licenciaConducir: input.licenciaConducir || null,
          activo: true, tieneCuenta: true, fechaCreacion: new Date().toISOString()
        };
        db.clientes.push(cli);
      }

      const u = {
        id: db.seq.usuario++, nombre: cli.nombre, correo, password: input.password,
        rol: 'CLIENTE', debeCambiarPassword: false, clienteId: cli.id, activo: true
      };
      db.usuarios.push(u);

      return auth(u);
    },

    me(v, ctx) {
      if (!ctx.u) falla('AUTH_NOT_AUTHENTICATED', 'Debes iniciar sesión.');
      return vUsuario(ctx.u);
    },

    cambiarPassword({ passwordActual, passwordNueva }, ctx) {
      const u = ctx.u;
      if (!u) falla('AUTH_NOT_AUTHENTICATED', 'Debes iniciar sesión.');
      if (u.password !== passwordActual) falla('CREDENCIALES_INVALIDAS', 'La contraseña actual no es correcta.');
      if (passwordNueva === passwordActual) falla('PASSWORD_REPETIDA', 'La nueva contraseña debe ser distinta de la actual.');
      validarPassword(passwordNueva);
      u.password = passwordNueva;
      u.debeCambiarPassword = false;
      return auth(u);
    },

    solicitarRecuperacionPassword({ correo }) {
      const u = db.usuarios.find(x => x.correo === plano(correo).trim() && x.activo);

      if (u) {
        const token = Math.random().toString(36).slice(2, 12);
        db.recuperaciones[token] = { usuarioId: u.id, vence: Date.now() + 30 * 60e3 };
        const ruta = location.pathname.replace(/[^/]*$/, '');
        console.info('Enlace de recuperación:', `${location.origin}${ruta}restablecer-password/?token=${token}`);
      }

      return true;
    },

    restablecerPassword({ token, passwordNueva }) {
      const r = db.recuperaciones[token];
      if (!r || r.vence < Date.now()) falla('TOKEN_INVALIDO', 'El enlace de recuperación venció o ya fue usado.');
      validarPassword(passwordNueva);
      const u = db.usuarios.find(x => x.id === r.usuarioId);
      u.password = passwordNueva;
      u.debeCambiarPassword = false;
      delete db.recuperaciones[token];
      return true;
    },

    crearAdministrador({ input }, ctx) {
      admin(ctx);
      const correo = validarCorreo(input.correo, true);
      if (!input.nombre || !input.nombre.trim()) falla('DATO_INVALIDO', 'El nombre es obligatorio.');
      validarPassword(input.passwordTemporal);
      if (db.usuarios.some(x => x.correo === correo)) falla('CORREO_DUPLICADO', 'Ya existe un usuario con ese correo.');

      const u = {
        id: db.seq.usuario++, nombre: input.nombre.trim(), correo, password: input.passwordTemporal,
        rol: 'ADMINISTRADOR', debeCambiarPassword: true, clienteId: null, activo: true
      };
      db.usuarios.push(u);

      return vUsuario(u);
    },


    categorias: () => db.categorias,

    vehiculosDisponibles({ fechaInicio, fechaFin, categoriaId }) {
      validarRango(fechaInicio, fechaFin);
      return db.vehiculos
        .filter(x => (!categoriaId || x.categoriaId === categoriaId) && libre(x, fechaInicio, fechaFin))
        .map(vVehiculo);
    },

    cotizarAlquiler({ vehiculoId, fechaInicio, fechaFin }) {
      const veh = vehiculoDe(vehiculoId);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      if (!fechaInicio || !fechaFin || fechaFin <= fechaInicio) falla('FECHAS_INVALIDAS', 'La fecha de entrega debe ser posterior a la salida.');
      if (entre(fechaInicio, fechaFin) > 90) falla('FECHAS_INVALIDAS', 'El alquiler no puede superar 90 días.');
      const dias = entre(fechaInicio, fechaFin);
      return { vehiculoId, fechaInicio, fechaFin, dias, precioDia: veh.precioDia, total: dinero(dias * veh.precioDia) };
    },

    vehiculo({ id }) {
      const veh = vehiculoDe(id);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      return vVehiculo(veh);
    },

    vehiculos(v, ctx) {
      admin(ctx);
      const t = plano(v.texto);
      const lista = db.vehiculos
        .filter(x => v.incluirInactivos || x.activo)
        .filter(x => !v.categoriaId || x.categoriaId === v.categoriaId)
        .filter(x => !t || plano(`${x.placa} ${x.marca} ${x.modelo}`).includes(t))
        .sort((a, b) => a.placa.localeCompare(b.placa))
        .map(vVehiculo);
      return conexion(lista, v);
    },

    crearCategoria({ nombre }, ctx) {
      admin(ctx);
      if (!nombre || !nombre.trim()) falla('DATO_INVALIDO', 'El nombre es obligatorio.');
      if (db.categorias.some(x => plano(x.nombre) === plano(nombre.trim()))) falla('CATEGORIA_DUPLICADA', 'Ya existe una categoría con ese nombre.');
      const cat = { id: db.seq.categoria++, nombre: nombre.trim() };
      db.categorias.push(cat);
      return cat;
    },

    crearVehiculo({ input }, ctx) {
      admin(ctx);
      const datos = validarVehiculo(input);
      const veh = { id: db.seq.vehiculo++, ...datos, estadoOperativo: 'DISPONIBLE', mantenimientoHasta: null, fotoUrl: null, activo: true };
      db.vehiculos.push(veh);
      return vVehiculo(veh);
    },

    actualizarVehiculo({ id, input }, ctx) {
      admin(ctx);
      const veh = vehiculoDe(id);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      Object.assign(veh, validarVehiculo(input, id));
      return vVehiculo(veh);
    },

    cambiarEstadoVehiculo({ input }, ctx) {
      admin(ctx);
      const veh = vehiculoDe(input.vehiculoId);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      if (estadoActual(veh) === 'ALQUILADO') falla('REGLA_NEGOCIO', 'No se puede cambiar el estado de un vehículo alquilado; primero registra la devolución.');
      if (!['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'].includes(input.estado)) falla('DATO_INVALIDO', 'Estado no válido.');
      veh.estadoOperativo = input.estado;
      veh.mantenimientoHasta = input.estado === 'MANTENIMIENTO' ? (input.mantenimientoHasta || null) : null;
      return vVehiculo(veh);
    },

    async subirFotoVehiculo({ id, foto }, ctx) {
      admin(ctx);
      const veh = vehiculoDe(id);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      if (!foto || !/\.(jpe?g|png|webp)$/i.test(foto.name)) falla('DATO_INVALIDO', 'La foto debe ser jpg, jpeg, png o webp.');
      if (foto.size > 5 * 1024 * 1024) falla('DATO_INVALIDO', 'La foto no puede superar 5 MB.');

      veh.fotoUrl = await new Promise((ok, mal) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => mal(new Fallo('DATO_INVALIDO', 'No se pudo leer la foto.'));
        r.readAsDataURL(foto);
      });

      return vVehiculo(veh);
    },

    desactivarVehiculo({ id }, ctx) {
      admin(ctx);
      const veh = vehiculoDe(id);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      if (db.alquileres.some(a => a.vehiculoId === id && a.estado === 'ACTIVO')) {
        falla('REGLA_NEGOCIO', 'El vehículo tiene alquileres activos o futuros; no se puede desactivar.');
      }
      veh.activo = false;
      return true;
    },


    clientes(v, ctx) {
      admin(ctx);
      const t = plano(v.texto);
      const td = String(v.texto || '').replace(/\D/g, '');
      const lista = db.clientes
        .filter(x => v.incluirInactivos || x.activo)
        .filter(x => !t || plano(`${x.nombre} ${x.correo || ''}`).includes(t) || (td && x.cedula.replace(/\D/g, '').includes(td)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      return conexion(lista, v);
    },

    cliente({ id }, ctx) {
      const u = requiere(ctx);
      if (u.rol !== 'ADMINISTRADOR' && u.clienteId !== id) falla('ACCESO_DENEGADO', 'No tienes acceso a este cliente.');
      const c = clienteDe(id);
      if (!c) falla('NO_ENCONTRADO', 'El cliente no existe.');
      return c;
    },

    miPerfil(v, ctx) {
      const u = cliente(ctx);
      return clienteDe(u.clienteId);
    },

    crearCliente({ input }, ctx) {
      admin(ctx);
      const c = { id: db.seq.cliente++, ...validarCliente(input), activo: true, tieneCuenta: false, fechaCreacion: new Date().toISOString() };
      db.clientes.push(c);
      return c;
    },

    actualizarCliente({ id, input }, ctx) {
      admin(ctx);
      const c = clienteDe(id);
      if (!c) falla('NO_ENCONTRADO', 'El cliente no existe.');
      Object.assign(c, validarCliente(input, id));
      return c;
    },

    desactivarCliente({ id }, ctx) {
      admin(ctx);
      const c = clienteDe(id);
      if (!c) falla('NO_ENCONTRADO', 'El cliente no existe.');
      if (db.alquileres.some(a => a.clienteId === id && a.estado === 'ACTIVO')) {
        falla('REGLA_NEGOCIO', 'El cliente tiene alquileres activos; no se puede desactivar.');
      }
      c.activo = false;
      db.usuarios.filter(x => x.clienteId === id).forEach(x => { x.activo = false; });
      return true;
    },


    crearAlquiler({ input }, ctx) {
      const u = requiere(ctx);
      const esAdmin = u.rol === 'ADMINISTRADOR';
      const clienteId = esAdmin ? input.clienteId : u.clienteId;

      if (esAdmin && !clienteId) falla('DATO_INVALIDO', 'Selecciona el cliente.');
      const cli = clienteDe(clienteId);
      if (!cli || !cli.activo) falla('NO_ENCONTRADO', 'El cliente no existe o está inactivo.');

      const metodo = metodoValido(input.metodoPago, true);
      validarRango(input.fechaInicio, input.fechaFin);

      const veh = vehiculoDe(input.vehiculoId);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      if (!libre(veh, input.fechaInicio, input.fechaFin)) falla('VEHICULO_NO_DISPONIBLE', 'El vehículo ya está comprometido en ese rango de fechas.');

      const a = nuevoAlquiler(clienteId, veh, input.fechaInicio, input.fechaFin, metodo, esAdmin ? 'MOSTRADOR' : 'PORTAL', null);
      a.fechaCreacion = new Date().toISOString();
      const f = db.facturas[db.facturas.length - 1];

      return { facturaId: f.id, alquiler: vAlquiler(a) };
    },

    misAlquileres(v, ctx) {
      const u = cliente(ctx);
      return db.alquileres
        .filter(a => a.clienteId === u.clienteId)
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
        .map(vAlquiler);
    },

    alquileres(v, ctx) {
      admin(ctx);
      let lista = db.alquileres
        .filter(a => !v.clienteId || a.clienteId === v.clienteId)
        .filter(a => !v.vehiculoId || a.vehiculoId === v.vehiculoId)
        .filter(a => !v.estado || a.estado === v.estado)
        .map(vAlquiler)
        .filter(a => !v.soloVencidos || a.vencido);

      lista = v._orden === 'vencimiento'
        ? lista.sort((a, b) => a.fechaFinPactada.localeCompare(b.fechaFinPactada))
        : lista.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));

      return conexion(lista, v);
    },

    alquiler({ id }, ctx) {
      return vAlquiler(alquilerPropio(ctx, id));
    },

    modificarAlquiler({ input }, ctx) {
      admin(ctx);
      const a = db.alquileres.find(x => x.id === input.alquilerId);
      if (!a) falla('NO_ENCONTRADO', 'El alquiler no existe.');
      activo(a);

      const comenzo = a.fechaInicio <= hoy();

      if (comenzo && (input.fechaInicio !== a.fechaInicio || input.vehiculoId !== a.vehiculoId)) {
        falla('REGLA_NEGOCIO', 'El alquiler ya comenzó: no se puede cambiar la fecha de salida ni el vehículo.');
      }

      if (comenzo) {
        if (input.fechaFin <= a.fechaInicio) falla('FECHAS_INVALIDAS', 'La fecha de entrega debe ser posterior a la salida.');
        if (entre(a.fechaInicio, input.fechaFin) > 90) falla('FECHAS_INVALIDAS', 'El alquiler no puede superar 90 días.');
      } else {
        validarRango(input.fechaInicio, input.fechaFin);
      }

      const veh = vehiculoDe(input.vehiculoId);
      if (!veh) falla('NO_ENCONTRADO', 'El vehículo no existe.');
      if (!libre(veh, input.fechaInicio, input.fechaFin, a.id)) falla('VEHICULO_NO_DISPONIBLE', 'El vehículo ya está comprometido en ese rango de fechas.');

      const dias = entre(input.fechaInicio, input.fechaFin);
      const nuevo = dinero(dias * veh.precioDia);
      const diferencia = dinero(nuevo - a.montoBase);
      const metodo = metodoValido(input.metodoPago, diferencia > 0);

      Object.assign(a, {
        vehiculoId: veh.id, fechaInicio: input.fechaInicio, fechaFinPactada: input.fechaFin,
        precioDia: veh.precioDia, dias, montoBase: nuevo
      });

      let factura = null;

      if (diferencia !== 0) {
        factura = facturar(a, 'AJUSTE',
          diferencia > 0 ? 'Ajuste por modificación del alquiler' : 'Nota de crédito por modificación del alquiler',
          diferencia, metodo, null);
      }

      return { facturaId: factura ? factura.id : null, alquiler: vAlquiler(a) };
    },

    cancelarAlquiler({ alquilerId, motivo }, ctx) {
      const a = alquilerPropio(ctx, alquilerId);
      activo(a);
      if (a.fechaInicio <= hoy()) falla('CANCELACION_NO_PERMITIDA', 'El alquiler ya comenzó; registra la devolución en su lugar.');

      const pagado = db.facturas.filter(f => f.alquilerId === a.id).reduce((t, f) => t + f.monto, 0);
      const original = db.facturas.find(f => f.alquilerId === a.id && f.tipo === 'ALQUILER');

      a.estado = 'CANCELADO';
      a.observaciones = motivo || null;

      const f = facturar(a, 'AJUSTE', 'Nota de crédito por cancelación', -pagado, original && original.metodoPago, null);
      return { facturaId: f.id, alquiler: vAlquiler(a) };
    },

    cotizarDevolucion({ alquilerId, fechaDevolucion }, ctx) {
      const a = alquilerPropio(ctx, alquilerId);
      activo(a);
      return cotizarDev(a, fechaDevolucion);
    },

    registrarDevolucion({ input }, ctx) {
      admin(ctx);
      const a = db.alquileres.find(x => x.id === input.alquilerId);
      if (!a) falla('NO_ENCONTRADO', 'El alquiler no existe.');
      activo(a);

      const c = cotizarDev(a, input.fechaDevolucion);
      const metodo = metodoValido(input.metodoPagoMora, c.diasMora > 0);
      const antes = db.facturas.length;

      cerrar(a, c.fechaDevolucion, metodo);

      const veh = vehiculoDe(a.vehiculoId);
      veh.estadoOperativo = 'MANTENIMIENTO';
      veh.mantenimientoHasta = siguienteLaborable(c.fechaDevolucion);

      const f = db.facturas.length > antes ? db.facturas[db.facturas.length - 1] : null;
      if (f) f.fechaEmision = new Date().toISOString();

      return { facturaId: f ? f.id : null, alquiler: vAlquiler(a) };
    },


    facturas(v, ctx) {
      admin(ctx);
      const local = iso => {
        const d = new Date(iso);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 10);
      };

      const lista = db.facturas
        .map(vFactura)
        .filter(f => !v.clienteId || f.clienteId === v.clienteId)
        .filter(f => !v.alquilerId || f.alquilerId === v.alquilerId)
        .filter(f => !v.desde || local(f.fechaEmision) >= v.desde)
        .filter(f => !v.hasta || local(f.fechaEmision) <= v.hasta)
        .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision));

      return conexion(lista, v);
    },

    misFacturas(v, ctx) {
      const u = cliente(ctx);
      return db.facturas
        .map(vFactura)
        .filter(f => f.clienteId === u.clienteId)
        .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision));
    },

    factura({ id }, ctx) {
      const u = requiere(ctx);
      const f = db.facturas.find(x => x.id === id);
      if (!f) falla('NO_ENCONTRADO', 'La factura no existe.');
      const vf = vFactura(f);
      if (u.rol !== 'ADMINISTRADOR' && vf.clienteId !== u.clienteId) falla('ACCESO_DENEGADO', 'No tienes acceso a esta factura.');
      return vf;
    },

    dashboard(v, ctx) {
      admin(ctx);
      const h = hoy();
      const estados = db.vehiculos.filter(x => x.activo).map(estadoActual);
      const cuenta = e => estados.filter(x => x === e).length;
      const activos = db.alquileres.filter(a => a.estado === 'ACTIVO');
      const mes = h.slice(0, 7);
      const local = iso => {
        const d = new Date(iso);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 7);
      };

      return {
        totalClientes: db.clientes.filter(x => x.activo).length,
        totalVehiculos: estados.length,
        vehiculosDisponibles: cuenta('DISPONIBLE'),
        vehiculosAlquilados: cuenta('ALQUILADO'),
        vehiculosEnMantenimiento: cuenta('MANTENIMIENTO'),
        vehiculosFueraDeServicio: cuenta('FUERA_DE_SERVICIO'),
        alquileresActivos: activos.length,
        alquileresVencidos: activos.filter(a => h > a.fechaFinPactada).length,
        pendientesDevolucion: activos.filter(a => a.fechaFinPactada <= h).length,
        ingresosTotales: dinero(db.facturas.reduce((t, f) => t + f.monto, 0)),
        ingresosMes: dinero(db.facturas.filter(f => local(f.fechaEmision) === mes).reduce((t, f) => t + f.monto, 0))
      };
    }
  };

  function cotizarDev(a, fecha) {
    const f = fecha || hoy();
    if (f > hoy()) falla('FECHAS_INVALIDAS', 'La fecha de devolución no puede ser futura.');
    if (f < a.fechaInicio) falla('FECHAS_INVALIDAS', 'La fecha de devolución no puede ser anterior a la salida.');
    const diasMora = Math.max(0, entre(a.fechaFinPactada, f));
    const montoMora = dinero(a.precioDia * 1.3 * diasMora);
    return { alquilerId: a.id, fechaDevolucion: f, diasMora, montoMora, montoBase: a.montoBase, montoTotal: dinero(a.montoBase + montoMora) };
  }

  function validarVehiculo(input, id) {
    const placa = String(input.placa || '').toUpperCase().replace(/[\s-]/g, '');
    const anio = +input.anio;
    const precio = +input.precioDia;
    const tope = new Date().getFullYear() + 1;

    if (!placa) falla('DATO_INVALIDO', 'La placa es obligatoria.');
    if (!db.categorias.some(x => x.id === input.categoriaId)) falla('DATO_INVALIDO', 'Selecciona una categoría válida.');
    if (!input.marca || !input.modelo) falla('DATO_INVALIDO', 'La marca y el modelo son obligatorios.');
    if (!(anio >= 1950 && anio <= tope)) falla('DATO_INVALIDO', `El año debe estar entre 1950 y ${tope}.`);
    if (!(precio > 0)) falla('DATO_INVALIDO', 'El precio por día debe ser mayor que 0.');
    if (db.vehiculos.some(x => x.placa === placa && x.id !== id)) falla('PLACA_DUPLICADA', 'Ya existe un vehículo con esa placa.');

    return { placa, categoriaId: input.categoriaId, marca: input.marca.trim(), modelo: input.modelo.trim(), anio, precioDia: dinero(precio) };
  }

  function validarCliente(input, id) {
    if (!input.nombre || !input.nombre.trim()) falla('DATO_INVALIDO', 'El nombre es obligatorio.');
    const cedula = normalizarCedula(input.cedula);
    const correo = validarCorreo(input.correo, false);

    if (db.clientes.some(x => x.cedula === cedula && x.id !== id)) falla('CEDULA_DUPLICADA', 'Ya existe un cliente con esa cédula.');
    if (correo && db.clientes.some(x => x.correo === correo && x.id !== id)) falla('CORREO_DUPLICADO', 'Ya existe un cliente con ese correo.');

    return {
      nombre: input.nombre.trim(), cedula, correo,
      telefono: input.telefono || null, licenciaConducir: input.licenciaConducir || null
    };
  }


  async function ejecutar(op, vars, token) {
    if (!db) cargar();

    await new Promise(r => setTimeout(r, 180 + Math.random() * 220));

    const fn = H[op];
    if (!fn) falla('ERROR_INTERNO', 'Operación no disponible en modo demostración.');

    const ctx = { u: usuarioDe(token) };
    if (token && !ctx.u && !['login', 'registrarCliente', 'solicitarRecuperacionPassword', 'restablecerPassword'].includes(op)) {
      falla('AUTH_NOT_AUTHENTICATED', 'Tu sesión expiró.');
    }

    const entrada = op === 'subirFotoVehiculo' ? { ...vars } : (copia(vars) || {});
    const r = await fn(entrada, ctx);
    guardar();

    return copia(r);
  }

  return { ejecutar };
})();
