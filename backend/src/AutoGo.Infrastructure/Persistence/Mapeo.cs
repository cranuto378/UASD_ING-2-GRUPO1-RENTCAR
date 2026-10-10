using AutoGo.Domain.Entities;
using AutoGo.Domain.Enums;

namespace AutoGo.Infrastructure.Persistence;

internal static class Mapeo
{
    public static T ParseEnum<T>(string valor) where T : struct, System.Enum => System.Enum.Parse<T>(valor, ignoreCase: true);

    public static Usuario ToEntity(this UsuarioRow r) =>
        Usuario.Rehidratar(r.Id, r.Nombre, r.Correo, r.PasswordHash, ParseEnum<Rol>(r.Rol), r.DebeCambiarPassword, r.Activo, r.ClienteId);

    public static Cliente ToEntity(this ClienteRow r) =>
        Cliente.Rehidratar(r.Id, r.UsuarioId, r.Nombre, r.Cedula, r.Correo, r.Telefono, r.LicenciaConducir, r.Activo,
            r.FechaCreacion.Utc());

    public static Categoria ToEntity(this CategoriaRow r) => Categoria.Rehidratar(r.Id, r.Nombre, r.Activo);

    public static Vehiculo ToEntity(this VehiculoRow r) =>
        Vehiculo.Rehidratar(r.Id, r.Placa, r.CategoriaId, r.CategoriaNombre, r.Marca, r.Modelo, r.Anio, r.PrecioDia,
            ParseEnum<EstadoOperativo>(r.EstadoOperativo), r.MantenimientoHasta.ToDateOnly(), r.FotoUrl, r.Activo,
            r.AlquilerActivoId);

    public static Alquiler ToEntity(this AlquilerRow r) =>
        Alquiler.Rehidratar(r.Id, r.ClienteId, r.ClienteNombre, r.ClienteCedula, r.VehiculoId, r.Placa, r.Marca,
            r.Modelo, r.RegistradoPorUsuarioId, ParseEnum<CanalAlquiler>(r.Canal), r.FechaInicio.ToDateOnly(),
            r.FechaFinPactada.ToDateOnly(), r.FechaDevolucion.ToDateOnly(), r.PrecioDia, r.Dias, r.MontoBase,
            r.DiasMora, r.MontoMora, ParseEnum<EstadoAlquiler>(r.Estado), r.Observaciones, r.FechaCreacion.Utc(),
            r.TotalFacturado);

    public static Factura ToEntity(this FacturaRow r) =>
        Factura.Rehidratar(r.Id, r.AlquilerId, ParseEnum<TipoFactura>(r.Tipo), r.Concepto, r.Monto,
            r.MetodoPago is null ? null : ParseEnum<MetodoPago>(r.MetodoPago), r.FechaEmision.Utc(), r.ClienteId,
            r.ClienteNombre, r.ClienteCedula, r.ClienteTelefono, r.ClienteCorreo, r.VehiculoId, r.Placa, r.Marca,
            r.Modelo, r.CategoriaNombre, r.FechaInicio.ToDateOnly(), r.FechaFinPactada.ToDateOnly(), r.Dias, r.PrecioDia);
}
