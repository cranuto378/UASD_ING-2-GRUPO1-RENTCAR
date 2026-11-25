/* =========================================================
   AUTOGO · REGLAS DE DOMINIO / MIGRACIÓN DE LA BASE LOCAL

   Este archivo corrige y normaliza la base local de demostración para que
   represente las mismas reglas que debe implementar el backend definitivo:

   - Una reserva futura NO convierte el vehículo en "Alquilado" hoy.
   - El catálogo calcula disponibilidad por rango de fechas.
   - Cada alquiler bloquea también los días de mantenimiento configurados.
   - Una devolución sin daños entra a mantenimiento automático.
   - Una devolución con daños queda en mantenimiento manual hasta que un
     administrador cambie su estado.
   - El mantenimiento automático vencido vuelve a Disponible.

   Persistencia local: autogo.localdb.v1
========================================================= */
(function () {
  var cfg = window.AUTOGO_CONFIG || {};
  if (cfg.LOCAL_DB !== true) return;

  var KEY = 'autogo.localdb.v1';
  var CAMPOS_FINANCIEROS = [
    'impuestoPct',
    'retencionPct',
    'recargoMoraPct',
    'retiroWalletClientePct'
  ];

  function clonar(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fechaLocal(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function sumarDias(fecha, dias) {
    var d = new Date(String(fecha).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + Number(dias || 0));
    return fechaLocal(d);
  }

  function seSolapan(aIni, aFin, bIni, bFin) {
    return String(aIni) <= String(bFin) && String(bIni) <= String(aFin);
  }

  function leerDB() {
    try {
      var db = JSON.parse(localStorage.getItem(KEY));
      return db && typeof db === 'object' ? db : null;
    } catch (_) {
      return null;
    }
  }

  function guardarDB(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {}
  }

  function parseObjeto(valor) {
    if (!valor) return {};
    if (typeof valor === 'object') return valor;
    try { return JSON.parse(valor); } catch (_) { return {}; }
  }

  function cambiosFinancieros(item) {
    var anterior = parseObjeto(item && (item.anterior || item.anteriorJson));
    var nuevo = parseObjeto(item && (item.nueva || item.nuevoJson));

    return CAMPOS_FINANCIEROS.filter(function (campo) {
      return Number(anterior[campo] == null ? 0 : anterior[campo]) !==
             Number(nuevo[campo] == null ? 0 : nuevo[campo]);
    });
  }

  function normalizarDatos(db) {
    if (!db || typeof db !== 'object') return db;

    if (!Array.isArray(db.historialConfiguracion)) db.historialConfiguracion = [];
    db.historialConfiguracion = db.historialConfiguracion.map(function (item) {
      var copia = Object.assign({}, item || {});
      if (!Array.isArray(copia.cambios)) copia.cambios = cambiosFinancieros(copia);
      copia.cambios = copia.cambios.filter(function (campo) {
        return CAMPOS_FINANCIEROS.indexOf(campo) !== -1;
      });
      return copia;
    }).filter(function (item) {
      return item.cambios.length > 0;
    });

    if (db.wallets && typeof db.wallets === 'object') {
      Object.keys(db.wallets).forEach(function (id) {
        var wallet = db.wallets[id];
        if (!wallet || !Array.isArray(wallet.movimientos)) return;
        wallet.movimientos.forEach(function (mov) {
          if (mov && mov.tipo === 'CREDITO') mov.tipo = 'ABONO';
        });
      });
    }

    if (Array.isArray(db.facturas)) {
      db.facturas.forEach(function (fac) {
        if (fac && fac.tipo === 'FACTURA') fac.tipo = 'ALQUILER';
      });
    }

    /* El nombre oficial del canal en la interfaz es PORTAL. */
    if (Array.isArray(db.alquileres)) {
      db.alquileres.forEach(function (alq) {
        if (alq && alq.canal === 'WEB') alq.canal = 'PORTAL';
      });
    }

    if (Array.isArray(db.vehiculos)) {
      db.vehiculos.forEach(function (v) {
        if (!v) return;
        if (v.mantenimientoManual == null) v.mantenimientoManual = false;
        if (v.danosPendientes == null) v.danosPendientes = false;
        if (v.mantenimientoDesde == null) v.mantenimientoDesde = null;
      });
    }

    return db;
  }

  function diasMantenimiento(db) {
    return Math.max(0, Number(db && db.configuracion && db.configuracion.diasMantenimientoPostDevolucion || 0));
  }

  function alquileresVigentesVehiculo(db, vehiculoId, excluirId) {
    return (db.alquileres || []).filter(function (a) {
      return a &&
        Number(a.vehiculoId) === Number(vehiculoId) &&
        a.estado === 'ACTIVO' &&
        Number(a.id) !== Number(excluirId || 0);
    });
  }

  /*
     Sincroniza SOLO el estado físico/operativo actual.

     La reserva futura no cambia estadoOperativo. Se visualiza como Reserva en
     el módulo de Alquileres según su fechaInicio. Si ya comenzó (o está vencida
     y aún no se ha devuelto), el vehículo sí queda físicamente ALQUILADO.
  */
  function sincronizarEstadosVehiculos(db) {
    if (!db || !Array.isArray(db.vehiculos)) return false;

    var cambio = false;
    var hoy = fechaLocal();

    db.vehiculos.forEach(function (v) {
      if (!v) return;

      var anteriorOperativo = v.estadoOperativo;
      var anteriorActual = v.estadoActual;
      var anteriorHasta = v.mantenimientoHasta;

      /* Mantenimiento por daños: jamás vence automáticamente. */
      if (v.estadoOperativo === 'MANTENIMIENTO' && (v.mantenimientoManual || v.danosPendientes)) {
        v.estadoActual = 'MANTENIMIENTO';
        v.mantenimientoHasta = null;
        if (anteriorActual !== v.estadoActual || anteriorHasta !== v.mantenimientoHasta) cambio = true;
        return;
      }

      /* Mantenimiento automático: queda disponible después de terminar el
         último día indicado en mantenimientoHasta. */
      if (v.estadoOperativo === 'MANTENIMIENTO' && v.mantenimientoHasta) {
        if (hoy > String(v.mantenimientoHasta).slice(0, 10)) {
          v.estadoOperativo = 'DISPONIBLE';
          v.estadoActual = 'DISPONIBLE';
          v.mantenimientoDesde = null;
          v.mantenimientoHasta = null;
          v.mantenimientoManual = false;
          v.danosPendientes = false;
        } else {
          v.estadoActual = 'MANTENIMIENTO';
        }

        if (anteriorOperativo !== v.estadoOperativo || anteriorActual !== v.estadoActual || anteriorHasta !== v.mantenimientoHasta) cambio = true;
        if (v.estadoOperativo === 'MANTENIMIENTO') return;
      }

      /* Fuera de servicio se mantiene hasta cambio manual. */
      if (v.estadoOperativo === 'FUERA_DE_SERVICIO') {
        v.estadoActual = 'FUERA_DE_SERVICIO';
        if (anteriorActual !== v.estadoActual) cambio = true;
        return;
      }

      var enManosCliente = alquileresVigentesVehiculo(db, v.id).some(function (a) {
        return String(a.fechaInicio).slice(0, 10) <= hoy;
      });

      if (enManosCliente) {
        v.estadoOperativo = 'ALQUILADO';
        v.estadoActual = 'ALQUILADO';
      } else {
        /* Una reserva futura NO cambia el estado físico del vehículo. */
        if (v.estadoOperativo === 'ALQUILADO') v.estadoOperativo = 'DISPONIBLE';
        v.estadoActual = v.estadoOperativo || 'DISPONIBLE';
      }

      if (anteriorOperativo !== v.estadoOperativo || anteriorActual !== v.estadoActual) cambio = true;
    });

    return cambio;
  }

  /*
     Disponibilidad por rango.

     Cada alquiler ACTIVO ocupa desde su fecha de salida hasta la entrega
     pactada + los días de mantenimiento configurados. La reserva que se está
     consultando también reserva su propio período de mantenimiento para evitar
     reservas consecutivas imposibles de cumplir.
  */
  function vehiculoDisponible(db, vehiculo, inicio, fin, excluirAlquilerId) {
    if (!vehiculo || vehiculo.activo === false) return false;
    if (!inicio || !fin || String(fin) <= String(inicio)) return false;

    if (vehiculo.estadoOperativo === 'FUERA_DE_SERVICIO') return false;
    if (vehiculo.estadoOperativo === 'MANTENIMIENTO' && (vehiculo.mantenimientoManual || vehiculo.danosPendientes)) return false;

    /* Mantenimiento automático que ya está en ejecución. */
    if (vehiculo.estadoOperativo === 'MANTENIMIENTO' && vehiculo.mantenimientoHasta) {
      var mIni = vehiculo.mantenimientoDesde || fechaLocal();
      var mFin = String(vehiculo.mantenimientoHasta).slice(0, 10);
      if (seSolapan(inicio, fin, mIni, mFin)) return false;
    }

    var buffer = diasMantenimiento(db);
    var finSolicitadoConMantenimiento = sumarDias(fin, buffer);
    var hoy = fechaLocal();

    return !alquileresVigentesVehiculo(db, vehiculo.id, excluirAlquilerId).some(function (a) {
      var aIni = String(a.fechaInicio).slice(0, 10);
      var aFin = String(a.fechaFinPactada).slice(0, 10);

      /* Si el alquiler ya venció y aún está ACTIVO, el vehículo continúa en
         manos del cliente: no podemos prometer ninguna fecha futura. */
      var aFinBloqueo = aFin < hoy && aIni <= hoy
        ? '9999-12-31'
        : sumarDias(aFin, buffer);

      return seSolapan(inicio, finSolicitadoConMantenimiento, aIni, aFinBloqueo);
    });
  }

  function migrarYGuardar() {
    var db = leerDB();
    if (!db) return null;
    normalizarDatos(db);
    sincronizarEstadosVehiculos(db);
    guardarDB(db);
    return db;
  }

  function parseRequest(options) {
    if (options && options.body instanceof FormData) {
      try {
        var ops = JSON.parse(options.body.get('operations') || '{}');
        return { query: ops.query || '', variables: ops.variables || {} };
      } catch (_) { return { query: '', variables: {} }; }
    }

    try {
      var x = JSON.parse(options && options.body || '{}');
      return { query: x.query || '', variables: x.variables || {} };
    } catch (_) {
      return { query: '', variables: {} };
    }
  }

  function rootField(query) {
    var m = String(query || '').match(/\{\s*([A-Za-z_]\w*)\s*(?:\(|\{)/);
    return m && m[1];
  }

  function respuesta(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function errorGraphQL(code, message) {
    return respuesta({ errors: [{ message: message, extensions: { code: code } }] });
  }

  /* Repara inmediatamente la base que ya está guardada. */
  migrarYGuardar();

  /* local-db.js sustituyó window.fetch antes de cargar este archivo. */
  var localFetch = window.fetch.bind(window);

  window.fetch = async function (url, options) {
    var esGraphQLLocal = cfg.LOCAL_DB === true && String(url || '').replace(/\/+$/, '').endsWith('/graphql');
    if (!esGraphQLLocal) return localFetch(url, options || {});

    var req = parseRequest(options || {});
    var op = rootField(req.query);
    var vars = req.variables || {};
    var db = migrarYGuardar();

    if (!db) return localFetch(url, options || {});

    /* -----------------------------------------------------
       Catálogo: disponibilidad REAL por fechas.
    ----------------------------------------------------- */
    if (op === 'vehiculosDisponibles') {
      var lista = (db.vehiculos || []).filter(function (v) {
        if (vars.categoriaId && Number(v.categoriaId) !== Number(vars.categoriaId)) return false;
        return vehiculoDisponible(db, v, vars.fechaInicio, vars.fechaFin, null);
      });
      return respuesta({ data: { vehiculosDisponibles: clonar(lista) } });
    }

    /* La cotización tampoco debe aceptar un vehículo ocupado en ese rango. */
    if (op === 'cotizarAlquiler') {
      var vehCot = (db.vehiculos || []).find(function (v) { return Number(v.id) === Number(vars.vehiculoId); });
      if (!vehiculoDisponible(db, vehCot, vars.fechaInicio, vars.fechaFin, null)) {
        return errorGraphQL('VEHICULO_NO_DISPONIBLE', 'El vehículo no está disponible para las fechas seleccionadas.');
      }
    }

    /* Crear reserva/alquiler: validación atómica antes de guardar. */
    if (op === 'crearAlquiler') {
      var inputCrear = vars.input || {};
      var vehCrear = (db.vehiculos || []).find(function (v) { return Number(v.id) === Number(inputCrear.vehiculoId); });
      var iniCrear = inputCrear.fechaInicio;
      var finCrear = inputCrear.fechaFinPactada || inputCrear.fechaFin;
      if (!vehiculoDisponible(db, vehCrear, iniCrear, finCrear, null)) {
        return errorGraphQL('VEHICULO_NO_DISPONIBLE', 'El vehículo ya está reservado, alquilado o bloqueado por mantenimiento para ese período.');
      }
    }

    /* Modificar fechas/vehículo: ignora el propio alquiler al revisar choque. */
    if (op === 'modificarAlquiler') {
      var inputMod = vars.input || {};
      var alqMod = (db.alquileres || []).find(function (a) {
        return Number(a.id) === Number(inputMod.id || inputMod.alquilerId);
      });
      if (alqMod) {
        var idVehMod = inputMod.vehiculoId || alqMod.vehiculoId;
        var vehMod = (db.vehiculos || []).find(function (v) { return Number(v.id) === Number(idVehMod); });
        var iniMod = inputMod.fechaInicio || alqMod.fechaInicio;
        var finMod = inputMod.fechaFinPactada || inputMod.fechaFin || alqMod.fechaFinPactada;
        if (!vehiculoDisponible(db, vehMod, iniMod, finMod, alqMod.id)) {
          return errorGraphQL('VEHICULO_NO_DISPONIBLE', 'El vehículo no está disponible para el nuevo período.');
        }
      }
    }

    var respuestaBase = await localFetch(url, options || {});

    /* -----------------------------------------------------
       Ajustes posteriores a operaciones que cambian estados.
    ----------------------------------------------------- */
    if (['crearAlquiler', 'modificarAlquiler', 'cancelarAlquiler', 'registrarDevolucion', 'cambiarEstadoVehiculo', 'actualizarConfiguracion'].indexOf(op) !== -1) {
      var db2 = leerDB();
      if (db2) {
        normalizarDatos(db2);

        if (op === 'registrarDevolucion') {
          var inputDev = vars.input || {};
          var alqDev = (db2.alquileres || []).find(function (a) {
            return Number(a.id) === Number(inputDev.alquilerId || inputDev.id);
          });
          var vehDev = alqDev && (db2.vehiculos || []).find(function (v) {
            return Number(v.id) === Number(alqDev.vehiculoId);
          });

          if (vehDev) {
            var fechaDev = String(inputDev.fechaDevolucion || fechaLocal()).slice(0, 10);
            var tieneDanos = inputDev.danosEncontrados === true || String(inputDev.danosEncontrados).toUpperCase() === 'SI';

            vehDev.estadoOperativo = 'MANTENIMIENTO';
            vehDev.estadoActual = 'MANTENIMIENTO';
            vehDev.mantenimientoDesde = fechaDev;

            if (tieneDanos) {
              /* Daños = mantenimiento manual sin fecha automática de salida. */
              vehDev.mantenimientoManual = true;
              vehDev.danosPendientes = true;
              vehDev.mantenimientoHasta = null;
            } else {
              var dias = diasMantenimiento(db2);
              vehDev.mantenimientoManual = false;
              vehDev.danosPendientes = false;

              if (dias > 0) {
                vehDev.mantenimientoHasta = sumarDias(fechaDev, dias);
              } else {
                vehDev.estadoOperativo = 'DISPONIBLE';
                vehDev.estadoActual = 'DISPONIBLE';
                vehDev.mantenimientoDesde = null;
                vehDev.mantenimientoHasta = null;
              }
            }
          }
        }

        if (op === 'cambiarEstadoVehiculo') {
          var inputEstado = vars.input || {};
          var vehEstado = (db2.vehiculos || []).find(function (v) {
            return Number(v.id) === Number(inputEstado.id || inputEstado.vehiculoId);
          });

          if (vehEstado) {
            var nuevoEstado = inputEstado.estadoOperativo || inputEstado.estado || vehEstado.estadoOperativo;
            if (nuevoEstado === 'DISPONIBLE') {
              vehEstado.mantenimientoManual = false;
              vehEstado.danosPendientes = false;
              vehEstado.mantenimientoDesde = null;
              vehEstado.mantenimientoHasta = null;
            } else if (nuevoEstado === 'MANTENIMIENTO') {
              vehEstado.mantenimientoDesde = vehEstado.mantenimientoDesde || fechaLocal();
              /* Si el administrador no puso una fecha, se considera manual. */
              vehEstado.mantenimientoManual = !inputEstado.mantenimientoHasta;
              if (inputEstado.mantenimientoHasta) {
                vehEstado.mantenimientoHasta = inputEstado.mantenimientoHasta;
                vehEstado.danosPendientes = false;
              }
            } else if (nuevoEstado === 'FUERA_DE_SERVICIO') {
              vehEstado.mantenimientoManual = false;
              vehEstado.danosPendientes = false;
              vehEstado.mantenimientoDesde = null;
              vehEstado.mantenimientoHasta = null;
            }
          }
        }

        sincronizarEstadosVehiculos(db2);
        guardarDB(db2);
      }
    }

    return respuestaBase;
  };
})();
