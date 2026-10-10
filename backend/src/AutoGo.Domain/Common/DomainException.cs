namespace AutoGo.Domain.Common;

/// <summary>Violación de una regla de negocio. <see cref="Code"/> viaja al cliente GraphQL.</summary>
public class DomainException : Exception
{
    public string Code { get; }

    public DomainException(string code, string message) : base(message) => Code = code;
}

/// <summary>Códigos de error de negocio estables (el frontend puede depender de ellos).</summary>
public static class CodigosError
{
    public const string ReglaNegocio = "REGLA_NEGOCIO";
    public const string FechasInvalidas = "FECHAS_INVALIDAS";
    public const string VehiculoNoDisponible = "VEHICULO_NO_DISPONIBLE";
    public const string AlquilerNoActivo = "ALQUILER_NO_ACTIVO";
    public const string CancelacionNoPermitida = "CANCELACION_NO_PERMITIDA";
    public const string ClienteInactivo = "CLIENTE_INACTIVO";
    public const string DatoInvalido = "DATO_INVALIDO";
}
