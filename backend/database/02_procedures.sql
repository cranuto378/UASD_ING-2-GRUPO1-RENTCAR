SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/* ============================================================================
   AutoGo - Script 02: Funciones y Stored Procedures

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
