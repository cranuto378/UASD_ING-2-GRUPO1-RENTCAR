SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/* ============================================================================
   AutoGo - Sistema de Renta de Vehículos
   Script 01: Tablas (SQL Server 2019+ / Azure SQL Database)
   Se ejecuta DENTRO de la base destino (sqlcmd -d <base>); no crea ni cambia de base.

   Responsabilidad de la BD:
     - Persistir datos e integridad (PK, FK, UNIQUE, CHECK).
     - Operaciones atómicas vía stored procedures (script 02).
   La BD NO calcula montos, NO decide estados de negocio y NO usa triggers:
   todas las reglas viven en la API (AutoGo.Domain / AutoGo.Application).
   ============================================================================ */


/* ---------------------------------------------------------------------------
   Limpieza (orden inverso a las dependencias)
   --------------------------------------------------------------------------- */
DROP TABLE IF EXISTS dbo.Facturas;
DROP TABLE IF EXISTS dbo.Alquileres;
DROP TABLE IF EXISTS dbo.TokensRecuperacion;
DROP TABLE IF EXISTS dbo.Vehiculos;
DROP TABLE IF EXISTS dbo.Categorias;
DROP TABLE IF EXISTS dbo.Clientes;
DROP TABLE IF EXISTS dbo.Usuarios;
GO

