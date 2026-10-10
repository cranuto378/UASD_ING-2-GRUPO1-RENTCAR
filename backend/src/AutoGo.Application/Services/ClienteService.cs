using AutoGo.Application.Abstractions;
using AutoGo.Application.Common;
using AutoGo.Application.Dtos;
using AutoGo.Domain.Common;
using AutoGo.Domain.Entities;

namespace AutoGo.Application.Services;

public interface IClienteService
{
    Task<IReadOnlyList<ClienteDto>> ListarAsync(string? texto, bool incluirInactivos, CancellationToken ct = default);
    Task<ClienteDto> ObtenerAsync(int id, CancellationToken ct = default);
    Task<ClienteDto> ObtenerMiPerfilAsync(CancellationToken ct = default);
    Task<ClienteDto> CrearAsync(ClienteInput input, CancellationToken ct = default);
    Task<ClienteDto> ActualizarAsync(int id, ClienteInput input, CancellationToken ct = default);
    Task<bool> DesactivarAsync(int id, CancellationToken ct = default);
}

public sealed class ClienteService(IClienteRepository clientes, ICurrentUser actual) : IClienteService
{
    public async Task<IReadOnlyList<ClienteDto>> ListarAsync(string? texto, bool incluirInactivos, CancellationToken ct = default) =>
        (await clientes.ListarAsync(string.IsNullOrWhiteSpace(texto) ? null : texto.Trim(), incluirInactivos, ct))
            .Select(c => c.ToDto()).ToList();

    public async Task<ClienteDto> ObtenerAsync(int id, CancellationToken ct = default)
    {
        Acceso.AsegurarAdminOPropietario(actual, id);
        return (await Cargar(id, ct)).ToDto();
    }

    public async Task<ClienteDto> ObtenerMiPerfilAsync(CancellationToken ct = default)
    {
        var id = actual.ClienteId ?? throw new ForbiddenException("La cuenta no está vinculada a un cliente.");
        return (await Cargar(id, ct)).ToDto();
    }

    public async Task<ClienteDto> CrearAsync(ClienteInput input, CancellationToken ct = default)
    {
        var cliente = Cliente.Crear(input.Nombre, input.Cedula, input.Correo, input.Telefono, input.LicenciaConducir);
        if (await clientes.ObtenerPorCedulaAsync(cliente.Cedula, ct) is not null)
            throw new ConflictException("CEDULA_DUPLICADA", "Ya existe un cliente con esa cédula.");

        var id = await clientes.CrearAsync(cliente, ct);
        return (await Cargar(id, ct)).ToDto();
    }

    public async Task<ClienteDto> ActualizarAsync(int id, ClienteInput input, CancellationToken ct = default)
    {
        var cliente = await Cargar(id, ct);
        cliente.Actualizar(input.Nombre, input.Cedula, input.Correo, input.Telefono, input.LicenciaConducir);

        var mismaCedula = await clientes.ObtenerPorCedulaAsync(cliente.Cedula, ct);
        if (mismaCedula is not null && mismaCedula.Id != id)
            throw new ConflictException("CEDULA_DUPLICADA", "Ya existe otro cliente con esa cédula.");

        await clientes.ActualizarAsync(cliente, ct);
        return (await Cargar(id, ct)).ToDto();
    }

    /// <summary>Baja lógica. Antes se borraba físicamente y fallaba por FK si tenía historial.</summary>
    public async Task<bool> DesactivarAsync(int id, CancellationToken ct = default)
    {
        await Cargar(id, ct);
        if (await clientes.ContarAlquileresActivosAsync(id, ct) > 0)
            throw new DomainException(CodigosError.ReglaNegocio, "El cliente tiene alquileres activos; no puede desactivarse.");
        await clientes.DesactivarAsync(id, ct);
        return true;
    }

    private async Task<Cliente> Cargar(int id, CancellationToken ct) =>
        await clientes.ObtenerPorIdAsync(id, ct) ?? throw new NotFoundException("Cliente", id);
}

/// <summary>Reglas de acceso a nivel de datos (el rol ya se valida en la API; aquí la propiedad del recurso).</summary>
internal static class Acceso
{
    public static void AsegurarAdminOPropietario(ICurrentUser actual, int clienteId)
    {
        if (actual.EsAdministrador) return;
        if (actual.ClienteId is int propio && propio == clienteId) return;
        throw new ForbiddenException();
    }
}
