using AutoGo.Domain.Enums;

namespace AutoGo.Domain.Entities;

/// <summary>Documento inmutable: una vez emitida, una factura nunca se modifica.</summary>
public sealed class Factura
{
    public int Id { get; private set; }
    public int AlquilerId { get; private set; }
    public TipoFactura Tipo { get; private set; }
    public string Concepto { get; private set; } = string.Empty;
    public decimal Monto { get; private set; }
    public MetodoPago? MetodoPago { get; private set; }
    public DateTime FechaEmision { get; private set; }

    // Proyección de lectura (datos para imprimir la factura)
    public int ClienteId { get; private set; }
    public string ClienteNombre { get; private set; } = string.Empty;
    public string ClienteCedula { get; private set; } = string.Empty;
    public string? ClienteTelefono { get; private set; }
    public string? ClienteCorreo { get; private set; }
    public int VehiculoId { get; private set; }
    public string Placa { get; private set; } = string.Empty;
    public string Marca { get; private set; } = string.Empty;
    public string Modelo { get; private set; } = string.Empty;
    public string CategoriaNombre { get; private set; } = string.Empty;
    public DateOnly FechaInicio { get; private set; }
    public DateOnly FechaFinPactada { get; private set; }
    public int Dias { get; private set; }
    public decimal PrecioDia { get; private set; }

    private Factura() { }

    public static Factura Rehidratar(int id, int alquilerId, TipoFactura tipo, string concepto, decimal monto,
        MetodoPago? metodoPago, DateTime fechaEmision, int clienteId, string clienteNombre, string clienteCedula,
        string? clienteTelefono, string? clienteCorreo, int vehiculoId, string placa, string marca, string modelo,
        string categoriaNombre, DateOnly fechaInicio, DateOnly fechaFinPactada, int dias, decimal precioDia) => new()
    {
        Id = id, AlquilerId = alquilerId, Tipo = tipo, Concepto = concepto, Monto = monto, MetodoPago = metodoPago,
        FechaEmision = fechaEmision, ClienteId = clienteId, ClienteNombre = clienteNombre, ClienteCedula = clienteCedula,
        ClienteTelefono = clienteTelefono, ClienteCorreo = clienteCorreo, VehiculoId = vehiculoId, Placa = placa,
        Marca = marca, Modelo = modelo, CategoriaNombre = categoriaNombre, FechaInicio = fechaInicio,
        FechaFinPactada = fechaFinPactada, Dias = dias, PrecioDia = precioDia
    };
}
