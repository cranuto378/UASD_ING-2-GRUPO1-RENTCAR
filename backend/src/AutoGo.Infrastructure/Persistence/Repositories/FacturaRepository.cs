using AutoGo.Application.Abstractions;
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
