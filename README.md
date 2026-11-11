# T18

![GitHub License](https://img.shields.io/github/license/kreier/T18)
![GitHub Release](https://img.shields.io/github/v/release/kreier/T18)

Software for the TTGO T18 3.0 20190410, also known as T-Energy.

## Documentation

LilyGo has some parts documented in this reposiory: [LILYGO-T-Energy](https://github.com/LilyGO/LILYGO-T-Energy).

The important details are:

- LED on pin IO5
- Battery on IO35 over 100K/100K voltage divider
- Button **EN** is also RESET or Enable
- Button **BOOT** is IO0

All from the schematics [https://github.com/LilyGO/LILYGO-T-Energy/blob/master/t18_v3.0.pdf](https://github.com/LilyGO/LILYGO-T-Energy/blob/master/t18_v3.0.pdf)

## Diagram

Buttons and LED:

![Buttons and LED](docs/buttons_led.jpg)

Charge controller TP5400 LDO 3.3V, Voltage divider 100k/100k to IO35

![TP5400](TP5400.jpg)
