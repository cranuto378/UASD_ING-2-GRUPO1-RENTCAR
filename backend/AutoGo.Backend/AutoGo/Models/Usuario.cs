namespace AutoGo.Models;

public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Rol { get; set; } = "Cliente";
    public bool DebeCambiarPassword { get; set; } = false;

    public int? ClienteId { get; set; }
    public Cliente? Cliente { get; set; }
}