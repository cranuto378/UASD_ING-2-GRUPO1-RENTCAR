/* =========================================================
   AUTOGO · REPORTES v2
   Una sola fuente de verdad para métricas, filtros y exportación.

   Reglas:
   - Ingresos = dinero nuevo recibido (efectivo/transferencia/tarjeta)
     + retención real de retiros Wallet GO.
   - Wallet GO reutilizado no vuelve a contarse como ingreso.
   - Notas de crédito = facturas con total negativo.
   - Facturas emitidas = facturas positivas.
   - Alquileres del período = alquileres cuya fecha de salida cae en el rango.
========================================================= */
(function () {
  'use strict';

  const $q = (s, r = document) => r.querySelector(s);
  const escHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Math.round((Number(n) || 0) * 100) / 100;
  const rd = n => 'RD$' + money(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isoLocal = d => {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
  };
  const today = () => isoLocal(new Date());
  const firstOfMonth = () => {
    const d = new Date();
    return isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const inRange = (v, from, to) => {
    const d = String(v || '').slice(0, 10);
    return !!d && d >= from && d <= to;
  };
  const label = v => window.UI && UI.etq ? UI.etq(v) : String(v || '').replace(/_/g, ' ');
  const icon = n => window.UI && UI.icon ? UI.icon(n) : '';

  async function allPages(loader) {
    const out = [];
    let after = null;
    let guard = 0;
    do {
      const r = await loader({ first: 200, after });
      out.push(...(r.nodes || []));
      after = r.pageInfo && r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
    } while (after && ++guard < 30);
    return out;
  }

  function invoiceTotal(f) {
    return money(f.total != null ? f.total : f.monto || 0);
  }

  function invoiceIncome(f) {
    const total = invoiceTotal(f);
    if (total <= 0) return 0;
    if (f.ingresoNuevo != null) return money(Math.max(0, Number(f.ingresoNuevo)));
    if (f.pagoAdicional != null) return money(Math.max(0, Number(f.pagoAdicional)));
    if (f.montoPagadoMetodo != null) return money(Math.max(0, Number(f.montoPagadoMetodo)));
    const wallet = Number(f.walletAplicado || 0);
    if (String(f.metodoPago || '').toUpperCase() === 'WALLET') return 0;
    return money(Math.max(0, total - wallet));
  }

  function incomeMethod(f) {
    if (invoiceIncome(f) <= 0) return null;
    return String(f.metodoPagoAdicional || f.metodoPago || 'OTRO').toUpperCase();
  }

  function creditReason(f) {
    const raw = String(f.origen || f.concepto || '').toUpperCase();
    if (raw.includes('CANCEL')) return 'Cancelación';
    if (raw.includes('DEVOLUC')) return 'Devolución anticipada';
    if (raw.includes('MODIFIC')) return 'Modificación de alquiler';
    return f.concepto || 'Nota de crédito';
  }

  function rentalState(a) {
    try {
      if (typeof estadoOperativoAlquiler === 'function') return estadoOperativoAlquiler(a);
    } catch (_) {}
    const h = today();
    if (a.estado === 'CANCELADO') return { texto: 'Cancelado', clave: 'cancelado' };
    if (a.estado === 'COMPLETADO') return { texto: 'Completado', clave: 'completado' };
    if (a.estado === 'ACTIVO' && a.fechaInicio > h) return { texto: 'Reserva', clave: 'reserva' };
    if (a.estado === 'ACTIVO' && a.fechaFinPactada < h) return { texto: 'Vencido', clave: 'vencido' };
    return { texto: 'En curso', clave: 'activo' };
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv(name, rows) {
    const text = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function empty(text, ic = 'info') {
    return UI.vacio ? UI.vacio(text, ic) : '<div class="vacio"><p>' + escHtml(text) + '</p></div>';
  }

  function bars(items, formatter = rd) {
    if (!items.length) return empty('No hay datos para este filtro.');
    const max = Math.max(1, ...items.map(x => Math.abs(Number(x.value || 0))));
    return '<div class="rep-barras">' + items.map(x =>
      '<div><div class="rep-bar-label"><span>' + escHtml(x.label) + '</span><b>' + formatter(x.value) + '</b></div>' +
      '<i><span style="width:' + Math.max(4, Math.abs(Number(x.value || 0)) / max * 100) + '%"></span></i></div>'
    ).join('') + '</div>';
  }

  async function vReportesLimpio(c, ctx) {
    const state = {
      desde: firstOfMonth(),
      hasta: today(),
      filtro: 'ingresos',
      facturas: [],
      alquileres: [],
      retirosWallet: [],
      loading: false
    };

    ctx.acciones('<button class="btn ghost" type="button" data-rpt-export>' + icon('download') + ' Exportar CSV</button>');

    c.innerHTML = `
      <div class="reportes-v2">
        <div class="rep-filtros">
          <label><span>Desde</span><input type="date" id="rptDesde" value="${state.desde}"></label>
          <label><span>Hasta</span><input type="date" id="rptHasta" value="${state.hasta}"></label>
          <button class="btn" type="button" id="rptAplicar">${icon('pulse')} Actualizar reporte</button>
          <button class="btn ghost" type="button" id="rptMes">Mes actual</button>
        </div>

        <div class="rep-resumen rpt-resumen" id="rptResumen">
          ${['','','',''].map(() => '<div class="card rep-mini"><span class="skeleton"></span></div>').join('')}
        </div>

        <div id="rptContenido"></div>
      </div>`;

    const elDesde = $q('#rptDesde', c);
    const elHasta = $q('#rptHasta', c);
    const contenido = $q('#rptContenido', c);
    const resumen = $q('#rptResumen', c);

    function validRange() {
      state.desde = elDesde.value;
      state.hasta = elHasta.value;
      if (!state.desde || !state.hasta) {
        UI.toast('Selecciona ambas fechas.', 'warn');
        return false;
      }
      if (state.hasta < state.desde) {
        UI.toast('La fecha “Hasta” debe ser igual o posterior a “Desde”.', 'warn');
        return false;
      }
      return true;
    }

    function positiveInvoices() {
      return state.facturas.filter(f => invoiceTotal(f) > 0);
    }
    function creditInvoices() {
      return state.facturas.filter(f => invoiceTotal(f) < 0);
    }
    function rentalsInRange() {
      return state.alquileres.filter(a => inRange(a.fechaInicio, state.desde, state.hasta));
    }

    function totalIncome() {
      const invoiceMoney = state.facturas.reduce((s, f) => s + invoiceIncome(f), 0);
      const walletRetention = state.retirosWallet.reduce((s, x) => s + Number(x.monto || 0), 0);
      return money(invoiceMoney + walletRetention);
    }

    function renderSummary() {
      const ingresos = totalIncome();
      const creditos = money(Math.abs(creditInvoices().reduce((s, f) => s + invoiceTotal(f), 0)));
      const alquileres = rentalsInRange().length;
      const facturas = positiveInvoices().length;
      const cards = [
        { key: 'ingresos', cls: 'tono-orange', ic: 'wallet', title: 'Ingresos recibidos', value: rd(ingresos), desc: 'Dinero nuevo recibido en el período' },
        { key: 'creditos', cls: 'tono-purple', ic: 'undo', title: 'Notas de crédito', value: rd(creditos), desc: 'Créditos y ajustes negativos emitidos' },
        { key: 'alquileres', cls: 'tono-green', ic: 'calendar', title: 'Alquileres', value: String(alquileres), desc: 'Salidas dentro del período' },
        { key: 'facturas', cls: 'tono-blue', ic: 'receipt', title: 'Facturas emitidas', value: String(facturas), desc: 'Facturas positivas del período' }
      ];
      resumen.innerHTML = cards.map(x => `
        <button class="card rep-mini ${x.cls} rpt-card-filter ${state.filtro === x.key ? 'rep-filtro-activo' : ''}" type="button" data-rpt-filter="${x.key}" aria-pressed="${state.filtro === x.key}">
          <span class="rep-mini-ico">${icon(x.ic)}</span>
          <span><small>${x.title}</small><b>${x.value}</b><em>${x.desc}</em></span>
        </button>`).join('');
    }

    function incomeRows() {
      const groups = {};
      state.facturas.forEach(f => {
        const amount = invoiceIncome(f);
        if (amount <= 0) return;
        const method = incomeMethod(f) || 'OTRO';
        groups[method] = money((groups[method] || 0) + amount);
      });
      const wallet = money(state.retirosWallet.reduce((s, x) => s + Number(x.monto || 0), 0));
      if (wallet > 0) groups.RETENCION_WALLET = wallet;
      return Object.entries(groups).map(([k,v]) => ({ label: k === 'RETENCION_WALLET' ? 'Retención Wallet GO' : label(k), value: v }))
        .sort((a,b) => b.value - a.value);
    }

    function creditRows() {
      const groups = {};
      creditInvoices().forEach(f => {
        const k = creditReason(f);
        groups[k] = money((groups[k] || 0) + Math.abs(invoiceTotal(f)));
      });
      return Object.entries(groups).map(([k,v]) => ({ label:k, value:v })).sort((a,b)=>b.value-a.value);
    }

    function invoiceTypeRows() {
      const groups = {};
      positiveInvoices().forEach(f => {
        const k = label(f.tipo || 'Otro');
        groups[k] = money((groups[k] || 0) + invoiceTotal(f));
      });
      return Object.entries(groups).map(([k,v]) => ({ label:k, value:v })).sort((a,b)=>b.value-a.value);
    }

    function rentalStateRows() {
      const groups = {};
      rentalsInRange().forEach(a => {
        const s = rentalState(a).texto;
        groups[s] = (groups[s] || 0) + 1;
      });
      return Object.entries(groups).map(([k,v]) => ({ label:k, value:v })).sort((a,b)=>b.value-a.value);
    }

    function rentalChannelRows() {
      const groups = {};
      rentalsInRange().forEach(a => {
        const k = String(a.canal || 'OTRO').toUpperCase();
        groups[k] = (groups[k] || 0) + 1;
      });
      return Object.entries(groups).map(([k,v]) => ({ label:label(k), value:v })).sort((a,b)=>b.value-a.value);
    }

    function vehicleRanking() {
      const groups = {};
      rentalsInRange().forEach(a => {
        const key = a.vehiculoId || a.placa || a.vehiculo;
        if (!groups[key]) groups[key] = { nombre:a.vehiculo || 'Vehículo', placa:a.placa || '—', alquileres:0, dias:0, ingreso:0 };
        groups[key].alquileres++;
        groups[key].dias += Number(a.dias || 0);
        const inv = state.facturas.filter(f => f.alquilerId == a.id);
        groups[key].ingreso += inv.reduce((s,f)=>s+invoiceIncome(f),0);
      });
      return Object.values(groups).sort((a,b)=>b.alquileres-a.alquileres || b.ingreso-a.ingreso).slice(0,8);
    }

    function invoicesTable(list, mode) {
      if (!list.length) return empty(mode === 'creditos' ? 'No hay notas de crédito en este período.' : 'No hay facturas para este filtro.', 'receipt');
      const rows = list.slice().sort((a,b)=>String(b.fechaEmision||'').localeCompare(String(a.fechaEmision||''))).slice(0,40).map(f => {
        const total = invoiceTotal(f);
        const method = incomeMethod(f);
        return `<tr>
          <td><a href="#/factura/${f.id}">#${String(f.id).padStart(4,'0')}</a></td>
          <td>${escHtml(UI.fmt.fechaHora(f.fechaEmision))}</td>
          <td>${escHtml(label(f.tipo))}</td>
          <td>${escHtml(f.clienteNombre || '—')}</td>
          <td>${escHtml(f.vehiculo || '—')}</td>
          ${mode === 'ingresos' ? `<td>${escHtml(method ? label(method) : 'Retención Wallet GO')}</td><td class="num">${rd(invoiceIncome(f))}</td>` : ''}
          ${mode === 'creditos' ? `<td>${escHtml(creditReason(f))}</td><td class="num negativo">${rd(Math.abs(total))}</td>` : ''}
          ${mode === 'facturas' ? `<td class="num">${rd(total)}</td><td class="num">${rd(invoiceIncome(f))}</td>` : ''}
        </tr>`;
      }).join('');
      const extra = mode === 'ingresos' ? '<th>Método</th><th class="num">Ingreso recibido</th>' : mode === 'creditos' ? '<th>Motivo</th><th class="num">Crédito</th>' : '<th class="num">Total factura</th><th class="num">Ingreso recibido</th>';
      return `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>No.</th><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Vehículo</th>${extra}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    function rentalsTable(list) {
      if (!list.length) return empty('No hay alquileres con salida dentro de este período.', 'calendar');
      const rows = list.slice().sort((a,b)=>String(b.fechaInicio||'').localeCompare(String(a.fechaInicio||''))).slice(0,40).map(a => {
        const st = rentalState(a);
        return `<tr>
          <td><b>#${a.id}</b></td><td>${escHtml(a.clienteNombre || '—')}</td><td>${escHtml(a.vehiculo || '—')}</td>
          <td>${escHtml(UI.fmt.fecha(a.fechaInicio))}</td><td>${escHtml(UI.fmt.fecha(a.fechaFinPactada))}</td>
          <td>${escHtml(label(a.canal || '—'))}</td><td>${escHtml(st.texto)}</td><td class="num">${a.dias || '—'}</td>
        </tr>`;
      }).join('');
      return `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>No.</th><th>Cliente</th><th>Vehículo</th><th>Salida</th><th>Entrega</th><th>Canal</th><th>Estado actual</th><th class="num">Días</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    function renderContent() {
      if (state.filtro === 'ingresos') {
        const incomeInvoices = state.facturas.filter(f => invoiceIncome(f) > 0);
        contenido.innerHTML = `
          <div class="rep-grid rpt-grid-dos">
            <section class="card rep-card"><div class="rep-card-h"><div><h3>Ingresos por método de pago</h3><p>Dinero nuevo recibido; Wallet GO reutilizado no se suma.</p></div></div>${bars(incomeRows())}</section>
            <section class="card rep-card"><div class="rep-card-h"><div><h3>Resumen del período</h3><p>Composición de los ingresos recibidos.</p></div></div>
              <div class="rpt-kv"><div><span>Facturas con ingreso nuevo</span><b>${incomeInvoices.length}</b></div><div><span>Retención por retiros Wallet GO</span><b>${rd(state.retirosWallet.reduce((s,x)=>s+Number(x.monto||0),0))}</b></div><div><span>Total recibido</span><b>${rd(totalIncome())}</b></div></div>
            </section>
          </div>
          <section class="card rep-card rep-ancha"><div class="rep-card-h"><div><h3>Actividad de ingresos</h3><p>Facturas que generaron dinero nuevo dentro del período.</p></div></div>${invoicesTable(incomeInvoices, 'ingresos')}</section>`;
        return;
      }

      if (state.filtro === 'creditos') {
        const credits = creditInvoices();
        contenido.innerHTML = `
          <div class="rep-grid rpt-grid-dos">
            <section class="card rep-card"><div class="rep-card-h"><div><h3>Créditos por motivo</h3><p>Origen de las notas de crédito emitidas.</p></div></div>${bars(creditRows())}</section>
            <section class="card rep-card"><div class="rep-card-h"><div><h3>Resumen de créditos</h3><p>Créditos que reducen el saldo a cobrar y pueden acreditar Wallet GO.</p></div></div>
              <div class="rpt-kv"><div><span>Notas de crédito</span><b>${credits.length}</b></div><div><span>Total acreditado</span><b>${rd(Math.abs(credits.reduce((s,f)=>s+invoiceTotal(f),0)))}</b></div></div>
            </section>
          </div>
          <section class="card rep-card rep-ancha"><div class="rep-card-h"><div><h3>Notas de crédito emitidas</h3><p>Detalle de los créditos del período.</p></div></div>${invoicesTable(credits, 'creditos')}</section>`;
        return;
      }

      if (state.filtro === 'alquileres') {
        const rentals = rentalsInRange();
        const top = vehicleRanking();
        contenido.innerHTML = `
          <div class="rep-grid rpt-grid-dos">
            <section class="card rep-card"><div class="rep-card-h"><div><h3>Estado actual de los alquileres</h3><p>Situación actual de los alquileres cuya salida está en el período.</p></div></div>${bars(rentalStateRows(), v => String(v))}</section>
            <section class="card rep-card"><div class="rep-card-h"><div><h3>Alquileres por canal</h3><p>Distribución entre Portal y Mostrador.</p></div></div>${bars(rentalChannelRows(), v => String(v))}</section>
          </div>
          <section class="card rep-card rep-ancha"><div class="rep-card-h"><div><h3>Vehículos con mayor actividad</h3><p>Ranking por alquileres, días alquilados e ingreso nuevo relacionado.</p></div></div>
            ${top.length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>#</th><th>Vehículo</th><th>Placa</th><th class="num">Alquileres</th><th class="num">Días</th><th class="num">Ingreso recibido</th></tr></thead><tbody>${top.map((x,i)=>`<tr><td>${i+1}</td><td><b>${escHtml(x.nombre)}</b></td><td>${escHtml(x.placa)}</td><td class="num">${x.alquileres}</td><td class="num">${x.dias}</td><td class="num">${rd(x.ingreso)}</td></tr>`).join('')}</tbody></table></div>` : empty('No hay actividad de vehículos en este período.', 'car')}
          </section>
          <section class="card rep-card rep-ancha"><div class="rep-card-h"><div><h3>Alquileres del período</h3><p>Se consideran por fecha de salida, no por fecha de creación.</p></div></div>${rentalsTable(rentals)}</section>`;
        return;
      }

      const invoices = positiveInvoices();
      contenido.innerHTML = `
        <div class="rep-grid rpt-grid-dos">
          <section class="card rep-card"><div class="rep-card-h"><div><h3>Facturas por tipo</h3><p>Distribución de las facturas positivas del período.</p></div></div>${bars(invoiceTypeRows())}</section>
          <section class="card rep-card"><div class="rep-card-h"><div><h3>Resumen de facturación</h3><p>Conteo y valor nominal de las facturas emitidas.</p></div></div>
            <div class="rpt-kv"><div><span>Facturas emitidas</span><b>${invoices.length}</b></div><div><span>Valor total facturado</span><b>${rd(invoices.reduce((s,f)=>s+invoiceTotal(f),0))}</b></div><div><span>Ingreso nuevo asociado</span><b>${rd(invoices.reduce((s,f)=>s+invoiceIncome(f),0))}</b></div></div>
          </section>
        </div>
        <section class="card rep-card rep-ancha"><div class="rep-card-h"><div><h3>Facturas recientes</h3><p>Facturas positivas emitidas dentro del período.</p></div></div>${invoicesTable(invoices, 'facturas')}</section>`;
    }

    function renderAll() {
      renderSummary();
      renderContent();
    }

    async function load() {
      if (!validRange() || state.loading) return;
      state.loading = true;
      resumen.innerHTML = ['','','',''].map(() => '<div class="card rep-mini"><span class="skeleton"></span></div>').join('');
      contenido.innerHTML = '<div class="card rep-card">' + (UI.cargando ? UI.cargando(4) : 'Cargando…') + '</div>';
      try {
        const [facts, rentals, wallet] = await Promise.all([
          allPages(p => Api.facturas({ desde: state.desde, hasta: state.hasta, ...p })),
          allPages(p => Api.alquileres({ ...p })),
          Api.ingresosWallet({ desde: state.desde, hasta: state.hasta }).catch(() => [])
        ]);
        if (!ctx.vigente()) return;
        state.facturas = facts;
        state.alquileres = rentals;
        state.retirosWallet = Array.isArray(wallet) ? wallet : [];
        renderAll();
      } catch (err) {
        contenido.innerHTML = empty(err && err.message ? err.message : 'No se pudo cargar el reporte.', 'warning');
      } finally {
        state.loading = false;
      }
    }

    resumen.addEventListener('click', e => {
      const card = e.target.closest('[data-rpt-filter]');
      if (!card) return;
      state.filtro = card.dataset.rptFilter;
      renderAll();
    });

    $q('#rptAplicar', c).addEventListener('click', load);
    $q('#rptMes', c).addEventListener('click', () => {
      elDesde.value = firstOfMonth();
      elHasta.value = today();
      load();
    });

    const exportBtn = document.querySelector('[data-rpt-export]');
    if (exportBtn) exportBtn.onclick = () => {
      if (!state.facturas.length && !state.alquileres.length) return UI.toast('No hay datos para exportar.', 'warn');
      let rows;
      if (state.filtro === 'ingresos') {
        const list = state.facturas.filter(f => invoiceIncome(f) > 0);
        rows = [['AUTOGO - INGRESOS', state.desde + ' a ' + state.hasta], [], ['Factura','Fecha','Cliente','Vehículo','Método','Ingreso recibido'], ...list.map(f => [f.id,f.fechaEmision,f.clienteNombre,f.vehiculo,label(incomeMethod(f) || 'Otro'),invoiceIncome(f)])];
        state.retirosWallet.forEach(x => rows.push(['',x.fecha || '', '','', 'Retención Wallet GO', Number(x.monto || 0)]));
      } else if (state.filtro === 'creditos') {
        rows = [['AUTOGO - NOTAS DE CRÉDITO', state.desde + ' a ' + state.hasta], [], ['No.','Fecha','Cliente','Vehículo','Motivo','Crédito'], ...creditInvoices().map(f => [f.id,f.fechaEmision,f.clienteNombre,f.vehiculo,creditReason(f),Math.abs(invoiceTotal(f))])];
      } else if (state.filtro === 'alquileres') {
        rows = [['AUTOGO - ALQUILERES', state.desde + ' a ' + state.hasta], [], ['No.','Cliente','Vehículo','Salida','Entrega','Canal','Estado actual','Días'], ...rentalsInRange().map(a => [a.id,a.clienteNombre,a.vehiculo,a.fechaInicio,a.fechaFinPactada,label(a.canal),rentalState(a).texto,a.dias])];
      } else {
        rows = [['AUTOGO - FACTURAS', state.desde + ' a ' + state.hasta], [], ['No.','Fecha','Tipo','Cliente','Vehículo','Método','Total factura','Ingreso recibido'], ...positiveInvoices().map(f => [f.id,f.fechaEmision,label(f.tipo),f.clienteNombre,f.vehiculo,label(f.metodoPago),invoiceTotal(f),invoiceIncome(f)])];
      }
      downloadCsv('AutoGo_' + state.filtro + '_' + state.desde + '_' + state.hasta + '.csv', rows);
    };

    await load();
  }

  // Sustituye solo la vista de Reportes. El resto de app.js permanece intacto.
  try {
    if (typeof RUTAS !== 'undefined' && RUTAS.reportes) RUTAS.reportes.vista = vReportesLimpio;
  } catch (_) {}
  window.AutoGoReports = { view: vReportesLimpio };
})();
