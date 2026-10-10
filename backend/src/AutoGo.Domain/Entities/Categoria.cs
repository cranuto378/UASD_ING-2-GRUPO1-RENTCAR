using AutoGo.Domain.Common;

namespace AutoGo.Domain.Entities;

public sealed class Categoria
{
    public int Id { get; private set; }
    public string Nombre { get; private set; } = string.Empty;
    public bool Activo { get; private set; }

    private Categoria() { }

    public static Categoria Crear(string? nombre) => new() { Nombre = Guard.Requerido(nombre, "nombre", 50), Activo = true };

    public static Categoria Rehidratar(int id, string nombre, bool activo) => new() { Id = id, Nombre = nombre, Activo = activo };
}
