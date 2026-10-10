namespace AutoGo.Domain.Enums;

public enum Rol { Administrador, Cliente }

/// <summary>Estado que se GUARDA en BD: lo que no puede derivarse de los alquileres.</summary>
public enum EstadoOperativo { Disponible, Mantenimiento, FueraDeServicio }

/// <summary>Estado que se MUESTRA: derivado de <see cref="EstadoOperativo"/> + alquileres.</summary>
public enum EstadoVehiculo { Disponible, Alquilado, Mantenimiento, FueraDeServicio }

public enum EstadoAlquiler { Activo, Completado, Cancelado }

public enum CanalAlquiler { Mostrador, Portal }

public enum TipoFactura { Alquiler, Mora, Ajuste }

public enum MetodoPago { Efectivo, Tarjeta, Transferencia }
