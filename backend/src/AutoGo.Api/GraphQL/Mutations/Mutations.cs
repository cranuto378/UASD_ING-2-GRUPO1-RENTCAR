using AutoGo.Api.Security;
using AutoGo.Application.Dtos;
using AutoGo.Application.Services;
using AutoGo.Domain.Enums;
using HotChocolate.Authorization;

namespace AutoGo.Api.GraphQL.Mutations;

[ExtendObjectType(OperationTypeNames.Mutation)]
public sealed class CuentaMutations
{
    public Task<AuthResultadoDto> Login(string correo, string password, [Service] IAuthService s, CancellationToken ct) =>
        s.LoginAsync(correo, password, ct);

    /// <summary>Auto-registro desde el portal. Devuelve sesión iniciada.</summary>
    public Task<AuthResultadoDto> RegistrarCliente(RegistroClienteInput input, [Service] IAuthService s, CancellationToken ct) =>
        s.RegistrarClienteAsync(input, ct);

    [Authorize(Policy = Politicas.Sesion)]
    public Task<AuthResultadoDto> CambiarPassword(string passwordActual, string passwordNueva, [Service] IAuthService s,
        CancellationToken ct) => s.CambiarPasswordAsync(passwordActual, passwordNueva, ct);

    /// <summary>Siempre devuelve true (no revela si el correo existe).</summary>
    public async Task<bool> SolicitarRecuperacionPassword(string correo, [Service] IAuthService s, CancellationToken ct)
    {
        await s.SolicitarRecuperacionAsync(correo, ct);
        return true;
    }

    public async Task<bool> RestablecerPassword(string token, string passwordNueva, [Service] IAuthService s, CancellationToken ct)
    {
        await s.RestablecerPasswordAsync(token, passwordNueva, ct);
        return true;
    }

    [Authorize(Policy = Politicas.Administrador)]
    public Task<UsuarioDto> CrearAdministrador(CrearAdministradorInput input, [Service] IAuthService s, CancellationToken ct) =>
        s.CrearAdministradorAsync(input, ct);
}

[ExtendObjectType(OperationTypeNames.Mutation)]
public sealed class CatalogoMutations
{
    [Authorize(Policy = Politicas.Administrador)]
    public Task<CategoriaDto> CrearCategoria(string nombre, [Service] ICategoriaService s, CancellationToken ct) =>
        s.CrearAsync(nombre, ct);

    [Authorize(Policy = Politicas.Administrador)]
    public Task<VehiculoDto> CrearVehiculo(VehiculoInput input, [Service] IVehiculoService s, CancellationToken ct) =>
        s.CrearAsync(input, ct);

    [Authorize(Policy = Politicas.Administrador)]
    public Task<VehiculoDto> ActualizarVehiculo(int id, VehiculoInput input, [Service] IVehiculoService s, CancellationToken ct) =>
        s.ActualizarAsync(id, input, ct);

    /// <summary>Disponible / Mantenimiento (con fecha fin opcional) / FueraDeServicio.</summary>
    [Authorize(Policy = Politicas.Administrador)]
    public Task<VehiculoDto> CambiarEstadoVehiculo(CambiarEstadoVehiculoInput input, [Service] IVehiculoService s,
        CancellationToken ct) => s.CambiarEstadoAsync(input, ct);

    /// <summary>Subida multipart (GraphQL multipart request spec).</summary>
    [Authorize(Policy = Politicas.Administrador)]
    public async Task<VehiculoDto> SubirFotoVehiculo(int id, IFile foto, [Service] IVehiculoService s, CancellationToken ct)
    {
        await using var stream = foto.OpenReadStream();
        return await s.SubirFotoAsync(id, stream, foto.Name, ct);
    }

    [Authorize(Policy = Politicas.Administrador)]
    public Task<bool> DesactivarVehiculo(int id, [Service] IVehiculoService s, CancellationToken ct) => s.DesactivarAsync(id, ct);
}

[ExtendObjectType(OperationTypeNames.Mutation)]
public sealed class ClienteMutations
{
    [Authorize(Policy = Politicas.Administrador)]
    public Task<ClienteDto> CrearCliente(ClienteInput input, [Service] IClienteService s, CancellationToken ct) =>
        s.CrearAsync(input, ct);

    [Authorize(Policy = Politicas.Administrador)]
    public Task<ClienteDto> ActualizarCliente(int id, ClienteInput input, [Service] IClienteService s, CancellationToken ct) =>
        s.ActualizarAsync(id, input, ct);

    [Authorize(Policy = Politicas.Administrador)]
    public Task<bool> DesactivarCliente(int id, [Service] IClienteService s, CancellationToken ct) => s.DesactivarAsync(id, ct);
}

[ExtendObjectType(OperationTypeNames.Mutation)]
public sealed class AlquilerMutations
{
    /// <summary>Administrador: indica clienteId (mostrador). Cliente: se ignora/valida y se usa su propia cuenta (portal).</summary>
    [Authorize(Policy = Politicas.Usuario)]
    public Task<OperacionAlquilerDto> CrearAlquiler(CrearAlquilerInput input, [Service] IAlquilerService s, CancellationToken ct) =>
        s.CrearAsync(input, ct);

    [Authorize(Policy = Politicas.Administrador)]
    public Task<OperacionAlquilerDto> ModificarAlquiler(ModificarAlquilerInput input, [Service] IAlquilerService s,
        CancellationToken ct) => s.ModificarAsync(input, ct);

    /// <summary>Sólo antes de la fecha de salida. El cliente puede cancelar los suyos.</summary>
    [Authorize(Policy = Politicas.Usuario)]
    public Task<OperacionAlquilerDto> CancelarAlquiler(int alquilerId, string? motivo, [Service] IAlquilerService s,
        CancellationToken ct) => s.CancelarAsync(alquilerId, motivo, ct);

    [Authorize(Policy = Politicas.Administrador)]
    public Task<OperacionAlquilerDto> RegistrarDevolucion(DevolucionInput input, [Service] IAlquilerService s,
        CancellationToken ct) => s.RegistrarDevolucionAsync(input, ct);
}
