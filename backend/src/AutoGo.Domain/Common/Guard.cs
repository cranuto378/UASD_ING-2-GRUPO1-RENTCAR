namespace AutoGo.Domain.Common;

internal static class Guard
{
    public static string Requerido(string? valor, string campo, int max)
    {
        if (string.IsNullOrWhiteSpace(valor))
            throw new DomainException(CodigosError.DatoInvalido, $"El campo '{campo}' es obligatorio.");
        var limpio = valor.Trim();
        if (limpio.Length > max)
            throw new DomainException(CodigosError.DatoInvalido, $"El campo '{campo}' admite máximo {max} caracteres.");
        return limpio;
    }

    public static string? Opcional(string? valor, string campo, int max)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        var limpio = valor.Trim();
        if (limpio.Length > max)
            throw new DomainException(CodigosError.DatoInvalido, $"El campo '{campo}' admite máximo {max} caracteres.");
        return limpio;
    }
}
