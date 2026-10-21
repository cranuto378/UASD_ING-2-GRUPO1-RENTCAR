/* ============================================================================
   Esta es para que ustedes la pongan en local chicos, en caso de prueba.
   BASE DE DATOS:  Sistema-ADV
   
   Crea la base Sistema-ADV (si no existe) con: 7 tablas + 1 funcion +
   36 stored procedures + el administrador inicial.


   PROTECCIONES:
     1) Eliminen la vieja y vuelvan a correr este script si quieren reconstruirla.
     2) El usuario de administrador se crea solo y la contraseña y correo estan abajo.

   Para Azure SQL Database use la version Azure (no lleva CREATE ni USE).
   ============================================================================ */
USE master;
GO
IF DB_ID(N'Sistema-ADV') IS NULL
    CREATE DATABASE [Sistema-ADV];
GO
USE [Sistema-ADV];
GO
SET NOEXEC OFF;
GO
IF COL_LENGTH(N'dbo.usuarios', N'id_usuario') IS NOT NULL
BEGIN
    RAISERROR(N'ABORTADO: esta base contiene el esquema viejo (usuarios.id_usuario). No se ejecuto nada.', 16, 1);
    SET NOEXEC ON;
END
GO
DECLARE @n INT = 0;
IF OBJECT_ID(N'dbo.Usuarios',   N'U') IS NOT NULL EXEC sp_executesql N'SELECT @n = @n + COUNT(*) FROM dbo.Usuarios',   N'@n INT OUTPUT', @n OUTPUT;
IF OBJECT_ID(N'dbo.Vehiculos',  N'U') IS NOT NULL EXEC sp_executesql N'SELECT @n = @n + COUNT(*) FROM dbo.Vehiculos',  N'@n INT OUTPUT', @n OUTPUT;
IF OBJECT_ID(N'dbo.Clientes',   N'U') IS NOT NULL EXEC sp_executesql N'SELECT @n = @n + COUNT(*) FROM dbo.Clientes',   N'@n INT OUTPUT', @n OUTPUT;
IF OBJECT_ID(N'dbo.Alquileres', N'U') IS NOT NULL EXEC sp_executesql N'SELECT @n = @n + COUNT(*) FROM dbo.Alquileres', N'@n INT OUTPUT', @n OUTPUT;
IF @n > 0
BEGIN
    RAISERROR(N'ABORTADO: la base Sistema-ADV ya tiene datos. Para reconstruirla ejecute DROP DATABASE [Sistema-ADV]; y vuelva a correr este script.', 16, 1);
    SET NOEXEC ON;
END
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/* ============================================================================
   AutoGo - Sistema de Renta de Vehículos
   Parte 1: Tablas

   Responsabilidad de la BD:
     - Persistir datos e integridad (PK, FK, UNIQUE, CHECK).
     - Operaciones atómicas vía stored procedures (parte 2).
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

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/* ============================================================================
   AutoGo - Parte 2: Funciones y Stored Procedures

   Convenciones:
     - Prefijo usp_<Entidad>_<Accion>.
     - Las fechas "de negocio" (@Hoy) las envía la API: la BD no decide qué día es.
     - Los montos llegan YA calculados desde la API. La BD sólo persiste.
     - Errores controlados con THROW (la API los traduce a errores GraphQL):
         51000  NO_ENCONTRADO
         51001  CONFLICTO_FECHAS   (vehículo ya comprometido en esas fechas)
         51002  ESTADO_INVALIDO    (el registro cambió de estado; concurrencia)
         51003  TOKEN_INVALIDO
   ============================================================================ */

/* ============================================================================
   Función: alquileres activos que chocan con un rango de fechas.
   Invariante de datos: un vehículo no puede estar comprometido dos veces.
   Un alquiler activo vencido (no devuelto) sigue ocupando el vehículo hasta @Hoy.
   ============================================================================ */
CREATE OR ALTER FUNCTION dbo.ufn_AlquileresEnConflicto
(
    @VehiculoId       INT,
    @FechaInicio      DATE,
    @FechaFin         DATE,
    @Hoy              DATE,
    @ExcluirAlquilerId INT
)
RETURNS TABLE
AS
RETURN
    SELECT a.Id
    FROM dbo.Alquileres a
    WHERE a.VehiculoId = @VehiculoId
      AND a.Estado = N'Activo'
      AND (@ExcluirAlquilerId IS NULL OR a.Id <> @ExcluirAlquilerId)
      AND a.FechaInicio <= @FechaFin
      AND (CASE WHEN a.FechaFinPactada < @Hoy THEN @Hoy ELSE a.FechaFinPactada END) >= @FechaInicio;
