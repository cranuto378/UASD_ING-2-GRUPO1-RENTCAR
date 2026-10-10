using AutoGo.Application.Abstractions;
using AutoGo.Application.Common;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Common;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;
using AutoGo.Domain.Services;

namespace AutoGo.Application.Services;

public interface IAlquilerService
{
    Task<IReadOnlyList<AlquilerDto>> ListarAsync(FiltroAlquileres filtro, CancellationToken ct = default);
    Task<IReadOnlyList<AlquilerDto>> ListarMiosAsync(CancellationToken ct = default);
    Task<AlquilerDto> ObtenerAsync(int id, CancellationToken ct = default);
    Task<CotizacionDto> CotizarAsync(int vehiculoId, DateOnly fechaInicio, DateOnly fechaFin, CancellationToken ct = default);
    Task<CotizacionDevolucionDto> CotizarDevolucionAsync(int alquilerId, DateOnly? fechaDevolucion, CancellationToken ct = default);
    Task<OperacionAlquilerDto> CrearAsync(CrearAlquilerInput input, CancellationToken ct = default);
    Task<OperacionAlquilerDto> ModificarAsync(ModificarAlquilerInput input, CancellationToken ct = default);
    Task<OperacionAlquilerDto> CancelarAsync(int alquilerId, string? motivo, CancellationToken ct = default);
    Task<OperacionAlquilerDto> RegistrarDevolucionAsync(DevolucionInput input, CancellationToken ct = default);
}

