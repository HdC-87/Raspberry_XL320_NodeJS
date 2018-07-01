// Initialisation port serie
var SerialPort = require("serialport");
var serialPort = new SerialPort("/dev/serial0", {
   baudRate: 1000000,
   stopBits: 1
});

var pos = 0 ;
var led = 0;

const XL320 = require('./xl320.js');

var servo1 = new XL320(1,serialPort);
var servo2 = new XL320(2,serialPort);

servo1.on('position', function(data) {
    console.log('Position : ' + data);
})

function lire() {
    servo1.readPosition();
    setTimeout(positionner,500);
}

function positionner() {
    console.log("Position");
    servo1.setPosition((20*++pos)&0x03FF);
    servo1.setLed(led);
    servo2.setPosition((20*pos)&0x03FF);
    servo2.setLed(led++);
    setTimeout(lire,500);    
}

positionner();

servo2.setPosition(512);
