namespace AutoGo.Models;

public class Alquiler
{
    public int Id { get; set; }
    public int VehiculoId { get; set; }
    public Vehiculo Vehiculo { get; set; } = null!;
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;

    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public DateTime? FechaDevolucion { get; set; }
    public decimal MontoTotal { get; set; }
    public string Estado { get; set; } = "ACTIVO"; // ACTIVO, CANCELADO, DEVUELTO
    public string MetodoPago { get; set; } = "EFECTIVO";
    public int? DiasMora { get; set; }
    public decimal? MontoMora { get; set; }

    public ICollection<Factura> Facturas { get; set; } = new List<Factura>();
}