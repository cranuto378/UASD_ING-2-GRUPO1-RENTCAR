using AutoGo.Application.Abstractions;
using AutoGo.Application.Common;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Entities;

namespace AutoGo.Application.Services;

public interface ICategoriaService
{
    Task<IReadOnlyList<CategoriaDto>> ListarAsync(CancellationToken ct = default);
    Task<CategoriaDto> CrearAsync(string nombre, CancellationToken ct = default);
}

public sealed class CategoriaService(ICategoriaRepository categorias) : ICategoriaService
{
    public async Task<IReadOnlyList<CategoriaDto>> ListarAsync(CancellationToken ct = default) =>
        (await categorias.ListarAsync(ct)).Select(c => c.ToDto()).ToList();

    public async Task<CategoriaDto> CrearAsync(string nombre, CancellationToken ct = default)
    {
        var categoria = Categoria.Crear(nombre);
        var id = await categorias.CrearAsync(categoria, ct);
        return (await categorias.ObtenerPorIdAsync(id, ct) ?? throw new NotFoundException("Categoría", id)).ToDto();
    }
}

public interface IDashboardService
{
    Task<DashboardDto> ObtenerAsync(CancellationToken ct = default);
}

public sealed class DashboardService(IDashboardRepository dashboard, IVehiculoRepository vehiculos, IClock clock)
    : IDashboardService
{
    public async Task<DashboardDto> ObtenerAsync(CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        var primerDia = new DateOnly(hoy.Year, hoy.Month, 1);
        var resumen = await dashboard.ObtenerResumenAsync(hoy, clock.InicioDelDiaUtc(primerDia),
            clock.InicioDelDiaUtc(primerDia.AddMonths(1)), ct);

        // El estado visible del vehículo es una regla de dominio: se calcula aquí, no en SQL.
        var estados = (await vehiculos.ListarAsync(hoy, null, null, false, ct))
            .GroupBy(v => v.EstadoActual(hoy))
            .ToDictionary(g => g.Key, g => g.Count());
        int Contar(Domain.Enums.EstadoVehiculo e) => estados.GetValueOrDefault(e);

        return new DashboardDto(
            resumen.TotalClientes,
            estados.Values.Sum(),
            Contar(Domain.Enums.EstadoVehiculo.Disponible),
            Contar(Domain.Enums.EstadoVehiculo.Alquilado),
            Contar(Domain.Enums.EstadoVehiculo.Mantenimiento),
            Contar(Domain.Enums.EstadoVehiculo.FueraDeServicio),
            resumen.AlquileresActivos,
            resumen.AlquileresVencidos,
            resumen.PendientesDevolucion,
            resumen.IngresosTotales,
            resumen.IngresosMes);
    }
}
