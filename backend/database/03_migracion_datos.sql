SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
/* ============================================================================
   AutoGo - Script 03: Migración de datos desde MySQL (sistema_adv, dump 2026-05-03)
   Generado automáticamente. Ver docs/ANALISIS.md -> "Migración de datos".

   Decisiones:
   - Se conservan los IDs originales (usuarios, clientes, alquileres, facturas)
     para no romper referencias impresas (No. de factura).
   - Contraseñas en texto plano -> hash BCrypt. Todos deben cambiarla al entrar.
   - Clientes sin contraseña quedan SIN cuenta de portal (sólo registro de cliente).
   - Categorías normalizadas a catálogo.
   - "alquilado" deja de ser un estado guardado: se deriva de los alquileres.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Usuarios (sólo quienes tienen acceso)
SET IDENTITY_INSERT dbo.Usuarios ON;
INSERT INTO dbo.Usuarios (Id, Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword) VALUES (1, N'Admin', N'admin@sav.com', N'$2a$11$mRo7nFhgg8wo4TC5M.ouwO4uaycsyIB4a0Pk2HqxXO9w2Cd0.TaFC', N'Administrador', 1);
INSERT INTO dbo.Usuarios (Id, Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword) VALUES (2, N'Mohammed L´raja', N'mohammedlrj@mail.com', N'$2a$11$/hT19NdOqiPXxjFxU3ZhGuHiEZ9eh.EXQzTONVAj8NxNx7353fpjS', N'Cliente', 1);
INSERT INTO dbo.Usuarios (Id, Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword) VALUES (7, N'Admin', N'admin@g1rentacar.com', N'$2a$11$Ss/KzjjYOgYNSgrJRVvqluTeZ2Ui4aq/12r8n7ugxthmhB9IrRWBy', N'Administrador', 1);
INSERT INTO dbo.Usuarios (Id, Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword) VALUES (8, N'Carlos Méndez', N'cmendez@g1rentacar.com', N'$2a$11$hTaux3/PTFjkHn05vCwX7O7MdZvg5xr.oquZA.x5IQWCsNR3m2hkS', N'Administrador', 1);
INSERT INTO dbo.Usuarios (Id, Nombre, Correo, PasswordHash, Rol, DebeCambiarPassword) VALUES (18, N'Angelino Peraltino', N'angelino@peraltino', N'$2a$11$efOrx4VKcqZuMeuoeYr/beYpJgB.OGKHCxUIxGtRonhVDh3w0yyka', N'Cliente', 1);
SET IDENTITY_INSERT dbo.Usuarios OFF;

-- Clientes
SET IDENTITY_INSERT dbo.Clientes ON;
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (2, 2, N'Mohammed L´raja', N'001-3345657-8', N'mohammedlrj@mail.com', N'809-334-6578', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (9, NULL, N'Pedro Martínez', N'001-2345678-9', N'pedro.martinez@gmail.com', N'829-555-2001', N'00100001');
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (10, NULL, N'Ana Familia', N'001-3456789-0', N'ana.familia@hotmail.com', N'849-555-2002', N'00200002');
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (11, NULL, N'Luis Castillo', N'001-4567890-1', N'lcastillo@gmail.com', N'809-555-2003', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (12, NULL, N'Carmen Sánchez', N'001-5678901-2', N'csanchez@yahoo.com', N'829-555-2004', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (13, NULL, N'Pepe Núñez', N'001-6789012-3', N'rnunez@gmail.com', N'849-555-2005', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (15, NULL, N'Abel', N'224-4466578-9', N'abelino@gmail.com', N'809-345-5645', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (16, NULL, N'Carlos', N'224-4466789-0', N'carlos23@gmail.com', N'809-567-6767', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (17, NULL, N'Jesús Moquete', N'244-5566765-7', N'jesus@gmail.com', N'809-456-3213', NULL);
INSERT INTO dbo.Clientes (Id, UsuarioId, Nombre, Cedula, Correo, Telefono, LicenciaConducir) VALUES (18, 18, N'Angelino Peraltino', N'224-4457876-2', N'angelino@peraltino', N'809-345-2343', NULL);
SET IDENTITY_INSERT dbo.Clientes OFF;

-- Categorías
SET IDENTITY_INSERT dbo.Categorias ON;
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (1, N'Compacto');
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (2, N'Económico');
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (3, N'Negocios');
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (4, N'Pick-up');
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (5, N'SUV');
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (6, N'Sedán');
INSERT INTO dbo.Categorias (Id, Nombre) VALUES (7, N'Van');
SET IDENTITY_INSERT dbo.Categorias OFF;

-- Vehículos
SET IDENTITY_INSERT dbo.Vehiculos ON;
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (1, N'C112233', 1, N'Kia', N'Rio', 2023, 1800.00, N'Disponible', NULL, NULL);
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (2, N'C123456', 6, N'Toyota', N'Corolla', 2022, 2500.00, N'Disponible', NULL, N'/media/vehiculos/tc2022.jpeg');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (3, N'C223344', 2, N'Chevrolet', N'Suzuki Celerio', 2015, 2000.00, N'Mantenimiento', N'2026-05-04', N'/media/vehiculos/Chevrolet Celerio.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (4, N'C234567', 6, N'Nissan', N'Sentra', 2021, 2000.00, N'Disponible', NULL, N'/media/vehiculos/Nissan-Sentra.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (5, N'C334455', 4, N'Toyota', N'Hilux', 2023, 5200.00, N'Disponible', NULL, N'/media/vehiculos/hilux 2023.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (6, N'C345678', 6, N'Chevrolet', N'Cruze', 2021, 2200.00, N'Disponible', NULL, N'/media/vehiculos/Chevrolet Cruze.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (7, N'C445566', 3, N'Nissan', N'Nissan Frontier', 2021, 23000.00, N'Disponible', NULL, N'/media/vehiculos/Nissan Frontier Manual.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (8, N'C456789', 2, N'Nissan', N'Nissan Versa', 2018, 2000.00, N'Disponible', NULL, N'/media/vehiculos/Nissan-Versa.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (9, N'C556677', 3, N'Mazda', N'Mazda CX-50', 2025, 43000.00, N'Disponible', NULL, N'/media/vehiculos/Mazda CX-50.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (10, N'C567890', 5, N'Honda', N'CR-V', 2023, 3800.00, N'Disponible', NULL, N'/media/vehiculos/HCRV-2023.jpeg');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (11, N'C678901', 5, N'Ford', N'Explorer', 2022, 4500.00, N'Disponible', NULL, N'/media/vehiculos/Ford-Explorer.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (12, N'C789012', 5, N'Hyundai', N'Tucson', 2022, 3200.00, N'Disponible', NULL, N'/media/vehiculos/tucson-2022.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (13, N'C890123', 5, N'Suzuki', N'Suzuki Vitara', 2024, 5000.00, N'Disponible', NULL, N'/media/vehiculos/Suzuki Vitara.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (14, N'C901234', 5, N'Suzuki', N'Suzuki Jimny GLX 4P', 2025, 6000.00, N'Disponible', NULL, N'/media/vehiculos/Suzuki Jimny GLX 4P.png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (15, N'L667788', 7, N'Nissan', N'Nissan Urvan Manual', 2015, 2400.00, N'Disponible', NULL, N'/media/vehiculos/Nissan Urvan Manual Van .png');
INSERT INTO dbo.Vehiculos (Id, Placa, CategoriaId, Marca, Modelo, Anio, PrecioDia, EstadoOperativo, MantenimientoHasta, FotoUrl) VALUES (16, N'L778899', 7, N'Suzuki', N'Suzuki APV Panel Van', 2014, 1300.00, N'Disponible', NULL, N'/media/vehiculos/Suzuki-APV-1.png');
SET IDENTITY_INSERT dbo.Vehiculos OFF;

-- Alquileres
SET IDENTITY_INSERT dbo.Alquileres ON;
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (1, 11, 13, 8, N'Mostrador', N'2026-04-08', N'2026-04-12', NULL, 5000.00, 4, 20000.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (2, 2, 12, 1, N'Mostrador', N'2026-04-10', N'2026-04-12', N'2026-04-12', 3200.00, 2, 6400.00, 0, 0, N'Completado', N'Migración: completado sin fecha de regreso en origen; se asume fecha fin pactada');
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (3, 13, 6, 1, N'Mostrador', N'2026-04-10', N'2026-04-20', NULL, 2200.00, 11, 24200.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (4, 13, 6, 1, N'Mostrador', N'2026-04-10', N'2026-04-20', NULL, 2200.00, 11, 24200.00, 0, 0, N'Cancelado', N'Migración: duplicado del alquiler #3 (mismo cliente, vehículo y fechas)');
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (5, 13, 6, 1, N'Mostrador', N'2026-04-10', N'2026-04-20', NULL, 2200.00, 11, 24200.00, 0, 0, N'Cancelado', N'Migración: duplicado del alquiler #3 (mismo cliente, vehículo y fechas)');
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (6, 10, 11, 1, N'Mostrador', N'2026-04-11', N'2026-04-23', NULL, 4500.00, 13, 58500.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (7, 10, 3, 1, N'Mostrador', N'2026-04-11', N'2026-04-22', N'2026-05-02', 2000.00, 12, 24000.00, 10, 26000.00, N'Completado', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (8, 12, 12, 1, N'Mostrador', N'2026-04-13', N'2026-04-15', NULL, 3200.00, 3, 9600.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (9, 15, 9, 1, N'Mostrador', N'2026-04-14', N'2026-04-16', NULL, 43000.00, 3, 129000.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (10, 16, 2, 1, N'Mostrador', N'2026-04-14', N'2026-04-15', NULL, 2500.00, 2, 5000.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (11, 17, 5, 1, N'Mostrador', N'2026-04-14', N'2026-04-21', NULL, 5200.00, 8, 41600.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (12, 18, 14, 1, N'Mostrador', N'2026-04-15', N'2026-04-17', NULL, 6000.00, 3, 18000.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (13, 18, 4, 1, N'Mostrador', N'2026-05-01', N'2026-05-02', NULL, 2000.00, 2, 4000.00, 0, 0, N'Activo', NULL);
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (14, 18, 16, 1, N'Mostrador', N'2026-05-02', N'2026-05-12', NULL, 1300.00, 10, 13000.00, 0, 0, N'Activo', N'Migración: monto_total NULL en origen; se toma de la factura');
INSERT INTO dbo.Alquileres (Id, ClienteId, VehiculoId, RegistradoPorUsuarioId, Canal, FechaInicio, FechaFinPactada, FechaDevolucion, PrecioDia, Dias, MontoBase, DiasMora, MontoMora, Estado, Observaciones) VALUES (15, 18, 15, 1, N'Mostrador', N'2026-05-02', N'2026-05-04', NULL, 2400.00, 3, 7200.00, 0, 0, N'Activo', NULL);
SET IDENTITY_INSERT dbo.Alquileres OFF;

-- Facturas (se conservan número, monto y fecha)
SET IDENTITY_INSERT dbo.Facturas ON;
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (1, 2, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 6400.00, N'Tarjeta', N'2026-04-10 21:46:01');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (2, 7, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 50000.00, N'Efectivo', N'2026-04-11 04:44:02');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (3, 8, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 9600.00, N'Efectivo', N'2026-04-14 03:09:15');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (4, 9, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 129000.00, N'Efectivo', N'2026-04-14 04:05:50');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (5, 10, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 5000.00, N'Tarjeta', N'2026-04-14 04:48:29');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (6, 11, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 41600.00, N'Efectivo', N'2026-04-14 21:05:10');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (7, 12, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 18000.00, N'Efectivo', N'2026-04-15 17:49:09');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (8, 13, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 4000.00, N'Efectivo', N'2026-05-01 19:52:49');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (9, 14, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 13000.00, N'Efectivo', N'2026-05-02 04:14:37');
INSERT INTO dbo.Facturas (Id, AlquilerId, Tipo, Concepto, Monto, MetodoPago, FechaEmision) VALUES (10, 15, N'Alquiler', N'Alquiler (migrado del sistema anterior)', 7200.00, N'Efectivo', N'2026-05-02 04:22:06');
SET IDENTITY_INSERT dbo.Facturas OFF;

COMMIT TRANSACTION;
PRINT N'Datos migrados.';
GO
