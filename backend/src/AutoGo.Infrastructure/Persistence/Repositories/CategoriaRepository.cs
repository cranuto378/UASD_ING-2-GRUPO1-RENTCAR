using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class CategoriaRepository(SpExecutor db) : ICategoriaRepository
{
    public async Task<IReadOnlyList<Categoria>> ListarAsync(CancellationToken ct = default) =>
        (await db.ListarAsync<CategoriaRow>("dbo.usp_Categoria_Listar", null, ct)).Select(r => r.ToEntity()).ToList();

    public async Task<Categoria?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        (await db.PrimeroAsync<CategoriaRow>("dbo.usp_Categoria_ObtenerPorId", new { Id = id }, ct))?.ToEntity();

    public Task<int> CrearAsync(Categoria categoria, CancellationToken ct = default) =>
        db.EscalarAsync<int>("dbo.usp_Categoria_Crear", new { categoria.Nombre }, ct);
}
