using AutoGo.Application.Common;
using AutoGo.Application.Dtos;
using AutoGo.Application.Services;
using AutoGo.Domain.Common;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;
using AutoGo.Domain.Services;

namespace AutoGo.UnitTests;

public class AlquilerServiceTests
{
    private static readonly DateOnly Viernes = new(2026, 9, 25);

    private readonly FakeClientes _clientes = new();
    private readonly FakeVehiculos _vehiculos = new();
    private readonly FakeAlquileres _alquileres;
    private readonly FakeClock _clock = new(Viernes);

    public AlquilerServiceTests()
    {
        _alquileres = new FakeAlquileres(_clientes, _vehiculos);
        _clientes.Datos.Add(Cliente.Rehidratar(10, 50, "Ana", "001-3456789-0", null, null, null, true, DateTime.UtcNow));
        _clientes.Datos.Add(Cliente.Rehidratar(11, null, "Luis", "001-4567890-1", null, null, null, true, DateTime.UtcNow));
        _vehiculos.Datos.Add(Vehiculo.Rehidratar(1, "C789012", 1, "SUV", "Hyundai", "Tucson", 2022, 3200m,
            EstadoOperativo.Disponible, null, null, true, null));
    }

    private AlquilerService Servicio(FakeUser usuario) =>
        new(_alquileres, _vehiculos, _clientes, new PoliticaTarifas(new OpcionesTarifas()), new CalendarioLaboral(), usuario, _clock);

    [Fact]
    public async Task Cliente_alquila_para_si_mismo_por_portal()
    {
        var r = await Servicio(FakeUser.Cliente(10)).CrearAsync(
            new CrearAlquilerInput(null, 1, Viernes, Viernes.AddDays(3), MetodoPago.Tarjeta));

        Assert.Equal(10, _alquileres.UltimoCreado!.ClienteId);
        Assert.Equal(CanalAlquiler.Portal, _alquileres.UltimoCreado.Canal);
        Assert.Null(_alquileres.UltimoCreado.RegistradoPorUsuarioId);
        Assert.Equal(9600m, r.Alquiler.MontoBase);
        Assert.Equal(101, r.FacturaId);
    }

    [Fact]
    public async Task Cliente_no_puede_alquilar_a_nombre_de_otro()
    {
        await Assert.ThrowsAsync<ForbiddenException>(() => Servicio(FakeUser.Cliente(10)).CrearAsync(
            new CrearAlquilerInput(11, 1, Viernes, Viernes.AddDays(1), MetodoPago.Efectivo)));
    }

    [Fact]
    public async Task Administrador_debe_indicar_cliente_y_queda_registrado()
    {
        var svc = Servicio(FakeUser.Admin);
        await Assert.ThrowsAsync<DomainException>(() =>
            svc.CrearAsync(new CrearAlquilerInput(null, 1, Viernes, Viernes.AddDays(1), MetodoPago.Efectivo)));

        await svc.CrearAsync(new CrearAlquilerInput(11, 1, Viernes, Viernes.AddDays(1), MetodoPago.Efectivo));
        Assert.Equal(CanalAlquiler.Mostrador, _alquileres.UltimoCreado!.Canal);
        Assert.Equal(1, _alquileres.UltimoCreado.RegistradoPorUsuarioId);
    }

    [Fact]
    public async Task Cliente_no_ve_alquiler_ajeno()
    {
        await Servicio(FakeUser.Admin).CrearAsync(new CrearAlquilerInput(11, 1, Viernes, Viernes.AddDays(1), MetodoPago.Efectivo));
        await Assert.ThrowsAsync<ForbiddenException>(() => Servicio(FakeUser.Cliente(10)).ObtenerAsync(1));
    }

    [Fact]
    public async Task Devolucion_tardia_exige_metodo_de_pago_y_envia_a_mantenimiento_siguiente_dia_laborable()
    {
        var hace5 = Viernes.AddDays(-5);
        var alquiler = Alquiler.Nuevo(10, _vehiculos.Datos[0], 1, CanalAlquiler.Mostrador, hace5, Viernes.AddDays(-2),
            new Cotizacion(3200m, 3, 9600m));
        _alquileres.Agregar(1, alquiler);
        var svc = Servicio(FakeUser.Admin);

        var ex = await Assert.ThrowsAsync<DomainException>(() => svc.RegistrarDevolucionAsync(new DevolucionInput(1, null, null)));
        Assert.Equal(CodigosError.DatoInvalido, ex.Code);

        var r = await svc.RegistrarDevolucionAsync(new DevolucionInput(1, null, MetodoPago.Efectivo));
        Assert.Equal(999, r.FacturaId);
        Assert.Equal(2 * 3200m * 1.30m, _alquileres.UltimoCargo!.Value.Monto);
        Assert.Equal(new DateOnly(2026, 9, 28), _alquileres.UltimoMantenimientoHasta); // viernes → lunes
    }

    [Fact]
    public async Task No_se_alquila_vehiculo_en_mantenimiento()
    {
        _vehiculos.Datos[0].EnviarAMantenimiento(Viernes.AddDays(3));
        var ex = await Assert.ThrowsAsync<DomainException>(() => Servicio(FakeUser.Admin).CrearAsync(
            new CrearAlquilerInput(11, 1, Viernes, Viernes.AddDays(1), MetodoPago.Efectivo)));
        Assert.Equal(CodigosError.VehiculoNoDisponible, ex.Code);
    }
}

public class AuthServiceTests
{
    private readonly FakeUsuarios _usuarios = new();
    private readonly FakeEmail _email = new();

    public AuthServiceTests() =>
        _usuarios.Datos.Add(Usuario.Rehidratar(1, "Admin", "admin@autogo.com", "H:Clave123", Rol.Administrador, false, true, null));

    private AuthService Servicio() => new(_usuarios, new FakeClientes(), new FakeHasher(), new FakeTokens(), _email,
        new FakeClock(new DateOnly(2026, 9, 25)), FakeUser.Admin, new OpcionesAplicacion());

    [Fact]
    public async Task Login_correcto_emite_token()
    {
        var r = await Servicio().LoginAsync(" ADMIN@autogo.com ", "Clave123");
        Assert.Equal("token-1", r.Token);
        Assert.Equal(Rol.Administrador, r.Usuario.Rol);
    }

    [Fact]
    public async Task Login_incorrecto_no_revela_el_motivo()
    {
        var a = await Assert.ThrowsAsync<AuthenticationException>(() => Servicio().LoginAsync("admin@autogo.com", "mala"));
        var b = await Assert.ThrowsAsync<AuthenticationException>(() => Servicio().LoginAsync("nadie@autogo.com", "x"));
        Assert.Equal(a.Message, b.Message);
    }

    [Fact]
    public async Task Recuperacion_guarda_hash_y_envia_token_en_claro_solo_por_correo()
    {
        await Servicio().SolicitarRecuperacionAsync("admin@autogo.com");
        var (_, hash) = Assert.Single(_usuarios.Tokens);
        var (_, cuerpo) = Assert.Single(_email.Enviados);
        var token = Uri.UnescapeDataString(cuerpo.Split("token=")[1].Split('"')[0]);
        Assert.NotEqual(token, hash);
        Assert.Equal(AuthService.HashToken(token), hash);
    }

    [Fact]
    public async Task Recuperacion_con_correo_inexistente_no_falla_ni_envia()
    {
        await Servicio().SolicitarRecuperacionAsync("nadie@autogo.com");
        Assert.Empty(_email.Enviados);
    }
}
