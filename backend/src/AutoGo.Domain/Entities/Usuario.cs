using AutoGo.Domain.Common;
using AutoGo.Domain.Enums;

namespace AutoGo.Domain.Entities;

/// <summary>Cuenta de acceso (administrador o cliente del portal).</summary>
public sealed class Usuario
{
    public int Id { get; private set; }
    public string Nombre { get; private set; } = string.Empty;
    public string Correo { get; private set; } = string.Empty;
    public string? PasswordHash { get; private set; }
    public Rol Rol { get; private set; }
    public bool DebeCambiarPassword { get; private set; }
    public bool Activo { get; private set; }
    /// <summary>Cliente vinculado (sólo para rol Cliente).</summary>
    public int? ClienteId { get; private set; }

    private Usuario() { }

    public static Usuario Rehidratar(int id, string nombre, string correo, string? passwordHash, Rol rol,
        bool debeCambiarPassword, bool activo, int? clienteId) => new()
    {
        Id = id, Nombre = nombre, Correo = correo, PasswordHash = passwordHash, Rol = rol,
        DebeCambiarPassword = debeCambiarPassword, Activo = activo, ClienteId = clienteId
    };

    public bool PuedeIniciarSesion => Activo && !string.IsNullOrEmpty(PasswordHash);

    public static string NormalizarCorreo(string? correo)
    {
        var c = Guard.Requerido(correo, "correo", 150).ToLowerInvariant();
        var at = c.IndexOf('@');
        if (at <= 0 || at != c.LastIndexOf('@') || !c[(at + 1)..].Contains('.') || c.EndsWith('.'))
            throw new DomainException(CodigosError.DatoInvalido, "El correo no tiene un formato válido.");
        return c;
    }
}
