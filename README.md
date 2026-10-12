# system-monitor

Dashboard web de métricas de sistema. Un servidor Express recoge datos en tiempo real con `systeminformation` (CPU, RAM, discos, red, GPU…) y los expone mediante una API JSON que consume la interfaz web.

## Descripción

Aplicación Node.js mínima que sirve una página estática (`public/`) y un endpoint `GET /api/metrics` con las métricas del sistema:

- CPU (modelo, velocidad, carga actual y temperatura si está disponible)
- Memoria RAM (usada / total)
- Discos y sistemas de ficheros
- Red (bytes RX/TX por segundo)
- GPU, batería e información del SO/hostname (cuando el sistema lo permite)

## Requisitos

- **Node.js >= 18** (no se declara `engines` en `package.json`; se recomienda 18 o superior).
- Dependencias: `express` y `systeminformation` (ver `package.json`).

## Cómo arrancar

```bash
npm install
npm start
```

El script `start` ejecuta `node server.js`. Por defecto el dashboard queda disponible en `http://localhost:3000`.

## Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `PORT` | Puerto HTTP en el que escucha el servidor Express. | `3000` |

Ejemplo:

```bash
PORT=8080 npm start
```

## ⚠️ Aviso de seguridad

El servidor escucha en `0.0.0.0` **sin autenticación**, por lo que cualquier equipo que alcance ese puerto puede ver las métricas del sistema. **No lo expongas directamente a Internet**: si necesitas acceso remoto, colócalo detrás de una capa de autenticación (por ejemplo un reverse proxy con Basic Auth / OAuth) o restringe el acceso por red (VPN, firewall, túnel).
