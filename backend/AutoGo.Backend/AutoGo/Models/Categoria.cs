namespace AutoGo.Models;

public class Categoria
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public ICollection<Vehiculo> Vehiculos { get; set; } = new List<Vehiculo>();
}