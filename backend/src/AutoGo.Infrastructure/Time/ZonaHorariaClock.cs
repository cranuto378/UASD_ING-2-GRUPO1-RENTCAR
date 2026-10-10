using AutoGo.Application.Abstractions;

namespace AutoGo.Infrastructure.Time;

/// <summary>Reloj del negocio en la zona horaria configurada (por defecto República Dominicana).</summary>
public sealed class ZonaHorariaClock(TimeProvider tiempo, string zonaHoraria = "America/Santo_Domingo") : IClock
{
    private readonly TimeZoneInfo _zona = TimeZoneInfo.FindSystemTimeZoneById(zonaHoraria);

    public DateTime AhoraUtc => tiempo.GetUtcNow().UtcDateTime;

    public DateOnly Hoy => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(AhoraUtc, _zona));

    public DateTime InicioDelDiaUtc(DateOnly fecha) =>
        TimeZoneInfo.ConvertTimeToUtc(fecha.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), _zona);
}
