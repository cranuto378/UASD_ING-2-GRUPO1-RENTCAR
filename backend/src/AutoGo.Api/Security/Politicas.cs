namespace AutoGo.Api.Security;

/// <summary>Políticas de autorización usadas en los resolvers GraphQL.</summary>
public static class Politicas
{
    /// <summary>Sólo sesión válida (aunque deba cambiar la contraseña). Para 'me' y 'cambiarPassword'.</summary>
    public const string Sesion = "Sesion";
    /// <summary>Cualquier usuario con contraseña vigente.</summary>
    public const string Usuario = "Usuario";
    public const string Administrador = "Administrador";
    public const string Cliente = "Cliente";
}
