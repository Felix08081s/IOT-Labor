console.log("Dashboard geladen");

//
// 1. Dummy REST-Call (später echte REST API)
//
async function fetchRooms() {
    // Schritt 1: später ersetzen durch echten REST-Call
    // return fetch("/api/rooms").then(r => r.json());

    // Dummy-Daten:
    return [
        { name: "Wohnzimmer", temp: 22.3, humidity: 45 },
        { name: "Schlafzimmer", temp: 19.8, humidity: 50 },
        { name: "Bad", temp: 21.5, humidity: 60 }
    ];
}

//
// 2. MQTT Live-Update (Dummy)
//
function initMQTT() {
    // Schritt 2: später echte MQTT Verbindung
    console.log("MQTT Dummy gestartet");

    // Dummy Live-Update Simulation:
    setInterval(() => {
        const i = Math.floor(Math.random()*3);
        const tempElement = document.querySelectorAll(".temp")[i];

        let newTemp = (20 + Math.random() * 5).toFixed(1);
        tempElement.textContent = newTemp + "°C";
    }, 5000);
}

//
// 3. Dashboard initial aufbauen
//
async function buildDashboard() {
    const rooms = await fetchRooms();
    const dashboard = document.getElementById("dashboard");

    rooms.forEach(room => {
        const card = document.createElement("div");
        card.className = "room-card";
        card.innerHTML = `
            <h2>${room.name}</h2>
            <p class="temp">${room.temp}°C</p>
            <p class="humidity">${room.humidity}%</p>
        `;
        card.addEventListener("click", () => {
            window.location.href =
                `room.html?room=${encodeURIComponent(room.name)}`;
        });
        dashboard.appendChild(card);
    });
}

//
// Start
//
buildDashboard();
initMQTT();


/* Echte MQTT Kommunikation
const client = mqtt.connect("ws://<IP_DES_RASPBERRY>:9001");

client.on("connect", () => {
    console.log("MQTT verbunden!");
    client.subscribe("home/+/status");
});


*/
