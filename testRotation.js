var SerialPort = require("serialport");
var serialPort = new SerialPort("/dev/serial0", {
    baudRate: 1000000,
    stopBits: 1
});

// Appel de la classe XL320 :
const XL320 = require('./xl320.js');

// Appel de la bibliothèque readline qui permet de lire la console
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var servo1 = new XL320(1, serialPort);
var couleur = [XL320.LED.BLUE, XL320.LED.GREEN, XL320.LED.RED, XL320.LED.YELLOW];
var indexCouleur = 0;
// Initialisation en mode JOIN : servomoteur en position angulaire
servo1.setTorque(XL320.TORQUE.OFF);
servo1.setMode(XL320.MODE.JOIN);
servo1.setTorque(XL320.TORQUE.ON);

// reglage de la vitesse angulaire 0~1023
servo1.setVelocity(256);

// Ecoute de l'évènement "position"
servo1.on('position', function (data) {
    console.log("Position actuelle : " + data);
})

var fin = false;

function lirePosition() {
    servo1.readPosition();
    if (!fin) setTimeout(saisir, 500);
}

function saisir() {
    if (++indexCouleur>3) indexCouleur = 0;
    servo1.setLed(couleur[indexCouleur]);
    rl.question('Entrez un nombre ', (nombre) => {
        console.log("Vous avez entré : " + nombre);
        if ((nombre >= 0) && (nombre < 1023)) {
            servo1.setPosition(nombre);
            setTimeout(lirePosition, 500);
        }
    });
}

saisir();
