namespace AutoGo.Application.Common;

/// <summary>Error de aplicación con un código estable para el cliente GraphQL.</summary>
public class AppException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed class NotFoundException(string entidad, object id)
    : AppException("NO_ENCONTRADO", $"{entidad} '{id}' no existe.");

public sealed class ConflictException(string code, string message) : AppException(code, message);

public sealed class ForbiddenException(string message = "No tiene permiso para realizar esta operación.")
    : AppException("ACCESO_DENEGADO", message);

public sealed class AuthenticationException(string message = "Correo o contraseña incorrectos.")
    : AppException("CREDENCIALES_INVALIDAS", message);
