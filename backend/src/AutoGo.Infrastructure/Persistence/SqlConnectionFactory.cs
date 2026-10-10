using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace AutoGo.Infrastructure.Persistence;

public interface IDbConnectionFactory
{
    Task<DbConnection> AbrirAsync(CancellationToken ct = default);
}

public sealed class SqlConnectionFactory(IConfiguration configuration) : IDbConnectionFactory
{
    private readonly string _connectionString = configuration.GetConnectionString("AutoGo")
        ?? throw new InvalidOperationException("Falta la cadena de conexión 'ConnectionStrings:AutoGo'.");

    public async Task<DbConnection> AbrirAsync(CancellationToken ct = default)
    {
        var conexion = new SqlConnection(_connectionString);
        await conexion.OpenAsync(ct);
        return conexion;
    }
}
