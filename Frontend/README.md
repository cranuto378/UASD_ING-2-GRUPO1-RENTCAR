# AutoGo · Frontend final

Frontend de AutoGo preparado para trabajar exclusivamente contra el backend GraphQL.

## Ejecución

1. Configura `js/config.js` con la URL del backend.
2. El backend debe exponer GraphQL en `{API_URL}/graphql`.
3. Sirve la carpeta `frontend/` con un servidor web.

```js
window.AUTOGO_CONFIG = {
  API_URL: 'https://localhost:7180',
  VEHICULO_EXTRA: true,
  ADMIN_EXTRA: true
};
```

No existe modo demostración en esta versión. Las operaciones, configuración, facturas, Wallet GO, roles y devoluciones dependen del backend.

## Persistencia local permitida

Solo se guardan en el navegador preferencias de interfaz y estado no crítico: tema DAY/NIGHT, ancho del menú, sesión/token y estado visual de notificaciones leídas. Los parámetros de negocio ya no se guardan en `localStorage`.

## Módulos

- Panel administrativo
- Alquileres y devoluciones
- Flota y categorías
- Clientes
- Facturación / notas de crédito
- Wallet GO
- Reportes
- Configuración institucional
- Administradores, roles y permisos
- Portal del cliente

Consulta `../BACKEND_CONTRATO.md` para los campos y operaciones que debe soportar el backend.
