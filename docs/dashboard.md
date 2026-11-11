# Web Dashboard & Visualization Specification

The web dashboard is hosted statically on GitHub Pages at [https://kreier.github.io/T18](https://kreier.github.io/T18).

---

## 1. Local Timezone Display (Vietnam / UTC+7)

To analyze the effects of high user activity during working hours versus relaxed night-time bandwidth:
- **Default Display Timezone**: **Vietnam Time (ICT / UTC+7)**.
- **Y-Axis Hours**: 24 rows representing `00:00` to `23:00` local station time.
  - **Daytime / High Activity**: `08:00 – 18:00` (highlighted on axis with sun/activity indicator).
  - **Evening / Relaxed Hours**: `18:00 – 22:00`.
  - **Night Hours**: `22:00 – 06:00`.
- An optional toggle allows switching between **Local Station Time (UTC+7)** and **UTC**.

---

## 2. 53-Day Heatmap Grid Layout

- **Width**: 53 columns representing the last 53 consecutive calendar days (ending with today).
- **Height**: 24 rows representing the 24 hours of each day (00:00 to 23:00 ICT).
- **Total Blocks**: $53 \times 24 = 1,272$ interactive hourly blocks.

### Cell Color Classifications:
| Color | Status | Definition |
|---|---|---|
| **Green** (`#238636`) | Healthy | All samples in the hour connected quickly ($T_{\text{assoc}} < 3000\text{ms}$, HTTP latency $< 150\text{ms}$). |
| **Orange** (`#d29922`) | Degraded | 1 failure in the hour, OR average HTTP latency between 150ms and 500ms. |
| **Purple** (`#8957e5`) | Slow Assoc / DHCP Lag | High connection or DHCP delay ($T_{\text{assoc}} > 4000\text{ms}$ or $T_{\text{dhcp}} > 3000\text{ms}$), but connection eventually succeeded. |
| **Red** (`#da3633`) | Outage / Failed | Zero successful connections or majority failures in this hour. |
| **Gray** (`#21262d`) | No Data / Offline | Station powered off or before initial deployment. |

---

## 3. Interactive Features

1. **Hover / Tap Tooltip**:
   - Local Date & Hour (e.g. `2026-11-11 14:00 - 14:59 ICT (UTC+7)`)
   - Probe success rate: `6 / 6 attempts (100%)`
   - Average Wi-Fi association time ($T_{\text{assoc}}$ in ms)
   - Average DHCP lease time ($T_{\text{dhcp}}$ in ms)
   - Average HTTP latency (Google, Fast, 1.1.1.1, Cloudflare)
   - Wi-Fi Signal RSSI (dBm) and Battery Voltage (V)
2. **Detail Card on Click**:
   - Pins the clicked hour block to show detailed target-by-target response times.
3. **Station Selector**:
   - Dynamically loads `data/stations.json` to switch between deployed stations (`C-703`, `LIB-2F`, etc.).
