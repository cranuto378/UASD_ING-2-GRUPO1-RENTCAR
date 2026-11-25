# Integración del backend

Este documento resume los datos y reglas que el frontend de AutoGo espera del backend GraphQL.

## Sesión y perfiles

La sesión debe identificar el tipo de usuario y, para administradores, el perfil correspondiente.

```text
rol: ADMINISTRADOR | CLIENTE
perfil: Superadministrador | Administrador | Operador | Consulta
```

## Vehículos y disponibilidad

`vehiculosDisponibles(fechaInicio, fechaFin, categoriaId)` debe devolver únicamente los vehículos disponibles para el rango solicitado.

La disponibilidad debe considerar:

- reservas y alquileres que se crucen con el rango;
- mantenimiento posterior a una devolución;
- mantenimiento manual por daños;
- vehículos fuera de servicio;
- vehículos inactivos.

Una reserva futura no debe cambiar el estado operativo actual del vehículo a `ALQUILADO`. Ese estado representa un vehículo físicamente entregado al cliente.

## Estados de alquiler

La interfaz contempla:

- Reserva: la fecha de salida todavía no ha llegado.
- En curso: el vehículo está en uso.
- Por devolver: la devolución corresponde al día actual.
- Vencido: pasó la fecha pactada y no se ha registrado devolución.
- Completado: la devolución fue registrada.
- Cancelado: el alquiler o reserva fue cancelado.

## Mantenimiento

`diasMantenimientoPostDevolucion` se obtiene de la configuración general.

- Una devolución sin daños coloca el vehículo en mantenimiento durante el período configurado.
- Una devolución con daños mantiene el vehículo en mantenimiento hasta que un administrador lo habilite manualmente.

## Modificación de alquiler

Al validar una modificación, la disponibilidad debe excluir el mismo alquiler que se está editando.

El backend puede implementar una operación específica, por ejemplo:

```text
cotizarModificacionAlquiler(alquilerId, vehiculoId, fechaInicio, fechaFin)
```

o permitir que la cotización general reciba un alquiler a excluir.

## Facturación y Wallet GO

El frontend necesita distinguir el importe total de la factura, la parte cubierta con Wallet GO y el dinero nuevo recibido.

La respuesta de una factura debe ofrecer información equivalente a:

```text
total
walletAplicado
pagoAdicional
metodoPagoAdicional
ingresoNuevo
```

Los nombres pueden variar si `js/api.js` se adapta al contrato definitivo.

### Regla de ingresos

- Efectivo, transferencia y tarjeta recibidos cuentan como ingreso nuevo.
- El saldo Wallet GO reutilizado no vuelve a contabilizarse como ingreso.
- Las notas de crédito no son ingresos.
- En un retiro de Wallet GO, solo la parte retenida por AutoGo representa ingreso de la empresa.
- La retención del retiro de Wallet GO no forma parte de una factura normal de alquiler, ajuste o mora.

## Canales

Los canales de alquiler utilizados por la interfaz son:

```text
PORTAL
MOSTRADOR
```

## Configuración

La configuración general debe incluir los datos institucionales y parámetros necesarios para las reglas de alquiler, mantenimiento, mora y Wallet GO.

## Reportes

El módulo de Reportes utiliza:

- facturas del período;
- alquileres;
- ingresos derivados de retiros Wallet GO.

Los alquileres del período se determinan por su fecha de salida. El CSV exporta la información correspondiente al filtro activo.
