# TATA Control de Transportes V7 — edición pública sin conexión

**Estado:** código de aplicación subido a GitHub; **sin conexión activa** a Supabase. Esta versión todavía no permite iniciar sesión ni registrar traslados. No incluye datos de empleados reales, contraseñas, URL del proyecto ni claves de API.

## Archivos incluidos

- `index.html`: entrada de la aplicación.
- `app.js`: interfaz V7 y lógica de marcajes, actualmente desactivadas por seguridad.
- `styles.css`: diseño para escritorio y móvil.
- `logo.svg`: logotipo tipográfico para esta edición pública.
- `gafetes_prueba.html`: tarjetas de códigos ficticios (sin QR imprimibles).

## Activación pendiente

1. Corregir los permisos anónimos de las cuatro tablas `engineering_balance_*` del proyecto compartido de Supabase, después de validar las dependencias y el impacto en sistemas de producción.
2. Sustituir o proteger la función existente `engineering-balance-api`, cuyo acceso actual no verifica la identidad del usuario. La función original NO ha sido modificada. La función paralela `engineering-balance-api-auth-test` permanece deshabilitada.
3. Validar con personal autorizado de TATA el uso de GitHub Pages y la incorporación de información corporativa.
4. Rehabilitar únicamente la clave *publicable* de Supabase y la URL del proyecto, **nunca** la clave secreta ni `service_role`. Validar con una cuenta de prueba y reglas RLS en `tc_*`.
5. Probar salidas, llegadas, QR y acceso multiusuario con datos ficticios antes de producción.

## Seguridad

- Las siete tablas `tc_*` de Transportes tienen RLS y no conceden lectura a usuarios anónimos.
- Las cuatro tablas `engineering_balance_*` existentes no tenían RLS y exponían permisos anónimos según la última auditoría. **Esta publicación no las corrige**.
- La aplicación V7 está desactivada expresamente para evitar dar acceso accidental al proyecto compartido.
- GitHub Pages no está configurado desde esta entrega; cargar código al repositorio NO significa que exista un sitio publicado.

**Importante:** las modificaciones de seguridad sobre componentes de otras aplicaciones requieren evaluación de dependencias y una validación de funcionamiento antes de aplicarlas.

## GitHub Pages

Este repositorio contiene un flujo de GitHub Actions en `.github/workflows/pages.yml` que publica la demo estática con datos ficticios. Configura **Settings → Pages → Source: GitHub Actions**. Revisa **Actions** para confirmar que el despliegue termine correctamente.
