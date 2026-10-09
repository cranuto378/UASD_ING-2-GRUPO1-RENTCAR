using Microsoft.EntityFrameworkCore;
using AutoGo.Models;

namespace AutoGo.Data;

public class AutoGoContext : DbContext
{
    public AutoGoContext(DbContextOptions<AutoGoContext> options) : base(options) { }

    public DbSet<Categoria> Categorias { get; set; }
    public DbSet<Vehiculo> Vehiculos { get; set; }
    public DbSet<Usuario> Usuarios { get; set; }
    public DbSet<Cliente> Clientes { get; set; }
    public DbSet<Alquiler> Alquileres { get; set; }    
    public DbSet<Factura> Facturas { get; set; }        

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Vehiculo>().HasIndex(v => v.Placa).IsUnique();
        modelBuilder.Entity<Usuario>().HasIndex(u => u.Correo).IsUnique();
        modelBuilder.Entity<Cliente>().HasIndex(c => c.Cedula).IsUnique();

        modelBuilder.Entity<Vehiculo>().Property(v => v.PrecioDia).HasPrecision(10, 2);
        modelBuilder.Entity<Alquiler>().Property(a => a.MontoTotal).HasPrecision(10, 2);
        modelBuilder.Entity<Alquiler>().Property(a => a.MontoMora).HasPrecision(10, 2);
        modelBuilder.Entity<Factura>().Property(f => f.Monto).HasPrecision(10, 2);

        // desactivar el cascade delete para evitar el error de ciclos
        modelBuilder.Entity<Alquiler>().HasOne(a => a.Cliente).WithMany(c => c.Alquileres).HasForeignKey(a => a.ClienteId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Alquiler>().HasOne(a => a.Vehiculo).WithMany().HasForeignKey(a => a.VehiculoId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Factura>().HasOne(f => f.Alquiler).WithMany(a => a.Facturas).HasForeignKey(f => f.AlquilerId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Factura>().HasOne(f => f.Cliente).WithMany().HasForeignKey(f => f.ClienteId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Factura>().HasOne(f => f.Vehiculo).WithMany().HasForeignKey(f => f.VehiculoId).OnDelete(DeleteBehavior.Restrict);
    }
}