GO

/* ============================================================================
   USUARIOS / AUTENTICACIÓN
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Usuario_ObtenerPorCorreo
    @Correo NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.Id, u.Nombre, u.Correo, u.PasswordHash, u.Rol, u.DebeCambiarPassword, u.Activo,
           c.Id AS ClienteId
    FROM dbo.Usuarios u
    LEFT JOIN dbo.Clientes c ON c.UsuarioId = u.Id
    WHERE u.Correo = @Correo;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Usuario_ObtenerPorId
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.Id, u.Nombre, u.Correo, u.PasswordHash, u.Rol, u.DebeCambiarPassword, u.Activo,
           c.Id AS ClienteId
    FROM dbo.Usuarios u
    LEFT JOIN dbo.Clientes c ON c.UsuarioId = u.Id
    WHERE u.Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Usuario_CrearAdministrador
    @Nombre       NVARCHAR(100),
    @Correo       NVARCHAR(150),
    @PasswordHash NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Usuarios (Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword)
    VALUES (@Nombre, @Correo, @PasswordHash, N'Administrador', 1);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS Id;
END
GO

/* Crea la cuenta de portal de un cliente. Si @ClienteIdExistente viene informado
   (el cliente ya fue registrado en mostrador) se vincula en lugar de duplicarlo.
   La decisión de vincular o crear la toma la API. */
CREATE OR ALTER PROCEDURE dbo.usp_Usuario_RegistrarCliente
    @ClienteIdExistente INT = NULL,
    @Nombre             NVARCHAR(100),
    @Correo             NVARCHAR(150),
    @PasswordHash       NVARCHAR(255),
    @Cedula             NVARCHAR(20),
    @Telefono           NVARCHAR(20) = NULL,
    @LicenciaConducir   NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UsuarioId INT, @ClienteId INT;

    BEGIN TRANSACTION;

        INSERT INTO dbo.Usuarios (Nombre, Correo, PasswordHash, Rol)
        VALUES (@Nombre, @Correo, @PasswordHash, N'Cliente');
        SET @UsuarioId = CAST(SCOPE_IDENTITY() AS INT);

        IF @ClienteIdExistente IS NULL
        BEGIN
            INSERT INTO dbo.Clientes (UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir)
            VALUES (@UsuarioId, @Nombre, @Cedula, @Correo, @Telefono, @LicenciaConducir);
            SET @ClienteId = CAST(SCOPE_IDENTITY() AS INT);
        END
        ELSE
        BEGIN
            UPDATE dbo.Clientes
               SET UsuarioId        = @UsuarioId,
                   Correo           = @Correo,
                   Telefono         = COALESCE(@Telefono, Telefono),
                   LicenciaConducir = COALESCE(@LicenciaConducir, LicenciaConducir)
             WHERE Id = @ClienteIdExistente
               AND UsuarioId IS NULL;

            IF @@ROWCOUNT = 0
                THROW 51002, N'El cliente ya tiene una cuenta de acceso vinculada.', 1;

            SET @ClienteId = @ClienteIdExistente;
        END

    COMMIT TRANSACTION;

    SELECT @UsuarioId AS UsuarioId, @ClienteId AS ClienteId;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Usuario_ActualizarPassword
    @Id                  INT,
    @PasswordHash        NVARCHAR(255),
    @DebeCambiarPassword BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Usuarios
       SET PasswordHash = @PasswordHash,
           DebeCambiarPassword = @DebeCambiarPassword
     WHERE Id = @Id;

    IF @@ROWCOUNT = 0
        THROW 51000, N'Usuario no encontrado.', 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_TokenRecuperacion_Crear
    @UsuarioId INT,
    @TokenHash CHAR(64),
    @ExpiraEn  DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
        -- Invalida tokens anteriores sin usar del mismo usuario
        UPDATE dbo.TokensRecuperacion
           SET UsadoEn = SYSUTCDATETIME()
         WHERE UsuarioId = @UsuarioId AND UsadoEn IS NULL;

        INSERT INTO dbo.TokensRecuperacion (UsuarioId, TokenHash, ExpiraEn)
        VALUES (@UsuarioId, @TokenHash, @ExpiraEn);
    COMMIT TRANSACTION;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_TokenRecuperacion_ObtenerVigente
    @TokenHash CHAR(64),
    @AhoraUtc  DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.Id, t.UsuarioId, t.ExpiraEn
    FROM dbo.TokensRecuperacion t
    WHERE t.TokenHash = @TokenHash
      AND t.UsadoEn IS NULL
      AND t.ExpiraEn > @AhoraUtc;
