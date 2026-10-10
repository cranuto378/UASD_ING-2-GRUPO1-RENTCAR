using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class UsuarioRepository(SpExecutor db) : IUsuarioRepository
{
    public async Task<Usuario?> ObtenerPorCorreoAsync(string correo, CancellationToken ct = default) =>
        (await db.PrimeroAsync<UsuarioRow>("dbo.usp_Usuario_ObtenerPorCorreo", new { Correo = correo }, ct))?.ToEntity();

    public async Task<Usuario?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        (await db.PrimeroAsync<UsuarioRow>("dbo.usp_Usuario_ObtenerPorId", new { Id = id }, ct))?.ToEntity();

    public Task<int> CrearAdministradorAsync(string nombre, string correo, string passwordHash, CancellationToken ct = default) =>
        db.EscalarAsync<int>("dbo.usp_Usuario_CrearAdministrador",
            new { Nombre = nombre, Correo = correo, PasswordHash = passwordHash }, ct);

    public async Task<(int UsuarioId, int ClienteId)> RegistrarClienteAsync(int? clienteExistenteId, Cliente cliente,
        string correo, string passwordHash, CancellationToken ct = default)
    {
        var r = await db.PrimeroAsync<RegistroClienteRow>("dbo.usp_Usuario_RegistrarCliente", new
        {
            ClienteIdExistente = clienteExistenteId,
            cliente.Nombre,
            Correo = correo,
            PasswordHash = passwordHash,
            cliente.Cedula,
            cliente.Telefono,
            cliente.LicenciaConducir
        }, ct) ?? throw new InvalidOperationException("usp_Usuario_RegistrarCliente no devolvió resultado.");
        return (r.UsuarioId, r.ClienteId);
    }

    public Task ActualizarPasswordAsync(int usuarioId, string passwordHash, bool debeCambiar, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Usuario_ActualizarPassword",
            new { Id = usuarioId, PasswordHash = passwordHash, DebeCambiarPassword = debeCambiar }, ct);

    public Task CrearTokenRecuperacionAsync(int usuarioId, string tokenHash, DateTime expiraEnUtc, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_TokenRecuperacion_Crear",
            new { UsuarioId = usuarioId, TokenHash = tokenHash, ExpiraEn = expiraEnUtc }, ct);

    public async Task<TokenRecuperacion?> ObtenerTokenVigenteAsync(string tokenHash, DateTime ahoraUtc, CancellationToken ct = default)
    {
        var r = await db.PrimeroAsync<TokenRow>("dbo.usp_TokenRecuperacion_ObtenerVigente",
            new { TokenHash = tokenHash, AhoraUtc = ahoraUtc }, ct);
        return r is null ? null : new TokenRecuperacion(r.Id, r.UsuarioId, r.ExpiraEn.Utc());
    }

    public Task ConsumirTokenAsync(int tokenId, string passwordHash, DateTime ahoraUtc, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_TokenRecuperacion_Consumir",
            new { TokenId = tokenId, PasswordHash = passwordHash, AhoraUtc = ahoraUtc }, ct);
}
