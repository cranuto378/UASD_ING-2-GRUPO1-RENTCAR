using AutoGo.Application.Common;
using AutoGo.Domain.Common;

namespace AutoGo.Api.GraphQL;

/// <summary>
/// Traduce excepciones a errores GraphQL con un código estable en extensions.code.
/// El frontend debe decidir por el código, no por el texto.
/// </summary>
public sealed class ErrorFilter(ILogger<ErrorFilter> logger, IHostEnvironment env) : IErrorFilter
{
    public IError OnError(IError error) => error.Exception switch
    {
        DomainException ex => Mapear(error, ex.Code, ex.Message),
        AppException ex => Mapear(error, ex.Code, ex.Message),
        null => error,
        var ex => Interno(error, ex)
    };

    private static IError Mapear(IError error, string code, string message) =>
        error.WithMessage(message).WithCode(code);

    private IError Interno(IError error, Exception ex)
    {
        logger.LogError(ex, "Error no controlado en {Path}", error.Path);
        var mensaje = env.IsDevelopment() ? ex.Message : "Ocurrió un error interno. Intente nuevamente.";
        return error.WithMessage(mensaje).WithCode("ERROR_INTERNO");
    }
}
