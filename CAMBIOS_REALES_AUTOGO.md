# Cambios reales que quedaron en AutoGo

## Tabla de comparación

| Módulo / archivo | Antes | Ahora | Por qué se cambió |
| --- | --- | --- | --- |
| `AutoGo.Application/Services/AuthService.cs` | El login no estaba reforzado con bloqueo por intentos, auditoría ni validación real del flujo de autenticación. | Queda con control de intentos fallidos, bloqueo temporal, registro de acceso y manejo de cambio de contraseña. | Para que la seguridad del acceso fuera real y no solo apariencia. |
| `AutoGo.Infrastructure/Persistence/Repositories/UsuarioRepository.cs` | El acceso a usuarios y seguridad estaba incompleto o desalineado con la base. | Se ajusta a los SP de login, bloqueo, auditoría y cambio de password. | Para que la API y la BD hablaran bien y no fallaran al autenticar. |
| `AutoGo.Domain/Entities/Usuario.cs` | La entidad de usuario no reflejaba bien la seguridad y el estado del acceso. | Se deja con la estructura real del dominio de usuario, activo, rol y password. | Para que el backend trabaje con el modelo correcto del usuario. |
| `AutoGo.Infrastructure/Persistence/Rows.cs` | Los rows no estaban alineados con la base real o con los resultados esperados de SQL. | Se deja el mapeo real para usuarios, clientes, vehículos, alquileres, factura y configuración. | Para que Dapper convierta bien los resultados de SQL al dominio. |
| `AutoGo.Infrastructure/Persistence/Mapeo.cs` | El mapeo era inconsistente y fallaba con los datos reales. | Se deja el mapeo coherente entre entidades y rows. | Para evitar errores de conversión y nulls/columnas mal leídas. |
| `AutoGo.Application/Abstractions/Repositorios.cs` | Los contratos de repositorio estaban incompletos o inconsistentes. | Quedan definidos los métodos reales que usa la app. | Para que cada servicio acceda a lo que realmente existe en la base. |
| `AutoGo.Application/Services/ClienteService.cs` | Las reglas de cliente eran incompletas y no protegían bien las operaciones. | Crear, actualizar y desactivar clientes queda validado. | Para que los clientes del sistema se creen y gestionen sin errores de negocio. |
| `AutoGo.Application/Services/VehiculoService.cs` | Vehículos, categoría, fotos y estados no estaban bien controlados. | Se valida placa, categoría, estado, mantenimiento y subida de foto. | Para que el catálogo de vehículos funcione correctamente. |
| `AutoGo.Application/Services/AlquilerService.cs` | El alquiler tenía reglas parciales y no estaba integrado bien al flujo real del negocio. | Se deja la cotización, creación, modificación, cancelación y devolución con validación real. | Para que la operación principal del negocio quede funcional. |
| `AutoGo.Infrastructure/Persistence/SqlConnectionFactory.cs` | Dependía de una configuración de conexión que estaba mal alineada. | Se mantiene la lectura desde `ConnectionStrings:AutoGo`. | Para centralizar la conexión SQL y evitar errores de conexión. |
| `backend/src/AutoGo.Api/appsettings.json` | Tenía una conexión Azure en texto plano y expuesta. | Se limpia la configuración base para no dejar secretos. | Para no publicar credenciales en el repositorio. |
| `backend/src/AutoGo.Api/appsettings.Development.json` | No estaba apuntando a la base local correcta. | Se configura para `Sistema_ADV` local con autenticación Windows. | Para trabajar localmente sin depender de Azure. |
| `backend/src/AutoGo.Api/appsettings.Production.json` | No existía. | Se crea como plantilla segura para Azure. | Para preparar la publicación sin secretos en Git. |
| `.gitignore` | No protegía ni secretos ni artefactos locales. | Se ignoran archivos locales, secretos y basura del entorno. | Para que no se suba lo que solo sirve al entorno de desarrollo. |
| `backend/tests/AutoGo.UnitTests/Fakes.cs` | Los fakes estaban rotos o inconsistentes. | Se dejan funcionando para pruebas reales del backend. | Para mantener la suite unitaria estable y válida. |


## Por qué se hicieron estos cambios

Porque el proyecto no estaba coherente en tres puntos clave:

1. la seguridad del login no estaba bien protegida
2. la base de datos no estaba alineada con la capa de infraestructura
3. el flujo de negocio principal (clientes, vehículos y alquileres) no estaba funcionando como se esperaba

Entonces se corrigió el núcleo funcional y la seguridad, y se dejó la configuración lista para publicar, pero sin secretos ni basura que no pertenecen al producto.

## Regla para Azure

La app debe usar:

- `appsettings.Development.json` para local
- `appsettings.Production.json` para Azure
-
## Resultado final

Lo que quedó como cambio real del proyecto es:

- backend con seguridad reforzada
- base y repositorios alineados
- catálogo, clientes y alquileres funcionales
- configuración preparada para Azure sin secretos expuestos
- Wallet fuera de alcance por decisión del proyecto