END
GO

/* Consume el token y cambia la contraseña de forma atómica. */
CREATE OR ALTER PROCEDURE dbo.usp_TokenRecuperacion_Consumir
    @TokenId      INT,
    @PasswordHash NVARCHAR(255),
    @AhoraUtc     DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UsuarioId INT;

    BEGIN TRANSACTION;
        UPDATE dbo.TokensRecuperacion
           SET UsadoEn = @AhoraUtc,
               @UsuarioId = UsuarioId
         WHERE Id = @TokenId
           AND UsadoEn IS NULL
           AND ExpiraEn > @AhoraUtc;

        IF @@ROWCOUNT = 0
            THROW 51003, N'El token de recuperación no es válido o ya expiró.', 1;

        UPDATE dbo.Usuarios
           SET PasswordHash = @PasswordHash,
               DebeCambiarPassword = 0
         WHERE Id = @UsuarioId;
    COMMIT TRANSACTION;
END
GO

/* ============================================================================
   CLIENTES
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Cliente_Listar
    @Texto            NVARCHAR(100) = NULL,
    @IncluirInactivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.Id, c.UsuarioId, c.Nombre, c.Cedula, c.Correo, c.Telefono, c.LicenciaConducir, c.Activo, c.FechaCreacion
    FROM dbo.Clientes c
    WHERE (@IncluirInactivos = 1 OR c.Activo = 1)
      AND (@Texto IS NULL
           OR c.Nombre LIKE N'%' + @Texto + N'%'
           OR c.Cedula LIKE N'%' + @Texto + N'%'
           OR c.Correo LIKE N'%' + @Texto + N'%')
    ORDER BY c.Nombre;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Cliente_ObtenerPorId
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.Id, c.UsuarioId, c.Nombre, c.Cedula, c.Correo, c.Telefono, c.LicenciaConducir, c.Activo, c.FechaCreacion
    FROM dbo.Clientes c
    WHERE c.Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Cliente_ObtenerPorCedula
    @Cedula NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.Id, c.UsuarioId, c.Nombre, c.Cedula, c.Correo, c.Telefono, c.LicenciaConducir, c.Activo, c.FechaCreacion
    FROM dbo.Clientes c
    WHERE c.Cedula = @Cedula;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Cliente_Crear
    @Nombre           NVARCHAR(100),
    @Cedula           NVARCHAR(20),
    @Correo           NVARCHAR(150) = NULL,
    @Telefono         NVARCHAR(20)  = NULL,
    @LicenciaConducir NVARCHAR(30)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Clientes (Nombre, Cedula, Correo, Telefono, LicenciaConducir)
    VALUES (@Nombre, @Cedula, @Correo, @Telefono, @LicenciaConducir);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Cliente_Actualizar
    @Id               INT,
    @Nombre           NVARCHAR(100),
    @Cedula           NVARCHAR(20),
    @Correo           NVARCHAR(150) = NULL,
    @Telefono         NVARCHAR(20)  = NULL,
    @LicenciaConducir NVARCHAR(30)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Clientes
       SET Nombre = @Nombre,
           Cedula = @Cedula,
           Correo = @Correo,
           Telefono = @Telefono,
           LicenciaConducir = @LicenciaConducir
     WHERE Id = @Id;

    IF @@ROWCOUNT = 0
        THROW 51000, N'Cliente no encontrado.', 1;
END
GO

/* Baja lógica: los clientes con historial no se borran físicamente. */
CREATE OR ALTER PROCEDURE dbo.usp_Cliente_Desactivar
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
        UPDATE dbo.Clientes SET Activo = 0 WHERE Id = @Id;
        IF @@ROWCOUNT = 0
            THROW 51000, N'Cliente no encontrado.', 1;

        UPDATE u SET u.Activo = 0
        FROM dbo.Usuarios u
        JOIN dbo.Clientes c ON c.UsuarioId = u.Id
        WHERE c.Id = @Id;
    COMMIT TRANSACTION;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Cliente_ContarAlquileresActivos
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT COUNT(*) AS Total
    FROM dbo.Alquileres
    WHERE ClienteId = @Id AND Estado = N'Activo';
