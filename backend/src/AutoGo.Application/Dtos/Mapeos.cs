using AutoGo.Domain.Entities;

namespace AutoGo.Application.Dtos;

internal static class Mapeos
{
    public static UsuarioDto ToDto(this Usuario u) =>
        new(u.Id, u.Nombre, u.Correo, u.Rol, u.DebeCambiarPassword, u.ClienteId);

    public static ClienteDto ToDto(this Cliente c) =>
        new(c.Id, c.Nombre, c.Cedula, c.Correo, c.Telefono, c.LicenciaConducir, c.Activo, c.TieneCuenta, c.FechaCreacion);

    public static CategoriaDto ToDto(this Categoria c) => new(c.Id, c.Nombre);

    public static VehiculoDto ToDto(this Vehiculo v, DateOnly hoy) =>
        new(v.Id, v.Placa, v.CategoriaId, v.CategoriaNombre, v.Marca, v.Modelo, v.Anio, v.PrecioDia,
            v.EstadoOperativo, v.EstadoActual(hoy), v.MantenimientoHasta, v.FotoUrl, v.Activo);

    public static AlquilerDto ToDto(this Alquiler a, DateOnly hoy) =>
        new(a.Id, a.ClienteId, a.ClienteNombre, a.ClienteCedula, a.VehiculoId, a.Placa, $"{a.Marca} {a.Modelo}",
            a.Canal, a.FechaInicio, a.FechaFinPactada, a.FechaDevolucion, a.PrecioDia, a.Dias, a.MontoBase,
            a.DiasMora, a.MontoMora, a.MontoTotal, a.TotalFacturado, a.Estado, a.EstaVencido(hoy), a.DiasRetraso(hoy),
            a.Observaciones, a.FechaCreacion);

    public static FacturaDto ToDto(this Factura f) =>
        new(f.Id, f.AlquilerId, f.Tipo, f.Concepto, f.Monto, f.MetodoPago, f.FechaEmision, f.ClienteId, f.ClienteNombre,
            f.ClienteCedula, f.ClienteTelefono, f.ClienteCorreo, f.VehiculoId, f.Placa, $"{f.Marca} {f.Modelo}",
            f.CategoriaNombre, f.FechaInicio, f.FechaFinPactada, f.Dias, f.PrecioDia);
}
