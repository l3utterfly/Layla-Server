# Layla Server

**Run powerful LLM models on your PC. Chat from anywhere on your phone.**

Layla Server is a lightweight wrapper around `llama-server` (or any OpenAI-compatible inference engine) that exposes your local LLM over WebRTC — so you can connect to it from anywhere, just by scanning a QR code with the [Layla app](https://www.layla-network.ai).

---

## Why Layla Server?

Your PC has the horsepower to run large, capable models. Your phone has the convenience. Layla Server bridges the two — no port forwarding, no static IP, no cloud subscription required.

- ✅ **One QR code** to connect your phone to your PC's LLM
- ✅ **Works anywhere** — WebRTC punches through NAT and firewalls
- ✅ **Long-lived sessions** — polling-based signalling keeps the server up indefinitely
- ✅ **One-click installer** — ships with a bundled `llama-server` snapshot, no setup needed
- ✅ **BYOM** — bring your own GGUF models
- ✅ **Swap backends** — switch to any OpenAI-compatible inference engine in settings

---

## How It Works

```
┌─────────────────────────────┐        WebRTC        ┌──────────────┐
│         Your PC             │ ◄──────────────────► │  Layla App   │
│                             │                      │  (iPhone /   │
│  llama-server  ←→  Layla    │        QR code       │   Android)   │
│  (or any OpenAI-compat API) │                      └──────────────┘
└─────────────────────────────┘
```

1. Layla Server starts `llama-server` (or connects to your preferred backend)
2. It generates a QR code encoding the WebRTC connection offer
3. Scan the QR code with the Layla app — a peer-to-peer connection is established
4. All OpenAI-compatible HTTP calls from the app are proxied over WebRTC to your local model
5. Reconnect any time by scanning a new QR code — the server stays alive via polling-based signalling

---

## Quick Start

### Option 1 — One-Click Install (Recommended for non-technical users)

Download the latest release for your platform from the [Releases page](https://github.com/your-org/layla-server/releases).

Layla Server ships with a bundled `llama-server` snapshot — no separate installation required (you can easily swap it out with newer versions or even different servers).

1. Download and unzip the release
2. Drop your `.gguf` model file into the `models/` folder
3. Launch `layla-server`
4. Open the Layla app on your phone and scan the QR code

That's it. You're now chatting with your local model from your phone.

---

### Option 2 — From Source

**Prerequisites:** Node.js 18+ (or your runtime of choice)

```bash
git clone https://github.com/your-org/Layla-Server.git
cd Layla-Server
npm install
npm start
```

Build an `.exe` for Windows:

```bash
npm run dist
```
---

## Configuration

All settings are available in the **Settings** panel of the Layla Server UI.

| Setting | Description |
|---|---|
| **Model path** | Path to your `.gguf` model file |
| **Inference backend** | URL of any OpenAI-compatible server (default: bundled `llama-server`) |
| **Additional Cmd Args** | Additional command-line arguments to pass to the server executable |

### Using a Custom Backend

Layla Server proxies to any OpenAI-compatible endpoint. To use a different inference engine (LM Studio, Ollama, vLLM, etc.), just point the backend URL to it in Settings — no other changes needed.

---

## Using Your Own Models

Layla Server supports any model in **GGUF format**.

1. Download a GGUF model (e.g. from [Hugging Face](https://huggingface.co/models?library=gguf))
2. Select your model in the settings page
3. Restart the server — the new model is loaded automatically

---

## Connecting the Layla App

1. Launch Layla Server on your PC
2. A QR code will appear in the UI
3. Open the **Layla app** on your phone
4. Tap **Connect** → **Scan QR code**
5. Point your camera at the code — connection is established instantly

The server uses **polling-based WebRTC signalling**, so it stays alive and connectable for as long as it's running. You can close the app, leave for hours, and reconnect whenever you like (no need to scan QR code again).

---

## Architecture Notes

- **WebRTC transport** — peer-to-peer data channel; traffic goes directly between your devices once connected
- **Polling signalling** — no persistent WebSocket required; the server polls for new connection offers at a configurable interval, making it robust for long-running sessions
- **OpenAI-compatible proxy** — the WebRTC channel transparently forwards HTTP requests and responses, so the Layla app doesn't need to know anything about the underlying transport

---

## Related

- [Layla App](https://www.layla-network.ai) — the offline LLM mobile client
- [llama.cpp](https://github.com/ggml-org/llama.cpp) — the inference engine powering the bundled backend

---

## License

MIT © Layla Network Pty Ltd