using AutoGo.Application.Abstractions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace AutoGo.Infrastructure.Storage;

public sealed class OpcionesArchivos
{
    public const string Seccion = "Archivos";
    /// <summary>Carpeta física donde se guardan (relativa al directorio de la app o absoluta).</summary>
    public string RutaRaiz { get; set; } = "wwwroot/media";
    /// <summary>Prefijo de URL con el que la API las sirve.</summary>
    public string UrlBase { get; set; } = "/media";
    public long TamanoMaximoBytes { get; set; } = 5 * 1024 * 1024;
}

/// <summary>Almacenamiento en disco. Para la nube basta otra implementación de IFileStorage (Blob, S3...).</summary>
public sealed class LocalFileStorage(IOptions<OpcionesArchivos> opciones, IHostEnvironment env) : IFileStorage
{
    public async Task<string> GuardarAsync(Stream contenido, string nombreArchivo, string carpeta, CancellationToken ct = default)
    {
        var o = opciones.Value;
        var nombre = Path.GetFileName(nombreArchivo);
        var directorio = Path.Combine(RaizAbsoluta(o), carpeta);
        Directory.CreateDirectory(directorio);

        var ruta = Path.Combine(directorio, nombre);
        await using (var destino = File.Create(ruta))
        {
            var buffer = new byte[81920];
            long total = 0;
            int leidos;
            while ((leidos = await contenido.ReadAsync(buffer, ct)) > 0)
            {
                total += leidos;
                if (total > o.TamanoMaximoBytes)
                {
                    await destino.DisposeAsync();
                    File.Delete(ruta);
                    throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido,
                        $"El archivo excede el tamaño máximo de {o.TamanoMaximoBytes / 1024 / 1024} MB.");
                }
                await destino.WriteAsync(buffer.AsMemory(0, leidos), ct);
            }
        }
        return $"{o.UrlBase.TrimEnd('/')}/{carpeta}/{Uri.EscapeDataString(nombre)}";
    }

    public Task EliminarAsync(string url, CancellationToken ct = default)
    {
        var o = opciones.Value;
        if (!url.StartsWith(o.UrlBase, StringComparison.OrdinalIgnoreCase)) return Task.CompletedTask;

        var relativa = Uri.UnescapeDataString(url[o.UrlBase.Length..].TrimStart('/'));
        var raiz = RaizAbsoluta(o);
        var ruta = Path.GetFullPath(Path.Combine(raiz, relativa));
        if (ruta.StartsWith(raiz, StringComparison.OrdinalIgnoreCase) && File.Exists(ruta))
            File.Delete(ruta);
        return Task.CompletedTask;
    }

    private string RaizAbsoluta(OpcionesArchivos o) =>
        Path.GetFullPath(Path.IsPathRooted(o.RutaRaiz) ? o.RutaRaiz : Path.Combine(env.ContentRootPath, o.RutaRaiz));
}
