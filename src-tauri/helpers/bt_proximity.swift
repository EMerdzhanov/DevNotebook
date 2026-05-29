import IOBluetooth
import Foundation

// Usage: bt_proximity <device-address>
// Output: JSON {"status":"connected"|"weak"|"disconnected","rssi":<number>}
// The device address format is "XX-XX-XX-XX-XX-XX" (macOS uses dashes)

guard CommandLine.arguments.count >= 2 else {
    print("{\"status\":\"error\",\"rssi\":0,\"message\":\"Usage: bt_proximity <address>\"}")
    exit(1)
}

let targetAddress = CommandLine.arguments[1]

// Look up the device by address
guard let device = IOBluetoothDevice(addressString: targetAddress) else {
    print("{\"status\":\"disconnected\",\"rssi\":-100}")
    exit(0)
}

// Check if device is connected (paired and active)
if device.isConnected() {
    let rssi = device.rawRSSI()
    // rawRSSI() returns 127 when unavailable
    let rssiValue: Int = (rssi == 127) ? -50 : Int(rssi)
    print("{\"status\":\"connected\",\"rssi\":\(rssiValue)}")
} else {
    // Try to get RSSI even if not connected — device might be nearby
    let rssi = device.rawRSSI()
    if rssi != 127 && rssi != 0 {
        print("{\"status\":\"weak\",\"rssi\":\(Int(rssi))}")
    } else {
        print("{\"status\":\"disconnected\",\"rssi\":-100}")
    }
}
