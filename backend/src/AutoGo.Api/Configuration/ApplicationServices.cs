using AutoGo.Application.Common;
using AutoGo.Application.Services;
using AutoGo.Domain.Services;

namespace AutoGo.Api.Configuration;

public static class ApplicationServices
{
    /// <summary>
    /// Registra los casos de uso. Vive en la API (composition root) para que Application
    /// no dependa de ningún framework.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        var tarifas = configuration.GetSection("Tarifas").Get<OpcionesTarifas>() ?? new OpcionesTarifas();
        var app = configuration.GetSection("Aplicacion").Get<OpcionesAplicacion>() ?? new OpcionesAplicacion();
        var feriados = (configuration.GetSection("Negocio:Feriados").Get<string[]>() ?? [])
            .Select(DateOnly.Parse);

        services.AddSingleton(tarifas);
        services.AddSingleton(app);
        services.AddSingleton<PoliticaTarifas>();
        services.AddSingleton(new CalendarioLaboral(feriados));

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IClienteService, ClienteService>();
        services.AddScoped<ICategoriaService, CategoriaService>();
        services.AddScoped<IVehiculoService, VehiculoService>();
        services.AddScoped<IAlquilerService, AlquilerService>();
        services.AddScoped<IFacturaService, FacturaService>();
        services.AddScoped<IDashboardService, DashboardService>();
        return services;
    }
}
