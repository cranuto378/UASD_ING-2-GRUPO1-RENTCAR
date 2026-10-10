using AutoGo.Application.Common;
using Microsoft.Data.SqlClient;

namespace AutoGo.Infrastructure.Persistence;

/// <summary>Traduce los errores controlados de los stored procedures (THROW 51xxx) a excepciones de aplicación.</summary>
internal static class SqlErrorTranslator
{
    public static Exception? Traducir(SqlException ex) => ex.Number switch
    {
        51000 => new AppException("NO_ENCONTRADO", ex.Message),
        51001 => new ConflictException("VEHICULO_NO_DISPONIBLE", ex.Message),
        51002 => new ConflictException("ESTADO_CAMBIADO", ex.Message),
        51003 => new AppException("TOKEN_INVALIDO", ex.Message),
        2627 or 2601 => Duplicado(ex.Message),
        547 => new ConflictException("REFERENCIA_INVALIDA", "La operación viola una relación de datos (registro relacionado inexistente o en uso)."),
        _ => null
    };

    private static ConflictException Duplicado(string mensaje) => mensaje switch
    {
        _ when mensaje.Contains("UQ_Clientes_Cedula") => new("CEDULA_DUPLICADA", "Ya existe un cliente con esa cédula."),
        _ when mensaje.Contains("UQ_Usuarios_Correo") => new("CORREO_DUPLICADO", "Ya existe una cuenta con ese correo."),
        _ when mensaje.Contains("UQ_Vehiculos_Placa") => new("PLACA_DUPLICADA", "Ya existe un vehículo con esa placa."),
        _ when mensaje.Contains("UQ_Categorias_Nombre") => new("CATEGORIA_DUPLICADA", "Ya existe una categoría con ese nombre."),
        _ => new("DUPLICADO", "El registro ya existe.")
    };
}
