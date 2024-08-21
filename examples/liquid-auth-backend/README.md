# Liquid Auth Backend

In order to use the Liquid Auth use-wallet wallet/provider it is necessary to run the Liquid Auth backend.

When a user engages in the _connect_ flow for the "Liquid" use-wallet option, it will generate a request-id presented through a QR code. When the QR code is scanned by a Liquid Auth-powered wallet (such as the [Liquid Auth Android demo mobile wallet app](https://github.com/algorandfoundation/liquid-auth-android/tree/develop)), the wallet app will read the request-id, acquire the origin and proceed to follow normal WebAuthn/FIDO2 flows such as generating and registering pass key credentials specific for that origin. It will then make a post request to the Liquid Auth backend it expects to be located at the origin.

To achieve this flow when developing locally, we make use of ngrok. Ngrok tunnels requests from the Internet (from the static domain provided for you) into our local computer, allow you to expose your local port HTTP to the world.

For more information on Liquid Auth, please [refer to the documentation](https://liquidauth.com).

## Liquid Auth Backend

The Liquid Auth backend is composed of the following components:

- NestJS: a headless NestJS API server.
- MongoDB: for maintaining sessions and persisting certain user data, like passkeys.
- Redis: for Web Sockets. Once a connection has been established communication happens peer-to-peer over WebRTC, but for the initial handshake Web Sockets are needed.
- CoTurn: to run your own TURN server. (Nodely.io kindly also offers TURN servers as public infrastructure.)
- Ngrok: creates the traffic tunnel to ngrok.com.

Refer to the `docker-compose.yaml` file for the specific images and additional specification.

## Setup

### 1. Install Docker

If you do not have it already, install [Docker](https://www.docker.com).

### 2. Sign Up for Ngrok

Navigate to [ngrok.com](https://ngrok.com) and sign up.

Follow all the steps.

Collect your **_Authtoken_** and **_Static Domain_**. You will need them in the next steps.

### 3. Create the YAML files

In this folder (liquid-auth-backend), the following YAML files must be created:

- .env.docker
- ngrok.yaml

Example files have been created and are checked in, but they need to be updated with your Ngrok authtoken and static domain.

Create `.env.docker` as follows, replacing <NGROK_STATIC_DOMAIN> with the static domain:

```YAML
# Application
NODE_ENV=production
SENTRY_DNS=
PORT=5173

# Database
DB_HOST=mongo:27017
DB_USERNAME=algorand
DB_PASSWORD=algorand
DB_NAME=fido
DB_ATLAS=false

# Events
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=

# FIDO2
RP_NAME=Algorand Foundation FIDO2 Server
HOSTNAME=<NGROK_STATIC_DOMAIN>
ORIGIN=https://<NGROK_STATIC_DOMAIN>

ANDROID_SHA256HASH=47:CC:4E:EE:B9:50:59:A5:8B:E0:19:45:CA:0A:6D:59:16:F9:A9:C2:96:75:F8:F3:64:86:92:46:2B:7D:5D:5C
ANDROID_PACKAGENAME=foundation.algorand.demo
```

For example it might look like this:

```YAML
HOSTNAME=different-precisely-worm.ngrok-free.app
ORIGIN=https://different-precisely-worm.ngrok-free.app
```

Similarly, create `ngrok.yml`as follows, replacing <NGROK_STATIC_DOMAIN> and <NGROK_AUTH_TOKEN>:

```YAML
version: 2
authtoken: <NGROK_AUTH_TOKEN>
tunnels:
  website:
    addr: frontend:8080
    proto: http
    domain: <NGROK_STATIC_DOMAIN>
```

### 4. Update Vite config

Ngrok is meant to expose your frontend, but we want the frontend to also be able to redirect paths to the backend API.

Using the `use-wallet/examples/vanilla-ts` example, add the following to `use-wallet/examples/vanilla-ts/vite.config.ts`

```typescript
import { defineConfig } from 'vite'

const DEFAULT_PROXY_URL = 'http://localhost:5174'
const DEFAULT_WSS_PROXY_URL = 'ws://localhost:5174'

export default defineConfig({
  // [existing config] ,
  server: {
    proxy: {
      '^/auth/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/.well-known/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/connect/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/attestation/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '^/assertion/.*': process.env.PROXY_URL || DEFAULT_PROXY_URL,
      '/socket.io': {
        target: process.env.WSS_PROXY_SERVER || DEFAULT_WSS_PROXY_URL,
        ws: true
      }
    }
  }
})
```

We are assuming that the Liquid Auth service gets to run on port 5174.

### 5. Spin up the backend services

Run `docker-compose up -d` from this directory.

This will start up the docker services and detach the output (logs) from the terminal window.

#### Platform Error

You might get the following error:

> ! liquid-auth The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8) and no specific platform was requested 0.0s

Or a similar. In this case, this error appears on MacBook Pros that are running Apple Silicon.

To fix this, we can force Docker to emulate linux/amd64, by adding `platform: linux/amd64` to the service in `docker-compose.yml`:

```YAML
// ...
  liquid-auth:
    image: ghcr.io/algorandfoundation/liquid-auth:develop
    platform: linux/amd64
    restart: no
    env_file:
      - .env.docker
    ports:
      - "5173:5173"
    depends_on:
      - redis
      - mongo
// ...
```
