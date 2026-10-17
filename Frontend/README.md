# AutoGo Rent a Car

AutoGo es una aplicación para la gestión de alquiler de vehículos. Incluye un catálogo público, portal de clientes y panel administrativo.

## Funcionalidades principales

- Inicio de sesión, registro y recuperación de contraseña.
- Catálogo de vehículos con consulta de disponibilidad por fechas.
- Registro, modificación, cancelación y devolución de alquileres.
- Gestión de clientes, categorías y flota de vehículos.
- Facturas, ajustes, notas de crédito y cargos por mora.
- Wallet GO para créditos y uso de saldo en alquileres.
- Panel administrativo con perfiles y permisos.
- Configuración general del sistema.
- Reportes de ingresos, facturas, notas de crédito y alquileres.
- Exportación de reportes en CSV.
- Interfaz responsive con modos día y noche.

## Estructura del frontend

```text
index.html
styles.css
theme.css
auth.css
responsive.css
components.css
print.css

js/
  config.js
  ui.js
  api.js
  app.js
  reports.js
  mobile-menu.js
  catalog-consistency.js
  financial-ui.js
```

### Archivos de desarrollo local

Los siguientes archivos permiten ejecutar la interfaz sin depender del backend durante el desarrollo:

```text
js/local-db.js
js/local-db-fixes.js
js/local-finance-rules.js
js/local-finance-v3.js
js/demo-login.js
```

Los datos locales se almacenan en `localStorage` bajo la clave `autogo.localdb.v1`.

## Configuración

La integración se define en `js/config.js`:

```js
window.AUTOGO_CONFIG = {
  API_URL: 'https://localhost:7180',
  LOCAL_DB: true,
  VEHICULO_EXTRA: true,
  ADMIN_EXTRA: true
};
```

- `API_URL`: dirección del backend.
- `LOCAL_DB`: usa los datos locales de desarrollo cuando está en `true`.
- `VEHICULO_EXTRA`: habilita los campos ampliados de vehículos.
- `ADMIN_EXTRA`: habilita la gestión ampliada de administradores.

Para utilizar el backend GraphQL, se configura la dirección correspondiente y se cambia:

```js
LOCAL_DB: false
```

## Perfiles administrativos

La interfaz contempla los siguientes perfiles:

- Superadministrador
- Administrador
- Operador
- Consulta

Los permisos se definen en `js/app.js`.

## Datos y backend

El frontend consume un único endpoint GraphQL mediante `js/api.js`. La persistencia definitiva corresponde al backend y a SQL Server / Azure SQL.

Los contratos y reglas necesarias para la integración se describen en [`INTEGRACION_BACKEND.md`](INTEGRACION_BACKEND.md).
