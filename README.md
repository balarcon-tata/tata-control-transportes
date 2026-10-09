# Repositorio de pruebas — TATA Control de Transportes V7

**Estado al 09/10/2026:** código fuente de la interfaz, sin conexión activa a Supabase ni despliegue confirmado. No habilitar claves de API ni conectar personal real hasta completar la revisión de seguridad de las tablas engineering_balance_* en el proyecto compartido. El sitio web muestra un aviso de conexión pendiente.

---

> **AVISO IMPORTANTE:** La conexión a Supabase se ha desactivado en esta copia porque el proyecto existente contiene cuatro tablas `engineering_balance_*` con RLS deshabilitada y permisos anónimos de lectura/escritura. NO reinsertar URL ni clave publicable hasta asegurar las tablas y validar autorización corporativa. Esta copia no permite iniciar sesión ni registrar marcajes.

# TATA Control de Transportes V7 — código sin conexión activa

Esta aplicación es una **copia del código fuente estático**, sin compilar, sin Node.js y sin Firebase. El backend está deshabilitado hasta cerrar los problemas de seguridad existentes.

## Estado y alcance

- La conexión al proyecto `Balances_ingenieria` está **desactivada** y no se incluyen URL ni clave publicable.
- Utiliza **únicamente las tablas `tc_`** que ya fueron creadas y protegidas con RLS: `tc_usuarios`, `tc_personal`, `tc_vehiculos`, `tc_configuracion`, `tc_traslados`, `tc_marcajes` y `tc_alertas`.
- El acceso requiere **Supabase Authentication** y presencia en `tc_usuarios`. El administrador de pruebas está autorizado en `tc_usuarios`.
- La interfaz permite ver traslados, registrar salidas y llegadas, escanear con cámara en navegadores con `BarcodeDetector`, consultar flota, historial y rutas. Si el navegador no permite la cámara, se utiliza entrada manual.
- No requiere modificaciones a otras tablas o permisos del proyecto, ni crea un proyecto adicional.
- Incluye solo **datos ficticios**: `TEST-0001`, `TEST-0002`, `TEST-0003` y vehículos `TC-TEST-*`.
- Tiempos por ruta y vehículos son solo lectura en V7. El estado de los vehículos se **infiere** de los traslados activos; la columna de inventario no se cambia automáticamente.
- **No incluye automatización de Teams**, solo indicación visual de demoras. No hay marcajes reales de trabajadores autorizados hasta finalizar pruebas y aprobación corporativa.

## Publicar (sin instalar nada)

1. Crear en GitHub un repositorio **nuevo y separado** llamado `tata-control-transportes` bajo la cuenta apropiada. **No** utilizar ni sobrescribir el repositorio de otros proyectos.
2. Subir **el contenido descomprimido completo** a la raíz del repositorio: `index.html`, `styles.css`, `app.js`, `logo.jpg`, `gafetes_prueba.html` y la carpeta `gafetes/`.
3. Abrir **Settings → Pages**. En *Build and deployment* elegir **Deploy from a branch**, rama `main`, carpeta `/ (root)` y guardar.
4. Esperar a que GitHub Pages muestre la URL y abrirla. El sitio no funciona realmente hasta que GitHub finalice la publicación.
5. **NO intentar iniciar sesión todavía**: la conexión se encuentra desactivada hasta resolver los permisos de otras tablas del proyecto.

**Nota:** GitHub Pages en repositorios públicos expone el código estático, incluyendo la clave publicable de Supabase (lo cual es normal). La seguridad real depende de Auth y de las políticas RLS. No se incluyen datos de personal real ni tokens secretos. Confirma que TATA autorice el uso de GitHub Pages antes de publicarlo.

## Primera prueba

1. Iniciar sesión y comprobar que aparecen tres colaboradores de prueba y cuatro vehículos.
2. Abrir **Registro QR → Registrar salida**. Código `TEST-0001`, modalidad `A pie`, origen `Planta Cinturones` y destino `Planta Fajas`.
3. Pulsar **Registrar salida**. Debe aparecer un registro nuevo en **En curso** y en `tc_traslados`.
4. Abrir la app en otro dispositivo con una cuenta autorizada (por ahora solo administrador) y comprobar que el registro aparece al actualizar.
5. Pulsar **Llegada**, verificar el código y el punto de llegada; confirmar. El registro debe pasar a **Historial**.
6. Repetir con `TC-TEST-SCT-001`, modo scooter.
7. Opcional: abre `gafetes_prueba.html` para visualizar o imprimir los QR ficticios y probar la cámara.
8. Para comprobar la seguridad, probar el acceso con una cuenta de Supabase que **no** tenga registro en `tc_usuarios`; la aplicación debe rechazarla.

## Limitaciones técnicas deliberadas

- Para no crear objetos más allá de las siete tablas autorizadas, cada salida/llegada se guarda en **dos peticiones**: traslado primero y marcaje después. Si falla la segunda, la interfaz reporta explícitamente que el traslado principal sí se guardó, pero el marcaje complementario no. Para transacciones verdaderamente atómicas será necesario aprobar una función `tc_` del lado del servidor en una fase posterior.
- Las llegadas requieren hora suficientemente sincronizada con el servidor debido a la política RLS ya instalada.
- Se muestran los últimos 300 traslados y 400 marcajes; antes de manejar producción se necesita paginación, auditoría y políticas adicionales para datos personales reales.
- El modo cámara solo funciona si el navegador implementa `BarcodeDetector`, está en HTTPS y permite acceso a cámara.
- No hay notificaciones reales de Teams: requieren un componente de servidor y autorización de webhook, sin exponer secretos.

## Archivos

- `index.html`: estructura principal.
- `styles.css`: diseño adaptable para móvil/escritorio.
- `app.js`: autenticación, API REST de Supabase, registros, dashboards y lectura de códigos.
- `logo.jpg`: logotipo TATA incluido en la versión previa de la aplicación.
- `gafetes_prueba.html` y `gafetes/`: QR ficticios imprimibles para probar cámara.