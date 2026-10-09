namespace AutoGo.Models;

public class Cliente
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Cedula { get; set; } = string.Empty;
    public string? Telefono { get; set; }
    public string? Correo { get; set; }
    public bool TieneCuenta { get; set; } = false;
    public bool Activo { get; set; } = true;

    public ICollection<Alquiler> Alquileres { get; set; } = new List<Alquiler>();
}