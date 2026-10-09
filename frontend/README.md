# AutoGo Rent a Car — Frontend

Interfaz web del Sistema de Alquiler de Vehículos (UASD · Ingeniería de Software · Grupo 1).
HTML, CSS y JavaScript sin dependencias ni compilación; se conecta a la API GraphQL de AutoGo.

## Estructura

```
index.html                     Página única de la aplicación
styles.css                     Estilos (diseño glass)
js/config.js                   URL de la API y modo demostración
js/api.js                      Cliente GraphQL: sesión, token y todas las operaciones
js/ui.js                       Íconos, formatos, modales, avisos y formularios
js/app.js                      Rutas y pantallas
js/demo.js                     Datos locales para usar el front sin backend
restablecer-password/          Recibe el enlace del correo de recuperación
img/vehiculos/                 Fotos de la flota de demostración
logo.png, banner.jpg, fondo_login.png
```

## Cómo ejecutarlo

Se necesita un servidor estático (no abrir el archivo con doble clic). Cualquiera de estos sirve:

```bash
npx serve .
# o
python -m http.server 5500
```

Con VS Code también funciona la extensión **Live Server**.

### Conectar con la API

En `js/config.js`:

```js
window.AUTOGO_CONFIG = {
  API_URL: 'https://localhost:7180',   // sin /graphql
  DEMO: false                          // true = datos locales, sin backend
};
```

Actualmente viene con `DEMO: true` para poder mostrarlo sin backend; al conectar la API real hay que ponerlo en `false`.

El backend debe permitir el origen del front en CORS y, en desarrollo, el navegador debe confiar en el certificado de `localhost`.

### Modo demostración

Para presentar sin backend, abrir la página con `?demo=1` (se recuerda en el navegador; `?demo=0` lo desactiva y `?demo=reset` reinicia los datos).

| Rol            | Correo             | Contraseña |
|----------------|--------------------|------------|
| Administrador  | admin@autogo.com   | Admin2026  |
| Cliente        | ana@correo.com     | Clave2026  |

El modo demostración aplica las mismas reglas de la guía de la API: rango máximo de 90 días, mora del 30 % por día de retraso, notas de crédito al cancelar, mantenimiento tras la devolución, cambio obligatorio de contraseña temporal, etc. En este modo el enlace de recuperación de contraseña se muestra en la consola del navegador.

## Pantallas

| Pantalla                 | Rol      | Operaciones                                                                 |
|--------------------------|----------|-----------------------------------------------------------------------------|
| Iniciar sesión           | Público  | `login`                                                                     |
| Crear cuenta             | Público  | `registrarCliente`                                                          |
| Recuperar contraseña     | Público  | `solicitarRecuperacionPassword`                                             |
| Restablecer contraseña   | Público  | `restablecerPassword`                                                       |
| Catálogo                 | Público  | `categorias`, `vehiculosDisponibles`                                        |
| Confirmar alquiler       | Cliente  | `cotizarAlquiler`, `crearAlquiler`                                          |
| Inicio                   | Cliente  | `misAlquileres`, `misFacturas`                                              |
| Mis alquileres           | Cliente  | `misAlquileres`, `cotizarDevolucion`, `cancelarAlquiler`                    |
| Mis facturas / Factura   | Cliente  | `misFacturas`, `factura`                                                    |
| Mi perfil                | Cliente  | `miPerfil`                                                                  |
| Cambiar contraseña       | Ambos    | `cambiarPassword`                                                           |
| Panel de control         | Admin    | `dashboard`, `alquileres`, `facturas`                                       |
| Nuevo alquiler           | Admin    | `clientes`, `crearCliente`, `vehiculosDisponibles`, `cotizarAlquiler`, `crearAlquiler` |
| Alquileres               | Admin    | `alquileres`, `modificarAlquiler`, `cancelarAlquiler`, `cotizarDevolucion`, `registrarDevolucion` |
| Flota                    | Admin    | `vehiculos`, `categorias`, `crearVehiculo`, `actualizarVehiculo`, `cambiarEstadoVehiculo`, `subirFotoVehiculo`, `desactivarVehiculo`, `crearCategoria` |
| Clientes                 | Admin    | `clientes`, `cliente`, `crearCliente`, `actualizarCliente`, `desactivarCliente` |
| Facturación              | Admin    | `facturas`, `factura`                                                       |
| Administradores          | Admin    | `crearAdministrador`                                                        |

## Notas de funcionamiento

- El front no calcula montos, días ni mora: siempre muestra lo que devuelven `cotizarAlquiler` y `cotizarDevolucion`.
- El token se guarda en `localStorage` si se marca "Recordarme" (si no, en `sessionStorage`) y la sesión se cierra sola al vencer `expiraEnUtc`.
- Si `debeCambiarPassword` es verdadero, solo se permite la pantalla de cambio de contraseña hasta completarla.
- Los errores se manejan por `extensions.code` según la tabla de la guía (sesión vencida → login, campos duplicados → mensaje en el campo, `VEHICULO_NO_DISPONIBLE` → se refresca el catálogo, etc.).
- Las fotos se suben como GraphQL multipart (jpg, jpeg, png o webp, hasta 5 MB) y `fotoUrl` se completa con la URL base de la API.
- Las facturas se pueden imprimir o guardar en PDF desde el botón **Imprimir**.
- El diseño se adapta a móvil (menú inferior) y respeta las preferencias del sistema de menos movimiento y menos transparencia.

## Créditos de las fotos

Las fotos de `img/vehiculos/` se usan en el modo demostración y provienen de Wikimedia Commons con licencias Creative Commons. En el sistema real, cada vehículo muestra la foto que sube el administrador.

| Vehículo | Autor | Licencia | Fuente |
|---|---|---|---|
| Chevrolet Cruze | Elise240SX | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2017_Chevrolet_Cruze_LT_in_Arctic_Blue_Metallic,_Front_Left.jpg) |
| Ford Explorer | Alexander Migl | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ford_Explorer_(sixth_generation)_IMG_6063.jpg) |
| Honda CR-V | M 93 | CC BY-SA 3.0 de | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Honda_CR-V_e-HEV_Elegance_AWD_(VI)_%E2%80%93_f_14072024.jpg) |
| Hyundai Tucson | M 93 | CC BY-SA 3.0 de | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Hyundai_Tucson_1.6_T-GDI_PHEV_Prime_(IV)_%E2%80%93_f_05072025.jpg) |
| Kia Rio | Vauxford | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2021_Kia_Rio_3_MHEV_facelift_1.0.jpg) |
| Mazda CX-5 | Mr.choppers | CC BY-SA 3.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2024_Mazda_CX-5_2.5_S_Select_in_Platinum_Quartz_Metallic,_front_right.jpg) |
| Nissan Frontier | Vogue2Voke | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2021_Nissan_Navara_facelift_(cropped).jpg) |
| Nissan Versa | Kevauto | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2020_Nissan_Versa_SV_1.6L,_front_2.29.20.jpg) |
| Suzuki APV | オーバードライブ83 | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2014_Suzuki_APV_Arena_SGX_1.5_DN42V_(20190623).jpg) |
| Suzuki Celerio | Exhibit Magazine | CC BY 3.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2021_Maruti_Suzuki_Celerio_ZXi_(India)_front_view_02.png) |
| Toyota Corolla | Elise240SX | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2020_Toyota_Corolla_SE_Upgrade_Package_Sedan_in_Classic_Silver_Metallic,_front_left,_2025-04-20.jpg) |
| Toyota Hilux | Vauxford | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:2016_Toyota_HiLux_Invincible_D-4D_4WD_2.4_Front.jpg) |
