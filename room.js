console.log("Room-Seite geladen");

//
// URL auslesen
//
const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");

document.getElementById("room-name").textContent = roomName;

//
// 1. Dummy REST Call – Raumdaten
//
async function fetchRoomDetails() {
    // später:
    // return fetch(`/api/room/${roomName}`).then(r => r.json());

    return {
        name: roomName,
        temp: (20 + Math.random()*5).toFixed(1),
        humidity: (40 + Math.random()*20).toFixed(0),
        target: 22
    };
}

//
// 2. MQTT Dummy Listener
//
function initMQTT() {
    console.log("MQTT Dummy für Raum gestartet");

    setInterval(() => {
        let t = (20 + Math.random()*5).toFixed(1);
        document.getElementById("current-temp").textContent = t;
    }, 4000);
}

//
// 3. Zieltemperatur setzen – REST Dummy
//
function sendTargetTemp(value) {
    console.log(
        `REST Dummy: Sollwert für ${roomName} gesetzt auf ${value}°C`
    );

    // später:
    /*
    fetch("/api/setTemperature", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ room: roomName, temp: value })
    });
    */

    // später MQTT:
    // client.publish(`home/${roomName}/set/temp`, value);
}

//
// 4. Initialisierung
//
async function init() {

    // Daten von "REST"
    const data = await fetchRoomDetails();
    document.getElementById("current-temp").textContent = data.temp;
    document.getElementById("current-humidity").textContent = data.humidity;

    // Slider initialisieren
    const slider = document.getElementById("temp-slider");
    const target = document.getElementById("target-temp");

    slider.value = data.target;
    target.textContent = data.target;

    slider.addEventListener("input", () => {
        target.textContent = slider.value;
        sendTargetTemp(slider.value);
    });

    initMQTT();
}

init();
