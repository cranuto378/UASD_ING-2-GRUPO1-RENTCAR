using AutoGo.Data;
using AutoGo.Models;
using Microsoft.EntityFrameworkCore;

namespace AutoGo.GraphQL;

public class Query
{
    public string Hello() => "backend de AutoGo con GraphQL";

    public IQueryable<Categoria> GetCategorias([Service] AutoGoContext context)
        => context.Categorias;

    public IQueryable<Vehiculo> GetVehiculos(
        string? texto, int? categoriaId, bool incluirInactivos,
        [Service] AutoGoContext context)
    {
        var query = context.Vehiculos.Include(v => v.Categoria).AsQueryable();
        if (!incluirInactivos)
            query = query.Where(v => v.EstadoOperativo != "FUERA_DE_SERVICIO");
        if (!string.IsNullOrWhiteSpace(texto))
            query = query.Where(v => v.Marca.Contains(texto) || v.Modelo.Contains(texto) || v.Placa.Contains(texto));
        if (categoriaId.HasValue)
            query = query.Where(v => v.CategoriaId == categoriaId.Value);
        return query;
    }

    public Vehiculo? GetVehiculo(int id, [Service] AutoGoContext context)
        => context.Vehiculos.Include(v => v.Categoria).FirstOrDefault(v => v.Id == id);

    public IQueryable<Vehiculo> GetVehiculosDisponibles(
        DateTime fechaInicio, DateTime fechaFin, int? categoriaId,
        [Service] AutoGoContext context)
    {
        var query = context.Vehiculos
            .Include(v => v.Categoria)
            .Where(v => v.EstadoOperativo == "DISPONIBLE");
        if (categoriaId.HasValue)
            query = query.Where(v => v.CategoriaId == categoriaId.Value);
        query = query.Where(v => !context.Alquileres.Any(a =>
            a.VehiculoId == v.Id &&
            a.Estado == "ACTIVO" &&
            a.FechaInicio <= fechaFin &&
            a.FechaFin >= fechaInicio));
        return query;
    }

    public IQueryable<Cliente> GetClientes(string? texto, bool incluirInactivos, [Service] AutoGoContext context)
    {
        var query = context.Clientes.AsQueryable();
        if (!incluirInactivos)
            query = query.Where(c => c.Activo);
        if (!string.IsNullOrWhiteSpace(texto))
            query = query.Where(c => c.Nombre.Contains(texto) || c.Cedula.Contains(texto));
        return query;
    }

    public Cliente? GetCliente(int id, [Service] AutoGoContext context)
        => context.Clientes.FirstOrDefault(c => c.Id == id);

    public IQueryable<Alquiler> GetAlquileres(
        int? clienteId, int? vehiculoId, string? estado, bool soloVencidos,
        [Service] AutoGoContext context)
    {
        var query = context.Alquileres
            .Include(a => a.Cliente)
            .Include(a => a.Vehiculo)
            .AsQueryable();
        if (clienteId.HasValue) query = query.Where(a => a.ClienteId == clienteId.Value);
        if (vehiculoId.HasValue) query = query.Where(a => a.VehiculoId == vehiculoId.Value);
        if (!string.IsNullOrWhiteSpace(estado)) query = query.Where(a => a.Estado == estado);
        if (soloVencidos) query = query.Where(a => a.Estado == "ACTIVO" && a.FechaFin < DateTime.UtcNow);
        return query;
    }

    public Alquiler? GetAlquiler(int id, [Service] AutoGoContext context)
        => context.Alquileres.Include(a => a.Cliente).Include(a => a.Vehiculo).FirstOrDefault(a => a.Id == id);

    public IQueryable<Factura> GetFacturas(int? clienteId, int? alquilerId, [Service] AutoGoContext context)
    {
        var query = context.Facturas
            .Include(f => f.Cliente)
            .Include(f => f.Vehiculo)
            .AsQueryable();
        if (clienteId.HasValue) query = query.Where(f => f.ClienteId == clienteId.Value);
        if (alquilerId.HasValue) query = query.Where(f => f.AlquilerId == alquilerId.Value);
        return query;
    }

    public Factura? GetFactura(int id, [Service] AutoGoContext context)
        => context.Facturas
            .Include(f => f.Cliente)
            .Include(f => f.Vehiculo)
            .FirstOrDefault(f => f.Id == id);

    public Dashboard GetDashboard([Service] AutoGoContext context)
    {
        var hoy = DateTime.UtcNow.Date;
        return new Dashboard
        {
            TotalClientes = context.Clientes.Count(c => c.Activo),
            TotalVehiculos = context.Vehiculos.Count(),
            VehiculosDisponibles = context.Vehiculos.Count(v => v.EstadoOperativo == "DISPONIBLE"),
            VehiculosAlquilados = context.Vehiculos.Count(v => v.EstadoOperativo == "ALQUILADO"),
            VehiculosEnMantenimiento = context.Vehiculos.Count(v => v.EstadoOperativo == "MANTENIMIENTO"),
            VehiculosFueraDeServicio = context.Vehiculos.Count(v => v.EstadoOperativo == "FUERA_DE_SERVICIO"),
            AlquileresActivos = context.Alquileres.Count(a => a.Estado == "ACTIVO"),
            AlquileresVencidos = context.Alquileres.Count(a => a.Estado == "ACTIVO" && a.FechaFin < hoy),
            PendientesDevolucion = context.Alquileres.Count(a => a.Estado == "ACTIVO" && a.FechaFin <= hoy),
            IngresosTotales = context.Facturas.Sum(f => (decimal?)f.Monto) ?? 0,
            IngresosMes = context.Facturas
                .Where(f => f.FechaEmision.Month == DateTime.UtcNow.Month && f.FechaEmision.Year == DateTime.UtcNow.Year)
                .Sum(f => (decimal?)f.Monto) ?? 0
        };
    }
}

public class Dashboard
{
    public int TotalClientes { get; set; }
    public int TotalVehiculos { get; set; }
    public int VehiculosDisponibles { get; set; }
    public int VehiculosAlquilados { get; set; }
    public int VehiculosEnMantenimiento { get; set; }
    public int VehiculosFueraDeServicio { get; set; }
    public int AlquileresActivos { get; set; }
    public int AlquileresVencidos { get; set; }
    public int PendientesDevolucion { get; set; }
    public decimal IngresosTotales { get; set; }
    public decimal IngresosMes { get; set; }
}