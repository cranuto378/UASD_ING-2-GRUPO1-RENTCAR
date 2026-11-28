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
        if (string.IsNullOrWhiteSpace(nombre))
            throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "El nombre del archivo es obligatorio.");

        var extension = Path.GetExtension(nombre).ToLowerInvariant();
        if (!".jpg".Equals(extension) && !".jpeg".Equals(extension) && !".png".Equals(extension) && !".webp".Equals(extension))
            throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido,
                "Formato de imagen no permitido (use jpg, jpeg, png o webp).");

        var bytes = await LeerTodoAsync(contenido, o.TamanoMaximoBytes, ct);
        ValidarImagen(bytes, extension);

        var directorio = Path.Combine(RaizAbsoluta(o), carpeta);
        Directory.CreateDirectory(directorio);

        var ruta = Path.Combine(directorio, nombre);
        await File.WriteAllBytesAsync(ruta, bytes, ct);
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

    private static async Task<byte[]> LeerTodoAsync(Stream contenido, long tamanoMaximoBytes, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        var buffer = new byte[81920];
        long total = 0;
        int leidos;
        while ((leidos = await contenido.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            total += leidos;
            if (total > tamanoMaximoBytes)
                throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido,
                    $"El archivo excede el tamaño máximo de {tamanoMaximoBytes / 1024 / 1024} MB.");

            await ms.WriteAsync(buffer.AsMemory(0, leidos), ct);
        }

        return ms.ToArray();
    }

    private static void ValidarImagen(byte[] bytes, string extension)
    {
        if (bytes.Length < 16)
            throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "La imagen está corrupta o vacía.");

        if (extension is ".jpg" or ".jpeg")
        {
            if (bytes[0] != 0xFF || bytes[1] != 0xD8 || bytes[2] != 0xFF)
                throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "La imagen JPG no es válida.");
            return;
        }

        if (extension == ".png")
        {
            if (bytes[0] != 0x89 || bytes[1] != 0x50 || bytes[2] != 0x4E || bytes[3] != 0x47)
                throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "La imagen PNG no es válida.");
            return;
        }

        if (extension == ".webp")
        {
            if (bytes[0] != 0x52 || bytes[1] != 0x49 || bytes[2] != 0x46 || bytes[3] != 0x46)
                throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido, "La imagen WEBP no es válida.");
            return;
        }

        throw new Domain.Common.DomainException(Domain.Common.CodigosError.DatoInvalido,
            "Formato de imagen no permitido (use jpg, jpeg, png o webp).");
    }

    private string RaizAbsoluta(OpcionesArchivos o) =>
        Path.GetFullPath(Path.IsPathRooted(o.RutaRaiz) ? o.RutaRaiz : Path.Combine(env.ContentRootPath, o.RutaRaiz));
}