END
GO

/* ============================================================================
   CATEGORÍAS
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Categoria_Listar
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, Nombre, Activo FROM dbo.Categorias WHERE Activo = 1 ORDER BY Nombre;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Categoria_ObtenerPorId
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Id, Nombre, Activo FROM dbo.Categorias WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Categoria_Crear
    @Nombre NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Categorias (Nombre) VALUES (@Nombre);
    SELECT CAST(SCOPE_IDENTITY() AS INT) AS Id;
END
GO

/* ============================================================================
   VEHÍCULOS
   AlquilerActivoId: alquiler activo que ya comenzó (@Hoy). La API lo usa para
   derivar el estado "Alquilado".
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_Listar
    @Hoy              DATE,
    @Texto            NVARCHAR(100) = NULL,
    @CategoriaId      INT = NULL,
    @IncluirInactivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.Id, v.Placa, v.CategoriaId, c.Nombre AS CategoriaNombre, v.Marca, v.Modelo, v.Anio,
           v.PrecioDia, v.EstadoOperativo, v.MantenimientoHasta, v.FotoUrl, v.Activo,
           act.Id AS AlquilerActivoId
    FROM dbo.Vehiculos v
    JOIN dbo.Categorias c ON c.Id = v.CategoriaId
    OUTER APPLY (SELECT TOP (1) a.Id
                 FROM dbo.Alquileres a
                 WHERE a.VehiculoId = v.Id AND a.Estado = N'Activo' AND a.FechaInicio <= @Hoy
                 ORDER BY a.FechaInicio DESC) act
    WHERE (@IncluirInactivos = 1 OR v.Activo = 1)
      AND (@CategoriaId IS NULL OR v.CategoriaId = @CategoriaId)
      AND (@Texto IS NULL
           OR v.Placa  LIKE N'%' + @Texto + N'%'
           OR v.Marca  LIKE N'%' + @Texto + N'%'
           OR v.Modelo LIKE N'%' + @Texto + N'%')
    ORDER BY c.Nombre, v.Marca, v.Modelo;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_ObtenerPorId
    @Id  INT,
    @Hoy DATE
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.Id, v.Placa, v.CategoriaId, c.Nombre AS CategoriaNombre, v.Marca, v.Modelo, v.Anio,
           v.PrecioDia, v.EstadoOperativo, v.MantenimientoHasta, v.FotoUrl, v.Activo,
           act.Id AS AlquilerActivoId
    FROM dbo.Vehiculos v
    JOIN dbo.Categorias c ON c.Id = v.CategoriaId
    OUTER APPLY (SELECT TOP (1) a.Id
                 FROM dbo.Alquileres a
                 WHERE a.VehiculoId = v.Id AND a.Estado = N'Activo' AND a.FechaInicio <= @Hoy
                 ORDER BY a.FechaInicio DESC) act
    WHERE v.Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_ExistePlaca
    @Placa     NVARCHAR(10),
    @ExcluirId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Vehiculos
                                  WHERE Placa = @Placa AND (@ExcluirId IS NULL OR Id <> @ExcluirId))
                     THEN 1 ELSE 0 END AS BIT) AS Existe;
END
GO

/* Vehículos activos SIN alquileres en conflicto con el rango.
   Si además están en mantenimiento / fuera de servicio lo decide la API
   (se devuelven EstadoOperativo y MantenimientoHasta para ello). */
CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_ListarSinConflicto
    @FechaInicio DATE,
    @FechaFin    DATE,
    @Hoy         DATE,
    @CategoriaId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.Id, v.Placa, v.CategoriaId, c.Nombre AS CategoriaNombre, v.Marca, v.Modelo, v.Anio,
           v.PrecioDia, v.EstadoOperativo, v.MantenimientoHasta, v.FotoUrl, v.Activo,
           CAST(NULL AS INT) AS AlquilerActivoId
    FROM dbo.Vehiculos v
    JOIN dbo.Categorias c ON c.Id = v.CategoriaId
    WHERE v.Activo = 1
      AND (@CategoriaId IS NULL OR v.CategoriaId = @CategoriaId)
      AND NOT EXISTS (SELECT 1 FROM dbo.ufn_AlquileresEnConflicto(v.Id, @FechaInicio, @FechaFin, @Hoy, NULL))
    ORDER BY c.Nombre, v.PrecioDia;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_Crear
    @Placa       NVARCHAR(10),
    @CategoriaId INT,
    @Marca       NVARCHAR(50),
    @Modelo      NVARCHAR(50),
    @Anio        SMALLINT,
    @PrecioDia   DECIMAL(10,2),
    @FotoUrl     NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Vehiculos (Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, FotoUrl)
    VALUES (@Placa, @CategoriaId, @Marca, @Modelo, @Anio, @PrecioDia, @FotoUrl);

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS Id;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_Actualizar
    @Id          INT,
    @Placa       NVARCHAR(10),
    @CategoriaId INT,
    @Marca       NVARCHAR(50),
    @Modelo      NVARCHAR(50),
    @Anio        SMALLINT,
    @PrecioDia   DECIMAL(10,2)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Vehiculos
       SET Placa = @Placa,
           CategoriaId = @CategoriaId,
           Marca = @Marca,
           Modelo = @Modelo,
           Anio = @Anio,
           PrecioDia = @PrecioDia
     WHERE Id = @Id;

    IF @@ROWCOUNT = 0
        THROW 51000, N'Vehículo no encontrado.', 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_CambiarEstado
    @Id                 INT,
    @EstadoOperativo    NVARCHAR(20),
    @MantenimientoHasta DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Vehiculos
       SET EstadoOperativo = @EstadoOperativo,
           MantenimientoHasta = @MantenimientoHasta
     WHERE Id = @Id;

    IF @@ROWCOUNT = 0
        THROW 51000, N'Vehículo no encontrado.', 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_ActualizarFoto
    @Id      INT,
    @FotoUrl NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Vehiculos SET FotoUrl = @FotoUrl WHERE Id = @Id;
    IF @@ROWCOUNT = 0
        THROW 51000, N'Vehículo no encontrado.', 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vehiculo_Desactivar
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Vehiculos SET Activo = 0 WHERE Id = @Id;
    IF @@ROWCOUNT = 0
        THROW 51000, N'Vehículo no encontrado.', 1;
END
GO

/* ============================================================================
   ALQUILERES
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Alquiler_Listar
    @Hoy          DATE,
    @ClienteId    INT = NULL,
    @VehiculoId   INT = NULL,
    @Estado       NVARCHAR(20) = NULL,
    @SoloVencidos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.Id, a.ClienteId, c.Nombre AS ClienteNombre, c.Cedula AS ClienteCedula,
           a.VehiculoId, v.Placa, v.Marca, v.Modelo,
           a.RegistradoPorUsuarioId, a.Canal, a.FechaInicio, a.FechaFinPactada, a.FechaDevolucion,
           a.PrecioDia, a.Dias, a.MontoBase, a.DiasMora, a.MontoMora, a.MontoTotal,
           a.Estado, a.Observaciones, a.FechaCreacion,
           COALESCE(f.TotalFacturado, 0) AS TotalFacturado
    FROM dbo.Alquileres a
    JOIN dbo.Clientes  c ON c.Id = a.ClienteId
    JOIN dbo.Vehiculos v ON v.Id = a.VehiculoId
    OUTER APPLY (SELECT SUM(x.Monto) AS TotalFacturado FROM dbo.Facturas x WHERE x.AlquilerId = a.Id) f
    WHERE (@ClienteId  IS NULL OR a.ClienteId  = @ClienteId)
      AND (@VehiculoId IS NULL OR a.VehiculoId = @VehiculoId)
      AND (@Estado     IS NULL OR a.Estado     = @Estado)
      AND (@SoloVencidos = 0 OR (a.Estado = N'Activo' AND a.FechaFinPactada < @Hoy))
    ORDER BY a.Id DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Alquiler_ObtenerPorId
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.Id, a.ClienteId, c.Nombre AS ClienteNombre, c.Cedula AS ClienteCedula,
           a.VehiculoId, v.Placa, v.Marca, v.Modelo,
           a.RegistradoPorUsuarioId, a.Canal, a.FechaInicio, a.FechaFinPactada, a.FechaDevolucion,
           a.PrecioDia, a.Dias, a.MontoBase, a.DiasMora, a.MontoMora, a.MontoTotal,
           a.Estado, a.Observaciones, a.FechaCreacion,
           COALESCE(f.TotalFacturado, 0) AS TotalFacturado
    FROM dbo.Alquileres a
    JOIN dbo.Clientes  c ON c.Id = a.ClienteId
    JOIN dbo.Vehiculos v ON v.Id = a.VehiculoId
    OUTER APPLY (SELECT SUM(x.Monto) AS TotalFacturado FROM dbo.Facturas x WHERE x.AlquilerId = a.Id) f
    WHERE a.Id = @Id;
END
GO

/* Crea alquiler + factura inicial de forma atómica.
   Bloquea el vehículo para evitar doble alquiler concurrente. */
