using System.Text;
using AutoGo.Api.Security;
using AutoGo.Application.Abstractions;
using AutoGo.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AutoGo.Api.Configuration;

public static class AuthConfiguration
{
    public static IServiceCollection AddAutenticacion(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection(OpcionesJwt.Seccion).Get<OpcionesJwt>() ?? new OpcionesJwt();
        if (string.IsNullOrWhiteSpace(jwt.Clave) || jwt.Clave.Length < 32)
            throw new InvalidOperationException("Configure 'Jwt:Clave' con al menos 32 caracteres (user-secrets o variable de entorno Jwt__Clave).");

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Emisor,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audiencia,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Clave)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = JwtRegisteredClaimNames.Name,
                    RoleClaimType = ClaimsAutoGo.Rol
                };
            });

        services.AddAuthorization(o =>
        {
            o.AddPolicy(Politicas.Sesion, p => p.RequireAuthenticatedUser());
            o.AddPolicy(Politicas.Usuario, p => p.RequireAuthenticatedUser().RequireClaim(ClaimsAutoGo.DebeCambiarPassword, "false"));
            o.AddPolicy(Politicas.Administrador, p => p.RequireAuthenticatedUser()
                .RequireClaim(ClaimsAutoGo.DebeCambiarPassword, "false").RequireRole("Administrador"));
            o.AddPolicy(Politicas.Cliente, p => p.RequireAuthenticatedUser()
                .RequireClaim(ClaimsAutoGo.DebeCambiarPassword, "false").RequireRole("Cliente"));
        });

        return services;
    }
}
