# SCCVI - Fase 3: Integracion continua con GitHub Actions

## Objetivo

Comprobar automaticamente el backend, la especificacion OpenAPI y la compilacion del frontend cuando se publiquen cambios en `develop` o en ramas `feature/**`, y cuando se abra o actualice un Pull Request cuyo destino sea `develop`.

## Que valida

### Backend

1. Descarga el codigo del repositorio.
2. Configura Node.js 24.
3. Instala exactamente las dependencias del lockfile con `npm ci`.
4. Ejecuta `npm run check` para comprobar la sintaxis de los archivos incluidos en ese script.
5. Ejecuta `npm run openapi:check` para validar la especificacion OpenAPI y las rutas esperadas.

### Frontend

1. Configura Node.js 24.
2. Instala las dependencias con `npm ci`.
3. Ejecuta `npm run build` para generar la compilacion Vite de produccion.

## Lo que no valida todavia

Esta primera version de CI no ejecuta pruebas contra una base PostgreSQL ni llama a Gmail o Telegram. Tampoco existe todavia una suite de pruebas unitarias o de integracion que pueda ejecutar. Las validaciones se limitan a los scripts y compilaciones disponibles actualmente en el repositorio.

Tampoco despliega a AWS, construye y publica imagenes Docker, ni utiliza secretos de produccion. Esas actividades se incorporaran despues de agregar pruebas, Terraform y la infraestructura AWS.

## Triggers

- `push` a `develop`.
- `push` a ramas `feature/**`, incluida `feature/preparacion-produccion-aws`.
- `pull_request` cuyo destino sea `develop`.
- Ejecucion manual desde la pestaña Actions mediante `workflow_dispatch`.

No se configura un trigger de push directo a `main`.

## Aplicacion

Colocar el archivo `ci.yml` en:

`.github/workflows/ci.yml`

El workflow debe quedar versionado en la rama de trabajo y publicado en GitHub. Despues de hacer push, abrir la pestaña **Actions** del repositorio y revisar los jobs:

- `Backend - sintaxis y OpenAPI`
- `Frontend - compilacion de produccion`

Ambos deben terminar con estado verde para que la comprobacion CI se considere satisfactoria.

## Si falla

Abrir el job fallido y leer el primer comando que termina con codigo distinto de cero. No continuar con Terraform o AWS hasta corregirlo. Un fallo de instalacion puede indicar que `package.json` y `package-lock.json` no estan sincronizados; un fallo de OpenAPI debe corregirse en la especificacion o en su validador; un fallo del build debe corregirse en el frontend.
