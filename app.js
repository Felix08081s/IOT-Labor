console.log("app.js geladen");

// =========================================================
// 1. Dummy REST API Speicher (persistent in localStorage)
// =========================================================

function loadData(key, fallback) {
    return JSON.parse(localStorage.getItem(key)) || fallback;
}

function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// Dummy Devices (statisch)
const dummyDevices = [
    { id: "abc123", alias: "Temperatursensor 1", type: "temp", topic: "dummy/temp1" },
    { id: "def456", alias: "Temperatursensor 2", type: "temp", topic: "dummy/temp2" },
    { id: "ghi789", alias: "Feuchtesensor Bad", type: "hum", topic: "dummy/hum1" }
];

// REST Simulation
async function apiGetRooms() {
    return loadData("rooms", []);
}

async function apiAddRoom(name) {
    const rooms = loadData("rooms", []);
    rooms.push({ name, devices: [] });
    saveData("rooms", rooms);
}

async function apiAssignDevice(roomName, deviceId, assigned) {
    const rooms = loadData("rooms", []);

    const room = rooms.find(r => r.name === roomName);
    if (!room) return;

    if (assigned) {
        if (!room.devices.includes(deviceId)) {
            room.devices.push(deviceId);
        }
    } else {
        room.devices = room.devices.filter(id => id !== deviceId);
    }
    saveData("rooms", rooms);
}

async function apiGetDevices() {
    return dummyDevices;
}


// =========================================================
// 2. Dummy MQTT Simulation
// =========================================================

const mqttListeners = {};

function mqttSubscribe(topic, callback) {
    mqttListeners[topic] = callback;
}

setInterval(() => {
    for (const dev of dummyDevices) {
        const value =
            dev.type === "temp"
                ? Math.floor(20 + Math.random() * 3)
                : Math.floor(50 + Math.random() * 10);

        if (mqttListeners[dev.topic]) {
            mqttListeners[dev.topic](value);
        }
    }
}, 3000);


// =========================================================
// 3. Dashboard aufbauen
// =========================================================

async function buildDashboard() {
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = "";

    const rooms = await apiGetRooms();
    const devices = await apiGetDevices();

    rooms.forEach(room => {
        let temperature = "--";
        let humidity = "--";

        const card = document.createElement("div");
        card.className = "room-card";
        card.innerHTML = `
            <h2>${room.name}</h2>
            <p class="temp">${temperature}°C</p>
            <p class="humidity">${humidity}%</p>
        `;

        room.devices.forEach(deviceId => {
            const dev = devices.find(d => d.id === deviceId);
            if (!dev) return;

            mqttSubscribe(dev.topic, value => {
                if (dev.type === "temp") {
                    card.querySelector(".temp").textContent = value + "°C";
                }
                if (dev.type === "hum") {
                    card.querySelector(".humidity").textContent = value + "%";
                }
            });
        });

        card.addEventListener("click", () => {
            window.location.href = `room.html?room=${encodeURIComponent(room.name)}`;
        });

        dashboard.appendChild(card);
    });
}

buildDashboard();


// =========================================================
// 4. Raum hinzufügen Popup
// =========================================================

document.getElementById("add-room-btn").onclick = () => {
    document.getElementById("room-popup").classList.remove("hidden");
};

document.getElementById("close-room-popup").onclick = () => {
    document.getElementById("room-popup").classList.add("hidden");
};

document.getElementById("save-room-btn").onclick = async () => {
    const name = document.getElementById("new-room-name").value.trim();
    if (!name) return;

    await apiAddRoom(name);

    document.getElementById("room-popup").classList.add("hidden");
    buildDashboard();
};


// =========================================================
// 5. Geräteverwaltung
// =========================================================

document.getElementById("manage-devices-btn").onclick = async () => {
    const popup = document.getElementById("device-popup");
    popup.classList.remove("hidden");

    const rooms = await apiGetRooms();
    const devices = await apiGetDevices();

    const list = document.getElementById("device-list");
    list.innerHTML = "";

    devices.forEach(dev => {
        const container = document.createElement("div");
        container.className = "device-item";

        const roomSelect = document.createElement("select");
        roomSelect.innerHTML = `<option value="">Kein Raum</option>`;
        rooms.forEach(r => {
            roomSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`;
        });

        // Aktuelle Zuweisung
        const currentRoom = rooms.find(r => r.devices.includes(dev.id));
        if (currentRoom) roomSelect.value = currentRoom.name;

        roomSelect.onchange = () => {
            rooms.forEach(r => apiAssignDevice(r.name, dev.id, false));

            if (roomSelect.value !== "") {
                apiAssignDevice(roomSelect.value, dev.id, true);
            }
            buildDashboard();
        };

        container.innerHTML = `<strong>${dev.alias}</strong>`;
        container.appendChild(roomSelect);

        list.appendChild(container);
    });
};

document.getElementById("close-device-popup").onclick = () => {
    document.getElementById("device-popup").classList.add("hidden");
};
