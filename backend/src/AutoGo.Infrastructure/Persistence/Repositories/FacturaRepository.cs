using AutoGo.Application.Abstractions;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Entities;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class FacturaRepository(SpExecutor db) : IFacturaRepository
{
    public async Task<IReadOnlyList<Factura>> ListarAsync(FiltroFacturas f, CancellationToken ct = default) =>
        (await db.ListarAsync<FacturaRow>("dbo.usp_Factura_Listar", new
        {
            f.ClienteId, f.AlquilerId, Desde = f.DesdeUtc, Hasta = f.HastaUtc
        }, ct)).Select(r => r.ToEntity()).ToList();

    public async Task<Factura?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        (await db.PrimeroAsync<FacturaRow>("dbo.usp_Factura_ObtenerPorId", new { Id = id }, ct))?.ToEntity();
}

public sealed class DashboardRepository(SpExecutor db) : IDashboardRepository
{
    public async Task<ResumenOperativo> ObtenerResumenAsync(DateOnly hoy, DateTime inicioMesUtc, DateTime finMesUtc,
        CancellationToken ct = default)
    {
        var r = await db.PrimeroAsync<ResumenRow>("dbo.usp_Dashboard_Resumen",
            new { Hoy = hoy.ToDb(), InicioMes = inicioMesUtc, FinMes = finMesUtc }, ct) ?? new ResumenRow();
        return new ResumenOperativo(r.TotalClientes, r.AlquileresActivos, r.AlquileresVencidos, r.PendientesDevolucion,
            r.IngresosTotales, r.IngresosMes);
    }
}

public sealed class ParametrosRepository(SpExecutor db) : IParametrosRepository
{
    public async Task<ParametrosGenerales> ObtenerAsync(CancellationToken ct = default)
    {
        var r = await db.PrimeroAsync<ParametrosRow>("dbo.usp_Parametros_Obtener", null, ct) ?? new ParametrosRow();
        return new ParametrosGenerales(r.ComisionWalletGo, r.NombreComercial, r.Rnc, r.Telefono, r.Correo, r.Direccion,
            r.DiasMantenimientoPostDevolucion, r.PermitirRetirosWallet, r.DiasAvisoVencimiento, r.ImpuestoPct,
            r.RetencionPct, r.RecargoMoraPct, r.RetiroWalletClientePct);
    }

    public Task ActualizarComisionWalletGoAsync(decimal comisionWalletGo, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Parametros_ActualizarComisionWalletGo", new { ComisionWalletGo = comisionWalletGo }, ct);

    public Task ActualizarConfiguracionAsync(ConfiguracionInput input, int usuarioId, string usuario, string cambios,
        string anteriorJson, string nuevoJson, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Configuracion_Actualizar", new
        {
            input.NombreComercial, input.Rnc, input.Telefono, input.Correo, input.Direccion,
            input.DiasMantenimientoPostDevolucion, input.PermitirRetirosWallet, input.DiasAvisoVencimiento,
            input.ImpuestoPct, input.RetencionPct, input.RecargoMoraPct, input.RetiroWalletClientePct,
            UsuarioId = usuarioId, Usuario = usuario, Cambios = cambios, AnteriorJson = anteriorJson, NuevoJson = nuevoJson
        }, ct);

    public async Task<IReadOnlyList<HistorialConfiguracion>> ObtenerHistorialAsync(CancellationToken ct = default) =>
        (await db.ListarAsync<HistorialConfiguracionRow>("dbo.usp_Configuracion_Historial", null, ct))
        .Select(r => new HistorialConfiguracion(r.Id, r.Fecha, r.Usuario, r.Cambios, r.AnteriorJson, r.NuevoJson))
        .ToList();
}

public sealed class WalletRepository(SpExecutor db) : IWalletRepository
{
    public async Task<decimal> ObtenerSaldoAsync(int clienteId, CancellationToken ct = default) =>
        await db.EscalarAsync<decimal>("dbo.usp_Wallet_Saldo", new { ClienteId = clienteId }, ct);

    public async Task<IReadOnlyList<WalletMovimiento>> ListarMovimientosAsync(int clienteId, CancellationToken ct = default) =>
        (await db.ListarAsync<WalletMovimientoRow>("dbo.usp_Wallet_Movimientos", new { ClienteId = clienteId }, ct))
            .Select(r => new WalletMovimiento(r.Id, r.Tipo, r.Monto, r.Concepto, r.Fecha.Utc(), r.AlquilerId)).ToList();

    public Task AcreditarAsync(int clienteId, decimal monto, string concepto, int? alquilerId, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Wallet_Acreditar",
            new { ClienteId = clienteId, Monto = monto, Concepto = concepto, AlquilerId = alquilerId }, ct);

    public Task RetirarAsync(int clienteId, decimal monto, string concepto, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Wallet_Retirar", new { ClienteId = clienteId, Monto = monto, Concepto = concepto }, ct);

    public async Task<IReadOnlyList<WalletRetiro>> ListarRetirosAsync(DateOnly? desde, DateOnly? hasta, CancellationToken ct = default) =>
        (await db.ListarAsync<WalletRetiroRow>("dbo.usp_Wallet_IngresosRetiros",
            new { Desde = desde?.ToDb(), Hasta = hasta?.ToDb() }, ct))
            .Select(r => new WalletRetiro(r.Id, r.ClienteNombre, r.Monto, r.Fecha.Utc())).ToList();
}
