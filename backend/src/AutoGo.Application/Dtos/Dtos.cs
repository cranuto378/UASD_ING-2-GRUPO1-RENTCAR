using AutoGo.Domain.Enums;

namespace AutoGo.Application.Dtos;

// ---------- Salidas ----------
public sealed record UsuarioDto(int Id, string Nombre, string Correo, Rol Rol, bool DebeCambiarPassword, int? ClienteId,
    DateTime? UltimoAccesoUtc = null, bool Activo = true, DateTime FechaCreacion = default)
{
    /// <summary>Perfil legible para el frontend (separado de Rol por compatibilidad con su esquema de permisos).</summary>
    public string? Perfil => Rol switch
    {
        Rol.Administrador => "Superadministrador",
        Rol.Operador => "Operador",
        _ => null
    };

    /// <summary>Alias de UltimoAccesoUtc con el nombre que espera el frontend.</summary>
    public DateTime? UltimoAcceso => UltimoAccesoUtc;
}

public sealed record AuthResultadoDto(string Token, DateTime ExpiraEnUtc, UsuarioDto Usuario);

public sealed record ClienteDto(int Id, string Nombre, string Cedula, string? Correo, string? Telefono,
    string? LicenciaConducir, bool Activo, bool TieneCuenta, DateTime FechaCreacion);

public sealed record CategoriaDto(int Id, string Nombre);

public sealed record VehiculoDto(int Id, string Placa, int CategoriaId, string Categoria, string Marca, string Modelo,
    int Anio, decimal PrecioDia, EstadoOperativo EstadoOperativo, EstadoVehiculo EstadoActual,
    DateOnly? MantenimientoHasta, string? FotoUrl, bool Activo);

/// <summary>
/// Porcentajes de impuesto/retención/mora/Wallet GO. Fase 2: constantes que reflejan
/// el comportamiento ya vigente (FactorMora 1.30 = 30% de recargo). Fase 4 las hace
/// configurables de verdad vía Configuración institucional (IConfigFinancieraProvider).
/// </summary>
public sealed record ConfigFinancieraDto(decimal ImpuestoPct, decimal RetencionPct, decimal RecargoMoraPct,
    decimal RetiroWalletClientePct);

public interface IConfigFinancieraProvider
{
    ConfigFinancieraDto Actual { get; }
}

public sealed class ConfigFinancieraProviderTemporal : IConfigFinancieraProvider
{
    public ConfigFinancieraDto Actual => new(0m, 0m, 30m, 30m);
}

public sealed record AlquilerDto(int Id, int ClienteId, string ClienteNombre, string ClienteCedula, int VehiculoId,
    string Placa, string Vehiculo, CanalAlquiler Canal, DateOnly FechaInicio, DateOnly FechaFinPactada,
    DateOnly? FechaDevolucion, decimal PrecioDia, int Dias, decimal MontoBase, int DiasMora, decimal MontoMora,
    decimal MontoTotal, decimal TotalFacturado, EstadoAlquiler Estado, bool Vencido, int DiasRetraso,
    string? Observaciones, DateTime FechaCreacion, ConfigFinancieraDto ConfigFinanciera)
{
    public decimal ImpuestoAlquiler => decimal.Round(MontoBase * ConfigFinanciera.ImpuestoPct / 100, 2);
    public decimal RetencionAlquiler => decimal.Round(MontoBase * ConfigFinanciera.RetencionPct / 100, 2);
    public decimal TotalAlquiler => MontoBase + ImpuestoAlquiler;

    public decimal SubtotalMora => decimal.Round(DiasMora * PrecioDia, 2);
    public decimal RecargoMora => decimal.Round(SubtotalMora * ConfigFinanciera.RecargoMoraPct / 100, 2);
    public decimal ImpuestoMora => decimal.Round((SubtotalMora + RecargoMora) * ConfigFinanciera.ImpuestoPct / 100, 2);
    public decimal RetencionMora => decimal.Round((SubtotalMora + RecargoMora) * ConfigFinanciera.RetencionPct / 100, 2);

    /// <summary>Reembolso por cancelación: aún no se rastrea por separado del monto de la nota de crédito.</summary>
    public int DiasNoUsados => 0;
    public decimal SubtotalReembolso => 0m;
    public decimal ImpuestoReembolso => 0m;
    public decimal RetencionReembolso => 0m;
    /// <summary>Crédito a Wallet GO del cliente. 0 hasta que el motor de Wallet GO (fase 3) esté implementado.</summary>
    public decimal CreditoWallet => 0m;
}

