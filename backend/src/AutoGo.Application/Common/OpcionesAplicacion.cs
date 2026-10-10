namespace AutoGo.Application.Common;

/// <summary>Configuración de casos de uso (sección "Aplicacion" en appsettings).</summary>
public sealed class OpcionesAplicacion
{
    /// <summary>URL del frontend para restablecer contraseña. Se le agrega ?token=...</summary>
    public string UrlRestablecerPassword { get; set; } = "http://localhost:5173/restablecer-password";

    public int MinutosValidezTokenRecuperacion { get; set; } = 30;

    public string NombreEmpresa { get; set; } = "AutoGo Rent a Car";
}
