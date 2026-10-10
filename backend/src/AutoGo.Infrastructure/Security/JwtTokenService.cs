using System.Security.Claims;
using System.Text;
using AutoGo.Application.Abstractions;
using AutoGo.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AutoGo.Infrastructure.Security;

public sealed class OpcionesJwt
{
    public const string Seccion = "Jwt";
    public string Emisor { get; set; } = "AutoGo";
    public string Audiencia { get; set; } = "AutoGo.Frontend";
    /// <summary>Clave HMAC de al menos 32 caracteres. En producción: variable de entorno / secreto, nunca en el repo.</summary>
    public string Clave { get; set; } = string.Empty;
    public int MinutosExpiracion { get; set; } = 480;
}

public static class ClaimsAutoGo
{
    public const string Rol = "role";
    public const string ClienteId = "cliente_id";
    public const string DebeCambiarPassword = "debe_cambiar_password";
}

public sealed class JwtTokenService(IOptions<OpcionesJwt> opciones, IClock clock) : ITokenService
{
    public TokenEmitido Emitir(Usuario usuario)
    {
        var o = opciones.Value;
        var expira = clock.AhoraUtc.AddMinutes(o.MinutosExpiracion);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, usuario.Correo),
            new(JwtRegisteredClaimNames.Name, usuario.Nombre),
            new(ClaimsAutoGo.Rol, usuario.Rol.ToString()),
            new(ClaimsAutoGo.DebeCambiarPassword, usuario.DebeCambiarPassword ? "true" : "false"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };
        if (usuario.ClienteId is int clienteId)
            claims.Add(new Claim(ClaimsAutoGo.ClienteId, clienteId.ToString()));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = o.Emisor,
            Audience = o.Audiencia,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = clock.AhoraUtc,
            NotBefore = clock.AhoraUtc,
            Expires = expira,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.Clave)), SecurityAlgorithms.HmacSha256)
        };

        return new TokenEmitido(new JsonWebTokenHandler().CreateToken(descriptor), expira);
    }
}
