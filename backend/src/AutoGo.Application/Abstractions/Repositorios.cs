using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.Application.Abstractions;

// Puertos de persistencia. La implementación (Dapper + stored procedures) vive en Infrastructure.

public sealed record TokenRecuperacion(int Id, int UsuarioId, DateTime ExpiraEn);

public interface IUsuarioRepository
{
    Task<Usuario?> ObtenerPorCorreoAsync(string correo, CancellationToken ct = default);
    Task<Usuario?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<int> CrearAdministradorAsync(string nombre, string correo, string passwordHash, CancellationToken ct = default);
    Task<(int UsuarioId, int ClienteId)> RegistrarClienteAsync(int? clienteExistenteId, Cliente cliente, string correo,
        string passwordHash, CancellationToken ct = default);
    Task ActualizarPasswordAsync(int usuarioId, string passwordHash, bool debeCambiar, CancellationToken ct = default);
    Task CrearTokenRecuperacionAsync(int usuarioId, string tokenHash, DateTime expiraEnUtc, CancellationToken ct = default);
    Task<TokenRecuperacion?> ObtenerTokenVigenteAsync(string tokenHash, DateTime ahoraUtc, CancellationToken ct = default);
    Task ConsumirTokenAsync(int tokenId, string passwordHash, DateTime ahoraUtc, CancellationToken ct = default);
}

public interface IClienteRepository
{
    Task<IReadOnlyList<Cliente>> ListarAsync(string? texto, bool incluirInactivos, CancellationToken ct = default);
    Task<Cliente?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<Cliente?> ObtenerPorCedulaAsync(string cedula, CancellationToken ct = default);
    Task<int> CrearAsync(Cliente cliente, CancellationToken ct = default);
    Task ActualizarAsync(Cliente cliente, CancellationToken ct = default);
    Task DesactivarAsync(int id, CancellationToken ct = default);
    Task<int> ContarAlquileresActivosAsync(int id, CancellationToken ct = default);
}

public interface ICategoriaRepository
{
    Task<IReadOnlyList<Categoria>> ListarAsync(CancellationToken ct = default);
    Task<Categoria?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
    Task<int> CrearAsync(Categoria categoria, CancellationToken ct = default);
}

public interface IVehiculoRepository
{
    Task<IReadOnlyList<Vehiculo>> ListarAsync(DateOnly hoy, string? texto, int? categoriaId, bool incluirInactivos,
        CancellationToken ct = default);
    Task<Vehiculo?> ObtenerPorIdAsync(int id, DateOnly hoy, CancellationToken ct = default);
    Task<bool> ExistePlacaAsync(string placa, int? excluirId, CancellationToken ct = default);
    /// <summary>Vehículos activos sin alquileres que choquen con el rango.</summary>
    Task<IReadOnlyList<Vehiculo>> ListarSinConflictoAsync(DateOnly inicio, DateOnly fin, DateOnly hoy, int? categoriaId,
        CancellationToken ct = default);
    Task<int> CrearAsync(Vehiculo vehiculo, CancellationToken ct = default);
    Task ActualizarAsync(Vehiculo vehiculo, CancellationToken ct = default);
    Task CambiarEstadoAsync(Vehiculo vehiculo, CancellationToken ct = default);
    Task ActualizarFotoAsync(int id, string fotoUrl, CancellationToken ct = default);
    Task DesactivarAsync(int id, CancellationToken ct = default);
}

public sealed record FiltroAlquileres(int? ClienteId = null, int? VehiculoId = null, EstadoAlquiler? Estado = null,
    bool SoloVencidos = false);

public interface IAlquilerRepository
{
    Task<IReadOnlyList<Alquiler>> ListarAsync(FiltroAlquileres filtro, DateOnly hoy, CancellationToken ct = default);
    Task<Alquiler?> ObtenerPorIdAsync(int id, CancellationToken ct = default);

    /// <summary>Crea alquiler + factura inicial (atómico). Lanza ConflictException si el vehículo ya está comprometido.</summary>
    Task<(int AlquilerId, int FacturaId)> CrearAsync(Alquiler alquiler, MetodoPago metodoPago, string conceptoFactura,
        DateOnly hoy, CancellationToken ct = default);

    Task<int?> ModificarAsync(Alquiler alquiler, decimal montoAjuste, MetodoPago? metodoPago, string? conceptoAjuste,
        DateOnly hoy, CancellationToken ct = default);

    Task<int?> CancelarAsync(Alquiler alquiler, decimal montoReembolso, string? conceptoAjuste, MetodoPago? metodoPago,
        CancellationToken ct = default);

    Task<int?> RegistrarDevolucionAsync(Alquiler alquiler, MetodoPago? metodoPagoMora, string? conceptoMora,
        DateOnly mantenimientoHasta, CancellationToken ct = default);
}

public sealed record FiltroFacturas(int? ClienteId = null, int? AlquilerId = null, DateTime? DesdeUtc = null,
    DateTime? HastaUtc = null);

public interface IFacturaRepository
{
    Task<IReadOnlyList<Factura>> ListarAsync(FiltroFacturas filtro, CancellationToken ct = default);
    Task<Factura?> ObtenerPorIdAsync(int id, CancellationToken ct = default);
}

public sealed record ResumenOperativo(int TotalClientes, int AlquileresActivos, int AlquileresVencidos,
    int PendientesDevolucion, decimal IngresosTotales, decimal IngresosMes);

public interface IDashboardRepository
{
    Task<ResumenOperativo> ObtenerResumenAsync(DateOnly hoy, DateTime inicioMesUtc, DateTime finMesUtc,
        CancellationToken ct = default);
}
