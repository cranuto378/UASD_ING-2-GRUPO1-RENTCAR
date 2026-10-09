namespace AutoGo.Models;

public class Factura
{
    public int Id { get; set; }
    public int AlquilerId { get; set; }
    public Alquiler Alquiler { get; set; } = null!;

    public string Tipo { get; set; } = "ALQUILER"; // ALQUILER, MORA, AJUSTE
    public string Concepto { get; set; } = string.Empty;
    public decimal Monto { get; set; }
    public string MetodoPago { get; set; } = "EFECTIVO";
    public DateTime FechaEmision { get; set; } = DateTime.UtcNow;

    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public int VehiculoId { get; set; }
    public Vehiculo Vehiculo { get; set; } = null!;
}