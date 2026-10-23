# Cutting Bridge

Local Windows bridge between the cutting UI and a serial scale. The service binds
only to `127.0.0.1:7001`; it does not expose the serial port to the network.

## Run

From the repository root, install the project dependencies and start the service:

```powershell
npm install
node .\bridge-agent\server.js
```

Set `NEXT_PUBLIC_BRIDGE_ENABLED=true` in `.env.local` to enable the UI integration.
If the service uses a non-default port, set `NEXT_PUBLIC_BRIDGE_URL` to its
loopback URL as well as `BRIDGE_PORT`. `BRIDGE_ALLOWED_ORIGINS` may be set to a
comma-separated list of exact browser origins. The defaults allow the local
Next.js UI and Tauri origins.

## API

- `GET /health`
- `POST /scale/connect` — JSON `{ "port": "COM3", "baudRate": 19200 }`
- `GET /scale/weight`
- `POST /scale/disconnect`

The service returns the latest parsed reading; scale output should include a
numeric weight, with an optional `kg` or `g` unit. Modbus and label-printing
endpoints are intentionally not implemented in this pilot bridge. If the serial
connection drops after a successful connection, the bridge retries it every
second until disconnected explicitly.

## Windows service (NSSM)

Install NSSM and Node.js on the station, then run PowerShell as Administrator:

```powershell
.\bridge-agent\install-service.ps1
```

The service runs as `CuttingBridge`, is configured to start automatically with
Windows, and writes logs under `bridge-agent\logs`. Select the scale's COM port
and baud rate in the app's scale settings before connecting. To inspect/remove
the service, use NSSM's standard `status` and `remove` commands.
