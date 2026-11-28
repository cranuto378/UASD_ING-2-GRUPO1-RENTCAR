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
    /// <summary>Instante UTC del último inicio de sesión exitoso. Null = nunca ha iniciado sesión.</summary>
    public DateTime? UltimoAccesoUtc { get; private set; }
    public DateTime FechaCreacion { get; private set; }
    public int IntentosFallidos { get; private set; }
    public DateTime? BloqueadoHastaUtc { get; private set; }
    public DateTime? FechaUltimoCambioPassword { get; private set; }

    private Usuario() { }

    public static Usuario Rehidratar(int id, string nombre, string correo, string? passwordHash, Rol rol,
        bool debeCambiarPassword, bool activo, int? clienteId, DateTime? ultimoAccesoUtc = null,
        DateTime fechaCreacion = default, int intentosFallidos = 0, DateTime? bloqueadoHastaUtc = null,
        DateTime? fechaUltimoCambioPassword = null) => new()
    {
        Id = id, Nombre = nombre, Correo = correo, PasswordHash = passwordHash, Rol = rol,
        DebeCambiarPassword = debeCambiarPassword, Activo = activo, ClienteId = clienteId,
        UltimoAccesoUtc = ultimoAccesoUtc, FechaCreacion = fechaCreacion,
        IntentosFallidos = intentosFallidos, BloqueadoHastaUtc = bloqueadoHastaUtc,
        FechaUltimoCambioPassword = fechaUltimoCambioPassword
    };

    public bool PuedeIniciarSesion => Activo && !string.IsNullOrEmpty(PasswordHash);
    public bool EstaBloqueado(DateTime ahoraUtc) => BloqueadoHastaUtc is DateTime bloqueado && bloqueado > ahoraUtc;

    public static string NormalizarCorreo(string? correo)
    {
        var c = Guard.Requerido(correo, "correo", 150).ToLowerInvariant();
        var at = c.IndexOf('@');
        if (at <= 0 || at != c.LastIndexOf('@') || !c[(at + 1)..].Contains('.') || c.EndsWith('.'))
            throw new DomainException(CodigosError.DatoInvalido, "El correo no tiene un formato válido.");
        return c;
    }
}
