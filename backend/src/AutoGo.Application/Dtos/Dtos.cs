using AutoGo.Domain.Enums;

namespace AutoGo.Application.Dtos;

// ---------- Salidas ----------
public sealed record UsuarioDto(int Id, string Nombre, string Correo, Rol Rol, bool DebeCambiarPassword, int? ClienteId);

public sealed record AuthResultadoDto(string Token, DateTime ExpiraEnUtc, UsuarioDto Usuario);

public sealed record ClienteDto(int Id, string Nombre, string Cedula, string? Correo, string? Telefono,
    string? LicenciaConducir, bool Activo, bool TieneCuenta, DateTime FechaCreacion);

public sealed record CategoriaDto(int Id, string Nombre);

public sealed record VehiculoDto(int Id, string Placa, int CategoriaId, string Categoria, string Marca, string Modelo,
    int Anio, decimal PrecioDia, EstadoOperativo EstadoOperativo, EstadoVehiculo EstadoActual,
    DateOnly? MantenimientoHasta, string? FotoUrl, bool Activo);

public sealed record AlquilerDto(int Id, int ClienteId, string ClienteNombre, string ClienteCedula, int VehiculoId,
    string Placa, string Vehiculo, CanalAlquiler Canal, DateOnly FechaInicio, DateOnly FechaFinPactada,
    DateOnly? FechaDevolucion, decimal PrecioDia, int Dias, decimal MontoBase, int DiasMora, decimal MontoMora,
    decimal MontoTotal, decimal TotalFacturado, EstadoAlquiler Estado, bool Vencido, int DiasRetraso,
    string? Observaciones, DateTime FechaCreacion);

public sealed record FacturaDto(int Id, int AlquilerId, TipoFactura Tipo, string Concepto, decimal Monto,
    MetodoPago? MetodoPago, DateTime FechaEmision, int ClienteId, string ClienteNombre, string ClienteCedula,
    string? ClienteTelefono, string? ClienteCorreo, int VehiculoId, string Placa, string Vehiculo, string Categoria,
    DateOnly FechaInicio, DateOnly FechaFinPactada, int Dias, decimal PrecioDia);

public sealed record CotizacionDto(int VehiculoId, DateOnly FechaInicio, DateOnly FechaFin, int Dias,
    decimal PrecioDia, decimal Total);

public sealed record CotizacionDevolucionDto(int AlquilerId, DateOnly FechaDevolucion, int DiasMora, decimal MontoMora,
    decimal MontoBase, decimal MontoTotal);

/// <summary>Resultado de operaciones sobre alquileres que pueden emitir una factura.</summary>
public sealed record OperacionAlquilerDto(AlquilerDto Alquiler, int? FacturaId);

public sealed record DashboardDto(int TotalClientes, int TotalVehiculos, int VehiculosDisponibles,
    int VehiculosAlquilados, int VehiculosEnMantenimiento, int VehiculosFueraDeServicio, int AlquileresActivos,
    int AlquileresVencidos, int PendientesDevolucion, decimal IngresosTotales, decimal IngresosMes);

// ---------- Entradas ----------
public sealed record RegistroClienteInput(string Nombre, string Correo, string Password, string Cedula,
    string? Telefono, string? LicenciaConducir);

public sealed record CrearAdministradorInput(string Nombre, string Correo, string PasswordTemporal);

public sealed record ClienteInput(string Nombre, string Cedula, string? Correo, string? Telefono, string? LicenciaConducir);

public sealed record VehiculoInput(string Placa, int CategoriaId, string Marca, string Modelo, int Anio, decimal PrecioDia);

public sealed record CambiarEstadoVehiculoInput(int VehiculoId, EstadoOperativo Estado, DateOnly? MantenimientoHasta);

public sealed record CrearAlquilerInput(int? ClienteId, int VehiculoId, DateOnly FechaInicio, DateOnly FechaFin,
    MetodoPago MetodoPago);

public sealed record ModificarAlquilerInput(int AlquilerId, int VehiculoId, DateOnly FechaInicio, DateOnly FechaFin,
    MetodoPago? MetodoPago);

public sealed record DevolucionInput(int AlquilerId, DateOnly? FechaDevolucion, MetodoPago? MetodoPagoMora);
