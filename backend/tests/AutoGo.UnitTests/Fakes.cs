using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.UnitTests;

internal sealed class FakeClock(DateOnly hoy) : IClock
{
    public DateOnly Hoy { get; set; } = hoy;
    public DateTime AhoraUtc => Hoy.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);
    public DateTime InicioDelDiaUtc(DateOnly fecha) => fecha.ToDateTime(new TimeOnly(4, 0), DateTimeKind.Utc);
}

internal sealed class FakeUser : ICurrentUser
{
    public bool EstaAutenticado => UsuarioId.HasValue;
    public int? UsuarioId { get; init; }
    public Rol? Rol { get; init; }
    public int? ClienteId { get; init; }

    public static FakeUser Admin => new() { UsuarioId = 1, Rol = Domain.Enums.Rol.Administrador };
    public static FakeUser Cliente(int clienteId) => new() { UsuarioId = 50, Rol = Domain.Enums.Rol.Cliente, ClienteId = clienteId };
}

internal sealed class FakeHasher : IPasswordHasher
{
    public string Hash(string password) => "H:" + password;
    public bool Verificar(string password, string hash) => hash == "H:" + password;
}

internal sealed class FakeTokens : ITokenService
{
    public TokenEmitido Emitir(Usuario usuario) => new($"token-{usuario.Id}", DateTime.UtcNow.AddHours(1));
}

internal sealed class FakeEmail : IEmailSender
{
    public List<(string Para, string Cuerpo)> Enviados { get; } = [];
    public Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        Enviados.Add((para, cuerpoHtml));
        return Task.CompletedTask;
    }
}

internal sealed class FakeUsuarios : IUsuarioRepository
{
    public List<Usuario> Datos { get; } = [];
    public List<(int UsuarioId, string Hash)> Tokens { get; } = [];

