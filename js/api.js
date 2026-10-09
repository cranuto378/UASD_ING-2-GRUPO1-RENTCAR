/* =========================================================
   CLIENTE GRAPHQL
   Un solo endpoint: POST {API_URL}/graphql
   Token en Authorization: Bearer <token>
========================================================= */

const Api = (() => {
  const cfg = window.AUTOGO_CONFIG || {};
  const BASE = (cfg.API_URL || '').replace(/\/+$/, '');
  const CLAVE = 'autogo.sesion';

  const params = new URLSearchParams(location.search);

  if (params.has('demo')) {
    try {
      if (params.get('demo') === '0') localStorage.removeItem('autogo.demo');
      else localStorage.setItem('autogo.demo', '1');
    } catch (e) { /* almacenamiento no disponible */ }
  }

  const DEMO = !!cfg.DEMO || (() => {
    try { return localStorage.getItem('autogo.demo') === '1'; } catch (e) { return false; }
  })();

  class ApiError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }


  /* Sesión */

  const utc = v => Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(v) ? v : v + 'Z');

  function leer(st) {
    try { return JSON.parse(st.getItem(CLAVE)); } catch (e) { return null; }
  }

  let actual = leer(localStorage) || leer(sessionStorage);

  function sesion() {
    if (actual && actual.expiraEnUtc && utc(actual.expiraEnUtc) <= Date.now()) {
      cerrarSesion();
    }
    return actual;
  }

  function guardarSesion(auth, recordar) {
    if (recordar === undefined) recordar = actual ? actual.recordar : true;

    actual = {
      token: auth.token,
      expiraEnUtc: auth.expiraEnUtc,
      usuario: auth.usuario,
      recordar
    };

    try {
      localStorage.removeItem(CLAVE);
      sessionStorage.removeItem(CLAVE);
      (recordar ? localStorage : sessionStorage).setItem(CLAVE, JSON.stringify(actual));
    } catch (e) { /* sin almacenamiento: la sesión vive en memoria */ }

    return actual;
  }

  function actualizarUsuario(usuario) {
    if (actual) guardarSesion({ ...actual, usuario });
  }

  function cerrarSesion() {
    actual = null;
    try {
      localStorage.removeItem(CLAVE);
      sessionStorage.removeItem(CLAVE);
    } catch (e) { /* nada que limpiar */ }
  }

  const media = url => {
    if (!url) return null;
    if (/^(data:|blob:|https?:|img\/)/.test(url)) return url;
    return BASE + url;
  };


  /* Petición */

  async function pedir(op, query, variables = {}, archivo) {
    if (DEMO) {
      const vars = archivo ? { ...variables, [archivo.campo]: archivo.file } : variables;

      try {
        return await Demo.ejecutar(op, vars, actual && actual.token);
      } catch (e) {
        throw new ApiError(e.code || 'ERROR_INTERNO', e.message || 'Ocurrió un error inesperado.');
      }
    }

    const headers = {};
    let body;

    if (actual && actual.token) headers.Authorization = 'Bearer ' + actual.token;

    if (archivo) {
      const fd = new FormData();

      fd.append('operations', JSON.stringify({
        query,
        variables: { ...variables, [archivo.campo]: null }
      }));
      fd.append('map', JSON.stringify({ 0: ['variables.' + archivo.campo] }));
      fd.append('0', archivo.file);

      headers['GraphQL-Preflight'] = '1';
      body = fd;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ query, variables });
    }

    let res;

    try {
      res = await fetch(BASE + '/graphql', { method: 'POST', headers, body });
    } catch (e) {
      throw new ApiError(
        'SIN_CONEXION',
        'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
      );
    }

    let json;

    try {
      json = await res.json();
    } catch (e) {
      if (res.status === 401) throw new ApiError('AUTH_NOT_AUTHENTICATED', 'Tu sesión expiró.');
      throw new ApiError('ERROR_INTERNO', 'El servidor respondió de forma inesperada.');
    }

    if (json.errors && json.errors.length) {
      const e = json.errors[0];
      throw new ApiError(
        (e.extensions && e.extensions.code) || 'ERROR_INTERNO',
        e.message || 'Ocurrió un error inesperado.'
      );
    }

    if (!json.data) throw new ApiError('ERROR_INTERNO', 'El servidor no devolvió datos.');

    return json.data[op];
  }


  /* Campos */

  const USUARIO = 'id nombre correo rol debeCambiarPassword clienteId';
  const AUTH = `token expiraEnUtc usuario { ${USUARIO} }`;
  const CATEGORIA = 'id nombre';
  const VEHICULO = 'id placa categoriaId categoria marca modelo anio precioDia estadoOperativo estadoActual mantenimientoHasta fotoUrl activo';
  const COTIZACION = 'vehiculoId fechaInicio fechaFin dias precioDia total';
  const CLIENTE = 'id nombre cedula correo telefono licenciaConducir activo tieneCuenta fechaCreacion';
  const ALQUILER = 'id clienteId clienteNombre clienteCedula vehiculoId placa vehiculo canal fechaInicio fechaFinPactada fechaDevolucion precioDia dias montoBase diasMora montoMora montoTotal totalFacturado estado vencido diasRetraso observaciones fechaCreacion';
  const OPERACION = `facturaId alquiler { ${ALQUILER} }`;
  const DEVOLUCION = 'alquilerId fechaDevolucion diasMora montoMora montoBase montoTotal';
  const FACTURA = 'id alquilerId tipo concepto monto metodoPago fechaEmision clienteId clienteNombre clienteCedula clienteTelefono clienteCorreo vehiculoId placa vehiculo categoria fechaInicio fechaFinPactada dias precioDia';
  const DASHBOARD = 'totalClientes totalVehiculos vehiculosDisponibles vehiculosAlquilados vehiculosEnMantenimiento vehiculosFueraDeServicio alquileresActivos alquileresVencidos pendientesDevolucion ingresosTotales ingresosMes';

  const conexion = campos =>
    `totalCount pageInfo { hasNextPage hasPreviousPage startCursor endCursor } nodes { ${campos} }`;

  const PAG = '$first: Int, $after: String, $last: Int, $before: String';
  const PAG_ARGS = 'first: $first, after: $after, last: $last, before: $before';

  const pagina = (p = {}) => ({
    first: p.first ?? null,
    after: p.after ?? null,
    last: p.last ?? null,
    before: p.before ?? null
  });

  const ORDEN_ALQUILER = {
    reciente: '{ fechaCreacion: DESC }',
    vencimiento: '{ fechaFinPactada: ASC }'
  };


  return {
    DEMO,
    ApiError,
    sesion,
    guardarSesion,
    actualizarUsuario,
    cerrarSesion,
    media,


    /* Cuenta */

    login: (correo, password) => pedir('login',
      `mutation Login($correo: String!, $password: String!) {
        login(correo: $correo, password: $password) { ${AUTH} }
      }`, { correo, password }),

    registrarCliente: input => pedir('registrarCliente',
      `mutation Registro($input: RegistroClienteInput!) {
        registrarCliente(input: $input) { ${AUTH} }
      }`, { input }),

    me: () => pedir('me', `query Me { me { ${USUARIO} } }`),

    cambiarPassword: (passwordActual, passwordNueva) => pedir('cambiarPassword',
      `mutation CambiarPassword($passwordActual: String!, $passwordNueva: String!) {
        cambiarPassword(passwordActual: $passwordActual, passwordNueva: $passwordNueva) { ${AUTH} }
      }`, { passwordActual, passwordNueva }),

    solicitarRecuperacionPassword: correo => pedir('solicitarRecuperacionPassword',
      `mutation Recuperar($correo: String!) {
        solicitarRecuperacionPassword(correo: $correo)
      }`, { correo }),

    restablecerPassword: (token, passwordNueva) => pedir('restablecerPassword',
      `mutation Restablecer($token: String!, $passwordNueva: String!) {
        restablecerPassword(token: $token, passwordNueva: $passwordNueva)
      }`, { token, passwordNueva }),

    crearAdministrador: input => pedir('crearAdministrador',
      `mutation CrearAdministrador($input: CrearAdministradorInput!) {
        crearAdministrador(input: $input) { ${USUARIO} }
      }`, { input }),


    /* Catálogo y vehículos */

    categorias: () => pedir('categorias', `query Categorias { categorias { ${CATEGORIA} } }`),

    vehiculosDisponibles: (fechaInicio, fechaFin, categoriaId = null) => pedir('vehiculosDisponibles',
      `query Disponibles($fechaInicio: LocalDate!, $fechaFin: LocalDate!, $categoriaId: Int) {
        vehiculosDisponibles(fechaInicio: $fechaInicio, fechaFin: $fechaFin, categoriaId: $categoriaId) { ${VEHICULO} }
      }`, { fechaInicio, fechaFin, categoriaId }),

    cotizarAlquiler: (vehiculoId, fechaInicio, fechaFin) => pedir('cotizarAlquiler',
      `query Cotizar($vehiculoId: Int!, $fechaInicio: LocalDate!, $fechaFin: LocalDate!) {
        cotizarAlquiler(vehiculoId: $vehiculoId, fechaInicio: $fechaInicio, fechaFin: $fechaFin) { ${COTIZACION} }
      }`, { vehiculoId, fechaInicio, fechaFin }),

    vehiculo: id => pedir('vehiculo',
      `query Vehiculo($id: Int!) { vehiculo(id: $id) { ${VEHICULO} } }`, { id }),

    vehiculos: ({ texto = null, categoriaId = null, incluirInactivos = false, ...p } = {}) => pedir('vehiculos',
      `query Flota($texto: String, $categoriaId: Int, $incluirInactivos: Boolean! = false, ${PAG}) {
        vehiculos(texto: $texto, categoriaId: $categoriaId, incluirInactivos: $incluirInactivos, ${PAG_ARGS}, order: { placa: ASC }) {
          ${conexion(VEHICULO)}
        }
      }`, { texto, categoriaId, incluirInactivos, ...pagina(p) }),

    crearCategoria: nombre => pedir('crearCategoria',
      `mutation CrearCategoria($nombre: String!) { crearCategoria(nombre: $nombre) { ${CATEGORIA} } }`, { nombre }),

    crearVehiculo: input => pedir('crearVehiculo',
      `mutation CrearVehiculo($input: VehiculoInput!) { crearVehiculo(input: $input) { ${VEHICULO} } }`, { input }),

    actualizarVehiculo: (id, input) => pedir('actualizarVehiculo',
      `mutation ActualizarVehiculo($id: Int!, $input: VehiculoInput!) {
        actualizarVehiculo(id: $id, input: $input) { ${VEHICULO} }
      }`, { id, input }),

    cambiarEstadoVehiculo: input => pedir('cambiarEstadoVehiculo',
      `mutation CambiarEstado($input: CambiarEstadoVehiculoInput!) {
        cambiarEstadoVehiculo(input: $input) { ${VEHICULO} }
      }`, { input }),

    subirFotoVehiculo: (id, file) => pedir('subirFotoVehiculo',
      `mutation SubirFoto($id: Int!, $foto: Upload!) {
        subirFotoVehiculo(id: $id, foto: $foto) { ${VEHICULO} }
      }`, { id }, { campo: 'foto', file }),

    desactivarVehiculo: id => pedir('desactivarVehiculo',
      `mutation DesactivarVehiculo($id: Int!) { desactivarVehiculo(id: $id) }`, { id }),


    /* Clientes */

    clientes: ({ texto = null, incluirInactivos = false, ...p } = {}) => pedir('clientes',
      `query Clientes($texto: String, $incluirInactivos: Boolean! = false, ${PAG}) {
        clientes(texto: $texto, incluirInactivos: $incluirInactivos, ${PAG_ARGS}, order: { nombre: ASC }) {
          ${conexion(CLIENTE)}
        }
      }`, { texto, incluirInactivos, ...pagina(p) }),

    cliente: id => pedir('cliente',
      `query Cliente($id: Int!) { cliente(id: $id) { ${CLIENTE} } }`, { id }),

    miPerfil: () => pedir('miPerfil', `query MiPerfil { miPerfil { ${CLIENTE} } }`),

    crearCliente: input => pedir('crearCliente',
      `mutation CrearCliente($input: ClienteInput!) { crearCliente(input: $input) { ${CLIENTE} } }`, { input }),

    actualizarCliente: (id, input) => pedir('actualizarCliente',
      `mutation ActualizarCliente($id: Int!, $input: ClienteInput!) {
        actualizarCliente(id: $id, input: $input) { ${CLIENTE} }
      }`, { id, input }),

    desactivarCliente: id => pedir('desactivarCliente',
      `mutation DesactivarCliente($id: Int!) { desactivarCliente(id: $id) }`, { id }),


    /* Alquileres */

    crearAlquiler: input => pedir('crearAlquiler',
      `mutation CrearAlquiler($input: CrearAlquilerInput!) { crearAlquiler(input: $input) { ${OPERACION} } }`, { input }),

    misAlquileres: () => pedir('misAlquileres', `query MisAlquileres { misAlquileres { ${ALQUILER} } }`),

    alquileres: ({ clienteId = null, vehiculoId = null, estado = null, soloVencidos = false, orden = 'reciente', ...p } = {}) =>
      pedir('alquileres',
        `query Alquileres($clienteId: Int, $vehiculoId: Int, $estado: EstadoAlquiler, $soloVencidos: Boolean! = false, ${PAG}) {
          alquileres(clienteId: $clienteId, vehiculoId: $vehiculoId, estado: $estado, soloVencidos: $soloVencidos, ${PAG_ARGS}, order: ${ORDEN_ALQUILER[orden] || ORDEN_ALQUILER.reciente}) {
            ${conexion(ALQUILER)}
          }
        }`, { clienteId, vehiculoId, estado, soloVencidos, ...pagina(p), ...(DEMO ? { _orden: orden } : {}) }),

    alquiler: id => pedir('alquiler',
      `query Alquiler($id: Int!) { alquiler(id: $id) { ${ALQUILER} } }`, { id }),

    modificarAlquiler: input => pedir('modificarAlquiler',
      `mutation ModificarAlquiler($input: ModificarAlquilerInput!) { modificarAlquiler(input: $input) { ${OPERACION} } }`, { input }),

    cancelarAlquiler: (alquilerId, motivo = null) => pedir('cancelarAlquiler',
      `mutation CancelarAlquiler($alquilerId: Int!, $motivo: String) {
        cancelarAlquiler(alquilerId: $alquilerId, motivo: $motivo) { ${OPERACION} }
      }`, { alquilerId, motivo }),

    cotizarDevolucion: (alquilerId, fechaDevolucion = null) => pedir('cotizarDevolucion',
      `query CotizarDevolucion($alquilerId: Int!, $fechaDevolucion: LocalDate) {
        cotizarDevolucion(alquilerId: $alquilerId, fechaDevolucion: $fechaDevolucion) { ${DEVOLUCION} }
      }`, { alquilerId, fechaDevolucion }),

    registrarDevolucion: input => pedir('registrarDevolucion',
      `mutation RegistrarDevolucion($input: DevolucionInput!) { registrarDevolucion(input: $input) { ${OPERACION} } }`, { input }),


    /* Facturas y dashboard */

    facturas: ({ clienteId = null, alquilerId = null, desde = null, hasta = null, ...p } = {}) => pedir('facturas',
      `query Facturas($clienteId: Int, $alquilerId: Int, $desde: LocalDate, $hasta: LocalDate, ${PAG}) {
        facturas(clienteId: $clienteId, alquilerId: $alquilerId, desde: $desde, hasta: $hasta, ${PAG_ARGS}, order: { fechaEmision: DESC }) {
          ${conexion(FACTURA)}
        }
      }`, { clienteId, alquilerId, desde, hasta, ...pagina(p) }),

    misFacturas: () => pedir('misFacturas', `query MisFacturas { misFacturas { ${FACTURA} } }`),

    factura: id => pedir('factura',
      `query Factura($id: Int!) { factura(id: $id) { ${FACTURA} } }`, { id }),

    dashboard: () => pedir('dashboard', `query Dashboard { dashboard { ${DASHBOARD} } }`)
  };
})();
