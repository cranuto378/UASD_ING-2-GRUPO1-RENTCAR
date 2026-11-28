/* ============================================================================
   AutoGo - Actualización de seguridad y auditoría
   Archivo: Sistema-ADV_02_Seguridad_Auditoria_20261126.sql
   Fecha: 2026-11-26
   Objetivo: reforzar seguridad autenticación, permisos, auditoría y trazabilidad
   SIN TOCAR wallet ni pagos.
   Ejecutar sobre la base [Sistema-ADV] de Azure SQL.
   ============================================================================ */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [Sistema-ADV];
GO

/* ============================================================================
   AutoGo - Actualización de seguridad y auditoría
   Archivo: Sistema-ADV_02_Seguridad_Auditoria_20261126.sql
   Fecha: 2026-11-26
   Objetivo: reforzar seguridad autenticación, permisos, auditoría y trazabilidad
   SIN TOCAR wallet ni pagos.
   Ejecutar sobre la base [Sistema-ADV] de Azure SQL.
   ============================================================================ */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [Sistema-ADV];
GO

/* ------------------------------------------------------------------------
   1) Campos adicionales para usuarios
   ------------------------------------------------------------------------ */
IF COL_LENGTH(N'dbo.Usuarios', N'IntentosFallidos') IS NULL
BEGIN
	ALTER TABLE dbo.Usuarios
		ADD IntentosFallidos INT NOT NULL CONSTRAINT DF_Usuarios_IntentosFallidos DEFAULT (0),
			BloqueadoHastaUtc DATETIME2(0) NULL,
			FechaUltimoCambioPassword DATETIME2(0) NULL;
END
GO

