/*********************************************************
 * Author Herve de Charriere
 * June 2018.
 * Class XL320
 * 
 * This class enables the control of Dynamixel XL320 servomotors
 * if a "set" method is used, the class emit an 'ack' event.
 * It's pretty straightforward to use it:
 * example:
 *      var myServo = new XL320(id,serialPort);
 *      ...
 *      myServo.setLed(7); // order white 
 *      ...
 *      myServo.on('ack',function(data) {
 *          do what you want
 *      })
 * 
 * if a read method is used, the event is depending on the method called
 * exemple:
 *      myServo.readLed();
 *      the event is
 *      myServo.on('led',function(data) {
 *          // the data is coded on 3 bits RED (b0), GREEN (b1), BLUE (b2)
 *      })
 * 
 */

const EventEmitter = require('events').EventEmitter;

const XL320_REGISTER = {
    LED : 25,
    GOAL_POSITION : 30,
    POSITION : 37,
    GOAL_VELOCITY : 32,
    VELOCITY : 39,
    TORQUE : 24,
    MODE : 11,
    LOAD : 41,
    VOLTAGE : 45,
    TEMPERATURE : 46,
    P_GAIN : 29,
    I_GAIN : 28,
    D_GAIN : 27
}

const XL320_INSTRUCTION = {
    READ : 2,
    WRITE : 3
}

const XL320_INSTRUCTION_LENGTH = {
	// -------- Read
	READ : 0x07,

	// -------- Write
	WRITE_ID : 0x06,
	WRITE_LED : 0x06,
	WRITE_GAIN : 0x06,
	WRITE_GOAL_POSITION : 0x07,
	WRITE_GOAL_VELOCITY : 0x07,
	WRITE_TORQUE : 0x06,
	WRITE_MODE : 0x06,
}

const XL320_READ_LENGTH = {
	POSITION : 2,
	TEMPERATURE : 1,
	VELOCITY : 2,
	VOLTAGE : 1,
	LOAD : 2,
	MODE : 1,
	LED : 1,
	TORQUE : 1,
	ID : 1,
	P_GAIN : 1,
	I_GAIN : 1,
	D_GAIN : 1,
	MOVING : 1,
}

const  LED = {
	NONE : 0x00,
	RED : 0x01,
	GREEN : 0x02,
	BLUE : 0x04,
	YELLOW : 0x03,
	CYAN : 0x06,
	PINK : 0x05,
	WHITE : 0x07,
	ERROR : 0xFF
};

const MODE = {
    WHEEL : 1,
    JOIN : 2
};

const TORQUE = {
    OFF : 0,
    ON : 1
};

class XL320 extends EventEmitter {
    static get LED() {
        return LED;
    }

    static get MODE() {
        return MODE;
    }

    static get TORQUE() {
        return TORQUE;
    }

