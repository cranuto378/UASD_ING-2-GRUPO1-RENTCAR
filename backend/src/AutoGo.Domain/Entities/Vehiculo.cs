using AutoGo.Domain.Common;
using AutoGo.Domain.Enums;

namespace AutoGo.Domain.Entities;

public sealed class Vehiculo
{
    public int Id { get; private set; }
    public string Placa { get; private set; } = string.Empty;
    public int CategoriaId { get; private set; }
    public string Marca { get; private set; } = string.Empty;
    public string Modelo { get; private set; } = string.Empty;
    public int Anio { get; private set; }
    public decimal PrecioDia { get; private set; }
    public EstadoOperativo EstadoOperativo { get; private set; }
    public DateOnly? MantenimientoHasta { get; private set; }
    public string? FotoUrl { get; private set; }
    public bool Activo { get; private set; }

    // Proyección de lectura (viene de la consulta, no se persiste desde aquí)
    public string CategoriaNombre { get; private set; } = string.Empty;
    /// <summary>Alquiler activo que ya comenzó, si existe.</summary>
    public int? AlquilerActivoId { get; private set; }

    private Vehiculo() { }

    public static Vehiculo Crear(string? placa, int categoriaId, string? marca, string? modelo, int anio,
        decimal precioDia, DateOnly hoy)
    {
        var v = new Vehiculo { EstadoOperativo = EstadoOperativo.Disponible, Activo = true };
        v.AsignarDatos(placa, categoriaId, marca, modelo, anio, precioDia, hoy);
        return v;
    }

    public static Vehiculo Rehidratar(int id, string placa, int categoriaId, string categoriaNombre, string marca,
        string modelo, int anio, decimal precioDia, EstadoOperativo estado, DateOnly? mantenimientoHasta,
        string? fotoUrl, bool activo, int? alquilerActivoId) => new()
    {
        Id = id, Placa = placa, CategoriaId = categoriaId, CategoriaNombre = categoriaNombre, Marca = marca,
        Modelo = modelo, Anio = anio, PrecioDia = precioDia, EstadoOperativo = estado,
        MantenimientoHasta = mantenimientoHasta, FotoUrl = fotoUrl, Activo = activo, AlquilerActivoId = alquilerActivoId
    };

    public void Actualizar(string? placa, int categoriaId, string? marca, string? modelo, int anio,
        decimal precioDia, DateOnly hoy) => AsignarDatos(placa, categoriaId, marca, modelo, anio, precioDia, hoy);

    public string Descripcion => $"{Marca} {Modelo}";

    /// <summary>Estado visible, derivado. Reemplaza el campo 'estado' que antes se desincronizaba.</summary>
    public EstadoVehiculo EstadoActual(DateOnly hoy)
    {
        if (EstadoOperativo == EstadoOperativo.FueraDeServicio) return EstadoVehiculo.FueraDeServicio;
        if (AlquilerActivoId.HasValue) return EstadoVehiculo.Alquilado;
        if (EstadoOperativo == EstadoOperativo.Mantenimiento && !MantenimientoTerminado(hoy))
            return EstadoVehiculo.Mantenimiento;
        return EstadoVehiculo.Disponible;
    }

    /// <summary>
    /// ¿Puede entregarse en <paramref name="fechaInicio"/>? (el choque de fechas con otros
    /// alquileres lo garantiza la BD de forma atómica; aquí van las reglas operativas).
    /// </summary>
    public bool PuedeAlquilarseDesde(DateOnly fechaInicio)
    {
        if (!Activo || EstadoOperativo == EstadoOperativo.FueraDeServicio) return false;
        if (EstadoOperativo == EstadoOperativo.Mantenimiento)
            return MantenimientoHasta.HasValue && MantenimientoHasta.Value <= fechaInicio;
        return true;
    }

    public void AsegurarPuedeAlquilarseDesde(DateOnly fechaInicio)
    {
        if (!PuedeAlquilarseDesde(fechaInicio))
            throw new DomainException(CodigosError.VehiculoNoDisponible,
                $"El vehículo {Placa} no está disponible para la fecha {fechaInicio:dd/MM/yyyy}.");
    }

    public void EnviarAMantenimiento(DateOnly? hasta)
    {
        EstadoOperativo = EstadoOperativo.Mantenimiento;
        MantenimientoHasta = hasta;
    }

    public void MarcarDisponible()
    {
        EstadoOperativo = EstadoOperativo.Disponible;
        MantenimientoHasta = null;
    }

    public void MarcarFueraDeServicio()
    {
        EstadoOperativo = EstadoOperativo.FueraDeServicio;
        MantenimientoHasta = null;
    }

    private bool MantenimientoTerminado(DateOnly hoy) => MantenimientoHasta.HasValue && MantenimientoHasta.Value <= hoy;

    private void AsignarDatos(string? placa, int categoriaId, string? marca, string? modelo, int anio,
        decimal precioDia, DateOnly hoy)
    {
        Placa = Guard.Requerido(placa, "placa", 10).ToUpperInvariant().Replace(" ", string.Empty).Replace("-", string.Empty);
        if (categoriaId <= 0)
            throw new DomainException(CodigosError.DatoInvalido, "Debe indicar una categoría válida.");
        CategoriaId = categoriaId;
        Marca = Guard.Requerido(marca, "marca", 50);
        Modelo = Guard.Requerido(modelo, "modelo", 50);
        if (anio < 1950 || anio > hoy.Year + 1)
            throw new DomainException(CodigosError.DatoInvalido, $"El año debe estar entre 1950 y {hoy.Year + 1}.");
        Anio = anio;
        if (precioDia <= 0)
            throw new DomainException(CodigosError.DatoInvalido, "El precio por día debe ser mayor que cero.");
        PrecioDia = decimal.Round(precioDia, 2);
    }
}