/* ------------------------------------------------------------------------
   2) Tabla de intentos de login
   ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.LoginIntentos', N'U') IS NULL
BEGIN
	CREATE TABLE dbo.LoginIntentos
	(
		Id           INT IDENTITY(1,1) NOT NULL,
		UsuarioId    INT NULL,
		Correo       NVARCHAR(150) NULL,
		Exito        BIT NOT NULL,
		IpAddress    NVARCHAR(64) NULL,
		UserAgent    NVARCHAR(512) NULL,
		FechaUtc     DATETIME2(0) NOT NULL CONSTRAINT DF_LoginIntentos_FechaUtc DEFAULT (SYSUTCDATETIME()),
		CONSTRAINT PK_LoginIntentos PRIMARY KEY CLUSTERED (Id)
	);
END
GO

/* ------------------------------------------------------------------------
   3) Tabla de auditoría general
   ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.AuditoriaAcciones', N'U') IS NULL
BEGIN
	CREATE TABLE dbo.AuditoriaAcciones
	(
		Id            INT IDENTITY(1,1) NOT NULL,
		UsuarioId     INT NULL,
		UsuarioNombre NVARCHAR(150) NULL,
		Entidad       NVARCHAR(100) NOT NULL,
		EntidadId     INT NULL,
		Accion        NVARCHAR(50) NOT NULL,
		Detalle       NVARCHAR(500) NULL,
		AntesJson     NVARCHAR(MAX) NULL,
		DespuesJson   NVARCHAR(MAX) NULL,
		IpAddress     NVARCHAR(64) NULL,
		FechaUtc      DATETIME2(0) NOT NULL CONSTRAINT DF_AuditoriaAcciones_FechaUtc DEFAULT (SYSUTCDATETIME()),
		CONSTRAINT PK_AuditoriaAcciones PRIMARY KEY CLUSTERED (Id)
	);
END
GO

/* ------------------------------------------------------------------------
   4) Índices para seguridad y trazabilidad
   ------------------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Usuarios_BloqueadoHastaUtc' AND object_id = OBJECT_ID(N'dbo.Usuarios'))
BEGIN
	CREATE NONCLUSTERED INDEX IX_Usuarios_BloqueadoHastaUtc
		ON dbo.Usuarios (BloqueadoHastaUtc)
		INCLUDE (IntentosFallidos);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LoginIntentos_Usuario_Fecha' AND object_id = OBJECT_ID(N'dbo.LoginIntentos'))
BEGIN
	CREATE NONCLUSTERED INDEX IX_LoginIntentos_Usuario_Fecha
		ON dbo.LoginIntentos (UsuarioId, FechaUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditoriaAcciones_Entidad' AND object_id = OBJECT_ID(N'dbo.AuditoriaAcciones'))
BEGIN
	CREATE NONCLUSTERED INDEX IX_AuditoriaAcciones_Entidad
		ON dbo.AuditoriaAcciones (Entidad, EntidadId, FechaUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditoriaAcciones_Usuario' AND object_id = OBJECT_ID(N'dbo.AuditoriaAcciones'))
BEGIN
	CREATE NONCLUSTERED INDEX IX_AuditoriaAcciones_Usuario
		ON dbo.AuditoriaAcciones (UsuarioId, FechaUtc DESC);
END
GO

/* ------------------------------------------------------------------------
   5) Procedimiento: registrar intento de login
   ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.usp_Login_RegistrarIntento', N'P') IS NULL
BEGIN
	EXEC(N'
	CREATE PROCEDURE dbo.usp_Login_RegistrarIntento
		@UsuarioId INT = NULL,
		@Correo NVARCHAR(150) = NULL,
		@Exito BIT,
		@IpAddress NVARCHAR(64) = NULL,
		@UserAgent NVARCHAR(512) = NULL
	AS
	BEGIN
		SET NOCOUNT ON;
		INSERT INTO dbo.LoginIntentos (UsuarioId, Correo, Exito, IpAddress, UserAgent)
		VALUES (@UsuarioId, @Correo, @Exito, @IpAddress, @UserAgent);
	END
	');
END
GO

/* ------------------------------------------------------------------------
   6) Procedimiento: registrar auditoría global
   ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.usp_Auditoria_Registrar', N'P') IS NULL
BEGIN
	EXEC(N'
	CREATE PROCEDURE dbo.usp_Auditoria_Registrar
		@UsuarioId INT = NULL,
		@UsuarioNombre NVARCHAR(150) = NULL,
		@Entidad NVARCHAR(100),
		@EntidadId INT = NULL,
		@Accion NVARCHAR(50),
		@Detalle NVARCHAR(500) = NULL,
		@AntesJson NVARCHAR(MAX) = NULL,
		@DespuesJson NVARCHAR(MAX) = NULL,
		@IpAddress NVARCHAR(64) = NULL
	AS
	BEGIN
		SET NOCOUNT ON;
		INSERT INTO dbo.AuditoriaAcciones
			(UsuarioId, UsuarioNombre, Entidad, EntidadId, Accion, Detalle, AntesJson, DespuesJson, IpAddress)
		VALUES
			(@UsuarioId, @UsuarioNombre, @Entidad, @EntidadId, @Accion, @Detalle, @AntesJson, @DespuesJson, @IpAddress);
	END
	');
END
GO

/* ------------------------------------------------------------------------
   7) Procedimiento: actualizar bloqueo por intentos fallidos
   ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.usp_Usuario_ActualizarBloqueo', N'P') IS NULL
BEGIN
	EXEC(N'
	CREATE PROCEDURE dbo.usp_Usuario_ActualizarBloqueo
		@UsuarioId INT,
		@IntentosFallidos INT,
		@BloqueadoHastaUtc DATETIME2(0) = NULL
	AS
	BEGIN
		SET NOCOUNT ON;
		UPDATE dbo.Usuarios
		   SET IntentosFallidos = @IntentosFallidos,
			   BloqueadoHastaUtc = @BloqueadoHastaUtc
		 WHERE Id = @UsuarioId;
	END
	');
END
GO

/* ------------------------------------------------------------------------
   8) Procedimiento: verificar si un usuario está bloqueado
   ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.usp_Usuario_EstaBloqueado', N'P') IS NULL
BEGIN
	EXEC(N'
	CREATE PROCEDURE dbo.usp_Usuario_EstaBloqueado
		@UsuarioId INT,
		@AhoraUtc DATETIME2(0)
	AS
	BEGIN
		SET NOCOUNT ON;
		SELECT CAST(CASE WHEN u.BloqueadoHastaUtc IS NOT NULL AND u.BloqueadoHastaUtc > @AhoraUtc THEN 1 ELSE 0 END AS BIT) AS EstaBloqueado
		FROM dbo.Usuarios u
		WHERE u.Id = @UsuarioId;
	END
	');
END
GO

PRINT N'Actualización de seguridad y auditoría aplicada correctamente.';
GO