    constructor(index, serialPort) {
        super();
        this.index = index;
        this.serialPort = serialPort;
        this.frameToSend = new Array();
        this.frameToReceive = new Array();
        this.endFrame = 0; // index of the last character of the frame received
        this.eventName = "";

        // Set the events on serialPort

        this.serialPort.on('data', (data) => {
            var startOfFrame = -1;
            // data may be only a part of the response, so I push it into frameToReceive
            for (var i = 0; i < data.length; i++) this.frameToReceive.push(data[i]);
            // search the start of frame identified by this sequence: 0xFF 0xFF 0xFD 0x00
            if (this.frameToReceive.length > 10) {
                for (var i = 0; i < this.frameToReceive.length - 4; i++) {
                    if ((this.frameToReceive[i] == 255) && (this.frameToReceive[i + 1] == 255) &&
                        (this.frameToReceive[i + 2] == 253) && (this.frameToReceive[i + 3] == 0))
                        startOfFrame = i;
                }

                if (startOfFrame >= 0) {
                    // remove items before startOfFrame
                    if (startOfFrame > 0) this.frameToReceive.splice(0, startOfFrame);
                    // check if the frame matches to an ACK
                    // FF FF FE 00 ID 04 00 55 ACK CRC_L CRC_H
                    if (this.frameToReceive[5] == 4) {
                        // check if the index of the frame matches the engine index
                        if (this.frameToReceive[4] == this.index) {
                            this.emit('ack', this.frameToReceive[8]);
                        }
                        this.frameToReceive.splice(0, 11);
                    }

                    // check if the frame matches to a data
                    // FF FF FE 00 ID 05 00 55 00 DATA CRC_L CRC_H     OR
                    // FF FF FE 00 ID 06 00 55 00 DATA_L DATA_H CRC_L CRC_H 
                    // At least 12 elements
                    if (this.frameToReceive.length > 11) {
                        if (this.frameToReceive[4] == this.index) {
                            // frame : FF FF FE 00 ID Length_L Length_H > 7 elements 
                            this.endFrame = this.frameToReceive[5] + 7;
                            if (this.frameToReceive.length >= this.endFrame) {
                                var value = -1;
                                // check if the data is on 1 or 2 bytes
                                if (this.frameToReceive[5] == 5) {
                                    value = this.frameToReceive[this.endFrame - 3];
                                    this.emit(this.eventName, value);
                                    this.frameToReceive.splice(0, this.endFrame);
                                }
                                if (this.frameToReceive[5] == 6) {
                                    value = 256 * this.frameToReceive[this.endFrame - 3] +
                                        this.frameToReceive[this.endFrame - 4];
                                    this.emit(this.eventName, value);
                                    this.frameToReceive.splice(0, this.endFrame);
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    // ----------------------  Definition of methods -----------------------

    setLed(led) { // Value is BLUE*4 + GREEN*2 + RED
        this.startFrame();
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_LED); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.LED); // Register's address of led = 25 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(led & 0x07); // Only 3 bits
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
        
    }

    readLed() {
        this.startFrame();
        this.eventName = "led";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.LED); // Register's address of led = 25 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.LED); // LSB of area's length (2 bytes)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    setPosition(position) { // 0~1023 => 0~300° in WHEEL mode only!
        this.startFrame();
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_GOAL_POSITION); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.GOAL_POSITION); // Register's address of goalPosition = 30 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(position & 0xFF); // LSB of position
        this.frameToSend.push((position >> 8) & 0xFF); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readPosition() {
        this.startFrame();
        this.eventName = "position";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.POSITION); // Register's address of Position = 37 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.POSITION); // LSB of area's length (2 bytes)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    setVelocity(velocity) { // 0..1023 CCW | 1024 2047 CW in WHEEL mode
        this.startFrame(); // 0..1023 in JOIN mode
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_GOAL_POSITION); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.GOAL_VELOCITY); // Register's address of goalVelocity = 32 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(velocity & 0xFF); // LSB of Velocity
        this.frameToSend.push((velocity >> 8) & 0xFF); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readVelocity() { // 0..1023 CCW | 1024 2047 CW in WHEEL mode, unit is around 0.1%
        this.startFrame(); // 0..1023 in JOIN mode, unit is around 0.111 rpm.
        this.eventName = "velocity";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.VELOCITY); // Register's address of goalVelocity = 39 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.VELOCITY); // LSB of area's length (2 bytes)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    setTorque(torque) { // 0 - 1
        this.startFrame();
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_TORQUE); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.TORQUE); // Register's address of goalPosition = 24 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(torque); // Torque on 1 byte
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readTorque() {
        this.startFrame();
        this.eventName = "torque";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.TORQUE); // Register's address of led = 25 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.TORQUE); // LSB of area's length (2 bytes)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    setMode(mode) { // WHEEL = 1, JOIN = 2
        this.startFrame(); // To allow the mode change (EEPROM area), torque must be OFF (0)
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_MODE); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.MODE); // Register's address of mode = 11 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(mode); // Mode on 1 byte.
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readMode() {
        this.startFrame();
        this.eventName = "mode";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.MODE); // Register's address of Mode = 11 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.MODE); // LSB of area's length (1 byte)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readLoad() { // returns the Load 0..1023 CCW | 1024 2047 CW
        this.startFrame();
        this.eventName = "load";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.LOAD); // Register's address of Load = 41 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.LOAD); // LSB of area's length (2 bytes)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readVoltage() { // Caution > if 7.5V is supplied, it returns 75
        this.startFrame();
        this.eventName = "voltage";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.VOLTAGE); // Register's address of Voltage = 45 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.VOLTAGE); // LSB of area's length (1 byte)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readTemperature() { // returns the temperature in °C
        this.startFrame();
        this.eventName = "temperature";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.TEMPERATURE); // Register's address of Temperature = 46 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.TEMPERATURE); // LSB of area's length (1 byte)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    /****************** block diagram of the PID controller:
     *                                     ┌────┐
     *            ╔════════════[KP]════════|+   |
     *            ║                        |    |
     *  Error ════╬═══[1/s]════[KI]════════|+   |════
     *            ║                        |    |
     *            ╚══[du/dt]═══[KD]════════|+   |
     *                                     └────┘
     * 
     * Default values : kp register = 32 -> KP = 4, KI = 0, KD = 0
     *******************************************************/        

    setKP(kp) { // actually KP = kp / 8
        this.startFrame(); // To allow the mode change (EEPROM area), torque must be OFF (0)
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_GAIN); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.P_GAIN); // Register's address of KP (P_GAIN) = 29 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(kp); // kp on 1 byte.
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readKP() { 
        this.startFrame();
        this.eventName = "kp";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.P_GAIN); // Register's address of KP = 29 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.P_GAIN); // LSB of area's length (1 byte)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    setKI(ki) { // actually KI = ki * 1000 / 2048
        this.startFrame(); // To allow the mode change (EEPROM area), torque must be OFF (0)
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_GAIN); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.I_GAIN); // Register's address of KI (I_GAIN) = 28 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(ki); // kp on 1 byte.
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readKI() { 
        this.startFrame();
        this.eventName = "ki";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.I_GAIN); // Register's address of KI = 28 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.I_GAIN); // LSB of area's length (1 byte)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    setKD(kd) { // actually KD = kd / 250
        this.startFrame(); // To allow the mode change (EEPROM area), torque must be OFF (0)
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.WRITE_GAIN); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.WRITE); // write instruction code = 3 (1 byte)
        this.frameToSend.push(XL320_REGISTER.D_GAIN); // Register's address of KD (D_GAIN) = 27 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(kd); // kp on 1 byte.
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    readKD() { 
        this.startFrame();
        this.eventName = "kd";
        this.frameToSend.push(this.index);
        this.frameToSend.push(XL320_INSTRUCTION_LENGTH.READ); // message's lenght (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_INSTRUCTION.READ); // read instruction code = 2 (1 byte)
        this.frameToSend.push(XL320_REGISTER.D_GAIN); // Register's address of KP = 27 (2 bytes)
        this.frameToSend.push(0x00);
        this.frameToSend.push(XL320_READ_LENGTH.D_GAIN); // LSB of area's length (1 byte)
        this.frameToSend.push(0); // MSB
        this.crcCalculation();
        this.serialPort.write(this.frameToSend);
    }

    // ---------------------- Tools

    startFrame() {
        this.frameToReceive = [];
        this.frameToSend = [];
        this.frameToSend.push(0xFF);
        this.frameToSend.push(0xFF);
        this.frameToSend.push(0xFD);
        this.frameToSend.push(0x00);
    }

    crcCalculation() {
        var crcTemp = 0;
        var i, j;
        var crcTable = [
            0x0000, 0x8005, 0x800F, 0x000A, 0x801B, 0x001E, 0x0014, 0x8011,
            0x8033, 0x0036, 0x003C, 0x8039, 0x0028, 0x802D, 0x8027, 0x0022,
            0x8063, 0x0066, 0x006C, 0x8069, 0x0078, 0x807D, 0x8077, 0x0072,
            0x0050, 0x8055, 0x805F, 0x005A, 0x804B, 0x004E, 0x0044, 0x8041,
            0x80C3, 0x00C6, 0x00CC, 0x80C9, 0x00D8, 0x80DD, 0x80D7, 0x00D2,
            0x00F0, 0x80F5, 0x80FF, 0x00FA, 0x80EB, 0x00EE, 0x00E4, 0x80E1,
            0x00A0, 0x80A5, 0x80AF, 0x00AA, 0x80BB, 0x00BE, 0x00B4, 0x80B1,
            0x8093, 0x0096, 0x009C, 0x8099, 0x0088, 0x808D, 0x8087, 0x0082,
            0x8183, 0x0186, 0x018C, 0x8189, 0x0198, 0x819D, 0x8197, 0x0192,
            0x01B0, 0x81B5, 0x81BF, 0x01BA, 0x81AB, 0x01AE, 0x01A4, 0x81A1,
            0x01E0, 0x81E5, 0x81EF, 0x01EA, 0x81FB, 0x01FE, 0x01F4, 0x81F1,
            0x81D3, 0x01D6, 0x01DC, 0x81D9, 0x01C8, 0x81CD, 0x81C7, 0x01C2,
            0x0140, 0x8145, 0x814F, 0x014A, 0x815B, 0x015E, 0x0154, 0x8151,
            0x8173, 0x0176, 0x017C, 0x8179, 0x0168, 0x816D, 0x8167, 0x0162,
            0x8123, 0x0126, 0x012C, 0x8129, 0x0138, 0x813D, 0x8137, 0x0132,
            0x0110, 0x8115, 0x811F, 0x011A, 0x810B, 0x010E, 0x0104, 0x8101,
            0x8303, 0x0306, 0x030C, 0x8309, 0x0318, 0x831D, 0x8317, 0x0312,
            0x0330, 0x8335, 0x833F, 0x033A, 0x832B, 0x032E, 0x0324, 0x8321,
            0x0360, 0x8365, 0x836F, 0x036A, 0x837B, 0x037E, 0x0374, 0x8371,
            0x8353, 0x0356, 0x035C, 0x8359, 0x0348, 0x834D, 0x8347, 0x0342,
            0x03C0, 0x83C5, 0x83CF, 0x03CA, 0x83DB, 0x03DE, 0x03D4, 0x83D1,
            0x83F3, 0x03F6, 0x03FC, 0x83F9, 0x03E8, 0x83ED, 0x83E7, 0x03E2,
            0x83A3, 0x03A6, 0x03AC, 0x83A9, 0x03B8, 0x83BD, 0x83B7, 0x03B2,
            0x0390, 0x8395, 0x839F, 0x039A, 0x838B, 0x038E, 0x0384, 0x8381,
            0x0280, 0x8285, 0x828F, 0x028A, 0x829B, 0x029E, 0x0294, 0x8291,
            0x82B3, 0x02B6, 0x02BC, 0x82B9, 0x02A8, 0x82AD, 0x82A7, 0x02A2,
            0x82E3, 0x02E6, 0x02EC, 0x82E9, 0x02F8, 0x82FD, 0x82F7, 0x02F2,
            0x02D0, 0x82D5, 0x82DF, 0x02DA, 0x82CB, 0x02CE, 0x02C4, 0x82C1,
            0x8243, 0x0246, 0x024C, 0x8249, 0x0258, 0x825D, 0x8257, 0x0252,
            0x0270, 0x8275, 0x827F, 0x027A, 0x826B, 0x026E, 0x0264, 0x8261,
            0x0220, 0x8225, 0x822F, 0x022A, 0x823B, 0x023E, 0x0234, 0x8231,
            0x8213, 0x0216, 0x021C, 0x8219, 0x0208, 0x820D, 0x8207, 0x0202
        ];

        for (j = 0; j < this.frameToSend.length; j++) {
            i = ((crcTemp >> 8) ^ this.frameToSend[j]) & 0xFF;
            crcTemp = ((crcTemp << 8) ^ crcTable[i]) & 0xFFFF;
        }
        this.frameToSend.push(crcTemp & 0xFF); // LSB of crc
        this.frameToSend.push((crcTemp >> 8) & 0xFF); // MSB
    }

}

module.exports = XL320;
