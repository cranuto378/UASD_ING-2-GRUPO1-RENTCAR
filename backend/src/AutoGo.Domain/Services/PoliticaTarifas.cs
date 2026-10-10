using AutoGo.Domain.Common;

namespace AutoGo.Domain.Services;

public sealed record Cotizacion(decimal PrecioDia, int Dias, decimal Total);

public sealed record CargoMora(int Dias, decimal Monto)
{
    public static readonly CargoMora Ninguno = new(0, 0m);
}

/// <summary>Parámetros de tarifa. Se configuran en appsettings (sección "Tarifas").</summary>
public sealed class OpcionesTarifas
{
    /// <summary>
    /// false (recomendado): se cobran periodos de 24 h → del 10 al 12 = 2 días.
    /// true: comportamiento del sistema anterior → del 10 al 12 = 3 días.
    /// </summary>
    public bool ContarDiaDeEntrega { get; set; }

    /// <summary>Multiplicador del precio diario por cada día de retraso (sistema anterior: 1.30).</summary>
    public decimal FactorMora { get; set; } = 1.30m;

    /// <summary>Máximo de días que puede durar un alquiler.</summary>
    public int DiasMaximos { get; set; } = 90;
}

/// <summary>Única fuente de verdad para calcular días, montos y mora.</summary>
public sealed class PoliticaTarifas
{
    private readonly OpcionesTarifas _opciones;

    public PoliticaTarifas(OpcionesTarifas opciones) => _opciones = opciones;

    public int CalcularDias(DateOnly inicio, DateOnly fin)
    {
        var dias = fin.DayNumber - inicio.DayNumber + (_opciones.ContarDiaDeEntrega ? 1 : 0);
        return Math.Max(1, dias);
    }

    public void ValidarRango(DateOnly inicio, DateOnly fin, DateOnly hoy)
    {
        if (inicio < hoy)
            throw new DomainException(CodigosError.FechasInvalidas, "La fecha de salida no puede estar en el pasado.");
        ValidarRangoSinHoy(inicio, fin);
    }

    public void ValidarRangoSinHoy(DateOnly inicio, DateOnly fin)
    {
        var minimo = _opciones.ContarDiaDeEntrega ? inicio : inicio.AddDays(1);
        if (fin < minimo)
            throw new DomainException(CodigosError.FechasInvalidas,
                "La fecha de entrega debe ser posterior a la fecha de salida.");
        if (CalcularDias(inicio, fin) > _opciones.DiasMaximos)
            throw new DomainException(CodigosError.FechasInvalidas,
                $"Un alquiler no puede exceder {_opciones.DiasMaximos} días.");
    }

    public Cotizacion Cotizar(decimal precioDia, DateOnly inicio, DateOnly fin)
    {
        var dias = CalcularDias(inicio, fin);
        return new Cotizacion(precioDia, dias, decimal.Round(precioDia * dias, 2, MidpointRounding.AwayFromZero));
    }

    public CargoMora CalcularMora(decimal precioDia, DateOnly fechaFinPactada, DateOnly fechaDevolucion)
    {
        var dias = fechaDevolucion.DayNumber - fechaFinPactada.DayNumber;
        if (dias <= 0) return CargoMora.Ninguno;
        var monto = decimal.Round(dias * precioDia * _opciones.FactorMora, 2, MidpointRounding.AwayFromZero);
        return new CargoMora(dias, monto);
    }
}
