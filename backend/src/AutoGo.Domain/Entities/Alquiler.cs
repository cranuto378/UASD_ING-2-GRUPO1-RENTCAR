using AutoGo.Domain.Common;
using AutoGo.Domain.Enums;
using AutoGo.Domain.Services;

namespace AutoGo.Domain.Entities;

public sealed class Alquiler
{
    public int Id { get; private set; }
    public int ClienteId { get; private set; }
    public int VehiculoId { get; private set; }
    public int? RegistradoPorUsuarioId { get; private set; }
    public CanalAlquiler Canal { get; private set; }
    public DateOnly FechaInicio { get; private set; }
    public DateOnly FechaFinPactada { get; private set; }
    public DateOnly? FechaDevolucion { get; private set; }
    public decimal PrecioDia { get; private set; }
    public int Dias { get; private set; }
    public decimal MontoBase { get; private set; }
    public int DiasMora { get; private set; }
    public decimal MontoMora { get; private set; }
    public EstadoAlquiler Estado { get; private set; }
    public string? Observaciones { get; private set; }
    public DateTime FechaCreacion { get; private set; }

    // Proyección de lectura
    public string ClienteNombre { get; private set; } = string.Empty;
    public string ClienteCedula { get; private set; } = string.Empty;
    public string Placa { get; private set; } = string.Empty;
    public string Marca { get; private set; } = string.Empty;
    public string Modelo { get; private set; } = string.Empty;
    public decimal TotalFacturado { get; private set; }

    private Alquiler() { }

    public decimal MontoTotal => MontoBase + MontoMora;

    public static Alquiler Nuevo(int clienteId, Vehiculo vehiculo, int? registradoPor, CanalAlquiler canal,
        DateOnly inicio, DateOnly fin, Cotizacion cotizacion) => new()
    {
        ClienteId = clienteId,
        VehiculoId = vehiculo.Id,
        RegistradoPorUsuarioId = registradoPor,
        Canal = canal,
        FechaInicio = inicio,
        FechaFinPactada = fin,
        PrecioDia = cotizacion.PrecioDia,
        Dias = cotizacion.Dias,
        MontoBase = cotizacion.Total,
        Estado = EstadoAlquiler.Activo,
        Placa = vehiculo.Placa,
        Marca = vehiculo.Marca,
        Modelo = vehiculo.Modelo
    };

    public static Alquiler Rehidratar(int id, int clienteId, string clienteNombre, string clienteCedula, int vehiculoId,
        string placa, string marca, string modelo, int? registradoPor, CanalAlquiler canal, DateOnly inicio,
        DateOnly finPactada, DateOnly? devolucion, decimal precioDia, int dias, decimal montoBase, int diasMora,
        decimal montoMora, EstadoAlquiler estado, string? observaciones, DateTime fechaCreacion, decimal totalFacturado) => new()
    {
        Id = id, ClienteId = clienteId, ClienteNombre = clienteNombre, ClienteCedula = clienteCedula,
        VehiculoId = vehiculoId, Placa = placa, Marca = marca, Modelo = modelo, RegistradoPorUsuarioId = registradoPor,
        Canal = canal, FechaInicio = inicio, FechaFinPactada = finPactada, FechaDevolucion = devolucion,
        PrecioDia = precioDia, Dias = dias, MontoBase = montoBase, DiasMora = diasMora, MontoMora = montoMora,
        Estado = estado, Observaciones = observaciones, FechaCreacion = fechaCreacion, TotalFacturado = totalFacturado
    };

    public bool EstaVencido(DateOnly hoy) => Estado == EstadoAlquiler.Activo && FechaFinPactada < hoy;

    public int DiasRetraso(DateOnly hoy) => EstaVencido(hoy) ? hoy.DayNumber - FechaFinPactada.DayNumber : 0;

    public bool HaComenzado(DateOnly hoy) => FechaInicio <= hoy;

    public void AsegurarActivo()
    {
        if (Estado != EstadoAlquiler.Activo)
            throw new DomainException(CodigosError.AlquilerNoActivo,
                $"El alquiler #{Id} está {Estado.ToString().ToLowerInvariant()} y no admite esta operación.");
    }

    /// <summary>Cambia vehículo/fechas. Devuelve la diferencia a facturar (+ cobro, − crédito).</summary>
    public decimal Modificar(Vehiculo vehiculo, DateOnly inicio, DateOnly fin, Cotizacion cotizacion, DateOnly hoy)
    {
        AsegurarActivo();
        if (HaComenzado(hoy) && inicio != FechaInicio)
            throw new DomainException(CodigosError.ReglaNegocio,
                "No se puede cambiar la fecha de salida de un alquiler que ya comenzó.");
        if (HaComenzado(hoy) && vehiculo.Id != VehiculoId)
            throw new DomainException(CodigosError.ReglaNegocio,
                "No se puede cambiar el vehículo de un alquiler que ya comenzó; registre la devolución y cree uno nuevo.");

        var diferencia = cotizacion.Total - MontoBase;
        VehiculoId = vehiculo.Id;
        FechaInicio = inicio;
        FechaFinPactada = fin;
        PrecioDia = cotizacion.PrecioDia;
        Dias = cotizacion.Dias;
        MontoBase = cotizacion.Total;
        return diferencia;
    }

    /// <summary>
    /// Regla de cancelación: sólo antes de la fecha de salida y con reembolso total.
    /// Después de la salida el flujo correcto es registrar la devolución.
    /// </summary>
    public decimal Cancelar(string? motivo, DateOnly hoy)
    {
        AsegurarActivo();
        if (HaComenzado(hoy))
            throw new DomainException(CodigosError.CancelacionNoPermitida,
                "El alquiler ya comenzó; no puede cancelarse. Registre la devolución.");
        Estado = EstadoAlquiler.Cancelado;
        Observaciones = Guard.Opcional(motivo, "motivo", 500) ?? "Cancelado";
        return TotalFacturado > 0 ? TotalFacturado : MontoBase;
    }

    public void RegistrarDevolucion(DateOnly fechaDevolucion, CargoMora mora)
    {
        AsegurarActivo();
        if (fechaDevolucion < FechaInicio)
            throw new DomainException(CodigosError.FechasInvalidas,
                "La fecha de devolución no puede ser anterior a la fecha de salida.");
        FechaDevolucion = fechaDevolucion;
        DiasMora = mora.Dias;
        MontoMora = mora.Monto;
        Estado = EstadoAlquiler.Completado;
    }
}
