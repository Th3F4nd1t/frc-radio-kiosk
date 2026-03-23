# FRC Radio Kiosk

A locally-hosted web application for a Raspberry Pi that configures the
**VH113 field access point** and **VH109 team radios** at an FRC event.

---

## Features

| Feature | Details |
|---|---|
| **AP Configuration** | Channel, channel bandwidth, red/blue VLANs, per-station SSID + WPA key |
| **Persistent Settings** | Config saved to `data/config.json`; reloaded on every server start |
| **Startup Push** | On boot the server automatically pushes the saved config to `http://10.0.100.2/configuration` |
| **WPA Key Generation** | Cryptographically secure 8-63 char WPA-PSK keys, one click per station |
| **VH109 Network Config** | Configure a team radio over HTTP via a USB ethernet dongle from the "VH109 Config" page |
| **Kiosk Mode** | Chromium opens automatically in full-screen kiosk mode at boot |

---

## Requirements

* Raspberry Pi (3 B+ or newer recommended) running Raspberry Pi OS Bullseye / Bookworm
* Node.js ≥ 18 (`sudo apt-get install nodejs npm`)
* Chromium browser (`sudo apt-get install chromium-browser`)
* Desktop environment (for kiosk mode)

---

## Quick Install

```bash
# 1. Clone the repo into the home directory
cd /home/pi
git clone https://github.com/Th3F4nd1t/frc-radio-kiosk.git

# 2. Run the installer (requires sudo)
cd frc-radio-kiosk
sudo bash scripts/install.sh
```

The installer will:
1. Install Node.js and Chromium if missing
2. Install npm dependencies
3. Register and enable two systemd services
4. Start the web server immediately

---

## Manual Start (development / debugging)

```bash
cd /home/pi/frc-radio-kiosk
npm install          # first time only
npm start            # starts the server on http://localhost:3000
```

---

## Systemd Services

| Service | Purpose |
|---|---|
| `frc-radio-kiosk.service` | Node.js web server – starts at `network-online.target` |
| `frc-radio-kiosk-browser.service` | Chromium kiosk – starts after the web server and desktop are ready |

```bash
# Check status
sudo systemctl status frc-radio-kiosk
sudo systemctl status frc-radio-kiosk-browser

# View live logs
sudo journalctl -u frc-radio-kiosk -f
```

---

## API Reference

All endpoints return JSON `{ success: boolean, ... }`.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/config` | Return the current persisted configuration |
| `POST` | `/api/config` | Save (persist) a new configuration |
| `POST` | `/api/push` | Push the persisted config to the VH113 AP |
| `POST` | `/api/save-and-push` | Save + push in one request |
| `POST` | `/api/generate-wpa` | Generate a random WPA key (`{ length?: number }`) |
| `POST` | `/api/vh109/configure` | Configure a VH109 (`{ radioUrl, ssid, wpaKey, localAddress? }`) |

### Example AP payload (sent to VH113)

```json
{
  "channel": 37,
  "channelBandwidth": "40MHz",
  "redVlans": "10_20_30",
  "blueVlans": "40_50_60",
  "stationConfigurations": {
    "red1":  { "ssid": "1234", "wpaKey": "Abc123!@#Xyz" },
    "red2":  { "ssid": "2345", "wpaKey": "Def456$%^Uvw" },
    "red3":  { "ssid": "3456", "wpaKey": "Ghi789&*()Rst" },
    "blue1": { "ssid": "4567", "wpaKey": "Jkl012!@#Opq" },
    "blue2": { "ssid": "5678", "wpaKey": "Mno345$%^Lmn" },
    "blue3": { "ssid": "6789", "wpaKey": "Pqr678&*()Ijk" }
  }
}
```

---

## VH109 Network Configuration

The VH109 radio is configured over **HTTP**, reached via a dedicated USB
ethernet dongle plugged into the Raspberry Pi.

### Physical setup

```
Raspberry Pi
  ├── eth0 (built-in or main NIC) ──→ field network / internet
  └── eth1 / usb0 (USB ethernet dongle) ──→ VH109 ethernet port
```

### How it works

1. Connect the VH109's ethernet port to the USB ethernet dongle on the Pi.
2. Open the **VH109 Config** page in the kiosk.
3. Enter the radio's configuration URL (e.g. `http://10.0.0.1/configuration`).
4. Optionally enter the Pi's IP address on the dongle interface as the
   **Local Interface IP** – this binds the outgoing HTTP request to that
   interface, ensuring it is routed to the radio rather than out the main NIC.
5. Enter (or load from a station preset) the SSID and WPA key, then click
   **Configure VH109**.

The server sends an HTTP POST to the radio:

```json
{ "ssid": "1234", "wpaKey": "SomePassphrase" }
```

> **Note:** The exact endpoint path and payload shape depend on the radio's
> firmware version.  Adjust `src/vh109.js → buildPayload()` if your firmware
> uses a different format.

### Routing the request through the correct interface

If the Pi has multiple network interfaces, set a static IP on the USB dongle
interface in the same subnet as the radio and either:

* Use the **Local Interface IP** field in the UI to bind the request to that
  IP, **or**
* Add a host route: `sudo ip route add 10.0.0.1 dev eth1` (replace `eth1`
  with your dongle's interface name, e.g. `usb0` or `enx…`).

To make the route persistent across reboots add it to
`/etc/dhcpcd.conf` or a `networkd` configuration file.

---

## Configuration File

Saved to `data/config.json` (excluded from git).  Default values:

```json
{
  "apUrl": "http://10.0.100.2/configuration",
  "channel": 37,
  "channelBandwidth": "40MHz",
  "redVlans": "10_20_30",
  "blueVlans": "40_50_60",
  "autoPushOnStartup": true,
  "stationConfigurations": {
    "red1":  { "ssid": "", "wpaKey": "" },
    "red2":  { "ssid": "", "wpaKey": "" },
    "red3":  { "ssid": "", "wpaKey": "" },
    "blue1": { "ssid": "", "wpaKey": "" },
    "blue2": { "ssid": "", "wpaKey": "" },
    "blue3": { "ssid": "", "wpaKey": "" }
  }
}
```

---

## Security Notes

* WPA keys are stored in plaintext in `data/config.json`.  Ensure the file
  permissions restrict access to the `pi` user only (`chmod 600 data/config.json`).
* The web server listens on `localhost:3000` only – it is not exposed to the
  network by default.  If you need remote access, add firewall rules accordingly.