namespace AutoGo.Domain.Services;

/// <summary>Días laborables para operaciones (mantenimiento post-devolución, etc.).</summary>
public sealed class CalendarioLaboral
{
    private readonly HashSet<DateOnly> _feriados;

    public CalendarioLaboral(IEnumerable<DateOnly>? feriados = null) => _feriados = new(feriados ?? []);

    public bool EsLaborable(DateOnly fecha) =>
        fecha.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday) && !_feriados.Contains(fecha);

    public DateOnly SiguienteDiaLaborable(DateOnly desde)
    {
        var d = desde.AddDays(1);
        while (!EsLaborable(d)) d = d.AddDays(1);
        return d;
    }
}
