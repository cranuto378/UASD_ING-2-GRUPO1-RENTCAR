using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.Application.Abstractions;

/// <summary>Reloj del negocio. "Hoy" se calcula en la zona horaria de la empresa, no en la del servidor.</summary>
public interface IClock
{
    DateOnly Hoy { get; }
    DateTime AhoraUtc { get; }
    /// <summary>Instante UTC en que comienza <paramref name="fecha"/> en la zona horaria del negocio.</summary>
    DateTime InicioDelDiaUtc(DateOnly fecha);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verificar(string password, string hash);
}

public sealed record TokenEmitido(string Token, DateTime ExpiraEnUtc);

public interface ITokenService
{
    TokenEmitido Emitir(Usuario usuario);
}

public interface IEmailSender
{
    Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default);
}

public interface IFileStorage
{
    /// <summary>Guarda el archivo y devuelve la URL pública relativa.</summary>
    Task<string> GuardarAsync(Stream contenido, string nombreArchivo, string carpeta, CancellationToken ct = default);
    Task EliminarAsync(string url, CancellationToken ct = default);
}

/// <summary>Identidad del usuario que hace la petición (la resuelve la capa API desde el JWT).</summary>
public interface ICurrentUser
{
    bool EstaAutenticado { get; }
    int? UsuarioId { get; }
    Rol? Rol { get; }
    int? ClienteId { get; }
    bool EsAdministrador => Rol == Domain.Enums.Rol.Administrador;
}
