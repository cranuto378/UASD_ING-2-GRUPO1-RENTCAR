using AutoGo.Application.Abstractions;
using AutoGo.Application.Common;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Common;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;
using AutoGo.Domain.Services;

namespace AutoGo.Application.Services;

public interface IVehiculoService
{
    Task<IReadOnlyList<VehiculoDto>> ListarAsync(string? texto, int? categoriaId, bool incluirInactivos, CancellationToken ct = default);
    Task<IReadOnlyList<VehiculoDto>> ListarDisponiblesAsync(DateOnly fechaInicio, DateOnly fechaFin, int? categoriaId, CancellationToken ct = default);
    Task<VehiculoDto> ObtenerAsync(int id, CancellationToken ct = default);
    Task<VehiculoDto> CrearAsync(VehiculoInput input, CancellationToken ct = default);
    Task<VehiculoDto> ActualizarAsync(int id, VehiculoInput input, CancellationToken ct = default);
    Task<VehiculoDto> CambiarEstadoAsync(CambiarEstadoVehiculoInput input, CancellationToken ct = default);
    Task<VehiculoDto> SubirFotoAsync(int id, Stream contenido, string nombreArchivo, CancellationToken ct = default);
    Task<bool> DesactivarAsync(int id, CancellationToken ct = default);
}

public sealed class VehiculoService(
    IVehiculoRepository vehiculos,
    ICategoriaRepository categorias,
    IAlquilerRepository alquileres,
    IFileStorage archivos,
    PoliticaTarifas tarifas,
    IClock clock) : IVehiculoService
{
    private static readonly string[] ExtensionesFoto = [".jpg", ".jpeg", ".png", ".webp"];

    public async Task<IReadOnlyList<VehiculoDto>> ListarAsync(string? texto, int? categoriaId, bool incluirInactivos,
        CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        return (await vehiculos.ListarAsync(hoy, string.IsNullOrWhiteSpace(texto) ? null : texto.Trim(), categoriaId,
            incluirInactivos, ct)).Select(v => v.ToDto(hoy)).ToList();
    }

    /// <summary>Catálogo para alquilar en un rango (sirve también para reservas a futuro).</summary>
    public async Task<IReadOnlyList<VehiculoDto>> ListarDisponiblesAsync(DateOnly fechaInicio, DateOnly fechaFin,
        int? categoriaId, CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        tarifas.ValidarRango(fechaInicio, fechaFin, hoy);
        var candidatos = await vehiculos.ListarSinConflictoAsync(fechaInicio, fechaFin, hoy, categoriaId, ct);
        return candidatos.Where(v => v.PuedeAlquilarseDesde(fechaInicio)).Select(v => v.ToDto(hoy)).ToList();
    }

    public async Task<VehiculoDto> ObtenerAsync(int id, CancellationToken ct = default) =>
        (await Cargar(id, ct)).ToDto(clock.Hoy);

    public async Task<VehiculoDto> CrearAsync(VehiculoInput input, CancellationToken ct = default)
    {
        var vehiculo = Vehiculo.Crear(input.Placa, input.CategoriaId, input.Marca, input.Modelo, input.Anio,
            input.PrecioDia, clock.Hoy);
        await ValidarCategoria(vehiculo.CategoriaId, ct);
        if (await vehiculos.ExistePlacaAsync(vehiculo.Placa, null, ct))
            throw new ConflictException("PLACA_DUPLICADA", $"Ya existe un vehículo con la placa {vehiculo.Placa}.");

        var id = await vehiculos.CrearAsync(vehiculo, ct);
        return await ObtenerAsync(id, ct);
    }

    public async Task<VehiculoDto> ActualizarAsync(int id, VehiculoInput input, CancellationToken ct = default)
    {
        var vehiculo = await Cargar(id, ct);
        vehiculo.Actualizar(input.Placa, input.CategoriaId, input.Marca, input.Modelo, input.Anio, input.PrecioDia, clock.Hoy);
        await ValidarCategoria(vehiculo.CategoriaId, ct);
        if (await vehiculos.ExistePlacaAsync(vehiculo.Placa, id, ct))
            throw new ConflictException("PLACA_DUPLICADA", $"Ya existe otro vehículo con la placa {vehiculo.Placa}.");

        await vehiculos.ActualizarAsync(vehiculo, ct);
        return await ObtenerAsync(id, ct);
    }

    public async Task<VehiculoDto> CambiarEstadoAsync(CambiarEstadoVehiculoInput input, CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        var vehiculo = await Cargar(input.VehiculoId, ct);

        if (input.Estado != EstadoOperativo.Disponible && vehiculo.EstadoActual(hoy) == EstadoVehiculo.Alquilado)
            throw new DomainException(CodigosError.ReglaNegocio,
                "El vehículo está alquilado; registre la devolución antes de cambiar su estado.");

        switch (input.Estado)
        {
            case EstadoOperativo.Disponible: vehiculo.MarcarDisponible(); break;
            case EstadoOperativo.FueraDeServicio: vehiculo.MarcarFueraDeServicio(); break;
            case EstadoOperativo.Mantenimiento:
                if (input.MantenimientoHasta is DateOnly hasta && hasta < hoy)
                    throw new DomainException(CodigosError.FechasInvalidas, "La fecha fin de mantenimiento no puede estar en el pasado.");
                vehiculo.EnviarAMantenimiento(input.MantenimientoHasta);
                break;
        }

        await vehiculos.CambiarEstadoAsync(vehiculo, ct);
        return await ObtenerAsync(vehiculo.Id, ct);
    }

    public async Task<VehiculoDto> SubirFotoAsync(int id, Stream contenido, string nombreArchivo, CancellationToken ct = default)
    {
        var vehiculo = await Cargar(id, ct);
        var extension = Path.GetExtension(nombreArchivo).ToLowerInvariant();
        if (!ExtensionesFoto.Contains(extension))
            throw new DomainException(CodigosError.DatoInvalido, "Formato de imagen no permitido (use jpg, png o webp).");

        var url = await archivos.GuardarAsync(contenido, $"{vehiculo.Placa}-{Guid.NewGuid():N}{extension}", "vehiculos", ct);
        await vehiculos.ActualizarFotoAsync(id, url, ct);
        if (!string.IsNullOrEmpty(vehiculo.FotoUrl))
            await archivos.EliminarAsync(vehiculo.FotoUrl, ct);
        return await ObtenerAsync(id, ct);
    }

    /// <summary>Baja lógica (conserva el historial de alquileres).</summary>
    public async Task<bool> DesactivarAsync(int id, CancellationToken ct = default)
    {
        await Cargar(id, ct);
        var activos = await alquileres.ListarAsync(new FiltroAlquileres(VehiculoId: id, Estado: EstadoAlquiler.Activo), clock.Hoy, ct);
        if (activos.Count > 0)
            throw new DomainException(CodigosError.ReglaNegocio, "El vehículo tiene alquileres activos o futuros; no puede desactivarse.");
        await vehiculos.DesactivarAsync(id, ct);
        return true;
    }

    private async Task<Vehiculo> Cargar(int id, CancellationToken ct) =>
        await vehiculos.ObtenerPorIdAsync(id, clock.Hoy, ct) ?? throw new NotFoundException("Vehículo", id);

    private async Task ValidarCategoria(int categoriaId, CancellationToken ct)
    {
        var categoria = await categorias.ObtenerPorIdAsync(categoriaId, ct);
        if (categoria is null || !categoria.Activo) throw new NotFoundException("Categoría", categoriaId);
    }
}
