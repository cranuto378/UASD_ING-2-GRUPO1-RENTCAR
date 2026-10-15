# AutoGo — API GraphQL de renta de vehículos

Refactorización de *Sistema_ADV G1RentaCar* (WinForms + MySQL) a una API web **GraphQL** con **arquitectura limpia**, **SQL Server** y acceso a datos con **Dapper + stored procedures**.

> Hallazgos del sistema anterior, decisiones y temas pendientes: **[docs/ANALISIS.md](docs/ANALISIS.md)**

## Arquitectura

```
AutoGo.Api ───────────► AutoGo.Application ───► AutoGo.Domain
   │  (GraphQL, JWT,          (casos de uso,          (entidades, reglas:
   │   composition root)       puertos/interfaces)     tarifas, mora, estados)
   │                                ▲
   └──► AutoGo.Infrastructure ──────┘
          (Dapper + SPs, BCrypt, JWT, correo, archivos, reloj)
```

| Proyecto | Responsabilidad | Depende de |
|---|---|---|
| `AutoGo.Domain` | Entidades con comportamiento (`Alquiler`, `Vehiculo`...), `PoliticaTarifas`, `CalendarioLaboral`. | nada |
| `AutoGo.Application` | Casos de uso (`AlquilerService`...), DTOs, puertos (`IAlquilerRepository`, `IClock`, `ICurrentUser`...). | Domain |
| `AutoGo.Infrastructure` | Implementa los puertos: repositorios Dapper que **sólo llaman stored procedures**, BCrypt, JWT, SMTP, disco. | Application |
| `AutoGo.Api` | HotChocolate GraphQL, autenticación/autorización, registro de dependencias. | Application, Infrastructure |

SOLID en la práctica:
- **S**: cada servicio cubre un agregado; la regla de precios vive sólo en `PoliticaTarifas`; `SpExecutor` es el único que habla con la BD.
- **O**: nuevas formas de enviar correo o guardar archivos = nueva implementación de `IEmailSender` / `IFileStorage`, sin tocar casos de uso.
- **L/I**: interfaces pequeñas por agregado (`IVehiculoRepository`, `IFacturaRepository`...).
- **D**: Application define las interfaces; Infrastructure las implementa. Application y Domain no referencian ningún paquete ni framework.

## Puesta en marcha

Requisitos: SDK .NET 11 (ver `global.json`), SQL Server 2019+ / Express.

```powershell
# 1. Base de datos (crea la base AutoGo, tablas, procedimientos y el administrador inicial)
sqlcmd -S localhost\SQLEXPRESS -E -b -i database\AutoGo_01_BaseDeDatos.sql

# 2. Ejecutar (la cadena de conexión ya apunta a Database=AutoGo)
dotnet dev-certs https --trust                 # una sola vez, para https://localhost:7180
dotnet run --project src\AutoGo.Api            # https://localhost:7180/graphql  (IDE Nitro)
dotnet test                                    # pruebas unitarias

# Producción: variables de entorno Jwt__Clave y ConnectionStrings__AutoGo
```

Primer ingreso: `admin@autogo.com` / `Admin2026` (el sistema pide cambiar la contraseña). El script **no borra nada**: si la base ya tiene datos se detiene; para reconstruirla, `DROP DATABASE AutoGo;`.

Categorías, vehículos y clientes se cargan desde la API. Las fotos se suben con `subirFotoVehiculo` y se guardan en `src\AutoGo.Api\wwwroot\media\vehiculos\`.

## Guía para el equipo de frontend

Endpoint único: `POST /graphql`. Autenticación: header `Authorization: Bearer <token>`.

### Autenticación

```graphql
mutation { login(correo: "admin@sav.com", password: "1234") {
  token expiraEnUtc usuario { id nombre rol debeCambiarPassword clienteId } } }
```

Si `debeCambiarPassword = true`, el token sólo sirve para `me` y `cambiarPassword`, que devuelve un token nuevo:

```graphql
mutation { cambiarPassword(passwordActual: "1234", passwordNueva: "NuevaClave2026") { token } }
```

Otras: `registrarCliente(input)`, `solicitarRecuperacionPassword(correo)`, `restablecerPassword(token, passwordNueva)`.

### Portal del cliente (público / rol Cliente)

```graphql
# Público
query { categorias { id nombre } }
query { vehiculosDisponibles(fechaInicio: "2026-10-01", fechaFin: "2026-10-04") {
  id placa marca modelo categoria precioDia fotoUrl } }
