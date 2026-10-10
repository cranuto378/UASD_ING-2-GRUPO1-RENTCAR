using AutoGo.Application.Abstractions;
using AutoGo.Application.Common;
using AutoGo.Application.Dtos;

namespace AutoGo.Application.Services;

public interface IFacturaService
{
    Task<IReadOnlyList<FacturaDto>> ListarAsync(int? clienteId, int? alquilerId, DateOnly? desde, DateOnly? hasta, CancellationToken ct = default);
    Task<IReadOnlyList<FacturaDto>> ListarMiasAsync(CancellationToken ct = default);
    Task<FacturaDto> ObtenerAsync(int id, CancellationToken ct = default);
}

public sealed class FacturaService(IFacturaRepository facturas, ICurrentUser actual, IClock clock) : IFacturaService
{
    public async Task<IReadOnlyList<FacturaDto>> ListarAsync(int? clienteId, int? alquilerId, DateOnly? desde,
        DateOnly? hasta, CancellationToken ct = default)
    {
        var filtro = new FiltroFacturas(clienteId, alquilerId,
            desde is DateOnly d ? clock.InicioDelDiaUtc(d) : null,
            hasta is DateOnly h ? clock.InicioDelDiaUtc(h.AddDays(1)) : null);
        return (await facturas.ListarAsync(filtro, ct)).Select(f => f.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<FacturaDto>> ListarMiasAsync(CancellationToken ct = default)
    {
        var clienteId = actual.ClienteId ?? throw new ForbiddenException("La cuenta no está vinculada a un cliente.");
        return (await facturas.ListarAsync(new FiltroFacturas(ClienteId: clienteId), ct)).Select(f => f.ToDto()).ToList();
    }

    public async Task<FacturaDto> ObtenerAsync(int id, CancellationToken ct = default)
    {
        var factura = await facturas.ObtenerPorIdAsync(id, ct) ?? throw new NotFoundException("Factura", id);
        Acceso.AsegurarAdminOPropietario(actual, factura.ClienteId);
        return factura.ToDto();
    }
}
