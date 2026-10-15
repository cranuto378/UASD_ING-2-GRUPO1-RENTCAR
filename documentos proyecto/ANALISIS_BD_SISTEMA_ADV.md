# Análisis: Backend AutoGo ↔ Base de datos Sistema_ADV

## Resumen

El script original de **Sistema_ADV** **no era compatible** con el backend. El backend (.NET 8, GraphQL, Dapper) está construido sobre una arquitectura donde **todo acceso a datos pasa por ~37 stored procedures `usp_*`** y un modelo de dominio más rico que el esquema nuevo. Si se hubiera apuntado la cadena de conexión sin más, **todas las operaciones fallarían** (`Could not find stored procedure 'dbo.usp_...'`).

## Qué se hizo

| # | Cambio | Archivo | Por qué |
|---|--------|---------|---------|
| 1 | Script de alineación del esquema (idempotente) | `backend/db/01_alineacion_sistema_adv.sql` | Añade las tablas/columnas que el backend necesita sin borrar las del script original |
| 2 | Script con los 37 stored procedures | `backend/db/02_procedures_sistema_adv.sql` | El backend no ejecuta SQL inline; sin estos SPs no funciona nada |
| 3 | Cadena de conexión → `localhost\SQLEXPRESS` / `Sistema_ADV` | `backend/src/AutoGo.Api/appsettings.json` | Apuntaba a una BD `AutoGo` inexistente en esta máquina |
| 4 | Traductor de errores SQL reconoce la PK de `vehiculos` (placa) y `UQ_usuarios_correo` | `SqlErrorTranslator.cs` | Los mensajes de duplicado dependen del nombre del constraint; el nuevo esquema usa nombres distintos |

**Orden de ejecución en SSMS:** primero `01_alineacion_sistema_adv.sql`, luego `02_procedures_sistema_adv.sql` (ambos contra `Sistema_ADV`, ambos re-ejecutables).

## Errores/problemas encontrados en el script original (y su solución)

1. **`vehiculos.placa` como PRIMARY KEY.** El dominio y la API GraphQL identifican vehículos por `Id` entero (`Vehiculo(id: 5)`, `alquileres.VehiculoId`). Con placa como única clave, cambiar una placa rompe FKs y la API no puede exponer IDs estables.  
   → Se añadió `id_vehiculo INT IDENTITY UNIQUE` (la PK por placa se conserva por compatibilidad).

2. **`vehiculos.categoria` como `varchar(50)`.** El backend administra categorías como entidad (crear, listar, filtrar por `categoriaId`).  
   → Nueva tabla `categorias` + FK; los valores varchar existentes se migran automáticamente.

3. **`vehiculos.estado` guarda `'alquilado'`.** "Alquilado" no es un estado persistible: se **deriva** de los alquileres activos. Guardarlo desincroniza datos (un vehículo puede quedar "alquilado" sin alquiler).  
   → `estado_operativo` (`Disponible`/`Mantenimiento`/`FueraDeServicio`) + `mantenimiento_hasta` + `activo`. La columna vieja `estado` se mantiene sincronizada por trigger para las vistas originales. El CHECK viejo (`CK_vehiculos_estado`) se elimina porque contradice el modelo.

4. **No existía tabla `clientes`.** En el dominio, **Cliente ≠ Usuario**: un cliente puede registrarse en mostrador sin cuenta (cédula, licencia) y luego vincular una cuenta del portal. El script original usaba `usuarios` como clientes y ponía la cédula ahí.  
   → Nueva tabla `clientes` (con `UQ_Clientes_Cedula`) y `usuarios.id_cliente` como vínculo. La cédula en `usuarios` queda en desuso (se le quita el UNIQUE).

5. **`usuarios` sin `activo`, `debe_cambiar_password` ni vínculo a cliente.** El login valida cuentas activas; el admin crea cuentas con contraseña temporal que debe cambiarse al primer ingreso.  
   → Columnas añadidas.

6. **`facturas` incompleta:** sin `tipo` ni `concepto`, y `metodo_pago` con CHECK en minúsculas (`'efectivo'`...). El backend emite facturas de **Alquiler, Mora y Ajuste** (cargo o **nota de crédito con monto negativo** en cancelaciones) y el enum es `Efectivo/Tarjeta/Transferencia`.  
   → Columnas `tipo`/`concepto` añadidas; CHECK reemplazado por mayúsculas. `monto_pagado` ahora admite negativos (notas de crédito).

