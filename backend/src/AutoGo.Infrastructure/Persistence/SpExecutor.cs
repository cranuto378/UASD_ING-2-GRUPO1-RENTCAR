using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace AutoGo.Infrastructure.Persistence;

/// <summary>
/// Único punto de acceso a la BD: todo pasa por stored procedures.
/// Los repositorios nunca escriben SQL inline.
/// </summary>
public sealed class SpExecutor(IDbConnectionFactory factory)
{
    public Task<IReadOnlyList<T>> ListarAsync<T>(string sp, object? parametros, CancellationToken ct) =>
        Ejecutar(async c => (IReadOnlyList<T>)(await c.QueryAsync<T>(Cmd(sp, parametros, ct))).AsList());

    public Task<T?> PrimeroAsync<T>(string sp, object? parametros, CancellationToken ct) =>
        Ejecutar(c => c.QueryFirstOrDefaultAsync<T>(Cmd(sp, parametros, ct)));

    public Task<T> EscalarAsync<T>(string sp, object? parametros, CancellationToken ct) =>
        Ejecutar(async c => (await c.ExecuteScalarAsync<T>(Cmd(sp, parametros, ct)))!);

    public Task EjecutarAsync(string sp, object? parametros, CancellationToken ct) =>
        Ejecutar(c => c.ExecuteAsync(Cmd(sp, parametros, ct)));

    private static CommandDefinition Cmd(string sp, object? parametros, CancellationToken ct) =>
        new(sp, parametros, commandType: CommandType.StoredProcedure, cancellationToken: ct);

    private async Task<T> Ejecutar<T>(Func<IDbConnection, Task<T>> accion)
    {
        try
        {
            await using var conexion = await factory.AbrirAsync();
            return await accion(conexion);
        }
        catch (SqlException ex) when (SqlErrorTranslator.Traducir(ex) is { } traducida)
        {
            throw traducida;
        }
    }
}

internal static class Fechas
{
    public static DateTime ToDb(this DateOnly d) => d.ToDateTime(TimeOnly.MinValue);
    public static DateTime? ToDb(this DateOnly? d) => d?.ToDateTime(TimeOnly.MinValue);
    public static DateOnly ToDateOnly(this DateTime d) => DateOnly.FromDateTime(d);
    public static DateOnly? ToDateOnly(this DateTime? d) => d.HasValue ? DateOnly.FromDateTime(d.Value) : null;
    public static DateTime Utc(this DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
}
