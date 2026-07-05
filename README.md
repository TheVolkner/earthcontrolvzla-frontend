# DondeAyudoVenezuela FrontEnd

Aplicacion Angular para consulta geolocalizada de zonas afectadas, estructuras visibles, refugios, sismos y envio de reportes ciudadanos.

## Stack

- Angular 22
- TypeScript 6
- Bootstrap
- Leaflet
- npm 11

## Ejecutar

```powershell
cd C:\Users\Omar\Documents\EarthControlVzla\app\FrontEnd
npm.cmd start
```

URL local:

```text
http://localhost:4200
```

El backend esperado por defecto es:

```text
http://localhost:8080
```

Archivo de configuracion:

```text
src/environments/environment.ts
```

## Funcionalidad actual

- UI Google-like sin Google Maps: mapa full-screen, barra superior, buscador y panel lateral.
- Leaflet con OpenStreetMap y alternancia visual a capa satelital Esri.
- Boton GPS para centrar el mapa en la ubicacion del usuario.
- Modulos: Reporte, Sismos, Edificios, Refugios Personas, Refugios Animales, Aprobar Reportes y Perfil.
- Consulta publica de zonas afectadas cercanas.
- Consulta publica de estructuras cercanas.
- Consulta publica de refugios y puntos de acopio.
- Consulta publica de eventos sismicos cargados.
- Formulario publico para crear `public_intake_report`.
- Perfil temporal con Basic Auth para admin/moderador.
- Panel inicial para aprobar, revisar o rechazar reportes anonimos.

## Endpoints consumidos

```text
GET /api/public/affected-zones?longitude={lon}&latitude={lat}&radiusMeters=5000&limit=50
GET /api/public/structures/nearby?longitude={lon}&latitude={lat}&radiusMeters=2000&limit=50
GET /api/public/relief-centers?longitude={lon}&latitude={lat}&radiusMeters=10000&limit=50
GET /api/public/seismic-events?from=2026-06-24T00:00:00&minMagnitude=2.5&limit=100
POST /api/public/intake-reports
GET /api/backoffice/intake-reports
PATCH /api/backoffice/intake-reports/{id}/review
POST /api/backoffice/intake-reports/{id}/convert
```

## Compilar

```powershell
npm.cmd run build
```

La salida se genera en:

```text
dist/earth-control-vzla-frontend
```

## Ajustes aplicados

- Se reemplazo el placeholder de Angular por una interfaz operativa.
- Se agrego `provideHttpClient()` en `app.config.ts`.
- Se creo `EarthControlApi` para aislar llamadas HTTP.
- Se agrego `environment.ts` para centralizar la URL del backend.
- Se agregaron Bootstrap y Leaflet como dependencias.
- Se configuro `allowedCommonJsDependencies` para Leaflet.
- Se ajusto el presupuesto inicial de Angular a `800kB` warning / `1.5MB` error por Bootstrap + Leaflet.
- Se migro la pantalla principal a una experiencia de mapa operativo Google-like.
- Se agregaron capas visuales para zonas, estructuras, refugios y sismos.

## Siguientes pasos sugeridos

- Agregar autenticacion JWT cuando el backend la tenga lista.
- Agregar filtros por severidad, municipio y estado.
- Reemplazar o complementar OpenStreetMap con tiles/capas propias si se requiere operacion offline.
- Dividir la pantalla en componentes Angular por modulo cuando crezca la UI.