    public Task<Usuario?> ObtenerPorCorreoAsync(string correo, CancellationToken ct = default) =>
        Task.FromResult(Datos.FirstOrDefault(u => u.Correo == correo));
    public Task<Usuario?> ObtenerPorIdAsync(int id, CancellationToken ct = default) =>
        Task.FromResult(Datos.FirstOrDefault(u => u.Id == id));
    public Task CrearTokenRecuperacionAsync(int usuarioId, string tokenHash, DateTime expiraEnUtc, CancellationToken ct = default)
    {
        Tokens.Add((usuarioId, tokenHash));
        return Task.CompletedTask;
    }
    public Task<int> CrearAdministradorAsync(string nombre, string correo, string passwordHash, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<(int UsuarioId, int ClienteId)> RegistrarClienteAsync(int? clienteExistenteId, Cliente cliente, string correo, string passwordHash, CancellationToken ct = default) => throw new NotImplementedException();
    public Task ActualizarPasswordAsync(int usuarioId, string passwordHash, bool debeCambiar, CancellationToken ct = default) => Task.CompletedTask;
    public Task<TokenRecuperacion?> ObtenerTokenVigenteAsync(string tokenHash, DateTime ahoraUtc, CancellationToken ct = default) => throw new NotImplementedException();
    public Task ConsumirTokenAsync(int tokenId, string passwordHash, DateTime ahoraUtc, CancellationToken ct = default) => throw new NotImplementedException();
}

internal sealed class FakeClientes : IClienteRepository
{
    public List<Cliente> Datos { get; } = [];
    public Task<Cliente?> ObtenerPorIdAsync(int id, CancellationToken ct = default) => Task.FromResult(Datos.FirstOrDefault(c => c.Id == id));
    public Task<Cliente?> ObtenerPorCedulaAsync(string cedula, CancellationToken ct = default) => Task.FromResult(Datos.FirstOrDefault(c => c.Cedula == cedula));
    public Task<IReadOnlyList<Cliente>> ListarAsync(string? texto, bool incluirInactivos, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<int> CrearAsync(Cliente cliente, CancellationToken ct = default) => throw new NotImplementedException();
    public Task ActualizarAsync(Cliente cliente, CancellationToken ct = default) => throw new NotImplementedException();
    public Task DesactivarAsync(int id, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<int> ContarAlquileresActivosAsync(int id, CancellationToken ct = default) => throw new NotImplementedException();
}

internal sealed class FakeVehiculos : IVehiculoRepository
{
    public List<Vehiculo> Datos { get; } = [];
    public Task<Vehiculo?> ObtenerPorIdAsync(int id, DateOnly hoy, CancellationToken ct = default) => Task.FromResult(Datos.FirstOrDefault(v => v.Id == id));
    public Task<IReadOnlyList<Vehiculo>> ListarAsync(DateOnly hoy, string? texto, int? categoriaId, bool incluirInactivos, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Vehiculo>>(Datos);
    public Task<bool> ExistePlacaAsync(string placa, int? excluirId, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<IReadOnlyList<Vehiculo>> ListarSinConflictoAsync(DateOnly inicio, DateOnly fin, DateOnly hoy, int? categoriaId, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<Vehiculo>>(Datos);
    public Task<int> CrearAsync(Vehiculo vehiculo, CancellationToken ct = default) => throw new NotImplementedException();
    public Task ActualizarAsync(Vehiculo vehiculo, CancellationToken ct = default) => throw new NotImplementedException();
    public Task CambiarEstadoAsync(Vehiculo vehiculo, CancellationToken ct = default) => throw new NotImplementedException();
    public Task ActualizarFotoAsync(int id, string fotoUrl, CancellationToken ct = default) => throw new NotImplementedException();
    public Task DesactivarAsync(int id, CancellationToken ct = default) => throw new NotImplementedException();
}

/// <summary>Simula los SPs: guarda lo que la API envía para poder verificarlo.</summary>
internal sealed class FakeAlquileres(FakeClientes clientes, FakeVehiculos vehiculos) : IAlquilerRepository
{
    public Dictionary<int, Alquiler> Datos { get; } = [];
    public Alquiler? UltimoCreado { get; private set; }
    public DateOnly? UltimoMantenimientoHasta { get; private set; }
    public (decimal Monto, MetodoPago? Metodo)? UltimoCargo { get; private set; }

    public Task<(int AlquilerId, int FacturaId)> CrearAsync(Alquiler alquiler, MetodoPago metodoPago, string conceptoFactura, DateOnly hoy, CancellationToken ct = default)
    {
        UltimoCreado = alquiler;
        var id = Datos.Count + 1;
        Datos[id] = Clonar(id, alquiler);
        return Task.FromResult((id, 100 + id));
    }

    public Task<Alquiler?> ObtenerPorIdAsync(int id, CancellationToken ct = default) => Task.FromResult(Datos.GetValueOrDefault(id));

    public Task<int?> RegistrarDevolucionAsync(Alquiler alquiler, MetodoPago? metodoPagoMora, string? conceptoMora, DateOnly mantenimientoHasta, CancellationToken ct = default)
    {
        UltimoMantenimientoHasta = mantenimientoHasta;
        UltimoCargo = (alquiler.MontoMora, metodoPagoMora);
        return Task.FromResult<int?>(alquiler.MontoMora > 0 ? 999 : null);
    }

    public Task<IReadOnlyList<Alquiler>> ListarAsync(FiltroAlquileres filtro, DateOnly hoy, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Alquiler>>(Datos.Values.Where(a => filtro.ClienteId is null || a.ClienteId == filtro.ClienteId).ToList());
    public Task<int?> ModificarAsync(Alquiler alquiler, decimal montoAjuste, MetodoPago? metodoPago, string? conceptoAjuste, DateOnly hoy, CancellationToken ct = default) => throw new NotImplementedException();
    public Task<int?> CancelarAsync(Alquiler alquiler, decimal montoReembolso, string? conceptoAjuste, MetodoPago? metodoPago, CancellationToken ct = default) => throw new NotImplementedException();

    public void Agregar(int id, Alquiler a) => Datos[id] = Clonar(id, a);

    private Alquiler Clonar(int id, Alquiler a)
    {
        var c = clientes.Datos.First(x => x.Id == a.ClienteId);
        var v = vehiculos.Datos.First(x => x.Id == a.VehiculoId);
        return Alquiler.Rehidratar(id, a.ClienteId, c.Nombre, c.Cedula, a.VehiculoId, v.Placa, v.Marca, v.Modelo,
            a.RegistradoPorUsuarioId, a.Canal, a.FechaInicio, a.FechaFinPactada, a.FechaDevolucion, a.PrecioDia, a.Dias,
            a.MontoBase, a.DiasMora, a.MontoMora, a.Estado, a.Observaciones, DateTime.UtcNow, a.MontoBase);
    }
}
