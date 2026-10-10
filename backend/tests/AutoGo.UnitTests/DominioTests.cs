using AutoGo.Domain.Common;
using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;
using AutoGo.Domain.Services;

namespace AutoGo.UnitTests;

public class PoliticaTarifasTests
{
    private static readonly DateOnly D10 = new(2026, 10, 10);

    [Fact]
    public void Por_defecto_cobra_periodos_de_24h()
    {
        var p = new PoliticaTarifas(new OpcionesTarifas());
        Assert.Equal(2, p.CalcularDias(D10, D10.AddDays(2)));
    }

    [Fact]
    public void Modo_legado_cuenta_el_dia_de_entrega()
    {
        var p = new PoliticaTarifas(new OpcionesTarifas { ContarDiaDeEntrega = true });
        Assert.Equal(3, p.CalcularDias(D10, D10.AddDays(2)));
    }

    [Fact]
    public void Cotizar_multiplica_precio_por_dias()
    {
        var c = new PoliticaTarifas(new OpcionesTarifas()).Cotizar(3200m, D10, D10.AddDays(3));
        Assert.Equal(3, c.Dias);
        Assert.Equal(9600m, c.Total);
    }

    [Fact]
    public void Mora_aplica_factor_por_dia_de_retraso()
    {
        // Caso real migrado: alquiler #7, 10 días tarde, RD$2,000/día → 26,000
        var mora = new PoliticaTarifas(new OpcionesTarifas()).CalcularMora(2000m, new DateOnly(2026, 4, 22), new DateOnly(2026, 5, 2));
        Assert.Equal(10, mora.Dias);
        Assert.Equal(26000m, mora.Monto);
    }

    [Fact]
    public void Sin_mora_si_entrega_a_tiempo_o_antes()
    {
        var p = new PoliticaTarifas(new OpcionesTarifas());
        Assert.Equal(CargoMora.Ninguno, p.CalcularMora(2000m, D10, D10));
        Assert.Equal(CargoMora.Ninguno, p.CalcularMora(2000m, D10, D10.AddDays(-1)));
    }

    [Fact]
    public void Rango_invalido_lanza_error()
    {
        var p = new PoliticaTarifas(new OpcionesTarifas { DiasMaximos = 30 });
        Assert.Throws<DomainException>(() => p.ValidarRango(D10, D10, D10));             // mismo día
        Assert.Throws<DomainException>(() => p.ValidarRango(D10.AddDays(-1), D10.AddDays(2), D10)); // pasado
        Assert.Throws<DomainException>(() => p.ValidarRango(D10, D10.AddDays(31), D10));  // excede máximo
        p.ValidarRango(D10, D10.AddDays(1), D10);
    }
}

public class CalendarioLaboralTests
{
    [Fact]
    public void Viernes_pasa_a_lunes()
    {
        var viernes = new DateOnly(2026, 9, 25);
        Assert.Equal(new DateOnly(2026, 9, 28), new CalendarioLaboral().SiguienteDiaLaborable(viernes));
    }

    [Fact]
    public void Salta_feriados()
    {
        var cal = new CalendarioLaboral([new DateOnly(2026, 9, 28)]);
        Assert.Equal(new DateOnly(2026, 9, 29), cal.SiguienteDiaLaborable(new DateOnly(2026, 9, 25)));
    }
}

public class VehiculoTests
{
    private static readonly DateOnly Hoy = new(2026, 10, 10);

    private static Vehiculo V(EstadoOperativo estado, DateOnly? hasta = null, int? alquilerActivo = null) =>
        Vehiculo.Rehidratar(1, "A123456", 1, "SUV", "Kia", "Rio", 2023, 1800m, estado, hasta, null, true, alquilerActivo);

    [Fact]
    public void Alquilado_se_deriva_del_alquiler_activo()
    {
        Assert.Equal(EstadoVehiculo.Alquilado, V(EstadoOperativo.Disponible, alquilerActivo: 5).EstadoActual(Hoy));
        Assert.Equal(EstadoVehiculo.Disponible, V(EstadoOperativo.Disponible).EstadoActual(Hoy));
    }

