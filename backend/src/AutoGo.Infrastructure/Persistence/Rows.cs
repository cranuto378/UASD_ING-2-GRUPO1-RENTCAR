namespace AutoGo.Infrastructure.Persistence;

// Filas tal como las devuelven los stored procedures (nombres de columna = nombres de propiedad).
// Se mantienen separadas del dominio para que un cambio de esquema no toque las entidades.

internal sealed class UsuarioRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Correo { get; set; } = "";
    public string? PasswordHash { get; set; }
    public string Rol { get; set; } = "";
    public bool DebeCambiarPassword { get; set; }
    public bool Activo { get; set; }
    public int? ClienteId { get; set; }
}

internal sealed class TokenRow
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public DateTime ExpiraEn { get; set; }
}

internal sealed class RegistroClienteRow
{
    public int UsuarioId { get; set; }
    public int ClienteId { get; set; }
}

internal sealed class ClienteRow
{
    public int Id { get; set; }
    public int? UsuarioId { get; set; }
    public string Nombre { get; set; } = "";
    public string Cedula { get; set; } = "";
    public string? Correo { get; set; }
    public string? Telefono { get; set; }
    public string? LicenciaConducir { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
}

internal sealed class CategoriaRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public bool Activo { get; set; }
}

internal sealed class VehiculoRow
{
    public int Id { get; set; }
    public string Placa { get; set; } = "";
    public int CategoriaId { get; set; }
    public string CategoriaNombre { get; set; } = "";
    public string Marca { get; set; } = "";
    public string Modelo { get; set; } = "";
    public short Anio { get; set; }
    public decimal PrecioDia { get; set; }
    public string EstadoOperativo { get; set; } = "";
    public DateTime? MantenimientoHasta { get; set; }
    public string? FotoUrl { get; set; }
    public bool Activo { get; set; }
    public int? AlquilerActivoId { get; set; }
}

internal sealed class AlquilerRow
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public string ClienteNombre { get; set; } = "";
    public string ClienteCedula { get; set; } = "";
    public int VehiculoId { get; set; }
    public string Placa { get; set; } = "";
    public string Marca { get; set; } = "";
    public string Modelo { get; set; } = "";
    public int? RegistradoPorUsuarioId { get; set; }
    public string Canal { get; set; } = "";
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFinPactada { get; set; }
    public DateTime? FechaDevolucion { get; set; }
    public decimal PrecioDia { get; set; }
    public int Dias { get; set; }
    public decimal MontoBase { get; set; }
    public int DiasMora { get; set; }
    public decimal MontoMora { get; set; }
    public decimal MontoTotal { get; set; }
    public string Estado { get; set; } = "";
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; }
    public decimal TotalFacturado { get; set; }
}

internal sealed class CrearAlquilerRow
{
    public int AlquilerId { get; set; }
    public int FacturaId { get; set; }
}

internal sealed class FacturaRow
{
    public int Id { get; set; }
    public int AlquilerId { get; set; }
    public string Tipo { get; set; } = "";
    public string Concepto { get; set; } = "";
    public decimal Monto { get; set; }
    public string? MetodoPago { get; set; }
    public DateTime FechaEmision { get; set; }
    public int ClienteId { get; set; }
    public string ClienteNombre { get; set; } = "";
    public string ClienteCedula { get; set; } = "";
    public string? ClienteTelefono { get; set; }
    public string? ClienteCorreo { get; set; }
    public int VehiculoId { get; set; }
    public string Placa { get; set; } = "";
    public string Marca { get; set; } = "";
    public string Modelo { get; set; } = "";
    public string CategoriaNombre { get; set; } = "";
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFinPactada { get; set; }
    public int Dias { get; set; }
    public decimal PrecioDia { get; set; }
}

internal sealed class ResumenRow
{
    public int TotalClientes { get; set; }
    public int AlquileresActivos { get; set; }
    public int AlquileresVencidos { get; set; }
    public int PendientesDevolucion { get; set; }
    public decimal IngresosTotales { get; set; }
    public decimal IngresosMes { get; set; }
}
