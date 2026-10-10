using System.Security.Claims;
using AutoGo.Application.Abstractions;
using AutoGo.Domain.Enums;
using AutoGo.Infrastructure.Security;
using Microsoft.IdentityModel.JsonWebTokens;

namespace AutoGo.Api.Security;

/// <summary>Adapta el JWT de la petición HTTP al puerto <see cref="ICurrentUser"/> de la capa de aplicación.</summary>
public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool EstaAutenticado => Principal?.Identity?.IsAuthenticated == true;

    public int? UsuarioId => Entero(JwtRegisteredClaimNames.Sub);

    public Rol? Rol => Enum.TryParse<Rol>(Principal?.FindFirstValue(ClaimsAutoGo.Rol), out var rol) ? rol : null;

    public int? ClienteId => Entero(ClaimsAutoGo.ClienteId);

    private int? Entero(string claim) =>
        EstaAutenticado && int.TryParse(Principal!.FindFirstValue(claim), out var valor) ? valor : null;
}