public sealed class AlquilerService(
    IAlquilerRepository alquileres,
    IVehiculoRepository vehiculos,
    IClienteRepository clientes,
    PoliticaTarifas tarifas,
    CalendarioLaboral calendario,
    ICurrentUser actual,
    IClock clock) : IAlquilerService
{
    public async Task<IReadOnlyList<AlquilerDto>> ListarAsync(FiltroAlquileres filtro, CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        return (await alquileres.ListarAsync(filtro, hoy, ct)).Select(a => a.ToDto(hoy)).ToList();
    }

    public async Task<IReadOnlyList<AlquilerDto>> ListarMiosAsync(CancellationToken ct = default)
    {
        var clienteId = actual.ClienteId ?? throw new ForbiddenException("La cuenta no está vinculada a un cliente.");
        return await ListarAsync(new FiltroAlquileres(ClienteId: clienteId), ct);
    }

    public async Task<AlquilerDto> ObtenerAsync(int id, CancellationToken ct = default) =>
        (await CargarConAcceso(id, ct)).ToDto(clock.Hoy);

    public async Task<CotizacionDto> CotizarAsync(int vehiculoId, DateOnly fechaInicio, DateOnly fechaFin, CancellationToken ct = default)
    {
        tarifas.ValidarRango(fechaInicio, fechaFin, clock.Hoy);
        var vehiculo = await CargarVehiculo(vehiculoId, ct);
        var c = tarifas.Cotizar(vehiculo.PrecioDia, fechaInicio, fechaFin);
        return new CotizacionDto(vehiculo.Id, fechaInicio, fechaFin, c.Dias, c.PrecioDia, c.Total);
    }

    public async Task<CotizacionDevolucionDto> CotizarDevolucionAsync(int alquilerId, DateOnly? fechaDevolucion, CancellationToken ct = default)
    {
        var alquiler = await CargarConAcceso(alquilerId, ct);
        alquiler.AsegurarActivo();
        var fecha = fechaDevolucion ?? clock.Hoy;
        var mora = tarifas.CalcularMora(alquiler.PrecioDia, alquiler.FechaFinPactada, fecha);
        return new CotizacionDevolucionDto(alquiler.Id, fecha, mora.Dias, mora.Monto, alquiler.MontoBase,
            alquiler.MontoBase + mora.Monto);
    }

    public async Task<OperacionAlquilerDto> CrearAsync(CrearAlquilerInput input, CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        var (clienteId, canal, registradoPor) = ResolverOrigen(input.ClienteId);

        var cliente = await clientes.ObtenerPorIdAsync(clienteId, ct) ?? throw new NotFoundException("Cliente", clienteId);
        cliente.AsegurarPuedeAlquilar();

        tarifas.ValidarRango(input.FechaInicio, input.FechaFin, hoy);
        var vehiculo = await CargarVehiculo(input.VehiculoId, ct);
        vehiculo.AsegurarPuedeAlquilarseDesde(input.FechaInicio);

        var cotizacion = tarifas.Cotizar(vehiculo.PrecioDia, input.FechaInicio, input.FechaFin);
        var alquiler = Alquiler.Nuevo(cliente.Id, vehiculo, registradoPor, canal, input.FechaInicio, input.FechaFin, cotizacion);

        var concepto = $"Alquiler {vehiculo.Descripcion} ({vehiculo.Placa}) {input.FechaInicio:dd/MM/yyyy}-{input.FechaFin:dd/MM/yyyy}, {cotizacion.Dias} día(s)";
        // La BD garantiza atómicamente que no haya choque de fechas (ConflictException si lo hay).
        var (alquilerId, facturaId) = await alquileres.CrearAsync(alquiler, input.MetodoPago, concepto, hoy, ct);

        return new OperacionAlquilerDto(await ObtenerDto(alquilerId, ct), facturaId);
    }

    public async Task<OperacionAlquilerDto> ModificarAsync(ModificarAlquilerInput input, CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        var alquiler = await Cargar(input.AlquilerId, ct);
        alquiler.AsegurarActivo();

        if (alquiler.HaComenzado(hoy))
        {
            tarifas.ValidarRangoSinHoy(input.FechaInicio, input.FechaFin);
            if (input.FechaFin < hoy)
                throw new DomainException(CodigosError.FechasInvalidas, "La nueva fecha de entrega no puede estar en el pasado.");
        }
        else
        {
            tarifas.ValidarRango(input.FechaInicio, input.FechaFin, hoy);
        }

        var vehiculo = await CargarVehiculo(input.VehiculoId, ct);
        if (vehiculo.Id != alquiler.VehiculoId) vehiculo.AsegurarPuedeAlquilarseDesde(input.FechaInicio);

        // Se respeta la tarifa pactada si el vehículo no cambia; si cambia, se usa la tarifa vigente del nuevo.
        var precio = vehiculo.Id == alquiler.VehiculoId ? alquiler.PrecioDia : vehiculo.PrecioDia;
        var cotizacion = tarifas.Cotizar(precio, input.FechaInicio, input.FechaFin);
        var ajuste = alquiler.Modificar(vehiculo, input.FechaInicio, input.FechaFin, cotizacion, hoy);

        if (ajuste > 0 && input.MetodoPago is null)
            throw new DomainException(CodigosError.DatoInvalido, "Indique el método de pago del cargo adicional.");

        var concepto = ajuste == 0 ? null
            : ajuste > 0 ? $"Cargo adicional por modificación del alquiler #{alquiler.Id} ({cotizacion.Dias} día(s))"
                         : $"Nota de crédito por modificación del alquiler #{alquiler.Id}";
        var facturaId = await alquileres.ModificarAsync(alquiler, ajuste, input.MetodoPago, concepto, hoy, ct);

        return new OperacionAlquilerDto(await ObtenerDto(alquiler.Id, ct), facturaId);
    }

    public async Task<OperacionAlquilerDto> CancelarAsync(int alquilerId, string? motivo, CancellationToken ct = default)
    {
        var alquiler = await CargarConAcceso(alquilerId, ct);
        var reembolso = alquiler.Cancelar(motivo, clock.Hoy);
        var facturaId = await alquileres.CancelarAsync(alquiler, reembolso,
            $"Nota de crédito por cancelación del alquiler #{alquiler.Id}", null, ct);

        return new OperacionAlquilerDto(await ObtenerDto(alquiler.Id, ct), facturaId);
    }

    public async Task<OperacionAlquilerDto> RegistrarDevolucionAsync(DevolucionInput input, CancellationToken ct = default)
    {
        var hoy = clock.Hoy;
        var fecha = input.FechaDevolucion ?? hoy;
        if (fecha > hoy)
            throw new DomainException(CodigosError.FechasInvalidas, "No se puede registrar una devolución con fecha futura.");

        var alquiler = await Cargar(input.AlquilerId, ct);
        var mora = tarifas.CalcularMora(alquiler.PrecioDia, alquiler.FechaFinPactada, fecha);
        if (mora.Monto > 0 && input.MetodoPagoMora is null)
            throw new DomainException(CodigosError.DatoInvalido,
                $"Hay una mora de RD$ {mora.Monto:N2}; indique el método de pago.");

        alquiler.RegistrarDevolucion(fecha, mora);
        var mantenimientoHasta = calendario.SiguienteDiaLaborable(fecha);
        var conceptoMora = mora.Monto > 0
            ? $"Mora por {mora.Dias} día(s) de retraso - alquiler #{alquiler.Id}"
            : null;

        var facturaId = await alquileres.RegistrarDevolucionAsync(alquiler, input.MetodoPagoMora, conceptoMora,
            mantenimientoHasta, ct);

        return new OperacionAlquilerDto(await ObtenerDto(alquiler.Id, ct), facturaId);
    }

    /// <summary>Administrador: registra en mostrador para el cliente indicado. Cliente: siempre para sí mismo, vía portal.</summary>
    private (int ClienteId, CanalAlquiler Canal, int? RegistradoPor) ResolverOrigen(int? clienteIdSolicitado)
    {
        if (actual.EsAdministrador)
        {
            var clienteId = clienteIdSolicitado
                ?? throw new DomainException(CodigosError.DatoInvalido, "Debe indicar el cliente.");
            return (clienteId, CanalAlquiler.Mostrador, actual.UsuarioId);
        }

        var propio = actual.ClienteId ?? throw new ForbiddenException("La cuenta no está vinculada a un cliente.");
        if (clienteIdSolicitado is int otro && otro != propio) throw new ForbiddenException();
        return (propio, CanalAlquiler.Portal, null);
    }

    private async Task<Alquiler> Cargar(int id, CancellationToken ct) =>
        await alquileres.ObtenerPorIdAsync(id, ct) ?? throw new NotFoundException("Alquiler", id);

    private async Task<Alquiler> CargarConAcceso(int id, CancellationToken ct)
    {
        var alquiler = await Cargar(id, ct);
        Acceso.AsegurarAdminOPropietario(actual, alquiler.ClienteId);
        return alquiler;
    }

    private async Task<AlquilerDto> ObtenerDto(int id, CancellationToken ct) => (await Cargar(id, ct)).ToDto(clock.Hoy);

    private async Task<Vehiculo> CargarVehiculo(int id, CancellationToken ct) =>
        await vehiculos.ObtenerPorIdAsync(id, clock.Hoy, ct) ?? throw new NotFoundException("Vehículo", id);
}
