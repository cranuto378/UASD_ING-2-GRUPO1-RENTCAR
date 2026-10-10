using AutoGo.Api.Configuration;
using AutoGo.Api.GraphQL;
using AutoGo.Api.GraphQL.Mutations;
using AutoGo.Api.GraphQL.Queries;
using AutoGo.Infrastructure;
using AutoGo.Infrastructure.Storage;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------- Capas ----------
builder.Services
    .AddApplication(config)          // casos de uso + reglas de negocio
    .AddInfrastructure(config)       // Dapper/SPs, JWT, BCrypt, correo, archivos
    .AddAutenticacion(config);       // JWT bearer + políticas

// ---------- CORS para el frontend ----------
var origenes = config.GetSection("Cors:Origenes").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origenes).AllowAnyHeader().AllowAnyMethod()));

// ---------- GraphQL ----------
builder.Services
    .AddGraphQLServer()
    .AddAuthorization()
    .AddQueryType()
    .AddMutationType()
    .AddTypeExtension<CuentaQueries>()
    .AddTypeExtension<CatalogoQueries>()
    .AddTypeExtension<ClienteQueries>()
    .AddTypeExtension<AlquilerQueries>()
    .AddTypeExtension<FacturaQueries>()
    .AddTypeExtension<DashboardQueries>()
    .AddTypeExtension<CuentaMutations>()
    .AddTypeExtension<CatalogoMutations>()
    .AddTypeExtension<ClienteMutations>()
    .AddTypeExtension<AlquilerMutations>()
    .AddType<UploadType>()
    .AddFiltering()
    .AddSorting()
    .AddErrorFilter<ErrorFilter>()
    .ModifyRequestOptions(o => o.IncludeExceptionDetails = builder.Environment.IsDevelopment());

builder.Services.AddHealthChecks();

var app = builder.Build();

// ---------- Pipeline ----------
app.UseCors();

// Fotos de vehículos (/media/...)
var archivos = config.GetSection(OpcionesArchivos.Seccion).Get<OpcionesArchivos>() ?? new OpcionesArchivos();
var rutaMedia = System.IO.Path.GetFullPath(System.IO.Path.IsPathRooted(archivos.RutaRaiz)
    ? archivos.RutaRaiz : System.IO.Path.Combine(app.Environment.ContentRootPath, archivos.RutaRaiz));
Directory.CreateDirectory(rutaMedia);
app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(rutaMedia), RequestPath = archivos.UrlBase });

app.UseAuthentication();
app.UseAuthorization();

app.MapGraphQL("/graphql");   // En desarrollo, abrir /graphql en el navegador (Nitro IDE)
app.MapHealthChecks("/health");

app.Run();

public partial class Program;
