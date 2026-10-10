using System.Security.Cryptography;
using System.Text;
using AutoGo.Application.Abstractions;
using AutoGo.Application.Common;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.Application.Services;

public interface IAuthService
{
    Task<AuthResultadoDto> LoginAsync(string correo, string password, CancellationToken ct = default);
    Task<AuthResultadoDto> RegistrarClienteAsync(RegistroClienteInput input, CancellationToken ct = default);
    Task<UsuarioDto> ObtenerUsuarioActualAsync(CancellationToken ct = default);
    /// <summary>Cambia la contraseña y emite un token nuevo (el anterior podía tener 'debe cambiar contraseña').</summary>
    Task<AuthResultadoDto> CambiarPasswordAsync(string passwordActual, string passwordNueva, CancellationToken ct = default);
    Task SolicitarRecuperacionAsync(string correo, CancellationToken ct = default);
    Task RestablecerPasswordAsync(string token, string passwordNueva, CancellationToken ct = default);
    Task<UsuarioDto> CrearAdministradorAsync(CrearAdministradorInput input, CancellationToken ct = default);
}

public sealed class AuthService(
    IUsuarioRepository usuarios,
    IClienteRepository clientes,
    IPasswordHasher hasher,
    ITokenService tokens,
    IEmailSender email,
    IClock clock,
    ICurrentUser actual,
    OpcionesAplicacion opciones) : IAuthService
{
    public async Task<AuthResultadoDto> LoginAsync(string correo, string password, CancellationToken ct = default)
    {
        var usuario = await usuarios.ObtenerPorCorreoAsync((correo ?? string.Empty).Trim().ToLowerInvariant(), ct);
        if (usuario is null || !usuario.PuedeIniciarSesion || !hasher.Verificar(password ?? string.Empty, usuario.PasswordHash!))
            throw new AuthenticationException();

        return Emitir(usuario);
    }

    public async Task<AuthResultadoDto> RegistrarClienteAsync(RegistroClienteInput input, CancellationToken ct = default)
    {
        var correo = Usuario.NormalizarCorreo(input.Correo);
        PoliticaPassword.Validar(input.Password);
        var cliente = Cliente.Crear(input.Nombre, input.Cedula, correo, input.Telefono, input.LicenciaConducir);

        if (await usuarios.ObtenerPorCorreoAsync(correo, ct) is not null)
            throw new ConflictException("CORREO_DUPLICADO", "Ya existe una cuenta con ese correo.");

        // Si el cliente ya fue registrado en mostrador, se vincula la cuenta en vez de duplicarlo.
        var existente = await clientes.ObtenerPorCedulaAsync(cliente.Cedula, ct);
        if (existente is not null && existente.TieneCuenta)
            throw new ConflictException("CEDULA_DUPLICADA", "Ya existe una cuenta asociada a esa cédula.");

        var (usuarioId, _) = await usuarios.RegistrarClienteAsync(existente?.Id, cliente, correo, hasher.Hash(input.Password), ct);
        var usuario = await usuarios.ObtenerPorIdAsync(usuarioId, ct) ?? throw new NotFoundException("Usuario", usuarioId);
        return Emitir(usuario);
    }

    public async Task<UsuarioDto> ObtenerUsuarioActualAsync(CancellationToken ct = default)
    {
        var usuario = await ObtenerActualAsync(ct);
        return usuario.ToDto();
    }

    public async Task<AuthResultadoDto> CambiarPasswordAsync(string passwordActual, string passwordNueva, CancellationToken ct = default)
    {
        var usuario = await ObtenerActualAsync(ct);
        if (usuario.PasswordHash is null || !hasher.Verificar(passwordActual ?? string.Empty, usuario.PasswordHash))
            throw new AuthenticationException("La contraseña actual no es correcta.");
        PoliticaPassword.Validar(passwordNueva);
        if (passwordNueva == passwordActual)
            throw new ConflictException("PASSWORD_REPETIDA", "La nueva contraseña debe ser distinta de la actual.");

        await usuarios.ActualizarPasswordAsync(usuario.Id, hasher.Hash(passwordNueva), debeCambiar: false, ct);
        return Emitir(await ObtenerActualAsync(ct));
    }

    /// <summary>Siempre responde OK (no revela si el correo existe).</summary>
    public async Task SolicitarRecuperacionAsync(string correo, CancellationToken ct = default)
    {
        var usuario = await usuarios.ObtenerPorCorreoAsync((correo ?? string.Empty).Trim().ToLowerInvariant(), ct);
        if (usuario is null || !usuario.Activo) return;

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var expira = clock.AhoraUtc.AddMinutes(opciones.MinutosValidezTokenRecuperacion);
        await usuarios.CrearTokenRecuperacionAsync(usuario.Id, HashToken(token), expira, ct);

        var enlace = $"{opciones.UrlRestablecerPassword}?token={Uri.EscapeDataString(token)}";
        var cuerpo = $"""
            <p>Hola {System.Net.WebUtility.HtmlEncode(usuario.Nombre)},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña en {opciones.NombreEmpresa}.</p>
            <p><a href="{enlace}">Restablecer contraseña</a> (válido por {opciones.MinutosValidezTokenRecuperacion} minutos).</p>
            <p>Si no fuiste tú, ignora este correo.</p>
            """;
        await email.EnviarAsync(usuario.Correo, $"Restablecer contraseña - {opciones.NombreEmpresa}", cuerpo, ct);
    }

    public async Task RestablecerPasswordAsync(string token, string passwordNueva, CancellationToken ct = default)
    {
        PoliticaPassword.Validar(passwordNueva);
        var vigente = await usuarios.ObtenerTokenVigenteAsync(HashToken(token ?? string.Empty), clock.AhoraUtc, ct)
                      ?? throw new AppException("TOKEN_INVALIDO", "El enlace de recuperación no es válido o ya expiró.");
        await usuarios.ConsumirTokenAsync(vigente.Id, hasher.Hash(passwordNueva), clock.AhoraUtc, ct);
    }

    public async Task<UsuarioDto> CrearAdministradorAsync(CrearAdministradorInput input, CancellationToken ct = default)
    {
        var correo = Usuario.NormalizarCorreo(input.Correo);
        PoliticaPassword.Validar(input.PasswordTemporal);
        var nombre = string.IsNullOrWhiteSpace(input.Nombre)
            ? throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "El nombre es obligatorio.")
            : input.Nombre.Trim();

        if (await usuarios.ObtenerPorCorreoAsync(correo, ct) is not null)
            throw new ConflictException("CORREO_DUPLICADO", "Ya existe una cuenta con ese correo.");

        var id = await usuarios.CrearAdministradorAsync(nombre, correo, hasher.Hash(input.PasswordTemporal), ct);
        return (await usuarios.ObtenerPorIdAsync(id, ct) ?? throw new NotFoundException("Usuario", id)).ToDto();
    }

    private async Task<Usuario> ObtenerActualAsync(CancellationToken ct)
    {
        if (actual.UsuarioId is not int id) throw new ForbiddenException("Debe iniciar sesión.");
        var usuario = await usuarios.ObtenerPorIdAsync(id, ct);
        if (usuario is null || !usuario.Activo) throw new ForbiddenException("La cuenta no está activa.");
        return usuario;
    }

    private AuthResultadoDto Emitir(Usuario usuario)
    {
        var token = tokens.Emitir(usuario);
        return new AuthResultadoDto(token.Token, token.ExpiraEnUtc, usuario.ToDto());
    }

    internal static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
}
