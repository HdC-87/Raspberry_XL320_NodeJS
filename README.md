# Raspberry_XL320_NodeJS
Javascript class to use the Dynamixel XL320 servomotor (not completed yet)

XL320.js is a javascript class designed to be used with a Raspberry Pi (stretch), using the serial interface, to drive Dynamixel XL320 servomotors.

Personally I use the PIXL board which is plugged to the raspberry

It is necessary to install node.js first, with serialport library.

The UART must be enabled by modifying the initial settings such as:

- /boot.config.txt add : <br>
dtoverlay=pi3-miniuart-bt <br>
core_freq=250
- /boot/cmdline.txt : <br>
console=tty1 instead of console=serial0,115200  