    [Fact]
    public void Mantenimiento_vencido_se_muestra_disponible()
    {
        Assert.Equal(EstadoVehiculo.Disponible, V(EstadoOperativo.Mantenimiento, Hoy).EstadoActual(Hoy));
        Assert.Equal(EstadoVehiculo.Mantenimiento, V(EstadoOperativo.Mantenimiento, Hoy.AddDays(1)).EstadoActual(Hoy));
        Assert.Equal(EstadoVehiculo.Mantenimiento, V(EstadoOperativo.Mantenimiento).EstadoActual(Hoy)); // sin fecha fin
    }

    [Fact]
    public void Puede_reservarse_para_despues_del_mantenimiento()
    {
        var v = V(EstadoOperativo.Mantenimiento, Hoy.AddDays(2));
        Assert.False(v.PuedeAlquilarseDesde(Hoy));
        Assert.True(v.PuedeAlquilarseDesde(Hoy.AddDays(2)));
        Assert.False(V(EstadoOperativo.FueraDeServicio).PuedeAlquilarseDesde(Hoy.AddDays(30)));
    }

    [Fact]
    public void Normaliza_placa_y_valida_precio()
    {
        var v = Vehiculo.Crear(" c-123 456", 1, "Kia", "Rio", 2023, 1800m, Hoy);
        Assert.Equal("C123456", v.Placa);
        Assert.Throws<DomainException>(() => Vehiculo.Crear("C1", 1, "Kia", "Rio", 2023, 0m, Hoy));
    }
}

public class AlquilerTests
{
    private static readonly DateOnly Hoy = new(2026, 10, 10);
    private static readonly Vehiculo Veh =
        Vehiculo.Rehidratar(1, "A1", 1, "SUV", "Kia", "Rio", 2023, 1000m, EstadoOperativo.Disponible, null, null, true, null);

    private static Alquiler Nuevo(DateOnly inicio, DateOnly fin) =>
        Alquiler.Nuevo(1, Veh, 1, CanalAlquiler.Mostrador, inicio, fin, new Cotizacion(1000m, fin.DayNumber - inicio.DayNumber, 1000m * (fin.DayNumber - inicio.DayNumber)));

    [Fact]
    public void No_se_cancela_si_ya_comenzo()
    {
        var a = Nuevo(Hoy, Hoy.AddDays(3));
        var ex = Assert.Throws<DomainException>(() => a.Cancelar("x", Hoy));
        Assert.Equal(CodigosError.CancelacionNoPermitida, ex.Code);
    }

    [Fact]
    public void Cancelar_antes_de_salida_reembolsa_total()
    {
        var a = Nuevo(Hoy.AddDays(5), Hoy.AddDays(8));
        Assert.Equal(3000m, a.Cancelar(null, Hoy));
        Assert.Equal(EstadoAlquiler.Cancelado, a.Estado);
    }

    [Fact]
    public void Devolucion_registra_mora_y_completa()
    {
        var a = Nuevo(Hoy.AddDays(-5), Hoy.AddDays(-2));
        Assert.True(a.EstaVencido(Hoy));
        Assert.Equal(2, a.DiasRetraso(Hoy));
        a.RegistrarDevolucion(Hoy, new CargoMora(2, 2600m));
        Assert.Equal(EstadoAlquiler.Completado, a.Estado);
        Assert.Equal(3000m + 2600m, a.MontoTotal);
        Assert.Throws<DomainException>(() => a.RegistrarDevolucion(Hoy, CargoMora.Ninguno)); // ya no está activo
    }

    [Fact]
    public void Modificar_devuelve_diferencia_a_facturar()
    {
        var a = Nuevo(Hoy.AddDays(1), Hoy.AddDays(3));
        var ajuste = a.Modificar(Veh, Hoy.AddDays(1), Hoy.AddDays(5), new Cotizacion(1000m, 4, 4000m), Hoy);
        Assert.Equal(2000m, ajuste);
    }
}

public class ClienteTests
{
    [Theory]
    [InlineData("00112345678")]
    [InlineData("001-1234567-8")]
    [InlineData(" 001 1234567 8 ")]
    public void Normaliza_cedula(string entrada) => Assert.Equal("001-1234567-8", Cliente.NormalizarCedula(entrada));

    [Fact]
    public void Rechaza_cedula_incompleta() => Assert.Throws<DomainException>(() => Cliente.NormalizarCedula("001-123"));

    [Fact]
    public void Rechaza_correo_invalido() => Assert.Throws<DomainException>(() => Usuario.NormalizarCorreo("angelino@peraltino"));
}
