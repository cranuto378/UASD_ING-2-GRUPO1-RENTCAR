using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class ClienteRepository(SpExecutor db) : IClienteRepository
{
    public async Task<IReadOnlyList<Cliente>> ListarAsync(string? texto, bool incluirInactivos, CancellationToken ct = default) =>
        (await db.ListarAsync<ClienteRow>("dbo.usp_Cliente_Listar",
            new { Texto = texto, IncluirInactivos = incluirInactivos }, ct)).Select(r => r.ToEntity()).ToList();

    public async Task<Cliente?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        (await db.PrimeroAsync<ClienteRow>("dbo.usp_Cliente_ObtenerPorId", new { Id = id }, ct))?.ToEntity();

    public async Task<Cliente?> ObtenerPorCedulaAsync(string cedula, CancellationToken ct = default) =>
        (await db.PrimeroAsync<ClienteRow>("dbo.usp_Cliente_ObtenerPorCedula", new { Cedula = cedula }, ct))?.ToEntity();

    public Task<int> CrearAsync(Cliente c, CancellationToken ct = default) =>
        db.EscalarAsync<int>("dbo.usp_Cliente_Crear",
            new { c.Nombre, c.Cedula, c.Correo, c.Telefono, c.LicenciaConducir }, ct);

    public Task ActualizarAsync(Cliente c, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Cliente_Actualizar",
            new { c.Id, c.Nombre, c.Cedula, c.Correo, c.Telefono, c.LicenciaConducir }, ct);

    public Task DesactivarAsync(int id, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Cliente_Desactivar", new { Id = id }, ct);

    public Task<int> ContarAlquileresActivosAsync(int id, CancellationToken ct = default) =>
        db.EscalarAsync<int>("dbo.usp_Cliente_ContarAlquileresActivos", new { Id = id }, ct);
}
