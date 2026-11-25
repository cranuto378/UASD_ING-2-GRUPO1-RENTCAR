/* =========================================================
   AUTOGO · AJUSTES FINANCIEROS LOCALES v3
   - Retención NO aplica a alquileres, ajustes ni devoluciones.
   - La retención relevante es únicamente la del retiro de Wallet GO,
     representada por retiroWalletClientePct / montoEmpresa.
   - Corrige el ingreso empresarial registrado al retirar Wallet GO.
========================================================= */
(function () {
  var cfg = window.AUTOGO_CONFIG || {};
  if (cfg.LOCAL_DB !== true) return;

  var KEY = 'autogo.localdb.v1';
  var prevFetch = window.fetch.bind(window);

  function money(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} }
  function parseRequest(options) {
    try {
      if (options && options.body instanceof FormData) {
        var ops = JSON.parse(options.body.get('operations') || '{}');
        return { query: ops.query || '', variables: ops.variables || {} };
      }
      var x = JSON.parse(options && options.body || '{}');
      return { query: x.query || '', variables: x.variables || {} };
    } catch (_) { return { query:'', variables:{} }; }
  }
  function rootField(query) {
    var m = String(query || '').match(/\{\s*([A-Za-z_]\w*)\s*(?:\(|\{)/);
    return m && m[1];
  }
  async function readJson(response) {
    try { return await response.clone().json(); } catch (_) { return null; }
  }
  function jsonResponse(payload, original) {
    return new Response(JSON.stringify(payload), { status: original.status, headers: { 'Content-Type':'application/json' } });
  }
  function dayCount(a,b) {
    return Math.max(1, Math.ceil((new Date(b+'T12:00:00') - new Date(a+'T12:00:00')) / 86400000));
  }
  function quoteNoRetention(db, veh, ini, fin) {
    var dias = dayCount(ini, fin);
    var subtotal = money(Number(veh && veh.precioDia || 0) * dias);
    var impuesto = money(subtotal * Number(db.configuracion && db.configuracion.impuestoPct || 0) / 100);
    return { dias:dias, precioDia:Number(veh && veh.precioDia || 0), subtotal:subtotal, impuesto:impuesto, retencion:0, total:money(subtotal + impuesto) };
  }

  /* La configuración histórica de retencionPct deja de intervenir en alquileres. */
  var inicial = load();
  if (inicial && inicial.configuracion) {
    inicial.configuracion.retencionPct = 0;
    save(inicial);
  }

  window.fetch = async function (url, options) {
    var local = cfg.LOCAL_DB === true && String(url || '').replace(/\/+$/, '').endsWith('/graphql');
    if (!local) return prevFetch(url, options || {});

    var req = parseRequest(options || {});
    var op = rootField(req.query);
    var vars = req.variables || {};
    var response = await prevFetch(url, options || {});
    var payload = await readJson(response);
    if (!payload || payload.errors || !payload.data) return response;

    var db = load();
    if (!db) return response;
    if (db.configuracion) db.configuracion.retencionPct = 0;

    if (op === 'cotizarAlquiler' && payload.data.cotizarAlquiler) {
      var veh = (db.vehiculos || []).find(function (v) { return Number(v.id) === Number(vars.vehiculoId); });
      var q = quoteNoRetention(db, veh, vars.fechaInicio, vars.fechaFin);
      Object.assign(payload.data.cotizarAlquiler, q);
    }

    if (op === 'crearAlquiler') {
      var r = payload.data.crearAlquiler;
      var a = r && r.alquiler && (db.alquileres || []).find(function (x) { return Number(x.id) === Number(r.alquiler.id); });
      if (a) {
        var vehC = (db.vehiculos || []).find(function (v) { return Number(v.id) === Number(a.vehiculoId); });
        var qc = quoteNoRetention(db, vehC, a.fechaInicio, a.fechaFinPactada);
        a.dias = qc.dias;
        a.precioDia = qc.precioDia;
        a.montoBase = qc.subtotal;
        a.impuestoAlquiler = qc.impuesto;
        a.retencionAlquiler = 0;
        a.totalAlquiler = qc.total;
        a.montoTotal = money(qc.total + Number(a.montoMora || 0));
        a.totalFacturado = qc.total;

        var fac = (db.facturas || []).filter(function (f) { return Number(f.alquilerId) === Number(a.id) && String(f.tipo).toUpperCase() === 'ALQUILER'; }).sort(function(x,y){return y.id-x.id;})[0];
        if (fac) {
          fac.subtotal = qc.subtotal;
          fac.impuesto = qc.impuesto;
          fac.retencion = 0;
          fac.total = qc.total;
          fac.monto = qc.total;
          fac.dias = qc.dias;
          fac.precioDia = qc.precioDia;
          var wallet = money(Number(fac.walletAplicado || 0));
          var adicional = money(Math.max(0, qc.total - wallet));
          fac.pagoAdicional = adicional;
          fac.montoPagadoMetodo = adicional;
          fac.ingresoNuevo = adicional;
          if (wallet > 0 && adicional <= 0) fac.metodoPago = 'WALLET';
        }
        r.alquiler = JSON.parse(JSON.stringify(a));
      }
    }

    if (op === 'cotizarDevolucion' && payload.data.cotizarDevolucion) {
      var cd = payload.data.cotizarDevolucion;
      cd.retencionMora = 0;
      cd.montoMora = money(Number(cd.subtotalMora || 0) + Number(cd.recargoMora || 0) + Number(cd.impuestoMora || 0));
      cd.retencionReembolso = 0;
      cd.creditoWallet = money(Number(cd.subtotalReembolso || 0) - Number(cd.impuestoReembolso || 0));
      cd.montoTotal = money(Number(cd.totalAlquiler || cd.montoBase || 0) + Number(cd.montoMora || 0));
    }

    if (op === 'registrarDevolucion') {
      var rr = payload.data.registrarDevolucion;
      var ar = rr && rr.alquiler && (db.alquileres || []).find(function (x) { return Number(x.id) === Number(rr.alquiler.id); });
      if (ar) {
        ar.retencionMora = 0;
        ar.retencionReembolso = 0;
        ar.montoMora = money(Number(ar.subtotalMora || 0) + Number(ar.recargoMora || 0) + Number(ar.impuestoMora || 0));
        ar.creditoWallet = money(Number(ar.subtotalReembolso || 0) - Number(ar.impuestoReembolso || 0));
        ar.montoTotal = money(Number(ar.totalAlquiler || 0) + Number(ar.montoMora || 0));
        rr.creditoWallet = ar.creditoWallet;
        rr.alquiler = JSON.parse(JSON.stringify(ar));
      }
    }

    if (op === 'retirarWallet' && payload.data.retirarWallet) {
      var rw = payload.data.retirarWallet;
      var ultimo = db.retirosWallet && db.retirosWallet[0];
      if (ultimo) {
        ultimo.montoCliente = money(Number(rw.montoCliente || 0));
        ultimo.montoEmpresa = money(Number(rw.montoEmpresa || 0));
        /* El campo monto es lo que Reportes interpreta como ingreso de AutoGo. */
        ultimo.monto = ultimo.montoEmpresa;
      }
    }

    /* Corrige retiros históricos cuando contienen datos suficientes. */
    (db.retirosWallet || []).forEach(function (x) {
      if (x.montoEmpresa != null) x.monto = money(x.montoEmpresa);
      else if (x.montoRetirado != null && db.configuracion && db.configuracion.retiroWalletClientePct != null) {
        var clientePct = Number(db.configuracion.retiroWalletClientePct || 0);
        x.monto = money(Number(x.montoRetirado || 0) * (100 - clientePct) / 100);
      }
    });

    save(db);
    return jsonResponse(payload, response);
  };
})();
