namespace AutoGo.Models;

public class Vehiculo
{
    public int Id { get; set; }
    public string Placa { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public int Anio { get; set; }
    public decimal PrecioDia { get; set; }
    public string? FotoUrl { get; set; }
    public string EstadoOperativo { get; set; } = "DISPONIBLE";

    public int CategoriaId { get; set; }
    public Categoria Categoria { get; set; } = null!;
}