CREATE OR ALTER PROCEDURE dbo.usp_Alquiler_Crear
    @ClienteId              INT,
    @VehiculoId             INT,
    @RegistradoPorUsuarioId INT = NULL,
    @Canal                  NVARCHAR(20),
    @FechaInicio            DATE,
    @FechaFinPactada        DATE,
    @PrecioDia              DECIMAL(10,2),
    @Dias                   INT,
    @MontoBase              DECIMAL(12,2),
    @MetodoPago             NVARCHAR(20),
    @ConceptoFactura        NVARCHAR(200),
    @Hoy                    DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @AlquilerId INT, @FacturaId INT;

    BEGIN TRANSACTION;

        -- Serializa operaciones sobre el mismo vehículo
        IF NOT EXISTS (SELECT 1 FROM dbo.Vehiculos WITH (UPDLOCK, HOLDLOCK) WHERE Id = @VehiculoId)
            THROW 51000, N'Vehículo no encontrado.', 1;

        IF EXISTS (SELECT 1 FROM dbo.ufn_AlquileresEnConflicto(@VehiculoId, @FechaInicio, @FechaFinPactada, @Hoy, NULL))
            THROW 51001, N'El vehículo ya está comprometido en ese rango de fechas.', 1;

        INSERT INTO dbo.Alquileres
            (ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada,
             PrecioDia, Dias, MontoBase, Estado)
        VALUES
            (@ClienteId, @VehiculoId, @RegistradoPorUsuarioId, @Canal, @FechaInicio, @FechaFinPactada,
             @PrecioDia, @Dias, @MontoBase, N'Activo');
        SET @AlquilerId = CAST(SCOPE_IDENTITY() AS INT);

        INSERT INTO dbo.Facturas (AlquilerId, Tipo, Concepto, Monto, MetodoPago)
        VALUES (@AlquilerId, N'Alquiler', @ConceptoFactura, @MontoBase, @MetodoPago);
        SET @FacturaId = CAST(SCOPE_IDENTITY() AS INT);

    COMMIT TRANSACTION;

    SELECT @AlquilerId AS AlquilerId, @FacturaId AS FacturaId;
END
GO

/* Modifica un alquiler activo. Si cambia el monto, la API envía el ajuste
   (positivo = cobro adicional, negativo = nota de crédito). */
