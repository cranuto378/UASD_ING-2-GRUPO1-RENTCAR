using AutoGo.Domain.Common;

namespace AutoGo.Domain.Entities;

public sealed class Cliente
{
    public int Id { get; private set; }
    public int? UsuarioId { get; private set; }
    public string Nombre { get; private set; } = string.Empty;
    public string Cedula { get; private set; } = string.Empty;
    public string? Correo { get; private set; }
    public string? Telefono { get; private set; }
    public string? LicenciaConducir { get; private set; }
    public bool Activo { get; private set; }
    public DateTime FechaCreacion { get; private set; }

    private Cliente() { }

    public static Cliente Crear(string? nombre, string? cedula, string? correo, string? telefono, string? licencia)
    {
        var c = new Cliente { Activo = true };
        c.AsignarDatos(nombre, cedula, correo, telefono, licencia);
        return c;
    }

    public static Cliente Rehidratar(int id, int? usuarioId, string nombre, string cedula, string? correo,
        string? telefono, string? licencia, bool activo, DateTime fechaCreacion) => new()
    {
        Id = id, UsuarioId = usuarioId, Nombre = nombre, Cedula = cedula, Correo = correo,
        Telefono = telefono, LicenciaConducir = licencia, Activo = activo, FechaCreacion = fechaCreacion
    };

    public void Actualizar(string? nombre, string? cedula, string? correo, string? telefono, string? licencia)
        => AsignarDatos(nombre, cedula, correo, telefono, licencia);

    public bool TieneCuenta => UsuarioId.HasValue;

    public void AsegurarPuedeAlquilar()
    {
        if (!Activo)
            throw new DomainException(CodigosError.ClienteInactivo, "El cliente está inactivo y no puede alquilar.");
    }

    private void AsignarDatos(string? nombre, string? cedula, string? correo, string? telefono, string? licencia)
    {
        Nombre = Guard.Requerido(nombre, "nombre", 100);
        Cedula = NormalizarCedula(cedula);
        Correo = string.IsNullOrWhiteSpace(correo) ? null : Usuario.NormalizarCorreo(correo);
        Telefono = Guard.Opcional(telefono, "telefono", 20);
        LicenciaConducir = Guard.Opcional(licencia, "licenciaConducir", 30);
    }

    /// <summary>Cédula dominicana: 11 dígitos, se guarda como 000-0000000-0.</summary>
    public static string NormalizarCedula(string? cedula)
    {
        var digitos = new string((cedula ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digitos.Length != 11)
            throw new DomainException(CodigosError.DatoInvalido, "La cédula debe tener 11 dígitos.");
        return $"{digitos[..3]}-{digitos[3..10]}-{digitos[10]}";
    }
}
