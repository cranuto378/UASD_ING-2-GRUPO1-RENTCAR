using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class AlquilerRepository(SpExecutor db) : IAlquilerRepository
{
    public async Task<IReadOnlyList<Alquiler>> ListarAsync(FiltroAlquileres f, DateOnly hoy, CancellationToken ct = default) =>
        (await db.ListarAsync<AlquilerRow>("dbo.usp_Alquiler_Listar", new
        {
            Hoy = hoy.ToDb(), f.ClienteId, f.VehiculoId, Estado = f.Estado?.ToString(), f.SoloVencidos
        }, ct)).Select(r => r.ToEntity()).ToList();

    public async Task<Alquiler?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        (await db.PrimeroAsync<AlquilerRow>("dbo.usp_Alquiler_ObtenerPorId", new { Id = id }, ct))?.ToEntity();

    public async Task<(int AlquilerId, int FacturaId)> CrearAsync(Alquiler a, MetodoPago metodoPago,
        string conceptoFactura, DateOnly hoy, CancellationToken ct = default)
    {
        var r = await db.PrimeroAsync<CrearAlquilerRow>("dbo.usp_Alquiler_Crear", new
        {
            a.ClienteId,
            a.VehiculoId,
            a.RegistradoPorUsuarioId,
            Canal = a.Canal.ToString(),
            FechaInicio = a.FechaInicio.ToDb(),
            FechaFinPactada = a.FechaFinPactada.ToDb(),
            a.PrecioDia,
            a.Dias,
            a.MontoBase,
            MetodoPago = metodoPago.ToString(),
            ConceptoFactura = conceptoFactura,
            Hoy = hoy.ToDb()
        }, ct) ?? throw new InvalidOperationException("usp_Alquiler_Crear no devolvió resultado.");
        return (r.AlquilerId, r.FacturaId);
    }

    public Task<int?> ModificarAsync(Alquiler a, decimal montoAjuste, MetodoPago? metodoPago, string? conceptoAjuste,
        DateOnly hoy, CancellationToken ct = default) =>
        db.EscalarAsync<int?>("dbo.usp_Alquiler_Modificar", new
        {
            a.Id,
            a.VehiculoId,
            FechaInicio = a.FechaInicio.ToDb(),
            FechaFinPactada = a.FechaFinPactada.ToDb(),
            a.PrecioDia,
            a.Dias,
            a.MontoBase,
            MontoAjuste = montoAjuste,
            MetodoPago = metodoPago?.ToString(),
            ConceptoAjuste = conceptoAjuste,
            Hoy = hoy.ToDb()
        }, ct);

    public Task<int?> CancelarAsync(Alquiler a, decimal montoReembolso, string? conceptoAjuste, MetodoPago? metodoPago,
        CancellationToken ct = default) =>
        db.EscalarAsync<int?>("dbo.usp_Alquiler_Cancelar", new
        {
            a.Id,
            Motivo = a.Observaciones,
            MontoReembolso = montoReembolso,
            ConceptoAjuste = conceptoAjuste,
            MetodoPago = metodoPago?.ToString()
        }, ct);

    public Task<int?> RegistrarDevolucionAsync(Alquiler a, MetodoPago? metodoPagoMora, string? conceptoMora,
        DateOnly mantenimientoHasta, CancellationToken ct = default) =>
        db.EscalarAsync<int?>("dbo.usp_Alquiler_RegistrarDevolucion", new
        {
            a.Id,
            FechaDevolucion = a.FechaDevolucion!.Value.ToDb(),
            a.DiasMora,
            a.MontoMora,
            MetodoPago = metodoPagoMora?.ToString(),
            ConceptoMora = conceptoMora,
            MantenimientoHasta = mantenimientoHasta.ToDb()
        }, ct);
}