CREATE OR ALTER PROCEDURE dbo.usp_Alquiler_Modificar
    @Id              INT,
    @VehiculoId      INT,
    @FechaInicio     DATE,
    @FechaFinPactada DATE,
    @PrecioDia       DECIMAL(10,2),
    @Dias            INT,
    @MontoBase       DECIMAL(12,2),
    @MontoAjuste     DECIMAL(12,2),
    @MetodoPago      NVARCHAR(20) = NULL,
    @ConceptoAjuste  NVARCHAR(200) = NULL,
    @Hoy             DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FacturaAjusteId INT = NULL;

    BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Vehiculos WITH (UPDLOCK, HOLDLOCK) WHERE Id = @VehiculoId)
            THROW 51000, N'Vehículo no encontrado.', 1;

        IF EXISTS (SELECT 1 FROM dbo.ufn_AlquileresEnConflicto(@VehiculoId, @FechaInicio, @FechaFinPactada, @Hoy, @Id))
            THROW 51001, N'El vehículo ya está comprometido en ese rango de fechas.', 1;

        UPDATE dbo.Alquileres
           SET VehiculoId = @VehiculoId,
               FechaInicio = @FechaInicio,
               FechaFinPactada = @FechaFinPactada,
               PrecioDia = @PrecioDia,
               Dias = @Dias,
               MontoBase = @MontoBase,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE Id = @Id
           AND Estado = N'Activo';

        IF @@ROWCOUNT = 0
            THROW 51002, N'El alquiler no existe o ya no está activo.', 1;

        IF @MontoAjuste <> 0
        BEGIN
            INSERT INTO dbo.Facturas (AlquilerId, Tipo, Concepto, Monto, MetodoPago)
            VALUES (@Id, N'Ajuste', @ConceptoAjuste, @MontoAjuste, @MetodoPago);
            SET @FacturaAjusteId = CAST(SCOPE_IDENTITY() AS INT);
        END

    COMMIT TRANSACTION;

    SELECT @FacturaAjusteId AS FacturaAjusteId;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Alquiler_Cancelar
    @Id               INT,
    @Motivo           NVARCHAR(500),
    @MontoReembolso   DECIMAL(12,2),
    @ConceptoAjuste   NVARCHAR(200) = NULL,
    @MetodoPago       NVARCHAR(20)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FacturaAjusteId INT = NULL;

    BEGIN TRANSACTION;
        UPDATE dbo.Alquileres
           SET Estado = N'Cancelado',
               Observaciones = @Motivo,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE Id = @Id
           AND Estado = N'Activo';

        IF @@ROWCOUNT = 0
            THROW 51002, N'El alquiler no existe o ya no está activo.', 1;

        IF @MontoReembolso > 0
        BEGIN
            INSERT INTO dbo.Facturas (AlquilerId, Tipo, Concepto, Monto, MetodoPago)
            VALUES (@Id, N'Ajuste', @ConceptoAjuste, -@MontoReembolso, @MetodoPago);
            SET @FacturaAjusteId = CAST(SCOPE_IDENTITY() AS INT);
        END
    COMMIT TRANSACTION;

    SELECT @FacturaAjusteId AS FacturaAjusteId;
END
GO

/* Devolución: cierra el alquiler, factura la mora (si la API la calculó)
   y envía el vehículo a mantenimiento hasta la fecha indicada por la API. */
CREATE OR ALTER PROCEDURE dbo.usp_Alquiler_RegistrarDevolucion
    @Id                 INT,
    @FechaDevolucion    DATE,
    @DiasMora           INT,
    @MontoMora          DECIMAL(12,2),
    @MetodoPago         NVARCHAR(20) = NULL,
    @ConceptoMora       NVARCHAR(200) = NULL,
    @MantenimientoHasta DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @VehiculoId INT, @FacturaMoraId INT = NULL;

    BEGIN TRANSACTION;
        UPDATE dbo.Alquileres
           SET FechaDevolucion = @FechaDevolucion,
               DiasMora = @DiasMora,
               MontoMora = @MontoMora,
               Estado = N'Completado',
               FechaActualizacion = SYSUTCDATETIME(),
               @VehiculoId = VehiculoId
         WHERE Id = @Id
           AND Estado = N'Activo';

        IF @@ROWCOUNT = 0
            THROW 51002, N'El alquiler no existe o ya no está activo.', 1;

        IF @MontoMora > 0
        BEGIN
            INSERT INTO dbo.Facturas (AlquilerId, Tipo, Concepto, Monto, MetodoPago)
            VALUES (@Id, N'Mora', @ConceptoMora, @MontoMora, @MetodoPago);
            SET @FacturaMoraId = CAST(SCOPE_IDENTITY() AS INT);
        END

        UPDATE dbo.Vehiculos
           SET EstadoOperativo = N'Mantenimiento',
               MantenimientoHasta = @MantenimientoHasta
         WHERE Id = @VehiculoId
           AND EstadoOperativo <> N'FueraDeServicio';
    COMMIT TRANSACTION;

    SELECT @FacturaMoraId AS FacturaMoraId;
END
GO

