/* =========================================================
   AUTOGO · REGLAS FINANCIERAS LOCALES

   Mantiene enlazados Alquileres, Facturación, Wallet GO y Reportes cuando
   AUTOGO_CONFIG.LOCAL_DB === true.

   Reglas clave:
   - La factura conserva el valor total del documento.
   - Wallet GO aplicado NO es ingreso nuevo del día.
   - Solo efectivo / tarjeta / transferencia recibidos ahora cuentan como
     ingreso nuevo.
   - La factura original nunca se edita: modificaciones generan AJUSTE.
   - Disminuciones, cancelaciones y devoluciones anticipadas acreditan Wallet.
   - Mora genera su propio documento e ingreso nuevo.
========================================================= */
(function () {
  var cfg = window.AUTOGO_CONFIG || {};
  if (cfg.LOCAL_DB !== true) return;

  var KEY = 'autogo.localdb.v1';
  var fetchBase = window.fetch.bind(window);

  function money(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function nowIso() { return new Date().toISOString(); }
  function today() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function dayCount(inicio, fin) {
    return Math.max(1, Math.ceil((new Date(fin + 'T12:00:00') - new Date(inicio + 'T12:00:00')) / 86400000));
  }
  function loadDB() {
    try {
      var db = JSON.parse(localStorage.getItem(KEY) || 'null');
      return db && typeof db === 'object' ? db : null;
    } catch (_) { return null; }
  }
  function saveDB(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} }
  function ensureIds(db) {
    db.nextIds = db.nextIds || {};
    if (!db.nextIds.factura) db.nextIds.factura = 7100;
    if (!db.nextIds.movimiento) db.nextIds.movimiento = 10;
  }
  function financialConfig(db) {
    return {
      impuestoPct: Number(db.configuracion && db.configuracion.impuestoPct || 0),
      retencionPct: Number(db.configuracion && db.configuracion.retencionPct || 0),
      recargoMoraPct: Number(db.configuracion && db.configuracion.recargoMoraPct || 0),
      retiroWalletClientePct: Number(db.configuracion && db.configuracion.retiroWalletClientePct || 0)
    };
  }
  function quote(db, vehicle, inicio, fin) {
    var dias = dayCount(inicio, fin);
    var subtotal = money(Number(vehicle && vehicle.precioDia || 0) * dias);
    var impuesto = money(subtotal * Number(db.configuracion.impuestoPct || 0) / 100);
    var retencion = money(subtotal * Number(db.configuracion.retencionPct || 0) / 100);
    return { dias: dias, precioDia: Number(vehicle && vehicle.precioDia || 0), subtotal: subtotal, impuesto: impuesto, retencion: retencion, total: money(subtotal + impuesto - retencion) };
  }

  function getWallet(db, clienteId) {
    ensureIds(db);
    db.wallets = db.wallets || {};
    if (!db.wallets[clienteId]) db.wallets[clienteId] = { saldo: 0, porcentajeRetiro: Number(db.configuracion.retiroWalletClientePct || 0), movimientos: [] };
    var w = db.wallets[clienteId];
    if (!Array.isArray(w.movimientos)) w.movimientos = [];
    w.porcentajeRetiro = Number(db.configuracion.retiroWalletClientePct || w.porcentajeRetiro || 0);
    return w;
  }

  function walletMove(db, clienteId, tipo, amount, concept, alquilerId) {
    var w = getWallet(db, clienteId);
    var monto = money(amount);
    w.saldo = money(Number(w.saldo || 0) + monto);
    w.movimientos.unshift({ id: db.nextIds.movimiento++, tipo: tipo, monto: monto, concepto: concept, fecha: nowIso(), alquilerId: alquilerId || null, configFinanciera: financialConfig(db) });
    return monto;
  }

  function invoice(db, rental, type, concept, total, options) {
    ensureIds(db);
    options = options || {};
    var client = (db.clientes || []).find(function (x) { return x.id == rental.clienteId; }) || {};
    var vehicle = (db.vehiculos || []).find(function (x) { return x.id == rental.vehiculoId; }) || {};
    var pagoAdicional = money(options.pagoAdicional == null ? (Number(total) > 0 ? total : 0) : options.pagoAdicional);
    var walletAplicado = money(options.walletAplicado || 0);
    var ingresoNuevo = money(options.ingresoNuevo == null ? pagoAdicional : options.ingresoNuevo);
    var metodoAdicional = pagoAdicional > 0 ? (options.metodoPagoAdicional || options.metodoPago || null) : null;
    var inv = {
      id: db.nextIds.factura++, alquilerId: rental.id, tipo: type, concepto: concept,
      monto: money(total), subtotal: money(options.subtotal == null ? total : options.subtotal),
      impuesto: money(options.impuesto || 0), retencion: money(options.retencion || 0), total: money(total),
      desgloseModo: 'DETALLADO', metodoPago: options.metodoPago || metodoAdicional || null,
      walletAplicado: walletAplicado, pagoAdicional: pagoAdicional, montoPagadoMetodo: pagoAdicional,
      metodoPagoAdicional: metodoAdicional, ingresoNuevo: ingresoNuevo,
      fechaEmision: nowIso(), clienteId: rental.clienteId, clienteNombre: rental.clienteNombre,
      clienteCedula: rental.clienteCedula, clienteTelefono: client.telefono || '', clienteCorreo: client.correo || '',
      vehiculoId: rental.vehiculoId, placa: rental.placa, vehiculo: rental.vehiculo, categoria: vehicle.categoria || '',
      fechaInicio: rental.fechaInicio, fechaFinPactada: rental.fechaFinPactada,
      dias: options.dias == null ? rental.dias : options.dias, precioDia: rental.precioDia,
      origen: options.origen || type, configFinanciera: financialConfig(db)
    };
    db.facturas.push(inv);
    return inv;
  }

  function walletUsadoHistorico(db, alquilerId) {
    var total = 0;
    Object.keys(db.wallets || {}).forEach(function (id) {
      ((db.wallets[id] && db.wallets[id].movimientos) || []).forEach(function (m) {
        if (m && m.tipo === 'USO' && Number(m.alquilerId) === Number(alquilerId)) total += Math.abs(Number(m.monto || 0));
      });
    });
    return money(total);
  }

  function normalizeWithdrawals(db) {
    var pct = Number(db.configuracion && db.configuracion.retiroWalletClientePct || 0);
    (db.retirosWallet || []).forEach(function (r) {
      if (!r) return;
      var total = Number(r.montoRetirado || 0);
      if (r.montoCliente == null) r.montoCliente = money(total * pct / 100);
      if (r.montoEmpresa == null) r.montoEmpresa = money(total - Number(r.montoCliente || 0));
      /* El contrato ingresosWallet usa `monto` para la parte que recibe AutoGo. */
      r.monto = money(r.montoEmpresa || 0);
    });
  }

  function normalizeLegacy(db) {
    if (!db) return;
    ensureIds(db);
    (db.facturas || []).forEach(function (f) {
      if (!f) return;
      if (f.tipo === 'FACTURA') f.tipo = 'ALQUILER';
      var total = Number(f.total != null ? f.total : f.monto || 0);
      if (f.walletAplicado == null && f.tipo === 'ALQUILER') f.walletAplicado = walletUsadoHistorico(db, f.alquilerId);
      f.walletAplicado = money(f.walletAplicado || 0);
      if (f.pagoAdicional == null) {
        if (total <= 0) f.pagoAdicional = 0;
        else if (f.tipo === 'ALQUILER') f.pagoAdicional = money(Math.max(0, total - f.walletAplicado));
        else f.pagoAdicional = money(total);
      }
      f.montoPagadoMetodo = money(f.pagoAdicional || 0);
      if (f.metodoPagoAdicional == null) f.metodoPagoAdicional = Number(f.pagoAdicional || 0) > 0 && f.metodoPago !== 'WALLET' ? (f.metodoPago || null) : null;
      if (f.ingresoNuevo == null) f.ingresoNuevo = total > 0 ? money(f.pagoAdicional || 0) : 0;
      f.ingresoNuevo = money(Math.max(0, Number(f.ingresoNuevo || 0)));
    });
    (db.alquileres || []).forEach(function (a) {
      if (!a) return;
      if (a.canal === 'WEB') a.canal = 'PORTAL';
      var primary = (db.facturas || []).filter(function (f) { return f.alquilerId == a.id && f.tipo === 'ALQUILER'; }).sort(function (x, y) { return x.id - y.id; })[0];
      if (primary) {
        a.walletAplicado = money(primary.walletAplicado || 0);
        a.pagoAdicional = money(primary.pagoAdicional || 0);
        a.metodoPagoAdicional = primary.metodoPagoAdicional || null;
      }
    });
    Object.keys(db.wallets || {}).forEach(function (id) {
      var w = db.wallets[id];
      (w.movimientos || []).forEach(function (m) { if (m.tipo === 'CREDITO') m.tipo = 'ABONO'; });
    });
    normalizeWithdrawals(db);
  }

  function parseRequest(options) {
    if (options && options.body instanceof FormData) {
      try { var ops = JSON.parse(options.body.get('operations') || '{}'); return { query: ops.query || '', variables: ops.variables || {} }; }
      catch (_) { return { query: '', variables: {} }; }
    }
    try { var x = JSON.parse(options && options.body || '{}'); return { query: x.query || '', variables: x.variables || {} }; }
    catch (_) { return { query: '', variables: {} }; }
  }
  function rootField(query) { var m = String(query || '').match(/\{\s*([A-Za-z_]\w*)\s*(?:\(|\{)/); return m && m[1]; }
  async function readJson(response) { try { return await response.clone().json(); } catch (_) { return null; } }
  function jsonResponse(payload, original) { return new Response(JSON.stringify(payload), { status: original ? original.status : 200, headers: { 'Content-Type': 'application/json' } }); }
  function graphError(code, message) { return new Response(JSON.stringify({ errors: [{ message: message, extensions: { code: code } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }

  function billedNet(db, alquilerId) {
    return money((db.facturas || []).filter(function (f) { return f.alquilerId == alquilerId && ['ALQUILER', 'AJUSTE'].indexOf(f.tipo) !== -1; }).reduce(function (s, f) { return s + Number(f.total || 0); }, 0));
  }
  function incomeInvoice(f) { return money(Math.max(0, Number(f && f.ingresoNuevo || 0))); }
  function companyWithdrawalIncome(r) { return money(Number(r && (r.montoEmpresa != null ? r.montoEmpresa : r.monto) || 0)); }

  var initial = loadDB();
  if (initial) { normalizeLegacy(initial); saveDB(initial); }

  window.fetch = async function (url, options) {
    var isLocalGraphQL = cfg.LOCAL_DB === true && String(url || '').replace(/\/+$/, '').endsWith('/graphql');
    if (!isLocalGraphQL) return fetchBase(url, options || {});

    var req = parseRequest(options || {});
    var op = rootField(req.query);
    var vars = req.variables || {};
    var before = loadDB();
    if (before) normalizeLegacy(before);

    /* No permitimos modificar primero y descubrir después que faltaba el pago. */
    if (op === 'modificarAlquiler' && before) {
      var preInput = vars.input || {};
      var preRental = (before.alquileres || []).find(function (a) { return a.id == (preInput.alquilerId || preInput.id); });
      var preVehicle = preRental && (before.vehiculos || []).find(function (v) { return v.id == (preInput.vehiculoId || preRental.vehiculoId); });
      if (preRental && preVehicle) {
        var preQuote = quote(before, preVehicle, preInput.fechaInicio || preRental.fechaInicio, preInput.fechaFinPactada || preInput.fechaFin || preRental.fechaFinPactada);
        var preDiff = money(preQuote.total - billedNet(before, preRental.id));
        if (preDiff > 0.009 && !preInput.metodoPago) return graphError('METODO_PAGO_REQUERIDO', 'Selecciona el método de pago para cobrar la diferencia.');
      }
    }

    var baseResponse = await fetchBase(url, options || {});
    var payload = await readJson(baseResponse);
    if (!payload || payload.errors || !payload.data) return baseResponse;

    var db = loadDB();
    if (!db) return baseResponse;
    normalizeLegacy(db);

    if (op === 'crearAlquiler') {
      var resultCreate = payload.data.crearAlquiler;
      var rentalCreate = resultCreate && resultCreate.alquiler;
      var inputCreate = vars.input || {};
      var storedCreate = rentalCreate && (db.alquileres || []).find(function (a) { return a.id == rentalCreate.id; });
      var originalInvoice = storedCreate && (db.facturas || []).filter(function (f) { return f.alquilerId == storedCreate.id && f.tipo === 'ALQUILER'; }).sort(function (a, b) { return b.id - a.id; })[0];
      if (storedCreate && originalInvoice && !originalInvoice.pagoProcesadoV2) {
        var aplicado = 0;
        if (inputCreate.usarWallet) {
          var wCreate = getWallet(db, storedCreate.clienteId);
          aplicado = Math.min(Number(wCreate.saldo || 0), Number(storedCreate.totalAlquiler || 0));
          if (aplicado > 0) walletMove(db, storedCreate.clienteId, 'USO', -aplicado, 'Aplicado a alquiler #' + storedCreate.id, storedCreate.id);
        }
        var pendiente = money(Number(storedCreate.totalAlquiler || 0) - aplicado);
        var metodo = pendiente > 0 ? (inputCreate.metodoPago || originalInvoice.metodoPago || 'EFECTIVO') : null;
        originalInvoice.walletAplicado = money(aplicado);
        originalInvoice.pagoAdicional = pendiente;
        originalInvoice.montoPagadoMetodo = pendiente;
        originalInvoice.metodoPagoAdicional = metodo;
        originalInvoice.metodoPago = pendiente <= 0 ? 'WALLET' : metodo;
        originalInvoice.ingresoNuevo = pendiente;
        originalInvoice.pagoProcesadoV2 = true;
        storedCreate.walletAplicado = money(aplicado);
        storedCreate.pagoAdicional = pendiente;
        storedCreate.metodoPagoAdicional = metodo;
        resultCreate.alquiler = JSON.parse(JSON.stringify(storedCreate));
      }
    }

    if (op === 'modificarAlquiler') {
      var inputMod = vars.input || {};
      var rentalMod = (db.alquileres || []).find(function (a) { return a.id == (inputMod.alquilerId || inputMod.id); });
      if (rentalMod && rentalMod.estado === 'ACTIVO') {
        var vehicleMod = (db.vehiculos || []).find(function (x) { return x.id == (inputMod.vehiculoId || rentalMod.vehiculoId); });
        var iniMod = inputMod.fechaInicio || rentalMod.fechaInicio;
        var finMod = inputMod.fechaFinPactada || inputMod.fechaFin || rentalMod.fechaFinPactada;
        if (vehicleMod) {
          var qMod = quote(db, vehicleMod, iniMod, finMod);
          rentalMod.vehiculoId = vehicleMod.id;
          rentalMod.placa = vehicleMod.placa;
          rentalMod.vehiculo = vehicleMod.marca + ' ' + vehicleMod.modelo;
          rentalMod.fechaInicio = iniMod;
          rentalMod.fechaFinPactada = finMod;
          delete rentalMod.fechaFin;
          rentalMod.precioDia = qMod.precioDia;
          rentalMod.dias = qMod.dias;
          rentalMod.montoBase = qMod.subtotal;
          rentalMod.impuestoAlquiler = qMod.impuesto;
          rentalMod.retencionAlquiler = qMod.retencion;
          rentalMod.totalAlquiler = qMod.total;
          rentalMod.montoTotal = money(qMod.total + Number(rentalMod.montoMora || 0));
          rentalMod.configFinanciera = financialConfig(db);

          var diff = money(qMod.total - billedNet(db, rentalMod.id));
          if (Math.abs(diff) >= 0.01) {
            var adj = invoice(db, rentalMod, 'AJUSTE', diff > 0 ? 'Ajuste por modificación de alquiler' : 'Nota de crédito por modificación de alquiler', diff, {
              subtotal: diff, impuesto: 0, retencion: 0,
              metodoPago: diff > 0 ? inputMod.metodoPago : 'WALLET',
              metodoPagoAdicional: diff > 0 ? inputMod.metodoPago : null,
              pagoAdicional: diff > 0 ? diff : 0,
              ingresoNuevo: diff > 0 ? diff : 0,
              origen: 'MODIFICACION'
            });
            payload.data.modificarAlquiler.facturaId = adj.id;
            if (diff < 0) {
              var creditoMod = Math.abs(diff);
              walletMove(db, rentalMod.clienteId, 'ABONO', creditoMod, 'Crédito por modificación de alquiler #' + rentalMod.id, rentalMod.id);
              payload.data.modificarAlquiler.creditoWallet = creditoMod;
            }
          }
          rentalMod.totalFacturado = qMod.total;
          payload.data.modificarAlquiler.alquiler = JSON.parse(JSON.stringify(rentalMod));
        }
      }
    }

    if (op === 'cancelarAlquiler') {
      var resultCancel = payload.data.cancelarAlquiler;
      var rentalCancel = resultCancel && resultCancel.alquiler;
      var storedCancel = rentalCancel && (db.alquileres || []).find(function (a) { return a.id == rentalCancel.id; });
      if (storedCancel && !storedCancel.cancelacionFinancieraProcesada) {
        var creditCancel = money(Number(storedCancel.totalAlquiler || storedCancel.montoTotal || 0));
        if (creditCancel > 0) {
          walletMove(db, storedCancel.clienteId, 'ABONO', creditCancel, 'Crédito por cancelación de reserva #' + storedCancel.id, storedCancel.id);
          var noteCancel = invoice(db, storedCancel, 'AJUSTE', 'Nota de crédito por cancelación', -creditCancel, {
            subtotal: -creditCancel, impuesto: 0, retencion: 0, metodoPago: 'WALLET', pagoAdicional: 0, ingresoNuevo: 0, origen: 'CANCELACION'
          });
          storedCancel.creditoWallet = money(Number(storedCancel.creditoWallet || 0) + creditCancel);
          storedCancel.cancelacionFinancieraProcesada = true;
          resultCancel.creditoWallet = creditCancel;
          resultCancel.diasNoUsados = Number(storedCancel.dias || 0);
          resultCancel.facturaId = noteCancel.id;
          resultCancel.alquiler = JSON.parse(JSON.stringify(storedCancel));
        }
      }
    }

    if (op === 'registrarDevolucion') {
      var resultReturn = payload.data.registrarDevolucion;
      var rentalReturn = resultReturn && resultReturn.alquiler;
      var storedReturn = rentalReturn && (db.alquileres || []).find(function (a) { return a.id == rentalReturn.id; });
      if (storedReturn && !storedReturn.devolucionFinancieraProcesada) {
        var generatedInvoice = null;
        if (Number(storedReturn.montoMora || 0) > 0) {
          var moraMetodo = (vars.input && vars.input.metodoPagoMora) || 'EFECTIVO';
          generatedInvoice = invoice(db, storedReturn, 'MORA', 'Mora por devolución tardía', storedReturn.montoMora, {
            subtotal: money(Number(storedReturn.subtotalMora || 0) + Number(storedReturn.recargoMora || 0)),
            impuesto: storedReturn.impuestoMora, retencion: storedReturn.retencionMora,
            metodoPago: moraMetodo, metodoPagoAdicional: moraMetodo,
            pagoAdicional: storedReturn.montoMora, ingresoNuevo: storedReturn.montoMora,
            dias: storedReturn.diasMora, origen: 'DEVOLUCION_MORA'
          });
          storedReturn.totalFacturado = money(Number(storedReturn.totalFacturado || storedReturn.totalAlquiler || 0) + Number(storedReturn.montoMora || 0));
        }
        if (Number(storedReturn.creditoWallet || 0) > 0) {
          var noteReturn = invoice(db, storedReturn, 'AJUSTE', 'Nota de crédito por devolución anticipada', -Number(storedReturn.creditoWallet || 0), {
            subtotal: -Number(storedReturn.subtotalReembolso || 0), impuesto: -Number(storedReturn.impuestoReembolso || 0), retencion: -Number(storedReturn.retencionReembolso || 0),
            metodoPago: 'WALLET', pagoAdicional: 0, ingresoNuevo: 0,
            dias: storedReturn.diasNoUsados, origen: 'DEVOLUCION_ANTICIPADA'
          });
          if (!generatedInvoice) generatedInvoice = noteReturn;
        }
        storedReturn.devolucionFinancieraProcesada = true;
        if (generatedInvoice) resultReturn.facturaId = generatedInvoice.id;
        resultReturn.alquiler = JSON.parse(JSON.stringify(storedReturn));
      }
    }

    if (op === 'retirarWallet') {
      normalizeWithdrawals(db);
    }

    /* Dashboard: ingreso nuevo = dinero que realmente entra ahora. Wallet
       aplicado a una renta no vuelve a contarse como ingreso. */
    if (op === 'dashboard' && payload.data.dashboard) {
      normalizeLegacy(db);
      var mes = today().slice(0, 7);
      var invoiceTotal = (db.facturas || []).reduce(function (s, f) { return s + incomeInvoice(f); }, 0);
      var invoiceMonth = (db.facturas || []).filter(function (f) { return String(f.fechaEmision || '').slice(0, 7) === mes; }).reduce(function (s, f) { return s + incomeInvoice(f); }, 0);
      var walletRetTotal = (db.retirosWallet || []).reduce(function (s, r) { return s + companyWithdrawalIncome(r); }, 0);
      var walletRetMonth = (db.retirosWallet || []).filter(function (r) { return String(r.fecha || '').slice(0, 7) === mes; }).reduce(function (s, r) { return s + companyWithdrawalIncome(r); }, 0);
      payload.data.dashboard.ingresosTotales = money(invoiceTotal + walletRetTotal);
      payload.data.dashboard.ingresosMes = money(invoiceMonth + walletRetMonth);
      payload.data.dashboard.ingresosWalletMes = money(walletRetMonth);
    }

    normalizeLegacy(db);
    saveDB(db);
    return jsonResponse(payload, baseResponse);
  };
})();