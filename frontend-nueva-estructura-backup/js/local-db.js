/* =========================================================
   AUTOGO · BASE DE DATOS LOCAL DE DEMOSTRACIÓN
   Emula el backend GraphQL en el navegador para revisar UI.
   Persistencia: localStorage (autogo.localdb.v1)
========================================================= */
(function () {
  const cfg = window.AUTOGO_CONFIG || {};
  if (cfg.LOCAL_DB !== true) return;

  const KEY = 'autogo.localdb.v1';
  const VERSION = 1;
  const nativeFetch = window.fetch.bind(window);

  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = n => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return isoDate(d); };
  const nowIso = () => new Date().toISOString();
  const clone = v => JSON.parse(JSON.stringify(v));
  const money = n => Math.round((Number(n) || 0) * 100) / 100;
  const cfgFin = db => ({
    impuestoPct: db.configuracion.impuestoPct,
    retencionPct: db.configuracion.retencionPct,
    recargoMoraPct: db.configuracion.recargoMoraPct,
    retiroWalletClientePct: db.configuracion.retiroWalletClientePct
  });

  function carSvg(label, c1, c2) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect width="900" height="560" rx="34" fill="url(#g)"/>
      <ellipse cx="450" cy="420" rx="290" ry="36" fill="rgba(0,0,0,.18)"/>
      <path d="M215 345c22-76 61-121 126-142 43-14 178-14 221 0 60 20 100 68 123 142l52 18c24 8 40 30 40 56v22H123v-22c0-25 17-48 41-56l51-18Z" fill="rgba(255,255,255,.88)"/>
      <path d="M322 218h256c31 16 56 50 72 95H260c15-44 33-74 62-95Z" fill="rgba(20,39,70,.70)"/>
      <circle cx="262" cy="439" r="55" fill="#14213c"/><circle cx="262" cy="439" r="26" fill="#dbe7ff"/>
      <circle cx="642" cy="439" r="55" fill="#14213c"/><circle cx="642" cy="439" r="26" fill="#dbe7ff"/>
      <text x="450" y="105" text-anchor="middle" fill="white" font-family="Arial" font-size="38" font-weight="700">${label}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function seed() {
    const configuracion = {
      nombreComercial: 'AutoGo Rent a Car',
      rnc: '1-32-45678-9',
      telefono: '809-555-0148',
      correo: 'info@autogo.local',
      direccion: 'Bonao, Monseñor Nouel, República Dominicana',
      diasMantenimientoPostDevolucion: 1,
      permitirRetirosWallet: true,
      diasAvisoVencimiento: 2,
      impuestoPct: 18,
      retencionPct: 2,
      recargoMoraPct: 30,
      retiroWalletClientePct: 70
    };

    const usuarios = [
      { id: 1, nombre:'Camila Rojas', correo:'superadmin@autogo.local', password:'Demo1234', rol:'ADMINISTRADOR', perfil:'Superadministrador', activo:true, debeCambiarPassword:false, clienteId:null, ultimoAcceso:nowIso(), fechaCreacion:addDays(-120) },
      { id: 2, nombre:'Administrador Demo', correo:'admin@autogo.local', password:'Demo1234', rol:'ADMINISTRADOR', perfil:'Administrador', activo:true, debeCambiarPassword:false, clienteId:null, ultimoAcceso:addDays(-1)+'T15:20:00', fechaCreacion:addDays(-100) },
      { id: 3, nombre:'Operador Demo', correo:'operador@autogo.local', password:'Demo1234', rol:'ADMINISTRADOR', perfil:'Operador', activo:true, debeCambiarPassword:false, clienteId:null, ultimoAcceso:addDays(-1)+'T11:10:00', fechaCreacion:addDays(-80) },
      { id: 4, nombre:'Consulta Demo', correo:'consulta@autogo.local', password:'Demo1234', rol:'ADMINISTRADOR', perfil:'Consulta', activo:true, debeCambiarPassword:false, clienteId:null, ultimoAcceso:addDays(-2)+'T09:30:00', fechaCreacion:addDays(-60) },
      { id: 10, nombre:'Laura Méndez', correo:'cliente@autogo.local', password:'Demo1234', rol:'CLIENTE', perfil:null, activo:true, debeCambiarPassword:false, clienteId:101, ultimoAcceso:nowIso(), fechaCreacion:addDays(-70) }
    ];

    const categorias = [
      { id:1, nombre:'Económico', activo:true },
      { id:2, nombre:'Sedán', activo:true },
      { id:3, nombre:'SUV', activo:true },
      { id:4, nombre:'Jeepeta', activo:true },
      { id:5, nombre:'Premium', activo:true }
    ];

    const vehiculos = [
      { id:1, placa:'A123456', categoriaId:2, categoria:'Sedán', marca:'Toyota', modelo:'Corolla', anio:2024, precioDia:2800, estadoOperativo:'DISPONIBLE', estadoActual:'DISPONIBLE', mantenimientoHasta:null, fotoUrl:carSvg('Toyota Corolla','#3e75b8','#293d68'), activo:true, color:'Gris', transmision:'Automática', capacidad:5, observaciones:'Sedán cómodo y eficiente.' },
      { id:2, placa:'G456789', categoriaId:3, categoria:'SUV', marca:'Honda', modelo:'CR-V', anio:2025, precioDia:4200, estadoOperativo:'DISPONIBLE', estadoActual:'DISPONIBLE', mantenimientoHasta:null, fotoUrl:carSvg('Honda CR-V','#596fb3','#2a345e'), activo:true, color:'Blanco', transmision:'Automática', capacidad:5, observaciones:'SUV familiar con amplio espacio.' },
      { id:3, placa:'L884201', categoriaId:4, categoria:'Jeepeta', marca:'Hyundai', modelo:'Santa Fe', anio:2024, precioDia:4700, estadoOperativo:'ALQUILADO', estadoActual:'ALQUILADO', mantenimientoHasta:null, fotoUrl:carSvg('Hyundai Santa Fe','#527b94','#243f5d'), activo:true, color:'Azul', transmision:'Automática', capacidad:7, observaciones:'' },
      { id:4, placa:'A781930', categoriaId:1, categoria:'Económico', marca:'Kia', modelo:'Picanto', anio:2023, precioDia:2200, estadoOperativo:'DISPONIBLE', estadoActual:'DISPONIBLE', mantenimientoHasta:null, fotoUrl:carSvg('Kia Picanto','#6785b9','#364a72'), activo:true, color:'Rojo', transmision:'Automática', capacidad:5, observaciones:'Ideal para ciudad.' },
      { id:5, placa:'G220481', categoriaId:5, categoria:'Premium', marca:'BMW', modelo:'X3', anio:2025, precioDia:7200, estadoOperativo:'MANTENIMIENTO', estadoActual:'MANTENIMIENTO', mantenimientoHasta:addDays(2), fotoUrl:carSvg('BMW X3','#465f8f','#252f52'), activo:true, color:'Negro', transmision:'Automática', capacidad:5, observaciones:'Mantenimiento preventivo.' },
      { id:6, placa:'A667341', categoriaId:2, categoria:'Sedán', marca:'Nissan', modelo:'Sentra', anio:2024, precioDia:3000, estadoOperativo:'DISPONIBLE', estadoActual:'DISPONIBLE', mantenimientoHasta:null, fotoUrl:carSvg('Nissan Sentra','#527f9c','#2b405d'), activo:true, color:'Plata', transmision:'Automática', capacidad:5, observaciones:'' },
      { id:7, placa:'G912773', categoriaId:3, categoria:'SUV', marca:'Mazda', modelo:'CX-5', anio:2024, precioDia:4500, estadoOperativo:'DISPONIBLE', estadoActual:'DISPONIBLE', mantenimientoHasta:null, fotoUrl:carSvg('Mazda CX-5','#665f9d','#303158'), activo:true, color:'Vino', transmision:'Automática', capacidad:5, observaciones:'' },
      { id:8, placa:'A308194', categoriaId:1, categoria:'Económico', marca:'Chevrolet', modelo:'Spark', anio:2022, precioDia:2000, estadoOperativo:'FUERA_DE_SERVICIO', estadoActual:'FUERA_DE_SERVICIO', mantenimientoHasta:null, fotoUrl:carSvg('Chevrolet Spark','#677b91','#354351'), activo:true, color:'Blanco', transmision:'Automática', capacidad:5, observaciones:'Pendiente de reparación.' }
    ];

    const clientes = [
      { id:101, nombre:'Laura Méndez', cedula:'001-1827364-5', correo:'cliente@autogo.local', telefono:'809-555-0170', licenciaConducir:'LIC-101020', activo:true, tieneCuenta:true, fechaCreacion:addDays(-70) },
      { id:102, nombre:'Carlos Peña', cedula:'402-2213401-2', correo:'carlos@example.com', telefono:'829-555-0102', licenciaConducir:'LIC-102021', activo:true, tieneCuenta:false, fechaCreacion:addDays(-55) },
      { id:103, nombre:'María Gómez', cedula:'001-3371902-1', correo:'maria@example.com', telefono:'849-555-0103', licenciaConducir:'LIC-103022', activo:true, tieneCuenta:true, fechaCreacion:addDays(-44) },
      { id:104, nombre:'José Ramírez', cedula:'402-1007723-6', correo:'jose@example.com', telefono:'809-555-0104', licenciaConducir:'LIC-104023', activo:true, tieneCuenta:false, fechaCreacion:addDays(-31) },
      { id:105, nombre:'Ana Martínez', cedula:'001-2901048-8', correo:'ana@example.com', telefono:'829-555-0105', licenciaConducir:'LIC-105024', activo:true, tieneCuenta:true, fechaCreacion:addDays(-20) }
    ];

    function rental(id, clienteId, vehiculoId, inicio, fin, estado, canal='WEB') {
      const c = clientes.find(x=>x.id===clienteId), v = vehiculos.find(x=>x.id===vehiculoId);
      const dias = Math.max(1, Math.ceil((new Date(fin+'T12:00:00')-new Date(inicio+'T12:00:00'))/86400000));
      const montoBase = money(v.precioDia*dias), impuesto = money(montoBase*.18), retencion = money(montoBase*.02), total = money(montoBase+impuesto-retencion);
      const vencido = estado==='ACTIVO' && fin < isoDate(new Date());
      const diasRetraso = vencido ? Math.max(1,Math.ceil((new Date()-new Date(fin+'T23:59:59'))/86400000)) : 0;
      return { id, clienteId, clienteNombre:c.nombre, clienteCedula:c.cedula, vehiculoId, placa:v.placa, vehiculo:`${v.marca} ${v.modelo}`, canal,
        fechaInicio:inicio, fechaFinPactada:fin, fechaDevolucion:estado==='COMPLETADO'?fin:null, precioDia:v.precioDia, dias, montoBase,
        impuestoAlquiler:impuesto, retencionAlquiler:retencion, totalAlquiler:total, diasMora:0, subtotalMora:0, recargoMora:0, impuestoMora:0, retencionMora:0, montoMora:0,
        diasNoUsados:0, subtotalReembolso:0, impuestoReembolso:0, retencionReembolso:0, creditoWallet:0, montoTotal:total, totalFacturado:total,
        estado, vencido, diasRetraso, observaciones:'', fechaCreacion:inicio+'T09:20:00', configFinanciera:{...configuracion} };
    }

    const alquileres = [
      rental(5001,101,3,addDays(-2),addDays(2),'ACTIVO','WEB'),
      rental(5002,102,1,addDays(-9),addDays(-5),'COMPLETADO','MOSTRADOR'),
      rental(5003,103,2,addDays(-7),addDays(-1),'ACTIVO','WEB'),
      rental(5004,104,6,addDays(2),addDays(6),'ACTIVO','MOSTRADOR'),
      rental(5005,101,4,addDays(-28),addDays(-25),'COMPLETADO','WEB'),
      rental(5006,105,7,addDays(-18),addDays(-14),'CANCELADO','WEB')
    ];

    const facturas = alquileres.filter(a=>a.estado!=='CANCELADO').map((a,i)=>({
      id:7001+i, alquilerId:a.id, tipo:'FACTURA', concepto:'Alquiler de vehículo', monto:a.totalAlquiler,
      subtotal:a.montoBase, impuesto:a.impuestoAlquiler, retencion:a.retencionAlquiler, total:a.totalAlquiler, desgloseModo:'DETALLADO',
      metodoPago:i%3===0?'TARJETA':i%3===1?'EFECTIVO':'TRANSFERENCIA', fechaEmision:a.fechaInicio+'T10:00:00', clienteId:a.clienteId,
      clienteNombre:a.clienteNombre, clienteCedula:a.clienteCedula, clienteTelefono:clientes.find(c=>c.id===a.clienteId)?.telefono || '', clienteCorreo:clientes.find(c=>c.id===a.clienteId)?.correo || '',
      vehiculoId:a.vehiculoId, placa:a.placa, vehiculo:a.vehiculo, categoria:vehiculos.find(v=>v.id===a.vehiculoId)?.categoria || '', fechaInicio:a.fechaInicio,
      fechaFinPactada:a.fechaFinPactada, dias:a.dias, precioDia:a.precioDia, configFinanciera:{...configuracion}
    }));

    const wallets = {
      101: { saldo:1850, porcentajeRetiro:70, movimientos:[
        { id:1,tipo:'CREDITO',monto:2500,concepto:'Crédito por devolución anticipada',fecha:addDays(-20)+'T15:30:00',alquilerId:5005,configFinanciera:{...configuracion} },
        { id:2,tipo:'USO',monto:-650,concepto:'Aplicado a alquiler #5001',fecha:addDays(-2)+'T09:15:00',alquilerId:5001,configFinanciera:{...configuracion} }
      ] },
      103: { saldo:900, porcentajeRetiro:70, movimientos:[{ id:3,tipo:'CREDITO',monto:900,concepto:'Ajuste promocional',fecha:addDays(-12)+'T12:00:00',alquilerId:null,configFinanciera:{...configuracion} }] }
    };

    return {
      version:VERSION,
      nextIds:{ usuario:20,categoria:10,vehiculo:20,cliente:120,alquiler:5100,factura:7100,movimiento:10,historial:2 },
      usuarios,categorias,vehiculos,clientes,alquileres,facturas,wallets,configuracion,
      retirosWallet:[{id:1,clienteNombre:'María Gómez',montoRetirado:1200,monto:840,fecha:addDays(-10)+'T14:20:00'}],
      historialConfiguracion:[{id:1,fecha:addDays(-14)+'T09:00:00',usuario:'Camila Rojas',cambios:'Actualización de parámetros financieros',anteriorJson:'{}',nuevoJson:JSON.stringify(configuracion)}]
    };
  }

  function load() {
    try {
      const db = JSON.parse(localStorage.getItem(KEY));
      if (db && db.version === VERSION) return db;
    } catch (_) {}
    const db = seed(); save(db); return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} }
  function page(nodes, vars={}) {
    const size = Number(vars.first || vars.last || nodes.length || 12);
    let start = 0;
    if (vars.after) start = Number(vars.after) || 0;
    if (vars.before) start = Math.max(0,(Number(vars.before)||0)-size);
    const slice = nodes.slice(start,start+size);
    return { totalCount:nodes.length, pageInfo:{hasNextPage:start+slice.length<nodes.length,hasPreviousPage:start>0,startCursor:String(start),endCursor:String(start+slice.length)}, nodes:clone(slice) };
  }
  function currentUser(db, headers) {
    const h = headers && (headers.Authorization || headers.authorization) || '';
    const t = String(h).replace(/^Bearer\s+/i,'');
    if (t === 'AUTOGO-DEMO-SUPERADMIN') return db.usuarios.find(u=>u.perfil==='Superadministrador');
    if (t === 'AUTOGO-DEMO-CLIENTE') return db.usuarios.find(u=>u.rol==='CLIENTE');
    const m = t.match(/^LOCAL-(\d+)/); return m ? db.usuarios.find(u=>u.id===Number(m[1])) : null;
  }
  function auth(u) { return { token:`LOCAL-${u.id}`, expiraEnUtc:new Date(Date.now()+8*3600000).toISOString(), usuario:{id:u.id,nombre:u.nombre,correo:u.correo,rol:u.rol,perfil:u.perfil||null,debeCambiarPassword:!!u.debeCambiarPassword,clienteId:u.clienteId??null} }; }
  function calcQuote(db,v,ini,fin) {
    const dias=Math.max(1,Math.ceil((new Date(fin+'T12:00:00')-new Date(ini+'T12:00:00'))/86400000));
    const subtotal=money(v.precioDia*dias), impuesto=money(subtotal*db.configuracion.impuestoPct/100), retencion=money(subtotal*db.configuracion.retencionPct/100);
    return {vehiculoId:v.id,fechaInicio:ini,fechaFin:fin,dias,precioDia:v.precioDia,subtotal,impuesto,retencion,total:money(subtotal+impuesto-retencion),configFinanciera:cfgFin(db)};
  }
  function freshRental(db,a) {
    const x={...a}; x.vencido=x.estado==='ACTIVO' && x.fechaFinPactada < isoDate(new Date());
    x.diasRetraso=x.vencido?Math.max(1,Math.ceil((new Date()-new Date(x.fechaFinPactada+'T23:59:59'))/86400000)):0; return x;
  }

  const handlers = {
    login(db,v){ const u=db.usuarios.find(x=>x.activo!==false && x.correo.toLowerCase()===String(v.correo||'').toLowerCase() && x.password===v.password); if(!u) throw ['AUTH_INVALID_CREDENTIALS','Correo o contraseña incorrectos.']; u.ultimoAcceso=nowIso(); save(db); return auth(u); },
    registrarCliente(db,v){ const i=v.input||{}; if(db.usuarios.some(u=>u.correo.toLowerCase()===String(i.correo).toLowerCase())) throw ['CORREO_DUPLICADO','Ese correo ya está registrado.']; const cid=db.nextIds.cliente++, uid=db.nextIds.usuario++; const c={id:cid,nombre:i.nombre,cedula:i.cedula,correo:i.correo,telefono:i.telefono||'',licenciaConducir:i.licenciaConducir||'',activo:true,tieneCuenta:true,fechaCreacion:isoDate(new Date())}; db.clientes.push(c); const u={id:uid,nombre:i.nombre,correo:i.correo,password:i.password,rol:'CLIENTE',perfil:null,activo:true,debeCambiarPassword:false,clienteId:cid,ultimoAcceso:nowIso(),fechaCreacion:isoDate(new Date())}; db.usuarios.push(u); save(db); return auth(u); },
    me(db,v,h){ const u=currentUser(db,h); return u?auth(u).usuario:null; },
    cambiarPassword(db,v,h){ const u=currentUser(db,h); if(!u) throw ['AUTH_NOT_AUTHENTICATED','Sesión no válida.']; u.password=v.passwordNueva; u.debeCambiarPassword=false; save(db); return auth(u); },
    solicitarRecuperacionPassword(){ return true; }, restablecerPassword(){ return true; },

    administradores(db,v){ let a=db.usuarios.filter(u=>u.rol==='ADMINISTRADOR'); if(v.texto){const q=v.texto.toLowerCase();a=a.filter(u=>`${u.nombre} ${u.correo}`.toLowerCase().includes(q));} if(v.perfil)a=a.filter(u=>u.perfil===v.perfil); return clone(a); },
    crearAdministrador(db,v){ const i=v.input||{}; const perfiles=['Superadministrador','Administrador','Operador','Consulta']; if(!perfiles.includes(i.perfil)) throw ['PERFIL_INVALIDO','Perfil administrativo no válido.']; const u={id:db.nextIds.usuario++,nombre:i.nombre,correo:i.correo,password:i.passwordTemporal||'Demo1234',rol:'ADMINISTRADOR',perfil:i.perfil,activo:true,debeCambiarPassword:!!i.debeCambiarPassword,ultimoAcceso:null,fechaCreacion:nowIso()}; db.usuarios.push(u); save(db); return clone(u); },
    actualizarAdministrador(db,v){ const u=db.usuarios.find(x=>x.id==v.id); Object.assign(u,v.input||{}); save(db); return clone(u); },
    restablecerClaveAdministrador(db,v){ const u=db.usuarios.find(x=>x.id==v.id); if(u){u.password=v.passwordTemporal;u.debeCambiarPassword=true;save(db);} return true; },
    eliminarAdministrador(db,v){ const i=db.usuarios.findIndex(x=>x.id==v.id); if(i>=0)db.usuarios.splice(i,1);save(db);return true; },

    categorias(db){ return clone(db.categorias.filter(x=>x.activo!==false)); },
    crearCategoria(db,v){ const c={id:db.nextIds.categoria++,nombre:v.nombre,activo:true};db.categorias.push(c);save(db);return clone(c); },
    actualizarCategoria(db,v){ const c=db.categorias.find(x=>x.id==v.id);if(c)c.nombre=v.nombre;save(db);return clone(c); },
    desactivarCategoria(db,v){ const c=db.categorias.find(x=>x.id==v.id);if(c)c.activo=false;save(db);return true; },
    vehiculosDisponibles(db,v){ let a=db.vehiculos.filter(x=>x.activo!==false&&x.estadoOperativo==='DISPONIBLE');if(v.categoriaId)a=a.filter(x=>x.categoriaId==v.categoriaId);return clone(a); },
    vehiculo(db,v){ return clone(db.vehiculos.find(x=>x.id==v.id)||null); },
    vehiculos(db,v){ let a=db.vehiculos.filter(x=>v.incluirInactivos||x.activo!==false);if(v.texto){const q=v.texto.toLowerCase();a=a.filter(x=>`${x.placa} ${x.marca} ${x.modelo}`.toLowerCase().includes(q));}if(v.categoriaId)a=a.filter(x=>x.categoriaId==v.categoriaId);a.sort((x,y)=>x.placa.localeCompare(y.placa));return page(a,v); },
    cotizarAlquiler(db,v){ const x=db.vehiculos.find(a=>a.id==v.vehiculoId);return calcQuote(db,x,v.fechaInicio,v.fechaFin); },
    crearVehiculo(db,v){ const i=v.input||{},cat=db.categorias.find(c=>c.id==i.categoriaId);const x={id:db.nextIds.vehiculo++,...i,categoria:cat?.nombre||'',activo:true,estadoOperativo:i.estadoOperativo||'DISPONIBLE',estadoActual:i.estadoOperativo||'DISPONIBLE',fotoUrl:i.fotoUrl||carSvg(`${i.marca||''} ${i.modelo||''}`,'#5479ad','#293b62')};db.vehiculos.push(x);save(db);return clone(x); },
    actualizarVehiculo(db,v){ const x=db.vehiculos.find(a=>a.id==v.id);Object.assign(x,v.input||{});const cat=db.categorias.find(c=>c.id==x.categoriaId);if(cat)x.categoria=cat.nombre;save(db);return clone(x); },
    cambiarEstadoVehiculo(db,v){ const i=v.input||{},x=db.vehiculos.find(a=>a.id==(i.id||i.vehiculoId));if(x){x.estadoOperativo=i.estadoOperativo||i.estado;x.estadoActual=x.estadoOperativo;x.mantenimientoHasta=i.mantenimientoHasta||null;}save(db);return clone(x); },
    desactivarVehiculo(db,v){ const x=db.vehiculos.find(a=>a.id==v.id);if(x)x.activo=false;save(db);return true; },
    reactivarVehiculo(db,v){ const x=db.vehiculos.find(a=>a.id==v.id);if(x)x.activo=true;save(db);return clone(x); },
    subirFotoVehiculo(db,v){ const x=db.vehiculos.find(a=>a.id==v.id);return clone(x); },

    clientes(db,v){ let a=db.clientes.filter(x=>v.incluirInactivos||x.activo!==false);if(v.texto){const q=v.texto.toLowerCase();a=a.filter(x=>`${x.nombre} ${x.cedula} ${x.correo}`.toLowerCase().includes(q));}a.sort((x,y)=>x.nombre.localeCompare(y.nombre));return page(a,v); },
    cliente(db,v){ return clone(db.clientes.find(x=>x.id==v.id)||null); },
    miPerfil(db,v,h){ const u=currentUser(db,h);return clone(db.clientes.find(x=>x.id==u?.clienteId)||null); },
    crearCliente(db,v){ const i=v.input||{},c={id:db.nextIds.cliente++,...i,activo:true,tieneCuenta:false,fechaCreacion:isoDate(new Date())};db.clientes.push(c);save(db);return clone(c); },
    actualizarCliente(db,v){ const c=db.clientes.find(x=>x.id==v.id);Object.assign(c,v.input||{});save(db);return clone(c); },
    desactivarCliente(db,v){ const c=db.clientes.find(x=>x.id==v.id);if(c)c.activo=false;save(db);return true; },

    alquileres(db,v){ let a=db.alquileres.map(x=>freshRental(db,x));if(v.clienteId)a=a.filter(x=>x.clienteId==v.clienteId);if(v.vehiculoId)a=a.filter(x=>x.vehiculoId==v.vehiculoId);if(v.estado)a=a.filter(x=>x.estado===v.estado);if(v.soloVencidos)a=a.filter(x=>x.vencido);a.sort((x,y)=>String(y.fechaCreacion).localeCompare(String(x.fechaCreacion)));return page(a,v); },
    alquiler(db,v){ const a=db.alquileres.find(x=>x.id==v.id);return a?freshRental(db,a):null; },
    misAlquileres(db,v,h){ const u=currentUser(db,h);return clone(db.alquileres.filter(x=>x.clienteId==u?.clienteId).map(x=>freshRental(db,x))); },
    crearAlquiler(db,v,h){ const i=v.input||{},u=currentUser(db,h),cid=i.clienteId||u?.clienteId,c=db.clientes.find(x=>x.id==cid),vh=db.vehiculos.find(x=>x.id==i.vehiculoId);const ini=i.fechaInicio,fin=i.fechaFinPactada||i.fechaFin,q=calcQuote(db,vh,ini,fin);const a={id:db.nextIds.alquiler++,clienteId:cid,clienteNombre:c?.nombre||'Cliente',clienteCedula:c?.cedula||'',vehiculoId:vh.id,placa:vh.placa,vehiculo:`${vh.marca} ${vh.modelo}`,canal:u?.rol==='CLIENTE'?'WEB':'MOSTRADOR',fechaInicio:ini,fechaFinPactada:fin,fechaDevolucion:null,precioDia:vh.precioDia,dias:q.dias,montoBase:q.subtotal,impuestoAlquiler:q.impuesto,retencionAlquiler:q.retencion,totalAlquiler:q.total,diasMora:0,subtotalMora:0,recargoMora:0,impuestoMora:0,retencionMora:0,montoMora:0,diasNoUsados:0,subtotalReembolso:0,impuestoReembolso:0,retencionReembolso:0,creditoWallet:0,montoTotal:q.total,totalFacturado:q.total,estado:'ACTIVO',vencido:false,diasRetraso:0,observaciones:i.observaciones||'',fechaCreacion:nowIso(),configFinanciera:cfgFin(db)};db.alquileres.push(a);vh.estadoOperativo='ALQUILADO';vh.estadoActual='ALQUILADO';const f={id:db.nextIds.factura++,alquilerId:a.id,tipo:'FACTURA',concepto:'Alquiler de vehículo',monto:q.total,subtotal:q.subtotal,impuesto:q.impuesto,retencion:q.retencion,total:q.total,desgloseModo:'DETALLADO',metodoPago:i.metodoPago||'EFECTIVO',fechaEmision:nowIso(),clienteId:cid,clienteNombre:a.clienteNombre,clienteCedula:a.clienteCedula,clienteTelefono:c?.telefono||'',clienteCorreo:c?.correo||'',vehiculoId:vh.id,placa:vh.placa,vehiculo:a.vehiculo,categoria:vh.categoria,fechaInicio:ini,fechaFinPactada:fin,dias:q.dias,precioDia:vh.precioDia,configFinanciera:cfgFin(db)};db.facturas.push(f);save(db);return {facturaId:f.id,creditoWallet:0,diasNoUsados:0,alquiler:clone(a)}; },
    modificarAlquiler(db,v){ const i=v.input||{},a=db.alquileres.find(x=>x.id==(i.id||i.alquilerId));if(a)Object.assign(a,i);save(db);return {facturaId:null,creditoWallet:0,diasNoUsados:0,alquiler:clone(a)}; },
    cancelarAlquiler(db,v){ const a=db.alquileres.find(x=>x.id==v.alquilerId);if(a){a.estado='CANCELADO';a.observaciones=v.motivo||a.observaciones;const vh=db.vehiculos.find(x=>x.id==a.vehiculoId);if(vh){vh.estadoOperativo='DISPONIBLE';vh.estadoActual='DISPONIBLE';}}save(db);return {facturaId:null,creditoWallet:0,diasNoUsados:0,alquiler:clone(a)}; },
    cotizarDevolucion(db,v){ const a=db.alquileres.find(x=>x.id==v.alquilerId),fecha=v.fechaDevolucion||isoDate(new Date());const fin=a.fechaFinPactada,diff=Math.round((new Date(fecha+'T12:00:00')-new Date(fin+'T12:00:00'))/86400000);const diasMora=Math.max(0,diff),diasNoUsados=Math.max(0,-diff),subtotalMora=money(diasMora*a.precioDia),recargoMora=money(subtotalMora*db.configuracion.recargoMoraPct/100),impuestoMora=money((subtotalMora+recargoMora)*db.configuracion.impuestoPct/100),retencionMora=money((subtotalMora+recargoMora)*db.configuracion.retencionPct/100),montoMora=money(subtotalMora+recargoMora+impuestoMora-retencionMora),subtotalReembolso=money(diasNoUsados*a.precioDia),impuestoReembolso=money(subtotalReembolso*db.configuracion.impuestoPct/100),retencionReembolso=money(subtotalReembolso*db.configuracion.retencionPct/100),creditoWallet=money(subtotalReembolso-impuestoReembolso-retencionReembolso);return {alquilerId:a.id,fechaDevolucion:fecha,diasMora,subtotalMora,recargoMora,impuestoMora,retencionMora,montoMora,diasNoUsados,subtotalReembolso,impuestoReembolso,retencionReembolso,creditoWallet,montoBase:a.montoBase,subtotalAlquiler:a.montoBase,impuestoAlquiler:a.impuestoAlquiler,retencionAlquiler:a.retencionAlquiler,totalAlquiler:a.totalAlquiler,montoTotal:money(a.totalAlquiler+montoMora),configFinanciera:cfgFin(db)}; },
    registrarDevolucion(db,v){ const i=v.input||{},a=db.alquileres.find(x=>x.id==(i.alquilerId||i.id)),q=handlers.cotizarDevolucion(db,{alquilerId:a.id,fechaDevolucion:i.fechaDevolucion});a.estado='COMPLETADO';a.fechaDevolucion=q.fechaDevolucion;Object.assign(a,{diasMora:q.diasMora,subtotalMora:q.subtotalMora,recargoMora:q.recargoMora,impuestoMora:q.impuestoMora,retencionMora:q.retencionMora,montoMora:q.montoMora,diasNoUsados:q.diasNoUsados,subtotalReembolso:q.subtotalReembolso,impuestoReembolso:q.impuestoReembolso,retencionReembolso:q.retencionReembolso,creditoWallet:q.creditoWallet,montoTotal:q.montoTotal});const vh=db.vehiculos.find(x=>x.id==a.vehiculoId);if(vh){vh.estadoOperativo='MANTENIMIENTO';vh.estadoActual='MANTENIMIENTO';vh.mantenimientoHasta=addDays(db.configuracion.diasMantenimientoPostDevolucion);}if(q.creditoWallet>0){const w=db.wallets[a.clienteId]||(db.wallets[a.clienteId]={saldo:0,porcentajeRetiro:db.configuracion.retiroWalletClientePct,movimientos:[]});w.saldo=money(w.saldo+q.creditoWallet);w.movimientos.unshift({id:db.nextIds.movimiento++,tipo:'CREDITO',monto:q.creditoWallet,concepto:'Crédito por devolución anticipada',fecha:nowIso(),alquilerId:a.id,configFinanciera:cfgFin(db)});}save(db);return {facturaId:null,creditoWallet:q.creditoWallet,diasNoUsados:q.diasNoUsados,alquiler:clone(a)}; },
    subirFotoDevolucion(){ return true; },

    facturas(db,v){ let a=[...db.facturas];if(v.clienteId)a=a.filter(x=>x.clienteId==v.clienteId);if(v.alquilerId)a=a.filter(x=>x.alquilerId==v.alquilerId);if(v.desde)a=a.filter(x=>String(x.fechaEmision).slice(0,10)>=v.desde);if(v.hasta)a=a.filter(x=>String(x.fechaEmision).slice(0,10)<=v.hasta);a.sort((x,y)=>String(y.fechaEmision).localeCompare(String(x.fechaEmision)));return page(a,v); },
    misFacturas(db,v,h){ const u=currentUser(db,h);return clone(db.facturas.filter(x=>x.clienteId==u?.clienteId)); },
    factura(db,v){ return clone(db.facturas.find(x=>x.id==v.id)||null); },
    miWallet(db,v,h){ const u=currentUser(db,h),w=db.wallets[u?.clienteId]||{saldo:0,porcentajeRetiro:db.configuracion.retiroWalletClientePct,movimientos:[]};return clone(w); },
    retirarWallet(db,v,h){ const u=currentUser(db,h),w=db.wallets[u?.clienteId]||{saldo:0,porcentajeRetiro:db.configuracion.retiroWalletClientePct,movimientos:[]},montoRetirado=w.saldo,pct=db.configuracion.retiroWalletClientePct,montoCliente=money(montoRetirado*pct/100),montoEmpresa=money(montoRetirado-montoCliente);w.saldo=0;w.movimientos.unshift({id:db.nextIds.movimiento++,tipo:'RETIRO',monto:-montoRetirado,concepto:'Retiro de Wallet GO',fecha:nowIso(),alquilerId:null,configFinanciera:cfgFin(db)});const c=db.clientes.find(x=>x.id==u?.clienteId);db.retirosWallet.unshift({id:Date.now(),clienteNombre:c?.nombre||u?.nombre,montoRetirado,monto:montoCliente,fecha:nowIso()});save(db);return {montoRetirado,montoCliente,montoEmpresa,saldo:0,porcentajeCliente:pct,configFinanciera:cfgFin(db)}; },
    ingresosWallet(db,v){ let a=db.retirosWallet;if(v.desde)a=a.filter(x=>String(x.fecha).slice(0,10)>=v.desde);if(v.hasta)a=a.filter(x=>String(x.fecha).slice(0,10)<=v.hasta);return clone(a); },
    configuracion(db){ return clone(db.configuracion); },
    actualizarConfiguracion(db,v,h){ const u=currentUser(db,h),anterior=clone(db.configuracion);Object.assign(db.configuracion,v.input||{});db.historialConfiguracion.unshift({id:db.nextIds.historial++,fecha:nowIso(),usuario:u?.nombre||'Usuario local',cambios:'Configuración actualizada',anteriorJson:JSON.stringify(anterior),nuevoJson:JSON.stringify(db.configuracion)});save(db);return clone(db.configuracion); },
    historialConfiguracion(db){ return clone(db.historialConfiguracion); },
    dashboard(db){ const rents=db.alquileres.map(x=>freshRental(db,x)),vs=db.vehiculos.filter(x=>x.activo!==false),mes=isoDate(new Date()).slice(0,7),ingMes=db.facturas.filter(f=>String(f.fechaEmision).slice(0,7)===mes).reduce((s,f)=>s+Number(f.total||0),0),ingTot=db.facturas.reduce((s,f)=>s+Number(f.total||0),0);return {totalClientes:db.clientes.filter(x=>x.activo!==false).length,totalVehiculos:vs.length,vehiculosDisponibles:vs.filter(x=>x.estadoOperativo==='DISPONIBLE').length,vehiculosAlquilados:vs.filter(x=>x.estadoOperativo==='ALQUILADO').length,vehiculosEnMantenimiento:vs.filter(x=>x.estadoOperativo==='MANTENIMIENTO').length,vehiculosFueraDeServicio:vs.filter(x=>x.estadoOperativo==='FUERA_DE_SERVICIO').length,alquileresActivos:rents.filter(x=>x.estado==='ACTIVO').length,alquileresVencidos:rents.filter(x=>x.vencido).length,pendientesDevolucion:rents.filter(x=>x.estado==='ACTIVO'&&x.fechaFinPactada<=isoDate(new Date())).length,ingresosTotales:money(ingTot),ingresosMes:money(ingMes),ingresosWalletMes:money(db.retirosWallet.filter(x=>String(x.fecha).slice(0,7)===mes).reduce((s,x)=>s+Number(x.monto||0),0))}; }
  };

  async function parseRequest(options) {
    if (options && options.body instanceof FormData) {
      const ops = JSON.parse(options.body.get('operations') || '{}'); return {query:ops.query||'',variables:ops.variables||{}};
    }
    try { return JSON.parse(options && options.body || '{}'); } catch (_) { return {}; }
  }
  function rootField(query) { const m=String(query||'').match(/\{\s*([A-Za-z_]\w*)\s*(?:\(|\{)/); return m&&m[1]; }
  function response(payload,status=200){ return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}}); }

  window.fetch = async function (url, options={}) {
    if (!(cfg.LOCAL_DB === true && String(url).replace(/\/+$/,'').endsWith('/graphql'))) return nativeFetch(url,options);
    const req=await parseRequest(options), op=rootField(req.query), db=load();
    try {
      if (!op || !handlers[op]) throw ['LOCAL_NOT_IMPLEMENTED',`Operación local no implementada: ${op||'desconocida'}.`];
      const result=await handlers[op](db,req.variables||{},options.headers||{});
      return response({data:{[op]:result}});
    } catch (e) {
      const arr=Array.isArray(e)?e:['ERROR_INTERNO',e?.message||'Error local inesperado.'];
      return response({errors:[{message:arr[1],extensions:{code:arr[0]}}]});
    }
  };

  window.AutoGoLocalDB = {
    reset(){ const db=seed();save(db);return clone(db); },
    exportar(){ return clone(load()); },
    perfiles:['Superadministrador','Administrador','Operador','Consulta']
  };
})();
