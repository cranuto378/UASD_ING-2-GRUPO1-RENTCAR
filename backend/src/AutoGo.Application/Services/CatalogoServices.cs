using System.Text.Json;
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

public interface IParametrosService
{
    Task<ParametrosGenerales> ObtenerAsync(CancellationToken ct = default);
    Task<ParametrosGenerales> ActualizarComisionWalletGoAsync(decimal comisionWalletGo, CancellationToken ct = default);
}

public sealed class ParametrosService(IParametrosRepository parametros) : IParametrosService
{
    public Task<ParametrosGenerales> ObtenerAsync(CancellationToken ct = default) => parametros.ObtenerAsync(ct);

    public async Task<ParametrosGenerales> ActualizarComisionWalletGoAsync(decimal comisionWalletGo, CancellationToken ct = default)
    {
        if (comisionWalletGo < 0 || comisionWalletGo > 100)
            throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "La comisión Wallet GO debe estar entre 0 y 100.");
        await parametros.ActualizarComisionWalletGoAsync(comisionWalletGo, ct);
        return await parametros.ObtenerAsync(ct);
    }
}

public interface IConfiguracionService
{
    Task<ConfiguracionDto> ObtenerAsync(CancellationToken ct = default);
    Task<ConfiguracionDto> ActualizarAsync(ConfiguracionInput input, CancellationToken ct = default);
    Task<IReadOnlyList<HistorialConfiguracionDto>> HistorialAsync(CancellationToken ct = default);
}

public sealed class ConfiguracionService(IParametrosRepository parametros, ICurrentUser actual) : IConfiguracionService
{
    public async Task<ConfiguracionDto> ObtenerAsync(CancellationToken ct = default) => (await parametros.ObtenerAsync(ct)).ToConfiguracionDto();

    public async Task<ConfiguracionDto> ActualizarAsync(ConfiguracionInput input, CancellationToken ct = default)
    {
        foreach (var pct in new[] { input.ImpuestoPct, input.RetencionPct, input.RecargoMoraPct, input.RetiroWalletClientePct })
            if (pct < 0 || pct > 100)
                throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "Los porcentajes deben estar entre 0 y 100.");

        var anterior = (await parametros.ObtenerAsync(ct)).ToConfiguracionDto();
        var anteriorJson = JsonSerializer.Serialize(anterior);
        var nuevoJson = JsonSerializer.Serialize(input);
        var usuarioId = actual.UsuarioId ?? 0;
        var usuario = actual.Nombre ?? $"Usuario #{usuarioId}";

        await parametros.ActualizarConfiguracionAsync(input, usuarioId, usuario, "Configuración institucional actualizada",
            anteriorJson, nuevoJson, ct);

        return (await parametros.ObtenerAsync(ct)).ToConfiguracionDto();
    }

    public async Task<IReadOnlyList<HistorialConfiguracionDto>> HistorialAsync(CancellationToken ct = default) =>
        (await parametros.ObtenerHistorialAsync(ct))
        .Select(h => new HistorialConfiguracionDto(h.Id, h.Fecha, h.Usuario, h.Cambios, h.AnteriorJson, h.NuevoJson))
        .ToList();
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
