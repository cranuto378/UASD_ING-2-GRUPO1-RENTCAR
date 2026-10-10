# AutoGo — Análisis del sistema anterior y decisiones de diseño

Sistema analizado: `Sistema_ADV G1RentaCar` (WinForms .NET 10 + MySQL `sistema_adv`, dump del 2026-05-03).

## 1. Hallazgos (lo que no hacía sentido)

Ordenados por impacto. Cada uno indica qué se hizo en AutoGo y si queda algo por decidir.

### Críticos

| # | Hallazgo | Evidencia | En AutoGo |
|---|----------|-----------|-----------|
| 1 | **Contraseñas en texto plano** y login por `correo OR nombre`. Hay dos usuarios llamados "Admin", así que el login por nombre es ambiguo. | `Login.cs`, tabla `usuarios` | Hash BCrypt, login sólo por correo (único). Los usuarios migrados quedan con `DebeCambiarPassword = 1`. |
| 2 | **Cadena de conexión con contraseña de root en el código** (`uid=root;pwd=124578`). | `Conexion.cs` | Cadena en `appsettings` / variables de entorno. Clave JWT fuera del repo (user-secrets). |
| 3 | **El estado `'vencido'` no existe en el ENUM** de `alquileres.estado`, pero `VehiculoEstadoService` lo asigna. En modo estricto el UPDATE falla y el `catch { }` vacío lo oculta: nunca funcionó. | `VehiculoEstadoService.cs` vs. `ENUM('activo','completado','cancelado')` | "Vencido" es un cálculo (`Activo` y `FechaFinPactada < hoy`), no un estado guardado. Campo `vencido` y `diasRetraso` en GraphQL. |
| 4 | **Las facturas se reescriben.** Al devolver con mora o editar un alquiler se hace `UPDATE facturas SET monto_pagado = ...` sobre la factura original. Un documento fiscal emitido no debe modificarse. Ej.: factura #2 dice RD$50,000 con fecha 11/04, pero la mora se generó el 02/05. | `FormGestionarDevolucion.cs`, `FormEditarAlquiler.cs` | Facturas inmutables. Mora = factura nueva tipo `Mora`. Modificación = factura `Ajuste` (positiva o nota de crédito negativa). |
| 5 | **Sin transacciones.** Alquiler + factura + estado del vehículo son 3–4 comandos sueltos. Si falla el segundo, queda un alquiler sin factura. Los alquileres #3, #4 y #5 son idénticos (triple clic / reintento). | `FormNuevoAlquiler.cs`, datos | Cada operación de escritura es **un** SP con `BEGIN TRAN` + `XACT_ABORT`. Bloqueo `UPDLOCK/HOLDLOCK` del vehículo para evitar doble alquiler concurrente. |
| 6 | **No se valida choque de fechas**: se puede alquilar el mismo vehículo dos veces en el mismo rango (el filtro sólo mira `estado = 'disponible'` en ese instante). | Alquileres #3–#5 | Función `ufn_AlquileresEnConflicto` usada por la búsqueda de disponibles y como guarda atómica en los SPs de creación/modificación. |

### Reglas de negocio inconsistentes