/* ---------------------------------------------------------------------------
   Usuarios: SOLO cuentas de acceso (administradores y clientes del portal).
   Contraseñas almacenadas como hash BCrypt, nunca en texto plano.
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.Usuarios
(
    Id                  INT            IDENTITY(1,1) NOT NULL,
    Nombre              NVARCHAR(100)  NOT NULL,
    Correo              NVARCHAR(150)  NOT NULL,
    PasswordHash        NVARCHAR(255)  NULL,          -- NULL = cuenta sin contraseña (debe recuperarla)
    Rol                 NVARCHAR(20)   NOT NULL CONSTRAINT DF_Usuarios_Rol DEFAULT (N'Cliente'),
    DebeCambiarPassword BIT            NOT NULL CONSTRAINT DF_Usuarios_DebeCambiar DEFAULT (0),
    Activo              BIT            NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT (1),
    FechaCreacion       DATETIME2(0)   NOT NULL CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Usuarios PRIMARY KEY (Id),
    CONSTRAINT UQ_Usuarios_Correo UNIQUE (Correo),
    CONSTRAINT CK_Usuarios_Rol CHECK (Rol IN (N'Administrador', N'Cliente'))
);
GO

/* ---------------------------------------------------------------------------
   Clientes: personas que alquilan. Pueden existir sin cuenta de portal
   (registrados en mostrador) -> UsuarioId NULL.
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.Clientes
(
    Id               INT           IDENTITY(1,1) NOT NULL,
    UsuarioId        INT           NULL,
    Nombre           NVARCHAR(100) NOT NULL,
    Cedula           NVARCHAR(20)  NOT NULL,
    Correo           NVARCHAR(150) NULL,
    Telefono         NVARCHAR(20)  NULL,
    LicenciaConducir NVARCHAR(30)  NULL,
    Activo           BIT           NOT NULL CONSTRAINT DF_Clientes_Activo DEFAULT (1),
    FechaCreacion    DATETIME2(0)  NOT NULL CONSTRAINT DF_Clientes_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Clientes PRIMARY KEY (Id),
    CONSTRAINT UQ_Clientes_Cedula UNIQUE (Cedula),
    CONSTRAINT FK_Clientes_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id)
);
GO
-- Un usuario sólo puede estar vinculado a un cliente
CREATE UNIQUE INDEX UX_Clientes_UsuarioId ON dbo.Clientes (UsuarioId) WHERE UsuarioId IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Categorías de vehículo (antes texto libre: 'Economico', 'Sedán', 'SUV'...)
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.Categorias
(
    Id     INT          IDENTITY(1,1) NOT NULL,
    Nombre NVARCHAR(50) NOT NULL,
    Activo BIT          NOT NULL CONSTRAINT DF_Categorias_Activo DEFAULT (1),
    CONSTRAINT PK_Categorias PRIMARY KEY (Id),
    CONSTRAINT UQ_Categorias_Nombre UNIQUE (Nombre)
);
GO

/* ---------------------------------------------------------------------------
   Vehículos.
   EstadoOperativo guarda sólo lo que NO se puede derivar:
     Disponible | Mantenimiento | FueraDeServicio
   "Alquilado" NO se guarda: se deriva de los alquileres activos (evita que el
   estado quede desincronizado como pasaba en el sistema anterior).
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.Vehiculos
(
    Id                 INT           IDENTITY(1,1) NOT NULL,
    Placa              NVARCHAR(10)  NOT NULL,
    CategoriaId        INT           NOT NULL,
    Marca              NVARCHAR(50)  NOT NULL,
    Modelo             NVARCHAR(50)  NOT NULL,
    Anio               SMALLINT      NOT NULL,
    PrecioDia          DECIMAL(10,2) NOT NULL,
    EstadoOperativo    NVARCHAR(20)  NOT NULL CONSTRAINT DF_Vehiculos_Estado DEFAULT (N'Disponible'),
    MantenimientoHasta DATE          NULL,
    FotoUrl            NVARCHAR(300) NULL,
    Activo             BIT           NOT NULL CONSTRAINT DF_Vehiculos_Activo DEFAULT (1),
    FechaCreacion      DATETIME2(0)  NOT NULL CONSTRAINT DF_Vehiculos_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Vehiculos PRIMARY KEY (Id),
    CONSTRAINT UQ_Vehiculos_Placa UNIQUE (Placa),
    CONSTRAINT FK_Vehiculos_Categorias FOREIGN KEY (CategoriaId) REFERENCES dbo.Categorias (Id),
    CONSTRAINT CK_Vehiculos_Estado CHECK (EstadoOperativo IN (N'Disponible', N'Mantenimiento', N'FueraDeServicio')),
    CONSTRAINT CK_Vehiculos_Precio CHECK (PrecioDia > 0),
    CONSTRAINT CK_Vehiculos_Anio CHECK (Anio BETWEEN 1950 AND 2100)
);
GO

/* ---------------------------------------------------------------------------
   Alquileres. Guarda una "foto" del precio al momento de alquilar (PrecioDia)
   para que un cambio de tarifa futuro no altere alquileres históricos.
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.Alquileres
(
    Id                     INT           IDENTITY(1,1) NOT NULL,
    ClienteId              INT           NOT NULL,
    VehiculoId             INT           NOT NULL,
    RegistradoPorUsuarioId INT           NULL,         -- NULL cuando lo crea el cliente desde el portal
    Canal                  NVARCHAR(20)  NOT NULL,
    FechaInicio            DATE          NOT NULL,
    FechaFinPactada        DATE          NOT NULL,
    FechaDevolucion        DATE          NULL,
    PrecioDia              DECIMAL(10,2) NOT NULL,
    Dias                   INT           NOT NULL,
    MontoBase              DECIMAL(12,2) NOT NULL,
    DiasMora               INT           NOT NULL CONSTRAINT DF_Alquileres_DiasMora  DEFAULT (0),
    MontoMora              DECIMAL(12,2) NOT NULL CONSTRAINT DF_Alquileres_MontoMora DEFAULT (0),
    MontoTotal             AS (MontoBase + MontoMora) PERSISTED,
    Estado                 NVARCHAR(20)  NOT NULL CONSTRAINT DF_Alquileres_Estado DEFAULT (N'Activo'),
    Observaciones          NVARCHAR(500) NULL,
    FechaCreacion          DATETIME2(0)  NOT NULL CONSTRAINT DF_Alquileres_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion     DATETIME2(0)  NULL,
    CONSTRAINT PK_Alquileres PRIMARY KEY (Id),
    CONSTRAINT FK_Alquileres_Clientes  FOREIGN KEY (ClienteId)              REFERENCES dbo.Clientes  (Id),
    CONSTRAINT FK_Alquileres_Vehiculos FOREIGN KEY (VehiculoId)             REFERENCES dbo.Vehiculos (Id),
    CONSTRAINT FK_Alquileres_Usuarios  FOREIGN KEY (RegistradoPorUsuarioId) REFERENCES dbo.Usuarios  (Id),
    CONSTRAINT CK_Alquileres_Canal  CHECK (Canal IN (N'Mostrador', N'Portal')),
    CONSTRAINT CK_Alquileres_Estado CHECK (Estado IN (N'Activo', N'Completado', N'Cancelado')),
    CONSTRAINT CK_Alquileres_Fechas CHECK (FechaFinPactada >= FechaInicio),
    CONSTRAINT CK_Alquileres_Montos CHECK (MontoBase >= 0 AND MontoMora >= 0 AND Dias > 0 AND DiasMora >= 0),
    CONSTRAINT CK_Alquileres_Devolucion CHECK
        ((Estado = N'Completado' AND FechaDevolucion IS NOT NULL) OR (Estado <> N'Completado' AND FechaDevolucion IS NULL))
);
GO
CREATE INDEX IX_Alquileres_Vehiculo_Fechas ON dbo.Alquileres (VehiculoId, Estado, FechaInicio, FechaFinPactada);
CREATE INDEX IX_Alquileres_Cliente         ON dbo.Alquileres (ClienteId, Estado);
GO

/* ---------------------------------------------------------------------------
   Facturas: documentos INMUTABLES. Nunca se actualizan.
     Alquiler -> cobro inicial
     Mora     -> cargo por devolución tardía
     Ajuste   -> diferencia por modificación / nota de crédito (monto negativo)
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.Facturas
(
    Id            INT           IDENTITY(1,1) NOT NULL,   -- No. de factura
    AlquilerId    INT           NOT NULL,
    Tipo          NVARCHAR(20)  NOT NULL,
    Concepto      NVARCHAR(200) NOT NULL,
    Monto         DECIMAL(12,2) NOT NULL,
    MetodoPago    NVARCHAR(20)  NULL,
    FechaEmision  DATETIME2(0)  NOT NULL CONSTRAINT DF_Facturas_FechaEmision DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Facturas PRIMARY KEY (Id),
    CONSTRAINT FK_Facturas_Alquileres FOREIGN KEY (AlquilerId) REFERENCES dbo.Alquileres (Id),
    CONSTRAINT CK_Facturas_Tipo CHECK (Tipo IN (N'Alquiler', N'Mora', N'Ajuste')),
    CONSTRAINT CK_Facturas_Metodo CHECK (MetodoPago IS NULL OR MetodoPago IN (N'Efectivo', N'Tarjeta', N'Transferencia')),
    CONSTRAINT CK_Facturas_Monto CHECK (Monto <> 0 AND (Tipo = N'Ajuste' OR Monto > 0))
);
GO
CREATE INDEX IX_Facturas_Alquiler ON dbo.Facturas (AlquilerId);
GO

/* ---------------------------------------------------------------------------
   Tokens de recuperación de contraseña (se guarda el SHA-256, no el token).
   --------------------------------------------------------------------------- */
CREATE TABLE dbo.TokensRecuperacion
(
    Id            INT          IDENTITY(1,1) NOT NULL,
    UsuarioId     INT          NOT NULL,
    TokenHash     CHAR(64)     NOT NULL,
    ExpiraEn      DATETIME2(0) NOT NULL,
    UsadoEn       DATETIME2(0) NULL,
    FechaCreacion DATETIME2(0) NOT NULL CONSTRAINT DF_Tokens_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_TokensRecuperacion PRIMARY KEY (Id),
    CONSTRAINT UQ_TokensRecuperacion_Hash UNIQUE (TokenHash),
    CONSTRAINT FK_TokensRecuperacion_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id)
);
GO

PRINT N'Esquema AutoGo creado.';
GO