7. **`alquileres` demasiado plano:** sin canal (Mostrador/Portal), sin fecha de devolución real, sin `precio_dia`/`dias`/`monto_base` (tarifa pactada congelada), sin mora (`dias_mora`/`monto_mora`), sin `estado` (Activo/Completado/Cancelado) ni observaciones. Toda la lógica de vencidos, devoluciones y cancelaciones del backend depende de esos campos. Además `id_cliente` apuntaba a `usuarios` en vez de a `clientes`.  
   → Columnas añadidas; FK de cliente re-apuntada a `clientes`; FK `id_vehiculo` nueva. La FK a `reservaciones` se conserva pero **el backend aún no usa reservaciones** (queda para una iteración futura).

8. **Sin tabla de tokens de recuperación.** El flujo "olvidé mi contraseña" necesita guardar el hash del token y su expiración.  
   → Nueva tabla `tokens_recuperacion`.

9. **`alquileres.no_reserva INT NULL` con FK a `reservaciones`.** Sin problemas técnicos, pero el backend no tiene ese concepto todavía: los SPs lo dejan NULL. Cuando se implementen reservaciones habrá que añadir SPs y endpoints.

10. **Vistas originales** (`vista_alquileres`, `vista_pagos`) unían `id_cliente` con `usuarios`; se reescribieron (`CREATE OR ALTER`) para unir con `clientes`. `vista_vehiculos_disponibles` sigue funcionando gracias al trigger de compatibilidad.

11. **SPs originales con el mismo nombre que conceptos del backend pero distinta firma** (`registrar_cliente`, `vehiculos_disponibles`, `alquileres_por_cliente`): se conservan intactos; el backend usa exclusivamente los `usp_*`.

## Detalles de los SPs nuevos que conviene conocer

- **Concurrencia:** `usp_Alquiler_Crear` bloquea la fila del vehículo (`UPDLOCK, HOLDLOCK`) dentro de una transacción y valida el choque de fechas → dos alquileres concurrentes del mismo vehículo se serializan y el segundo recibe el error `51001` (`VEHICULO_NO_DISPONIBLE`).
- **Errores controlados:** `THROW 51000` (no encontrado), `51001` (vehículo no disponible), `51002` (estado cambió / ya tiene cuenta), `51003` (token inválido) — mapeados en `SqlErrorTranslator.cs`.
- **Devolución:** al registrar devolución el vehículo pasa a `Mantenimiento` hasta el siguiente día laborable (buffer de inspección) y, si hay mora, se factura como `tipo = 'Mora'`.
- **`usp_Vehiculo_Crear`:** no usa `SCOPE_IDENTITY()` directamente porque la PK clustered sigue siendo `placa`; lee el `id_vehiculo` por la placa recién insertada.

## Datos semilla mínimos (ejecutar manualmente después)

```sql
-- Categorías (si la migración de la columna vieja no creó ninguna)
INSERT INTO dbo.categorias (nombre) VALUES ('Sedán'), ('SUV'), ('Jeepeta'), ('Camioneta');

-- Primer administrador: el hash BCrypt se genera desde el backend o con cualquier
-- herramienta BCrypt (factor 11). Ejemplo con contraseña 'Admin123*':
-- (generar hash en https://bcrypt-generator.com/ y pegarlo abajo)
INSERT INTO dbo.usuarios (nombre, correo, contrasena, rol, debe_cambiar_password)
VALUES ('Administrador', 'admin@autogo.com', '<HASH_BCRYPT_AQUI>', 'Administrador', 1);
```

## Limitaciones conocidas (backend sin cambios, por ahora)

- **Reservaciones:** la tabla existe pero no hay endpoints; se gestionan sólo por SQL.
- **Primer admin:** debe insertarse por SQL (no puede haber auto-registro de administradores por seguridad).
- **Frontend:** no requiere cambios de código; usa la misma API GraphQL.
- **Azure:** la cadena de conexión actual usa autenticación de Windows (`Trusted_Connection`). Al migrar a Azure SQL habrá que cambiarla a usuario/clave (`User ID=...;Password=...`) y ajustar firewall. Ejecutar los dos scripts también en Azure.