| # | Hallazgo | En AutoGo |
|---|----------|-----------|
| 7 | **Dos fórmulas de días.** El trigger usaba `DATEDIFF(fin, inicio)` (10→12 = 2 días) y la app `(fin − inicio) + 1` (10→12 = 3 días), y luego corregía el trigger con otro UPDATE. En los datos hay alquileres cobrados de ambas formas (#2 y #14 con 2 días; el resto con +1). | Una sola regla en `PoliticaTarifas`, configurable: `Tarifas:ContarDiaDeEntrega`. **Por defecto `false` (periodos de 24 h, estándar de la industria)**. ⚠️ *Decisión pendiente tuya.* |
| 8 | **Dos flujos de devolución distintos**: `FormNuevaFactura` deja el vehículo `disponible` y crea otra factura "efectivo" fija; `FormGestionarDevolucion` lo pasa a `mantenimiento` y cobra mora ×1.30. | Un único caso de uso `registrarDevolucion`: calcula mora, factura la mora aparte, y envía el vehículo a mantenimiento hasta el siguiente día laborable. |
| 9 | **El estado del vehículo se guarda y se desincroniza.** En el dump hay 11 vehículos "alquilado" aunque varios alquileres ya pasaron; el C223344 sigue en "mantenimiento" desde mayo. La liberación dependía de que alguien abriera la app. | Se guarda sólo el estado **operativo** (Disponible / Mantenimiento con fecha fin / FueraDeServicio). "Alquilado" se **deriva** de los alquileres. El mantenimiento vence solo al llegar `MantenimientoHasta` (sin jobs). |
| 10 | **Precio no congelado**: `monto_total` se recalcula con el `precio_dia` actual del vehículo al editar. Cambiar la tarifa altera alquileres ya pactados. | `Alquileres.PrecioDia` guarda la tarifa pactada. |
| 11 | **Editar alquiler permite poner cualquier estado** (`activo/completado/cancelado`) desde un combo, sin fecha de devolución ni reglas. | Estados sólo cambian por casos de uso: `cancelarAlquiler`, `registrarDevolucion`. |
| 12 | **Factor de mora 1.30 fijo en el código** y sin mora mínima/tolerancia. | `Tarifas:FactorMora` en configuración. |

### Modelo de datos

| # | Hallazgo | En AutoGo |
|---|----------|-----------|
| 13 | **Clientes y administradores en la misma tabla** `usuarios`; clientes creados en mostrador tienen contraseña NULL (no pueden entrar). `alquileres.id_cliente` apunta a `usuarios`. | `Usuarios` = cuentas de acceso. `Clientes` = personas que alquilan (con `UsuarioId` opcional). Un cliente de mostrador puede crear su cuenta después y se **vincula** por cédula en lugar de duplicarse. |
| 14 | **`id_usuario` del empleado se adivina**: se busca un admin por *nombre* o se usa el primero / el id 1. Los alquileres del portal quedaban a nombre del primer admin. | `RegistradoPorUsuarioId` sale del JWT; `NULL` + `Canal = Portal` cuando lo hace el cliente. |
| 15 | **Tabla `reservaciones` sin uso** (0 filas, ninguna pantalla). | Eliminada. Un alquiler con fecha de inicio futura **es** la reserva (se factura al crear). Si quieren reservas sin pago, se agrega un estado `Reservado`. ⚠️ *Pendiente.* |
| 16 | **Categoría en texto libre** (`Economico`, `Sedán`, `Negocio`...). `modelo` repite la marca ("Nissan Versa"), y el C223344 es marca "Chevrolet" modelo "Suzuki Celerio". | Tabla `Categorias`. Los datos raros se migraron tal cual para que los corrijan. |
| 17 | **`foto_url` con rutas de Windows** (`Resources\\tc2022.jpeg`), una rota (`Resourceskia_rio.jpg`). | URLs servidas por la API (`/media/vehiculos/...`) + mutación `subirFotoVehiculo` (multipart). La rota queda en NULL. |
| 18 | **Borrado físico** de clientes y vehículos (falla por FK si tienen historial). | Baja lógica (`Activo = 0`), bloqueada si hay alquileres activos. |
| 19 | **Esquema que se "autorrepara" en runtime**: `ALTER TABLE` si no existe `debe_cambiar`, consultas a `INFORMATION_SCHEMA`. Tres scripts SQL distintos y desalineados (`setup_SAV.sql`, `Consultas.sql`, dumps). | Un solo juego de scripts versionados en `database/`. La API asume el esquema. |
| 20 | **Recuperación de contraseña**: genera clave con `Random` (no criptográfico), la guarda en texto plano y la envía por `mailto:` (abre el Outlook del *empleado*). | Token aleatorio criptográfico, se guarda sólo su SHA‑256, expira en 30 min, un solo uso, se envía por `IEmailSender`. La respuesta no revela si el correo existe. |
| 21 | `correo` no es único en la BD real (sólo índice), aunque el script dice UNIQUE. Hay un correo inválido (`angelino@peraltino`). | `UQ_Usuarios_Correo`. El correo inválido se migró; conviene corregirlo. |
| 22 | Vista `vista_alquileres_activos.dias_retraso` da números negativos para alquileres que no han vencido. | `diasRetraso` = 0 si no está vencido. |

## 2. Separación de responsabilidades BD ↔ API

Pediste separar lo más posible. La línea que seguí:

**La base de datos (SQL Server) sólo:**
- Guarda datos e integridad estructural: PK, FK, UNIQUE, CHECK (ej. `FechaFinPactada >= FechaInicio`, facturas con monto > 0 salvo ajustes).
- Ejecuta cada escritura de forma **atómica** dentro de un SP (transacción).
- Garantiza el único invariante que requiere bloqueo: *un vehículo no puede estar comprometido dos veces en las mismas fechas*. Esto no puede hacerse de forma segura desde la API sin transacción de BD.
- Expone lecturas vía SPs (joins, filtros). Nada de triggers.

**La API (C#) decide todo lo de negocio:**
- Cuántos días se cobran, el monto, la mora, el factor.
- Qué día es "hoy" (zona horaria de RD) — se pasa `@Hoy` a los SPs.
- Si un vehículo puede alquilarse (mantenimiento, fuera de servicio), su estado visible, si un alquiler está vencido.
- Hasta cuándo queda en mantenimiento (siguiente día laborable, respetando feriados configurados).
- Quién puede hacer qué (roles + propiedad del recurso).
- Textos de las facturas.

Si mañana cambia la regla de mora o de días, **no se toca la BD**.

## 3. Migración de datos (`03_migracion_datos.sql`)

- Conserva IDs de usuarios/clientes, alquileres y **números de factura**.
- 5 cuentas: admins #1, #7, #8 y clientes con contraseña #2, #18. Todas con BCrypt y obligadas a cambiar la clave. Los otros 10 clientes quedan sin cuenta (pueden registrarse y se vinculan por cédula).
- Alquileres #4 y #5 → `Cancelado` con observación "duplicado del #3".
- Alquiler #2: `completado` sin fecha de regreso → se asume la fecha fin pactada.
- Alquiler #14: `monto_total` NULL → se tomó de su factura (RD$13,000).
- Alquiler #7: se separó base (RD$24,000) y mora (10 días, RD$26,000). Su factura #2 se conserva con el total original.
- Hay 11 alquileres "activos" que vencieron entre abril y mayo. Aparecerán como **vencidos**; hay que registrar su devolución o cancelarlos.

## 4. Decisiones pendientes (para analizarlas juntos)

1. **Regla de días**: ¿10→12 son 2 días (recomendado) o 3 (como cobraba el sistema)? Se cambia con `Tarifas:ContarDiaDeEntrega`.
2. **Reservas sin pago**: hoy crear un alquiler futuro factura de inmediato. ¿Quieren reservas con pago al retirar?
3. **Cancelación**: implementé "sólo antes de la fecha de salida, reembolso 100%". ¿Hay penalidad?
4. **ITBIS (18%)**: ni el sistema anterior ni AutoGo lo calculan. Si facturan con NCF, hay que modelar impuestos y secuencias de comprobantes.
5. **Mantenimiento post-devolución**: 1 día laborable fijo, como antes. ¿Debería ser configurable por categoría?
6. **Feriados**: la lista `Negocio:Feriados` está vacía; hay que cargar el calendario oficial.