query { cotizarAlquiler(vehiculoId: 12, fechaInicio: "2026-10-01", fechaFin: "2026-10-04") { dias precioDia total } }

# Cliente autenticado
mutation { crearAlquiler(input: { vehiculoId: 12, fechaInicio: "2026-10-01", fechaFin: "2026-10-04", metodoPago: TARJETA }) {
  facturaId alquiler { id montoTotal estado } } }
query { misAlquileres { id vehiculo fechaInicio fechaFinPactada estado vencido montoTotal } }
query { misFacturas { id tipo concepto monto fechaEmision } }
mutation { cancelarAlquiler(alquilerId: 20, motivo: "Cambio de planes") { facturaId alquiler { estado } } }
```

### Backoffice (rol Administrador)

```graphql
query { dashboard { vehiculosDisponibles vehiculosAlquilados alquileresVencidos pendientesDevolucion ingresosMes } }

query { alquileres(soloVencidos: true, first: 20, order: { fechaFinPactada: ASC }) {
  totalCount nodes { id clienteNombre placa fechaFinPactada diasRetraso montoTotal } } }

query { cotizarDevolucion(alquilerId: 3) { diasMora montoMora montoTotal } }
mutation { registrarDevolucion(input: { alquilerId: 3, metodoPagoMora: EFECTIVO }) { facturaId alquiler { estado montoMora } } }

mutation { crearAlquiler(input: { clienteId: 10, vehiculoId: 4, fechaInicio: "2026-10-01", fechaFin: "2026-10-03", metodoPago: EFECTIVO }) { facturaId } }
mutation { modificarAlquiler(input: { alquilerId: 20, vehiculoId: 4, fechaInicio: "2026-10-01", fechaFin: "2026-10-05", metodoPago: EFECTIVO }) { facturaId } }

mutation { crearVehiculo(input: { placa: "A123456", categoriaId: 5, marca: "Kia", modelo: "Sportage", anio: 2025, precioDia: 4200 }) { id } }
mutation { cambiarEstadoVehiculo(input: { vehiculoId: 3, estado: MANTENIMIENTO, mantenimientoHasta: "2026-10-02" }) { estadoActual } }
mutation { crearCliente(input: { nombre: "Juan Pérez", cedula: "00112345678", telefono: "809-555-0000" }) { id cedula } }
```

`subirFotoVehiculo(id, foto: Upload!)` usa el [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec) (Apollo Upload Client, urql, etc.).

Las listas del backoffice (`vehiculos`, `clientes`, `alquileres`, `facturas`) soportan paginación (`first/after`, `totalCount`), `where` y `order`.

### Errores

Todos los errores de negocio llegan en `errors[].extensions.code`. Decidir por el código, no por el mensaje:

| Código | Significado |
|---|---|
| `CREDENCIALES_INVALIDAS` | Login o contraseña actual incorrecta |
| `AUTH_NOT_AUTHENTICATED` | Falta el token o expiró |
| `AUTH_NOT_AUTHORIZED` / `ACCESO_DENEGADO` | Rol insuficiente, contraseña por cambiar o recurso ajeno |
| `NO_ENCONTRADO` | El id no existe |
| `DATO_INVALIDO`, `FECHAS_INVALIDAS` | Validación de entrada |
| `VEHICULO_NO_DISPONIBLE` | Vehículo en mantenimiento/fuera de servicio o ya comprometido en esas fechas |
| `ALQUILER_NO_ACTIVO`, `CANCELACION_NO_PERMITIDA`, `ESTADO_CAMBIADO` | Operación no válida para el estado actual |
| `CEDULA_DUPLICADA`, `CORREO_DUPLICADO`, `PLACA_DUPLICADA` | Unicidad |
| `TOKEN_INVALIDO` | Enlace de recuperación vencido o usado |
| `REGLA_NEGOCIO` | Otra regla de negocio (ver mensaje) |

Notas: fechas de negocio son `LocalDate`/`Date` (`"2026-10-01"`); `fechaEmision`/`expiraEnUtc` vienen en UTC. Los enums van en MAYÚSCULAS (`FUERA_DE_SERVICIO`). **El frontend no debe calcular montos**: usar `cotizarAlquiler` y `cotizarDevolucion`.