public sealed record FacturaDto(int Id, int AlquilerId, TipoFactura Tipo, string Concepto, decimal Monto,
    MetodoPago? MetodoPago, DateTime FechaEmision, int ClienteId, string ClienteNombre, string ClienteCedula,
    string? ClienteTelefono, string? ClienteCorreo, int VehiculoId, string Placa, string Vehiculo, string Categoria,
    DateOnly FechaInicio, DateOnly FechaFinPactada, int Dias, decimal PrecioDia, ConfigFinancieraDto ConfigFinanciera)
{
    public decimal Subtotal => decimal.Round(Monto / (1 + ConfigFinanciera.ImpuestoPct / 100), 2);
    public decimal Impuesto => Monto - Subtotal;
    public decimal Retencion => decimal.Round(Subtotal * ConfigFinanciera.RetencionPct / 100, 2);
    public decimal Total => Monto;
    /// <summary>Cómo se desglosa el monto (impuesto incluido vs. añadido). Fase 4 lo hará configurable.</summary>
    public string DesgloseModo => "INCLUIDO";
}

public sealed record CotizacionDto(int VehiculoId, DateOnly FechaInicio, DateOnly FechaFin, int Dias,
    decimal PrecioDia, decimal Total);

public sealed record CotizacionDevolucionDto(int AlquilerId, DateOnly FechaDevolucion, int DiasMora, decimal MontoMora,
    decimal MontoBase, decimal MontoTotal);

/// <summary>Resultado de operaciones sobre alquileres que pueden emitir una factura.</summary>
public sealed record OperacionAlquilerDto(AlquilerDto Alquiler, int? FacturaId);

public sealed record DashboardDto(int TotalClientes, int TotalVehiculos, int VehiculosDisponibles,
    int VehiculosAlquilados, int VehiculosEnMantenimiento, int VehiculosFueraDeServicio, int AlquileresActivos,
    int AlquileresVencidos, int PendientesDevolucion, decimal IngresosTotales, decimal IngresosMes)
{
    /// <summary>Ingresos de la comisión Wallet GO del mes. 0 hasta que el motor de Wallet GO esté implementado.</summary>
    public decimal IngresosWalletMes => 0m;
}

// ---------- Entradas ----------
public sealed record RegistroClienteInput(string Nombre, string Correo, string Password, string Cedula,
    string? Telefono, string? LicenciaConducir);

public sealed record CrearAdministradorInput(string Nombre, string Correo, string PasswordTemporal, Rol Rol = Rol.Operador);

public sealed record ClienteInput(string Nombre, string Cedula, string? Correo, string? Telefono, string? LicenciaConducir);

public sealed record VehiculoInput(string Placa, int CategoriaId, string Marca, string Modelo, int Anio, decimal PrecioDia);

public sealed record CambiarEstadoVehiculoInput(int VehiculoId, EstadoOperativo Estado, DateOnly? MantenimientoHasta);

public sealed record CrearAlquilerInput(int? ClienteId, int VehiculoId, DateOnly FechaInicio, DateOnly FechaFin,
    MetodoPago MetodoPago);

public sealed record ModificarAlquilerInput(int AlquilerId, int VehiculoId, DateOnly FechaInicio, DateOnly FechaFin,
    MetodoPago? MetodoPago);

public sealed record DevolucionInput(int AlquilerId, DateOnly? FechaDevolucion, MetodoPago? MetodoPagoMora);
