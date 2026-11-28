using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.Infrastructure.Persistence.Repositories;

public sealed class UsuarioRepository(SpExecutor db) : IUsuarioRepository
{
    public async Task<Usuario?> ObtenerPorCorreoAsync(string correo, CancellationToken ct = default) =>
        (await db.PrimeroAsync<UsuarioRow>("dbo.usp_Usuario_ObtenerPorCorreo", new { Correo = correo }, ct))?.ToEntity();

    public async Task<Usuario?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        (await db.PrimeroAsync<UsuarioRow>("dbo.usp_Usuario_ObtenerPorId", new { Id = id }, ct))?.ToEntity();

    public Task<int> CrearAdministradorAsync(string nombre, string correo, string passwordHash, Rol rol, CancellationToken ct = default) =>
        db.EscalarAsync<int>("dbo.usp_Usuario_CrearAdministrador",
            new { Nombre = nombre, Correo = correo, PasswordHash = passwordHash, Rol = rol.ToString() }, ct);

    public async Task<bool> EstaBloqueadoAsync(int usuarioId, DateTime ahoraUtc, CancellationToken ct = default)
    {
        var r = await db.PrimeroAsync<dynamic>("dbo.usp_Usuario_EstaBloqueado", new { UsuarioId = usuarioId, AhoraUtc = ahoraUtc }, ct);
        return r is not null && Convert.ToBoolean(r.EstaBloqueado);
    }

    public Task ActualizarBloqueoAsync(int usuarioId, int intentosFallidos, DateTime? bloqueadoHastaUtc, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Usuario_ActualizarBloqueo",
            new { UsuarioId = usuarioId, IntentosFallidos = intentosFallidos, BloqueadoHastaUtc = bloqueadoHastaUtc }, ct);

    public Task RegistrarIntentoLoginAsync(int? usuarioId, string? correo, bool exito, string? ipAddress = null,
        string? userAgent = null, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Login_RegistrarIntento",
            new { UsuarioId = usuarioId, Correo = correo, Exito = exito, IpAddress = ipAddress, UserAgent = userAgent }, ct);

    public Task RegistrarAuditoriaAsync(int? usuarioId, string? usuarioNombre, string entidad, int? entidadId,
        string accion, string? detalle = null, string? antesJson = null, string? despuesJson = null,
        string? ipAddress = null, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Auditoria_Registrar",
            new
            {
                UsuarioId = usuarioId,
                UsuarioNombre = usuarioNombre,
                Entidad = entidad,
                EntidadId = entidadId,
                Accion = accion,
                Detalle = detalle,
                AntesJson = antesJson,
                DespuesJson = despuesJson,
                IpAddress = ipAddress
            }, ct);

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

    public Task RegistrarAccesoAsync(int usuarioId, DateTime ahoraUtc, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Usuario_RegistrarAcceso", new { Id = usuarioId, AhoraUtc = ahoraUtc }, ct);

    public async Task<IReadOnlyList<Usuario>> ListarAdministradoresAsync(CancellationToken ct = default) =>
        (await db.ListarAsync<UsuarioRow>("dbo.usp_Usuario_ListarAdministradores", null, ct)).Select(r => r.ToEntity()).ToList();

    public Task ActualizarAdministradorAsync(int id, string nombre, Rol rol, bool activo, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Usuario_ActualizarAdministrador",
            new { Id = id, Nombre = nombre, Rol = rol.ToString(), Activo = activo }, ct);

    public Task EliminarAdministradorAsync(int id, CancellationToken ct = default) =>
        db.EjecutarAsync("dbo.usp_Usuario_EliminarAdministrador", new { Id = id }, ct);
}