/* ============================================================================
   FACTURAS
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Factura_Listar
    @ClienteId  INT = NULL,
    @AlquilerId INT = NULL,
    @Desde      DATETIME2(0) = NULL,
    @Hasta      DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT f.Id, f.AlquilerId, f.Tipo, f.Concepto, f.Monto, f.MetodoPago, f.FechaEmision,
           c.Id AS ClienteId, c.Nombre AS ClienteNombre, c.Cedula AS ClienteCedula,
           c.Telefono AS ClienteTelefono, c.Correo AS ClienteCorreo,
           v.Id AS VehiculoId, v.Placa, v.Marca, v.Modelo, cat.Nombre AS CategoriaNombre,
           a.FechaInicio, a.FechaFinPactada, a.Dias, a.PrecioDia
    FROM dbo.Facturas f
    JOIN dbo.Alquileres a  ON a.Id = f.AlquilerId
    JOIN dbo.Clientes   c  ON c.Id = a.ClienteId
    JOIN dbo.Vehiculos  v  ON v.Id = a.VehiculoId
    JOIN dbo.Categorias cat ON cat.Id = v.CategoriaId
    WHERE (@ClienteId  IS NULL OR a.ClienteId = @ClienteId)
      AND (@AlquilerId IS NULL OR f.AlquilerId = @AlquilerId)
      AND (@Desde IS NULL OR f.FechaEmision >= @Desde)
      AND (@Hasta IS NULL OR f.FechaEmision <  @Hasta)
    ORDER BY f.Id DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_Factura_ObtenerPorId
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT f.Id, f.AlquilerId, f.Tipo, f.Concepto, f.Monto, f.MetodoPago, f.FechaEmision,
           c.Id AS ClienteId, c.Nombre AS ClienteNombre, c.Cedula AS ClienteCedula,
           c.Telefono AS ClienteTelefono, c.Correo AS ClienteCorreo,
           v.Id AS VehiculoId, v.Placa, v.Marca, v.Modelo, cat.Nombre AS CategoriaNombre,
           a.FechaInicio, a.FechaFinPactada, a.Dias, a.PrecioDia
    FROM dbo.Facturas f
    JOIN dbo.Alquileres a  ON a.Id = f.AlquilerId
    JOIN dbo.Clientes   c  ON c.Id = a.ClienteId
    JOIN dbo.Vehiculos  v  ON v.Id = a.VehiculoId
    JOIN dbo.Categorias cat ON cat.Id = v.CategoriaId
    WHERE f.Id = @Id;
END
GO

/* ============================================================================
   DASHBOARD
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.usp_Dashboard_Resumen
    @Hoy        DATE,
    @InicioMes  DATETIME2(0),
    @FinMes     DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM dbo.Clientes WHERE Activo = 1)                                          AS TotalClientes,
        (SELECT COUNT(*) FROM dbo.Alquileres WHERE Estado = N'Activo')                                AS AlquileresActivos,
        (SELECT COUNT(*) FROM dbo.Alquileres WHERE Estado = N'Activo' AND FechaFinPactada < @Hoy)     AS AlquileresVencidos,
        (SELECT COUNT(*) FROM dbo.Alquileres WHERE Estado = N'Activo' AND FechaFinPactada <= @Hoy)    AS PendientesDevolucion,
        (SELECT COALESCE(SUM(Monto), 0) FROM dbo.Facturas)                                            AS IngresosTotales,
        (SELECT COALESCE(SUM(Monto), 0) FROM dbo.Facturas
          WHERE FechaEmision >= @InicioMes AND FechaEmision < @FinMes)                                AS IngresosMes;
END
GO

PRINT N'Procedimientos AutoGo creados.';
GO

/* ============================================================================
   UNICO DATO INICIAL: administrador para poder entrar por primera vez.
     Correo:     admin@autogo.com
     Contrasena: Admin2026   (el sistema obliga a cambiarla al primer ingreso)
   Todo lo demas (categorias, vehiculos, clientes) lo cargas tu desde la API.
   ============================================================================ */
IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Correo = N'admin@autogo.com')
    INSERT INTO dbo.Usuarios (Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword)
    VALUES (N'Administrador', N'admin@autogo.com', N'$2b$11$6D8YEP9BFUvDys0BP61OTu44wVnC4hnwrMANITSEhRLajWdycbpuS', N'Administrador', 1);
GO

SET NOEXEC OFF;
GO
PRINT N'Base Sistema-ADV lista (tablas + procedimientos).';
GO