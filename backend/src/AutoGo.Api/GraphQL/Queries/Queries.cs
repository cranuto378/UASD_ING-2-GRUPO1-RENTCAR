using AutoGo.Api.Security;
using AutoGo.Application.Abstractions;
using AutoGo.Application.Dtos;
using AutoGo.Application.Services;
using AutoGo.Domain.Enums;
using HotChocolate.Authorization;

namespace AutoGo.Api.GraphQL.Queries;

[ExtendObjectType(OperationTypeNames.Query)]
public sealed class CuentaQueries
{
    /// <summary>Usuario autenticado. Disponible aunque deba cambiar la contraseña.</summary>
    [Authorize(Policy = Politicas.Sesion)]
    public Task<UsuarioDto> Me([Service] IAuthService auth, CancellationToken ct) => auth.ObtenerUsuarioActualAsync(ct);
}

[ExtendObjectType(OperationTypeNames.Query)]
public sealed class CatalogoQueries
{
    /// <summary>Público: categorías de vehículos.</summary>
    public Task<IReadOnlyList<CategoriaDto>> Categorias([Service] ICategoriaService s, CancellationToken ct) => s.ListarAsync(ct);

    /// <summary>Público: vehículos libres para alquilar en el rango indicado (catálogo del portal).</summary>
    public Task<IReadOnlyList<VehiculoDto>> VehiculosDisponibles(DateOnly fechaInicio, DateOnly fechaFin, int? categoriaId,
        [Service] IVehiculoService s, CancellationToken ct) => s.ListarDisponiblesAsync(fechaInicio, fechaFin, categoriaId, ct);

    /// <summary>Público: precio calculado por la API (el frontend no debe replicar la regla de días/tarifa).</summary>
    public Task<CotizacionDto> CotizarAlquiler(int vehiculoId, DateOnly fechaInicio, DateOnly fechaFin,
        [Service] IAlquilerService s, CancellationToken ct) => s.CotizarAsync(vehiculoId, fechaInicio, fechaFin, ct);

    [Authorize(Policy = Politicas.Administrador)]
    [UsePaging(IncludeTotalCount = true, DefaultPageSize = 50, MaxPageSize = 200)]
    [UseFiltering]
    [UseSorting]
    public Task<IReadOnlyList<VehiculoDto>> Vehiculos(string? texto, int? categoriaId, bool incluirInactivos,
        [Service] IVehiculoService s, CancellationToken ct) => s.ListarAsync(texto, categoriaId, incluirInactivos, ct);

    public Task<VehiculoDto> Vehiculo(int id, [Service] IVehiculoService s, CancellationToken ct) => s.ObtenerAsync(id, ct);
}

[ExtendObjectType(OperationTypeNames.Query)]
public sealed class ClienteQueries
{
    [Authorize(Policy = Politicas.Administrador)]
    [UsePaging(IncludeTotalCount = true, DefaultPageSize = 50, MaxPageSize = 200)]
    [UseFiltering]
    [UseSorting]
    public Task<IReadOnlyList<ClienteDto>> Clientes(string? texto, bool incluirInactivos, [Service] IClienteService s,
        CancellationToken ct) => s.ListarAsync(texto, incluirInactivos, ct);

    [Authorize(Policy = Politicas.Usuario)]
    public Task<ClienteDto> Cliente(int id, [Service] IClienteService s, CancellationToken ct) => s.ObtenerAsync(id, ct);

    [Authorize(Policy = Politicas.Cliente)]
    public Task<ClienteDto> MiPerfil([Service] IClienteService s, CancellationToken ct) => s.ObtenerMiPerfilAsync(ct);
}

[ExtendObjectType(OperationTypeNames.Query)]
public sealed class AlquilerQueries
{
    [Authorize(Policy = Politicas.Administrador)]
    [UsePaging(IncludeTotalCount = true, DefaultPageSize = 50, MaxPageSize = 200)]
    [UseFiltering]
    [UseSorting]
    public Task<IReadOnlyList<AlquilerDto>> Alquileres(int? clienteId, int? vehiculoId, EstadoAlquiler? estado,
        bool soloVencidos, [Service] IAlquilerService s, CancellationToken ct) =>
        s.ListarAsync(new FiltroAlquileres(clienteId, vehiculoId, estado, soloVencidos), ct);

    [Authorize(Policy = Politicas.Cliente)]
    public Task<IReadOnlyList<AlquilerDto>> MisAlquileres([Service] IAlquilerService s, CancellationToken ct) =>
        s.ListarMiosAsync(ct);

    [Authorize(Policy = Politicas.Usuario)]
    public Task<AlquilerDto> Alquiler(int id, [Service] IAlquilerService s, CancellationToken ct) => s.ObtenerAsync(id, ct);

    /// <summary>Vista previa de la devolución (mora) antes de confirmarla.</summary>
    [Authorize(Policy = Politicas.Usuario)]
    public Task<CotizacionDevolucionDto> CotizarDevolucion(int alquilerId, DateOnly? fechaDevolucion,
        [Service] IAlquilerService s, CancellationToken ct) => s.CotizarDevolucionAsync(alquilerId, fechaDevolucion, ct);
}

[ExtendObjectType(OperationTypeNames.Query)]
public sealed class FacturaQueries
{
    [Authorize(Policy = Politicas.Administrador)]
    [UsePaging(IncludeTotalCount = true, DefaultPageSize = 50, MaxPageSize = 200)]
    [UseFiltering]
    [UseSorting]
    public Task<IReadOnlyList<FacturaDto>> Facturas(int? clienteId, int? alquilerId, DateOnly? desde, DateOnly? hasta,
        [Service] IFacturaService s, CancellationToken ct) => s.ListarAsync(clienteId, alquilerId, desde, hasta, ct);

    [Authorize(Policy = Politicas.Cliente)]
    public Task<IReadOnlyList<FacturaDto>> MisFacturas([Service] IFacturaService s, CancellationToken ct) => s.ListarMiasAsync(ct);

    [Authorize(Policy = Politicas.Usuario)]
    public Task<FacturaDto> Factura(int id, [Service] IFacturaService s, CancellationToken ct) => s.ObtenerAsync(id, ct);
}

[ExtendObjectType(OperationTypeNames.Query)]
public sealed class DashboardQueries
{
    [Authorize(Policy = Politicas.Administrador)]
    public Task<DashboardDto> Dashboard([Service] IDashboardService s, CancellationToken ct) => s.ObtenerAsync(ct);
}
