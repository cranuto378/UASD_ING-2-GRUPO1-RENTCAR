using AutoGo.Application.Abstractions;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Common;

namespace AutoGo.Application.Services;

public interface IWalletService
{
    Task<WalletDto> ObtenerMiWalletAsync(CancellationToken ct = default);
    Task<RetiroWalletDto> RetirarAsync(CancellationToken ct = default);
    Task<IReadOnlyList<IngresoWalletDto>> IngresosAsync(DateOnly? desde, DateOnly? hasta, CancellationToken ct = default);
    /// <summary>Acredita Wallet GO al cliente (p. ej. por una cancelación/devolución). Uso interno de otros servicios.</summary>
    Task AcreditarAsync(int clienteId, decimal montoBase, string concepto, int? alquilerId, CancellationToken ct = default);
}

public sealed class WalletService(
    IWalletRepository wallet,
    IParametrosRepository parametros,
    IConfigFinancieraProvider configFinanciera,
    ICurrentUser actual) : IWalletService
{
    private int ClienteActual => actual.ClienteId ??
        throw new DomainException(CodigosError.ReglaNegocio, "La cuenta no está vinculada a un cliente.");

    public async Task<WalletDto> ObtenerMiWalletAsync(CancellationToken ct = default)
    {
        var clienteId = ClienteActual;
        var cfg = configFinanciera.Actual;
        var saldo = await wallet.ObtenerSaldoAsync(clienteId, ct);
        var movimientos = (await wallet.ListarMovimientosAsync(clienteId, ct))
            .Select(m => new WalletMovimientoDto(m.Id, m.Tipo, m.Monto, m.Concepto, m.Fecha, m.AlquilerId, cfg)).ToList();
        return new WalletDto(saldo, cfg.RetiroWalletClientePct, movimientos);
    }

    public async Task<RetiroWalletDto> RetirarAsync(CancellationToken ct = default)
    {
        var clienteId = ClienteActual;
        var cfg = configFinanciera.Actual;
        var saldo = await wallet.ObtenerSaldoAsync(clienteId, ct);
        if (saldo <= 0) throw new DomainException(CodigosError.ReglaNegocio, "No tienes saldo disponible en Wallet GO.");

        var comisionPct = (await parametros.ObtenerAsync(ct)).ComisionWalletGo;
        var montoEmpresa = decimal.Round(saldo * comisionPct / 100, 2);
        var montoCliente = saldo - montoEmpresa;

        await wallet.RetirarAsync(clienteId, saldo, "Retiro de saldo Wallet GO", ct);

        return new RetiroWalletDto(saldo, montoCliente, montoEmpresa, 0m, cfg.RetiroWalletClientePct, cfg);
    }

    public async Task<IReadOnlyList<IngresoWalletDto>> IngresosAsync(DateOnly? desde, DateOnly? hasta, CancellationToken ct = default)
    {
        var comisionPct = (await parametros.ObtenerAsync(ct)).ComisionWalletGo;
        return (await wallet.ListarRetirosAsync(desde, hasta, ct))
            .Select(r => new IngresoWalletDto(r.Id, r.ClienteNombre, r.Monto, decimal.Round(r.Monto * comisionPct / 100, 2), r.Fecha))
            .ToList();
    }

    public Task AcreditarAsync(int clienteId, decimal montoBase, string concepto, int? alquilerId, CancellationToken ct = default) =>
        wallet.AcreditarAsync(clienteId, montoBase, concepto, alquilerId, ct);
}
