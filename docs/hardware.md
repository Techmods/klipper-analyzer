# Testplattform

## Hardware

| Komponente | Modell |
| --- | --- |
| Host | Raspberry Pi 3B+ |
| Hauptplatine (MCU) | BIGTREETECH SKR Mini E3 v2.0 (`stm32f103xe`) |
| Expander Board (MCU) | Klipper Expander Board (`stm32f042x6`) |
| ADXL345 Adapter | Mellow FLY USB-ADXL345 (`RP2040`) |
| Drucker-Kinematics | CoreXY (Voron 0) |
| Bauraum | 120 x 120 x 120 mm |

## Software

| Komponente | Version | Quelle |
| --- | --- | --- |
| Kalico | `v2026.03.00-3-gf26c79c7` | <https://github.com/KalicoCrew/kalico> |
| Mainsail | `2.17.0` | <https://docs.mainsail.xyz/> |
| Moonraker | `v0.10.0-13-g9e6eeea` | <https://moonraker.readthedocs.io/en/latest/> |

## Relevante Runtime-Befunde

- Moonraker-Konfiguration: `/home/pi/printer_data/config/moonraker.conf`
- Moonraker lauscht auf `0.0.0.0:7125`
- Klippy-Status: `ready`
- `printer/info.app`: `Kalico`
- erkannte Profiling-Heizer im Zielsystem:
  - `extruder`
  - `heater_bed`

## Installierte Erweiterungen

| Plugin | Beschreibung | Quelle |
| --- | --- | --- |
| Klippain-ShakeTune | Input Shaping und Resonanzanalyse | <https://github.com/Frix-x/klippain-shaketune> |
| klipper_tmc_autotune | Automatisches Tuning der TMC-Treiber | <https://github.com/andrewmcgr/klipper_tmc_autotune> |
| Klipper Backup | Automatische Backups via Git | <https://github.com/Staubgeborener/klipper-backup> |
