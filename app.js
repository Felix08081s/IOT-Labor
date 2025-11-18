const MQTT_WS = (location.hostname === "localhost")
  ? "ws://localhost:9001"
  : `ws://${location.hostname}:9001`;

const client = mqtt.connect(MQTT_WS);

let devices = [];
let rooms = [];

client.on("connect", () => {
    console.log("MQTT WebSocket connected");
    client.subscribe("home/devices/+/state");
});

client.on("message", (topic, msg) => {
    try {
        const json = JSON.parse(msg.toString());
        const id = topic.split("/")[2];
        const dev = devices.find(d => d.id === id);
        if (dev) {
            dev.lastState = json;
            buildDashboard();
        }
    } catch {}
});

// -----------------------------
// REST helper
// -----------------------------
async function loadDevices() {
    const r = await fetch("/api/devices");
    devices = await r.json();
}
async function loadRooms() {
    const r = await fetch("/api/rooms");
    rooms = await r.json();
}

// -----------------------------
// Build Dashboard
// -----------------------------
async function buildDashboard() {
    await loadDevices();
    await loadRooms();

    const dash = document.getElementById("dashboard");
    dash.innerHTML = "";

    rooms.forEach(room => {
        const card = document.createElement("div");
        card.className = "room-card";

        const assigned = devices.filter(d => room.devices.includes(d.id));

        let temp = "--";
        let hum = "--";

        assigned.forEach(d => {
            if (d.lastState?.temperature !== undefined) temp = d.lastState.temperature;
            if (d.lastState?.humidity !== undefined) hum = d.lastState.humidity;
        });

        const tags = assigned
            .map(d => `<span class="alias-tag">${d.alias || d.id}</span>`)
            .join(" ");

        card.innerHTML = `
            <h2>${room.name}</h2>
            <div class="device-aliases">${tags}</div>
            <p class="temp">${temp}°C</p>
            <p class="humidity">${hum}%</p>
        `;

        card.onclick = () => window.location.href = `room.html?room=${room.name}`;
        dash.appendChild(card);
    });
}

buildDashboard();

// -----------------------------
// UI Buttons
// -----------------------------
document.getElementById("new-room-btn").onclick = () => {
    document.getElementById("room-popup").classList.remove("hidden");
};

document.getElementById("save-room-btn").onclick = async () => {
    const name = document.getElementById("new-room-name").value;
    if (!name) return;

    await fetch("/api/rooms", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name })
    });

    document.getElementById("room-popup").classList.add("hidden");
    buildDashboard();
};

document.getElementById("manage-devices-btn").onclick = () => {
    loadDeviceManagement();
    document.getElementById("devices-popup").classList.remove("hidden");
};

// -----------------------------
// Device Management
// -----------------------------
async function loadDeviceManagement() {
    await loadDevices();
    await loadRooms();

    const list = document.getElementById("devices-list");
    const sel = document.getElementById("alias-device-select");

    list.innerHTML = "";
    sel.innerHTML = "";

    devices.forEach(d => {
        const item = document.createElement("div");
        item.className = "device-item";

        item.innerHTML = `
            <b>${d.alias || d.id}</b><br>
            Typ: ${d.type}<br>
            ID: ${d.id}
            <hr>
        `;

        list.appendChild(item);

        const opt = document.createElement("option");
        opt.value = d.id;
        opt.innerText = d.alias || d.id;
        sel.appendChild(opt);
    });
}

document.getElementById("alias-save-btn").onclick = async () => {
    const id = document.getElementById("alias-device-select").value;
    const alias = document.getElementById("alias-input").value;

    await fetch(`/api/devices/${id}/alias`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ alias })
    });

    loadDeviceManagement();
    buildDashboard();
};
