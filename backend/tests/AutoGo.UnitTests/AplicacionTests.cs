using AutoGo.Application.Abstractions;
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
    private readonly FakeClientes _clientes = new();

    public AuthServiceTests() =>
        _usuarios.Datos.Add(Usuario.Rehidratar(1, "Admin", "admin@autogo.com", "H:Clave123", Rol.Administrador, false, true, null));

    private AuthService Servicio() => ServicioComo(FakeUser.Admin);

    private AuthService ServicioComo(ICurrentUser actual) => new(_usuarios, _clientes, new FakeHasher(), new FakeTokens(), _email,
        new FakeClock(new DateOnly(2026, 9, 25)), actual, new OpcionesAplicacion());

    [Fact]
    public async Task Login_correcto_emite_token()
    {
        var r = await Servicio().LoginAsync(" ADMIN@autogo.com ", "Clave123");
        Assert.Equal("token-1", r.Token);
        Assert.Equal(Rol.Administrador, r.Usuario.Rol);
    }

    [Fact]
    public async Task Login_correcto_registra_el_ultimo_acceso()
    {
        await Servicio().LoginAsync("admin@autogo.com", "Clave123");
        Assert.Equal(new DateOnly(2026, 9, 25), DateOnly.FromDateTime(_usuarios.Datos.Single(u => u.Id == 1).UltimoAccesoUtc!.Value));
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

    private static RegistroClienteInput Registro(string correo) =>
        new("Luis", correo, "Clave2026", "00145678901", null, null);

    [Fact]
    public async Task Registro_con_cedula_de_mostrador_y_correo_distinto_se_rechaza()
    {
        _clientes.Datos.Add(Cliente.Rehidratar(11, null, "Luis", "001-4567890-1", "luis@mail.com", null, null, true, DateTime.UtcNow));

        var ex = await Assert.ThrowsAsync<ConflictException>(() => Servicio().RegistrarClienteAsync(Registro("otro@mail.com")));

        Assert.Equal("CLIENTE_EXISTENTE", ex.Code);
        Assert.Null(_usuarios.UltimoClienteVinculado);
    }

    [Fact]
    public async Task CrearAdministrador_respeta_el_perfil_solicitado()
    {
        var u = await Servicio().CrearAdministradorAsync(new CrearAdministradorInput("Pat", "pat@autogo.com", "Clave2026", Rol.Operador));
        Assert.Equal(Rol.Operador, u.Rol);
    }

    [Fact]
    public async Task Operador_no_puede_crear_otro_superadministrador()
    {
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() => ServicioComo(FakeUser.Operador)
            .CrearAdministradorAsync(new CrearAdministradorInput("Pat", "pat@autogo.com", "Clave2026", Rol.Administrador)));
        Assert.NotNull(ex);
    }

    [Fact]
    public async Task Operador_si_puede_crear_otro_operador()
    {
        var u = await ServicioComo(FakeUser.Operador)
            .CrearAdministradorAsync(new CrearAdministradorInput("Pat", "pat@autogo.com", "Clave2026", Rol.Operador));
        Assert.Equal(Rol.Operador, u.Rol);
    }

    [Fact]
    public async Task ListarAdministradores_incluye_operadores_y_excluye_clientes()
    {
        _usuarios.Datos.Add(Usuario.Rehidratar(2, "Pat", "pat@autogo.com", "H:Clave2026", Rol.Operador, false, true, null));
        _usuarios.Datos.Add(Usuario.Rehidratar(3, "Cliente", "cliente@mail.com", "H:Clave2026", Rol.Cliente, false, true, 1));

        var lista = await Servicio().ListarAdministradoresAsync();

        Assert.Equal(2, lista.Count);
        Assert.DoesNotContain(lista, u => u.Rol == Rol.Cliente);
    }

    [Fact]
    public async Task Registro_con_cedula_de_mostrador_sin_correo_registrado_se_rechaza()
    {
        _clientes.Datos.Add(Cliente.Rehidratar(11, null, "Luis", "001-4567890-1", null, null, null, true, DateTime.UtcNow));

        var ex = await Assert.ThrowsAsync<ConflictException>(() => Servicio().RegistrarClienteAsync(Registro("luis@mail.com")));

        Assert.Equal("CLIENTE_EXISTENTE", ex.Code);
    }

    [Fact]
    public async Task Registro_con_cedula_de_mostrador_y_mismo_correo_vincula_la_cuenta()
    {
        _clientes.Datos.Add(Cliente.Rehidratar(11, null, "Luis", "001-4567890-1", "luis@mail.com", null, null, true, DateTime.UtcNow));

        var r = await Servicio().RegistrarClienteAsync(Registro("LUIS@mail.com"));

        Assert.Equal(11, _usuarios.UltimoClienteVinculado);
        Assert.Equal(11, r.Usuario.ClienteId);
    }

    [Fact]
    public async Task Registro_con_cedula_que_ya_tiene_cuenta_se_rechaza()
    {
        _clientes.Datos.Add(Cliente.Rehidratar(11, 50, "Luis", "001-4567890-1", "luis@mail.com", null, null, true, DateTime.UtcNow));

        var ex = await Assert.ThrowsAsync<ConflictException>(() => Servicio().RegistrarClienteAsync(Registro("luis@mail.com")));

        Assert.Equal("CEDULA_DUPLICADA", ex.Code);
    }
}

public class ParametrosServiceTests
{
    private readonly FakeParametros _parametros = new();
    private ParametrosService Servicio() => new(_parametros);

    [Fact]
    public async Task Actualizar_guarda_el_nuevo_valor()
    {
        var r = await Servicio().ActualizarComisionWalletGoAsync(85m);
        Assert.Equal(85m, r.ComisionWalletGo);
        Assert.Equal(85m, (await Servicio().ObtenerAsync()).ComisionWalletGo);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(100.01)]
    public async Task Actualizar_rechaza_valores_fuera_de_rango(decimal valor)
    {
        await Assert.ThrowsAsync<DomainException>(() => Servicio().ActualizarComisionWalletGoAsync(valor));
    }
}
