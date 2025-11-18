// URL Parameter lesen
const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");
document.getElementById("room-name").textContent = roomName;

// Dummy-REST laden
const rooms = JSON.parse(localStorage.getItem("rooms")) || [];
const devices = [
    { id: "abc123", type: "temp", topic: "dummy/temp1" },
    { id: "def456", type: "temp", topic: "dummy/temp2" },
    { id: "ghi789", type: "hum", topic: "dummy/hum1" }
];

const mqttListeners = window.mqttListeners;

// aktuellen Raum finden
const room = rooms.find(r => r.name === roomName);

// MQTT Live-Daten
room.devices.forEach(id => {
    const dev = devices.find(d => d.id === id);
    if (!dev) return;

    mqttSubscribe(dev.topic, value => {
        if (dev.type === "temp") {
            document.getElementById("current-temp").textContent = value;
        }
        if (dev.type === "hum") {
            document.getElementById("current-humidity").textContent = value;
        }
    });
});

// Slider
const slider = document.getElementById("temp-slider");
const targetTemp = document.getElementById("target-temp");

slider.oninput = () => {
    targetTemp.textContent = slider.value;
};
