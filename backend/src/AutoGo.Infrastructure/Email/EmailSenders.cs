using System.Net;
using System.Net.Mail;
using AutoGo.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AutoGo.Infrastructure.Email;

public sealed class OpcionesEmail
{
    public const string Seccion = "Email";
    /// <summary>"Log" (desarrollo: sólo escribe en el log) o "Smtp".</summary>
    public string Modo { get; set; } = "Log";
    public string Host { get; set; } = string.Empty;
    public int Puerto { get; set; } = 587;
    public bool UsarSsl { get; set; } = true;
    public string Usuario { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Remitente { get; set; } = "no-reply@autogo.com";
}

/// <summary>Desarrollo: no envía nada, deja el correo en el log.</summary>
public sealed class LogEmailSender(ILogger<LogEmailSender> logger) : IEmailSender
{
    public Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        logger.LogInformation("[Email simulado] Para: {Para} | Asunto: {Asunto}\n{Cuerpo}", para, asunto, cuerpoHtml);
        return Task.CompletedTask;
    }
}

public sealed class SmtpEmailSender(IOptions<OpcionesEmail> opciones) : IEmailSender
{
    public async Task EnviarAsync(string para, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        var o = opciones.Value;
        using var cliente = new SmtpClient(o.Host, o.Puerto)
        {
            EnableSsl = o.UsarSsl,
            Credentials = string.IsNullOrEmpty(o.Usuario) ? null : new NetworkCredential(o.Usuario, o.Password)
        };
        using var mensaje = new MailMessage(o.Remitente, para, asunto, cuerpoHtml) { IsBodyHtml = true };
        await cliente.SendMailAsync(mensaje, ct);
    }
}
