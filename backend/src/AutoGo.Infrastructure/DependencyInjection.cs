using AutoGo.Application.Abstractions;
using AutoGo.Infrastructure.Email;
using AutoGo.Infrastructure.Persistence;
using AutoGo.Infrastructure.Persistence.Repositories;
using AutoGo.Infrastructure.Security;
using AutoGo.Infrastructure.Storage;
using AutoGo.Infrastructure.Time;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AutoGo.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Persistencia (Dapper + stored procedures)
        services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();
        services.AddSingleton<SpExecutor>();
        services.AddScoped<IUsuarioRepository, UsuarioRepository>();
        services.AddScoped<IClienteRepository, ClienteRepository>();
        services.AddScoped<ICategoriaRepository, CategoriaRepository>();
        services.AddScoped<IVehiculoRepository, VehiculoRepository>();
        services.AddScoped<IAlquilerRepository, AlquilerRepository>();
        services.AddScoped<IFacturaRepository, FacturaRepository>();
        services.AddScoped<IDashboardRepository, DashboardRepository>();

        // Seguridad
        services.Configure<OpcionesJwt>(configuration.GetSection(OpcionesJwt.Seccion));
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();

        // Reloj
        services.AddSingleton(TimeProvider.System);
        var zona = configuration["Negocio:ZonaHoraria"] ?? "America/Santo_Domingo";
        services.AddSingleton<IClock>(sp => new ZonaHorariaClock(sp.GetRequiredService<TimeProvider>(), zona));

        // Correo
        services.Configure<OpcionesEmail>(configuration.GetSection(OpcionesEmail.Seccion));
        if (string.Equals(configuration[$"{OpcionesEmail.Seccion}:Modo"], "Smtp", StringComparison.OrdinalIgnoreCase))
            services.AddSingleton<IEmailSender, SmtpEmailSender>();
        else
            services.AddSingleton<IEmailSender, LogEmailSender>();

        // Archivos
        services.Configure<OpcionesArchivos>(configuration.GetSection(OpcionesArchivos.Seccion));
        services.AddSingleton<IFileStorage, LocalFileStorage>();

        return services;
    }
}
