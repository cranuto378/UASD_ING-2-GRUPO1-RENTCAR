/* Interfaz financiera, modificación de alquiler y desglose de pagos. */
(function () {
  'use strict';

  var cfg = window.AUTOGO_CONFIG || {};
  var DB_KEY = 'autogo.localdb.v1';
  var q = function (sel, root) { return (root || document).querySelector(sel); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  var money = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  var fmtMoney = function (n) { return UI.fmt.dinero(money(n)); };
  var label = function (v) { return UI.etq ? UI.etq(v) : String(v || '').replace(/_/g, ' '); };
  var icon = function (n) { return UI.icon ? UI.icon(n) : ''; };

  function today() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function addDays(fecha, dias) {
    var d = new Date(String(fecha).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }

  function overlaps(a1, a2, b1, b2) {
    return String(a1) <= String(b2) && String(b1) <= String(a2);
  }

  function localDB() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || 'null'); }
    catch (_) { return null; }
  }

  /* Cotiza una modificación local excluyendo el alquiler editado. */
  function quoteModificationLocal(alquiler, vehiculoId, inicio, fin) {
    var db = localDB();
    if (!db) throw Object.assign(new Error('No se pudo leer la base local.'), { code: 'ERROR_LOCAL' });

    var vehicle = (db.vehiculos || []).find(function (v) { return Number(v.id) === Number(vehiculoId); });
    if (!vehicle || vehicle.activo === false) throw Object.assign(new Error('El vehículo no está disponible.'), { code: 'VEHICULO_NO_DISPONIBLE' });
    if (vehicle.estadoOperativo === 'FUERA_DE_SERVICIO') throw Object.assign(new Error('El vehículo está fuera de servicio.'), { code: 'VEHICULO_NO_DISPONIBLE' });
    if (vehicle.estadoOperativo === 'MANTENIMIENTO' && (vehicle.mantenimientoManual || vehicle.danosPendientes)) {
      throw Object.assign(new Error('El vehículo está en mantenimiento sin fecha automática de salida.'), { code: 'VEHICULO_NO_DISPONIBLE' });
    }

    if (vehicle.estadoOperativo === 'MANTENIMIENTO' && vehicle.mantenimientoHasta) {
      var mi = vehicle.mantenimientoDesde || today();
      var mf = String(vehicle.mantenimientoHasta).slice(0, 10);
      if (overlaps(inicio, fin, mi, mf)) {
        throw Object.assign(new Error('El vehículo está en mantenimiento para esas fechas.'), { code: 'VEHICULO_NO_DISPONIBLE' });
      }
    }

    var buffer = Math.max(0, Number(db.configuracion && db.configuracion.diasMantenimientoPostDevolucion || 0));
    var requestedEnd = addDays(fin, buffer);
    var h = today();
    var clash = (db.alquileres || []).some(function (a) {
      if (!a || a.estado !== 'ACTIVO' || Number(a.id) === Number(alquiler.id) || Number(a.vehiculoId) !== Number(vehiculoId)) return false;
      var ai = String(a.fechaInicio).slice(0, 10);
      var af = String(a.fechaFinPactada).slice(0, 10);
      var blockEnd = af < h && ai <= h ? '9999-12-31' : addDays(af, buffer);
      return overlaps(inicio, requestedEnd, ai, blockEnd);
    });

    if (clash) {
      throw Object.assign(new Error('El vehículo no está disponible para las fechas seleccionadas.'), { code: 'VEHICULO_NO_DISPONIBLE' });
    }

    var dias = Math.max(1, daysBetween(inicio, fin));
    var subtotal = money(Number(vehicle.precioDia || 0) * dias);
    var impuesto = money(subtotal * Number(db.configuracion && db.configuracion.impuestoPct || 0) / 100);

    return Promise.resolve({
      vehiculoId: vehicle.id,
      fechaInicio: inicio,
      fechaFin: fin,
      dias: dias,
      precioDia: Number(vehicle.precioDia || 0),
      subtotal: subtotal,
      impuesto: impuesto,
      retencion: 0,
      total: money(subtotal + impuesto)
    });
  }

  function quoteModification(alquiler, vehiculoId, inicio, fin) {
    if (cfg.LOCAL_DB === true) return quoteModificationLocal(alquiler, vehiculoId, inicio, fin);
    return Api.cotizarAlquiler(vehiculoId, inicio, fin);
  }

  function setFormError(form, message) {
    var box = q('.form-err', form);
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-err';
      form.appendChild(box);
    }
    box.textContent = message || '';
    box.style.display = message ? 'block' : 'none';
  }

  function clearFormError(form) {
    if (UI.limpiarErrores) UI.limpiarErrores(form);
    setFormError(form, '');
  }

  /* Modifica fechas y vehículo con recálculo de disponibilidad y precio. */
  try {
    modificarAlquiler = function (a, alCambiar) {
      var comenzo = a.fechaInicio <= today();
      var minFin = comenzo ? [addDays(a.fechaInicio, 1), today()].sort().pop() : addDays(a.fechaInicio, 1);
      var currentTotal = Number(a.totalAlquiler != null ? a.totalAlquiler : a.montoTotal || a.montoBase || 0);
      var methods = (UI.METODOS || ['EFECTIVO','TARJETA','TRANSFERENCIA']).map(function (m) {
        return '<option value="' + esc(m) + '">' + esc(label(m)) + '</option>';
      }).join('');

      var modal = UI.modal({
        titulo: 'Modificar alquiler #' + a.id,
        ancho: 620,
        cuerpo: '<p class="texto modificar-resumen">' + esc(a.clienteNombre) + ' · ' + esc(a.vehiculo) + ' (' + esc(a.placa) + ')</p>' +
          (comenzo ? '<div class="info-banda" style="margin-bottom:14px">' + icon('info') + '<span>El alquiler ya comenzó: solo se puede cambiar la fecha de entrega.</span></div>' : '') +
          '<form class="form modificar-alquiler-form" id="fm2" novalidate>' +
            '<div class="grid2">' +
              '<label class="campo"><span>Fecha de salida</span><input name="fechaInicio" type="date" value="' + esc(a.fechaInicio) + '" min="' + today() + '"' + (comenzo ? ' disabled' : '') + '></label>' +
              '<label class="campo"><span>Fecha de entrega</span><input name="fechaFin" type="date" value="' + esc(a.fechaFinPactada) + '" min="' + esc(minFin) + '"></label>' +
              '<label class="campo todo"><span>Vehículo</span><select name="vehiculoId"' + (comenzo ? ' disabled' : '') + '><option value="' + a.vehiculoId + '">' + esc(a.vehiculo) + ' · ' + esc(a.placa) + ' (actual)</option></select></label>' +
            '</div>' +
            '<dl class="dl modificar-importes">' +
              '<dt>Monto actual</dt><dd>' + fmtMoney(currentTotal) + '</dd>' +
              '<dt>Nuevo monto</dt><dd data-k="nuevo">Calculando…</dd>' +
              '<dt>Días</dt><dd data-k="dias">—</dd>' +
              '<dt>Diferencia</dt><dd data-k="diferencia">—</dd>' +
            '</dl>' +
            '<label class="campo modificar-metodo"><span>Método de pago de la diferencia</span><select name="metodoPago"><option value="">Sin cobro adicional</option>' + methods + '</select><small class="campo-ayuda" data-ayuda-metodo>Solo es obligatorio cuando el nuevo monto es mayor. Si disminuye, la diferencia se acredita a Wallet GO.</small></label>' +
            '<div class="form-err" style="display:none"></div>' +
            '<div class="modal-acc"><button class="btn ghost" type="button" data-cerrar>Volver</button><button class="btn" type="submit" disabled>Guardar cambios</button></div>' +
          '</form>'
      });

      var f = q('#fm2', modal.el);
      var submit = q('[type=submit]', f);
      var quoteOk = null;
      var quoteSeq = 0;
      var vehicleSeq = 0;

      function paintDifference(cot) {
        var diff = money(Number(cot.total || 0) - currentTotal);
        q('[data-k=nuevo]', modal.el).textContent = fmtMoney(cot.total);
        q('[data-k=dias]', modal.el).textContent = cot.dias;
        var d = q('[data-k=diferencia]', modal.el);
        d.textContent = (diff > 0 ? '+ ' : diff < 0 ? '− ' : '') + fmtMoney(Math.abs(diff));
        d.className = diff > 0 ? 'mod-diff aumento' : diff < 0 ? 'mod-diff credito' : 'mod-diff igual';
        var help = q('[data-ayuda-metodo]', modal.el);
        if (diff > 0) help.textContent = 'Debes seleccionar cómo se cobrará la diferencia de ' + fmtMoney(diff) + '. Se emitirá una factura de ajuste.';
        else if (diff < 0) help.textContent = 'Se acreditarán ' + fmtMoney(Math.abs(diff)) + ' al Wallet GO y se emitirá una nota de crédito.';
        else help.textContent = 'No hay diferencia de precio; no se emitirá un documento de ajuste.';
        return diff;
      }

      function updateSubmit(diff) {
        var needsMethod = diff > 0.009;
        submit.disabled = !quoteOk || (needsMethod && !f.metodoPago.value);
      }

      async function loadVehicles() {
        if (comenzo) return;
        var ini = f.fechaInicio.value;
        var fin = f.fechaFin.value;
        if (!ini || !fin || fin <= ini) return;

        var n = ++vehicleSeq;
        try {
          var list = await Api.vehiculosDisponibles(ini, fin);
          if (n !== vehicleSeq) return;

          var selected = f.vehiculoId.value || String(a.vehiculoId);
          var html = '<option value="' + a.vehiculoId + '">' + esc(a.vehiculo) + ' · ' + esc(a.placa) + ' (actual)</option>';
          html += list.filter(function (v) { return Number(v.id) !== Number(a.vehiculoId); }).map(function (v) {
            return '<option value="' + v.id + '">' + esc(v.marca + ' ' + v.modelo) + ' · ' + esc(v.placa) + ' · ' + fmtMoney(v.precioDia) + '/día</option>';
          }).join('');

          f.vehiculoId.innerHTML = html;
          if (qa('option', f.vehiculoId).some(function (o) { return o.value === selected; })) f.vehiculoId.value = selected;
          else f.vehiculoId.value = String(a.vehiculoId);
        } catch (_) {}
      }

      async function recalc() {
        clearFormError(f);
        quoteOk = null;
        submit.disabled = true;
        q('[data-k=nuevo]', modal.el).textContent = 'Calculando…';
        q('[data-k=dias]', modal.el).textContent = '—';
        q('[data-k=diferencia]', modal.el).textContent = '—';

        var ini = f.fechaInicio.value;
        var fin = f.fechaFin.value;
        if (!ini || !fin || fin <= ini) {
          q('[data-k=nuevo]', modal.el).textContent = '—';
          return setFormError(f, 'La fecha de entrega debe ser posterior a la salida.');
        }
        if (daysBetween(ini, fin) > 90) {
          q('[data-k=nuevo]', modal.el).textContent = '—';
          return setFormError(f, 'El alquiler no puede superar 90 días.');
        }

        var n = ++quoteSeq;
        try {
          var cot = await quoteModification(a, Number(f.vehiculoId.value), ini, fin);
          if (n !== quoteSeq) return;
          quoteOk = cot;
          updateSubmit(paintDifference(cot));
        } catch (err) {
          if (n !== quoteSeq) return;
          q('[data-k=nuevo]', modal.el).textContent = '—';
          q('[data-k=dias]', modal.el).textContent = '—';
          q('[data-k=diferencia]', modal.el).textContent = '—';
          setFormError(f, err && err.message ? err.message : 'No se pudo comprobar la disponibilidad.');
          submit.disabled = true;
        }
      }

      async function datesChanged() {
        await loadVehicles();
        await recalc();
      }

      f.fechaInicio.addEventListener('change', function () {
        if (f.fechaInicio.value) {
          f.fechaFin.min = addDays(f.fechaInicio.value, 1);
          if (!f.fechaFin.value || f.fechaFin.value <= f.fechaInicio.value) f.fechaFin.value = addDays(f.fechaInicio.value, 3);
        }
        datesChanged();
      });
      f.fechaFin.addEventListener('change', datesChanged);
      f.vehiculoId.addEventListener('change', recalc);
      f.metodoPago.addEventListener('change', function () {
        if (quoteOk) updateSubmit(money(quoteOk.total - currentTotal));
      });

      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearFormError(f);
        await recalc();
        if (!quoteOk) return;

        var diff = money(quoteOk.total - currentTotal);
        if (diff > 0.009 && !f.metodoPago.value) {
          return setFormError(f, 'Selecciona el método de pago para cobrar la diferencia.');
        }

        UI.ocupado(submit, true);
        try {
          var r = await Api.modificarAlquiler({
            alquilerId: a.id,
            vehiculoId: Number(f.vehiculoId.value),
            fechaInicio: f.fechaInicio.value,
            fechaFin: f.fechaFin.value,
            metodoPago: f.metodoPago.value || null
          });
          modal.cerrar();
          if (typeof avisoOperacion === 'function') avisoOperacion(r.facturaId ? 'Alquiler modificado. Se emitió el documento de ajuste.' : 'Alquiler modificado.', r.facturaId);
          else UI.toast(r.facturaId ? 'Alquiler modificado. Se emitió el documento de ajuste.' : 'Alquiler modificado.');
          if (alCambiar) alCambiar();
        } catch (err) {
          UI.ocupado(submit, false);
          setFormError(f, err && err.message ? err.message : 'No se pudo modificar el alquiler.');
          submit.disabled = true;
        }
      });

      datesChanged();
    };
  } catch (_) {}

  function paymentInfo(f) {
    var total = Number(f.total != null ? f.total : f.monto || 0);
    var wallet = money(Number(f.walletAplicado || 0));
    var additional;

    if (f.pagoAdicional != null) additional = money(f.pagoAdicional);
    else if (f.montoPagadoMetodo != null) additional = money(f.montoPagadoMetodo);
    else additional = total > 0 ? money(Math.max(0, total - wallet)) : 0;

    var method = f.metodoPagoAdicional || ((f.metodoPago && f.metodoPago !== 'WALLET') ? f.metodoPago : null);
    var income;

    if (f.ingresoNuevo != null) income = money(Math.max(0, Math.min(Number(f.ingresoNuevo), Math.max(0, total))));
    else income = total > 0 ? (String(f.metodoPago || '').toUpperCase() === 'WALLET' && wallet <= 0 ? 0 : additional) : 0;

    return { total: money(total), wallet: wallet, additional: additional, method: method, income: income };
  }

  function sessionRole() {
    try { return Api.sesion() && Api.sesion().usuario && Api.sesion().usuario.rol; }
    catch (_) { return null; }
  }

  function removeRetention(root) {
    if (!root) return;

    qa('dt,div,span,td,th,p,small', root).forEach(function (el) {
      if (String(el.textContent || '').trim().toLowerCase() !== 'retención') return;

      if (el.tagName === 'DT') {
        var dd = el.nextElementSibling;
        if (dd && dd.tagName === 'DD') dd.remove();
        el.remove();
        return;
      }

      var row = el.closest('.factura-total-fila,.factura-resumen-fila,.fila-total,.resumen-fila,tr');
      if (!row) {
        var p = el.parentElement;
        if (p && p.children.length <= 3) row = p;
      }
      if (row) row.remove();
    });

    qa('*', root).forEach(function (el) {
      if (el.children.length) return;
      var t = String(el.textContent || '');
      if (/Tasas aplicadas en esta operación:/i.test(t)) {
        el.textContent = t.replace(/,?\s*retención\s+[\d.,]+\s*%/i, '').replace(/\s+,/g, ',');
      }
    });
  }

  var invoiceLock = false;
  var invoiceCache = {};

  async function refineInvoice() {
    var m = location.hash.match(/#\/factura\/(\d+)/);
    var box = q('.factura');
    if (!m || !box || invoiceLock) return;

    var id = Number(m[1]);
    if (box.dataset.financeFinal === String(id)) return;

    invoiceLock = true;
    try {
      var f = invoiceCache[id] || await Api.factura(id);
      invoiceCache[id] = f;
      if (!f || !document.body.contains(box)) return;

      box.dataset.financeFinal = String(id);
      removeRetention(box);

      var p = paymentInfo(f);
      var section = q('.factura-pago-desglose', box);

      if (p.total >= 0 && p.wallet <= 0) {
        if (section) section.remove();
        return;
      }

      if (p.total >= 0 && p.wallet > 0) {
        if (!section) {
          section = document.createElement('section');
          section.className = 'factura-pago-desglose';
          box.appendChild(section);
        }

        if (sessionRole() === 'CLIENTE') {
          var clienteRows = '';
          clienteRows += '<div><span>Total del alquiler</span><b>' + fmtMoney(p.total) + '</b></div>';
          clienteRows += '<div class="wallet-line"><span>Wallet GO utilizado</span><b>− ' + fmtMoney(p.wallet) + '</b></div>';
          if (p.additional > 0) {
            clienteRows += '<div><span>Pago adicional</span><b>' + fmtMoney(p.additional) + (p.method ? ' · ' + esc(label(p.method)) : '') + '</b></div>';
          }
          clienteRows += '<div class="factura-cliente-cubierto"><span>Total cubierto</span><b>' + fmtMoney(p.wallet + p.additional) + '</b></div>';
          section.innerHTML = '<div class="factura-pago-titulo factura-pago-cliente"><div><b>Forma de pago</b><small>Resumen de cómo se cubrió este alquiler.</small></div></div><div class="factura-pago-grid factura-pago-grid-cliente">' + clienteRows + '</div>';
        } else {
          var adminRows = '';
          adminRows += '<div><span>Total de la factura</span><b>' + fmtMoney(p.total) + '</b></div>';
          adminRows += '<div class="wallet-line"><span>Aplicado desde Wallet GO</span><b>− ' + fmtMoney(p.wallet) + '</b></div>';
          adminRows += '<div><span>Pago adicional recibido</span><b>' + fmtMoney(p.additional) + '</b></div>';
          adminRows += '<div><span>Método del pago adicional</span><b>' + (p.additional > 0 ? esc(label(p.method || '—')) : 'No aplica') + '</b></div>';
          adminRows += '<div class="income-line"><span>Ingreso nuevo registrado</span><b>' + fmtMoney(p.income) + '</b></div>';
          section.innerHTML = '<div class="factura-pago-titulo"><div><b>Desglose del pago</b><small>El saldo Wallet GO ya estaba acreditado y no se registra nuevamente como ingreso.</small></div></div><div class="factura-pago-grid">' + adminRows + '</div>';
        }
      }

      if (p.total < 0 && section) section.classList.add('factura-nota-credito-pago');
    } catch (_) {
    } finally {
      invoiceLock = false;
    }
  }

  var detailLocks = {};

  function findRentalDialog() {
    var heads = qa('h1,h2,h3,.modal-h strong,.modal-h b');
    for (var i = heads.length - 1; i >= 0; i--) {
      var match = String(heads[i].textContent || '').match(/Alquiler\s+#(\d+)/i);
      if (match) {
        return {
          id: Number(match[1]),
          root: heads[i].closest('[role=dialog],.modal,.modal-caja') || heads[i].parentElement.parentElement
        };
      }
    }
    return null;
  }

  async function decorateRentalDetail() {
    var info = findRentalDialog();
    if (!info || !info.root || q('.detalle-pago-real', info.root) || detailLocks[info.id]) return;

    detailLocks[info.id] = true;
    try {
      var pair = await Promise.all([
        Api.alquiler(info.id),
        Api.facturas({ alquilerId: info.id, first: 100 })
      ]);
      var rental = pair[0];
      var invoices = pair[1] && pair[1].nodes || [];
      if (!rental || !document.body.contains(info.root)) return;

      var wallet = money(invoices.reduce(function (s, f) { return s + Number(f.walletAplicado || 0); }, 0));
      var income = money(invoices.reduce(function (s, f) { return s + Number(f.ingresoNuevo || 0); }, 0));
      var credits = money(Math.abs(invoices.filter(function (f) {
        return Number(f.total != null ? f.total : f.monto) < 0;
      }).reduce(function (s, f) {
        return s + Number(f.total != null ? f.total : f.monto || 0);
      }, 0)));
      var methods = invoices.filter(function (f) {
        return Number(f.ingresoNuevo || 0) > 0;
      }).map(function (f) {
        return f.metodoPagoAdicional || f.metodoPago;
      }).filter(Boolean).filter(function (x, i, arr) {
        return arr.indexOf(x) === i;
      });

      var div = document.createElement('section');
      div.className = 'detalle-pago-real';
      div.innerHTML = '<div class="detalle-pago-title"><span>' + icon('wallet') + '</span><div><b>Resumen de pago</b><small>Cómo se cubrió el alquiler y qué entró realmente como pago nuevo.</small></div></div>' +
        '<div class="detalle-pago-grid">' +
          '<div><small>Wallet GO aplicado</small><b>' + fmtMoney(wallet) + '</b></div>' +
          '<div><small>Pago adicional recibido</small><b>' + fmtMoney(income) + '</b><span>' + (methods.length ? methods.map(label).join(' · ') : 'Sin pago adicional') + '</span></div>' +
          (credits > 0 ? '<div><small>Créditos devueltos a Wallet</small><b>' + fmtMoney(credits) + '</b></div>' : '') +
          '<div><small>Total actual del alquiler</small><b>' + fmtMoney(rental.totalAlquiler != null ? rental.totalAlquiler : rental.montoTotal) + '</b></div>' +
        '</div>';

      var invoiceHeading = qa('h3,h4,b,strong', info.root).find(function (el) {
        return /^Facturas$/i.test(String(el.textContent || '').trim());
      });
      var target = invoiceHeading && (invoiceHeading.closest('section') || invoiceHeading.parentElement);
      var actions = q('.modal-acc', info.root);
      if (target && target.parentElement) target.parentElement.insertBefore(div, target);
      else if (actions && actions.parentElement) actions.parentElement.insertBefore(div, actions);
      else info.root.appendChild(div);
    } catch (_) {
    } finally {
      delete detailLocks[info.id];
    }
  }

  function invoiceIncome(f) {
    return paymentInfo(f).income;
  }

  async function allInvoices(desde, hasta) {
    var nodes = [];
    var after = null;
    var guard = 0;
    do {
      var r = await Api.facturas({ desde: desde || null, hasta: hasta || null, first: 200, after: after });
      nodes.push.apply(nodes, r.nodes || []);
      after = r.pageInfo && r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
    } while (after && ++guard < 25);
    return nodes;
  }

  /* Calcula la serie de ingresos del panel administrativo. */
  try {
    serieIngresos = async function () {
      var h = today();
      var p = h.split('-').map(Number);
      var y = p[0];
      var m = p[1];
      var months = [];

      for (var i = 5; i >= 0; i--) {
        months.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
      }

      var sum = {};
      var fromWalletWithdraw = {};
      months.forEach(function (k) {
        sum[k] = 0;
        fromWalletWithdraw[k] = 0;
      });

      var invoices = await allInvoices(months[0] + '-01', h);
      invoices.forEach(function (f) {
        var k = String(f.fechaEmision || '').slice(0, 7);
        if (k in sum) sum[k] += invoiceIncome(f);
      });

      try {
        var iw = await Api.ingresosWallet({ desde: months[0] + '-01', hasta: h });
        (iw || []).forEach(function (x) {
          var k = String(x.fecha || '').slice(0, 7);
          if (k in sum) {
            sum[k] += Number(x.monto || 0);
            fromWalletWithdraw[k] += Number(x.monto || 0);
          }
        });
      } catch (_) {}

      return months.map(function (k) {
        var name = new Date(k + '-15T12:00:00').toLocaleDateString('es-DO', { month: 'short' }).replace('.', '');
        return {
          clave: k,
          etq: name.charAt(0).toUpperCase() + name.slice(1),
          valor: money(sum[k]),
          wallet: money(fromWalletWithdraw[k])
        };
      });
    };
  } catch (_) {}

  function cleanDashboardPendingText() {
    if (location.hash !== '#/dashboard') return;
    qa('p,small,span,div').forEach(function (el) {
      if (el.children.length) return;
      if (/Reportes\s+y\s+Configuración:\s*pendientes\s+de\s+implementar/i.test(String(el.textContent || ''))) el.remove();
    });
  }

  var scheduled = false;
  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      refineInvoice();
      decorateRentalDetail();
      cleanDashboardPendingText();
    });
  }

  var root = document.getElementById('raiz') || document.body;
  new MutationObserver(scheduleEnhance).observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { setTimeout(scheduleEnhance, 0); });
  scheduleEnhance();

  setTimeout(function () {
    if (/#\/dashboard(?:\?|$)/.test(location.hash) && typeof render === 'function') render();
  }, 0);
})();
