using AutoGo.Domain.Common;

namespace AutoGo.Application.Common;

public static class PoliticaPassword
{
    public const int LongitudMinima = 8;

    public static void Validar(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < LongitudMinima
            || !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            throw new DomainException(CodigosError.DatoInvalido,
                $"La contraseña debe tener al menos {LongitudMinima} caracteres e incluir letras y números.");
    }
}
