using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class VehiculoRepository(SpExecutor db) : IVehiculoRepository
{
    public async Task<IReadOnlyList<Vehiculo>> ListarAsync(DateOnly hoy, string? texto, int? categoriaId,
        bool incluirInactivos, CancellationToken ct = default) =>
        (await db.ListarAsync<VehiculoRow>("dbo.usp_Vehiculo_Listar",
            new { Hoy = hoy.ToDb(), Texto = texto, CategoriaId = categoriaId, IncluirInactivos = incluirInactivos }, ct))
        .Select(r => r.ToEntity()).ToList();

    public async Task<Vehiculo?> ObtenerPorIdAsync(int id, DateOnly hoy, CancellationToken ct = default) =>
        (await db.PrimeroAsync<VehiculoRow>("dbo.usp_Vehiculo_ObtenerPorId", new { Id = id, Hoy = hoy.ToDb() }, ct))?.ToEntity();

    public Task<bool> ExistePlacaAsync(string placa, int? excluirId, CancellationToken ct = default) =>
        db.EscalarAsync<bool>("dbo.usp_Vehiculo_ExistePlaca", new { Placa = placa, ExcluirId = excluirId }, ct);

    public async Task<IReadOnlyList<Vehiculo>> ListarSinConflictoAsync(DateOnly inicio, DateOnly fin, DateOnly hoy,
        int? categoriaId, CancellationToken ct = default) =>
        (await db.ListarAsync<VehiculoRow>("dbo.usp_Vehiculo_ListarSinConflicto",
            new { FechaInicio = inicio.ToDb(), FechaFin = fin.ToDb(), Hoy = hoy.ToDb(), CategoriaId = categoriaId }, ct))
        .Select(r => r.ToEntity()).ToList();

    public Task<int> CrearAsync(Vehiculo v, CancellationToken ct = default) =>
        db.EscalarAsync<int>("dbo.usp_Vehiculo_Crear", new
        {
            v.Placa, v.CategoriaId, v.Marca, v.Modelo, Anio = (short)v.Anio, v.PrecioDia, v.FotoUrl
        }, ct);

    public Task ActualizarAsync(Vehiculo v, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Vehiculo_Actualizar", new
        {
            v.Id, v.Placa, v.CategoriaId, v.Marca, v.Modelo, Anio = (short)v.Anio, v.PrecioDia
        }, ct);

    public Task CambiarEstadoAsync(Vehiculo v, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Vehiculo_CambiarEstado", new
        {
            v.Id, EstadoOperativo = v.EstadoOperativo.ToString(), MantenimientoHasta = v.MantenimientoHasta.ToDb()
        }, ct);

    public Task ActualizarFotoAsync(int id, string fotoUrl, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Vehiculo_ActualizarFoto", new { Id = id, FotoUrl = fotoUrl }, ct);

    public Task DesactivarAsync(int id, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Vehiculo_Desactivar", new { Id = id }, ct);
}
