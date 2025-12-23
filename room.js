// ==========================================================
// MQTT WebSocket URL bestimmen
// ==========================================================
const MQTT_WS = (location.hostname === "localhost")
  ? "ws://localhost:9001"
  : `ws://${location.hostname}:9001`;

// ==========================================================
// Raumname aus URL lesen und im UI anzeigen
// ==========================================================
const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");
document.getElementById("room-name").textContent = roomName;

// Gemeinsamer Zustand für diesen Raum
let roomDevices = [];
let mqttClient = null;

// ==========================================================
// Raum initial laden: Räume + Geräte + MQTT
// ==========================================================
async function initRoom() {
  // Räume laden und passenden Raum finden
  const roomsRes = await fetch("/api/rooms");
  const rooms = await roomsRes.json();
  const room = rooms.find(r => r.name === roomName);
  if (!room) {
    alert("Raum nicht gefunden: " + roomName);
    return;
  }

  // Geräte dieses Raums laden (mit lastState)
  const devRes = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/devices`);
  roomDevices = await devRes.json();

  // Erste Anzeige aus REST-Daten
  renderRoom();

  // MQTT verbinden
  mqttClient = mqtt.connect(MQTT_WS);

  mqttClient.on("connect", () => {
    console.log("MQTT connected in room view");
    // Alle State-Topics der Geräte dieses Raums abonnieren
    roomDevices.forEach(d => {
      const base = d.topicBase || `home/devices/${d.id}`;
      mqttClient.subscribe(`${base}/state`);
    });
  });

  // Live-Updates verarbeiten
  mqttClient.on("message", (topic, msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const parts = topic.split("/"); // home/devices/<id>/state
      const id = parts[2];
      const dev = roomDevices.find(d => d.id === id);
      if (!dev) return;

      dev.lastState = data;
      renderRoom();
    } catch (e) {
      console.warn("MQTT parse error in room:", e);
    }
  });

  // Zieltemperatur-Slider (wie bisher)
  const slider = document.getElementById("temp-slider");
  if (slider) {
    slider.oninput = async () => {
      const val = slider.value;
      document.getElementById("target-temp").textContent = val;

      const actor = roomDevices.find(d => d.capabilities?.includes("targetTemperature"));
      if (!actor) return;

      await fetch(`/api/devices/${actor.id}/set`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ targetTemperature: Number(val) })
      });
    };
  }

  // Raum löschen Button
  const deleteBtn = document.getElementById("delete-room-btn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm(`Raum "${roomName}" wirklich löschen?`)) return;
      await fetch(`/api/rooms/${encodeURIComponent(roomName)}`, {
        method: "DELETE"
      });
      window.location.href = "index.html";
    };
  }
}

// ==========================================================
// UI-Rendering: Durchschnitt + Geräte-Kacheln
// ==========================================================
async function reloadRoomDevices() {
  const devRes = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/devices`);
  roomDevices = await devRes.json();
}

function renderRoom() {
  const statsEl = document.getElementById("room-stats");
  const container = document.getElementById("room-devices");
  if (!statsEl || !container) return;

  // Durchschnitt berechnen
  const temps = roomDevices
    .map(d => d.lastState?.temperature)
    .filter(t => typeof t === "number");
  const hums = roomDevices
    .map(d => d.lastState?.humidity)
    .filter(h => typeof h === "number");

  const avgTemp = temps.length
    ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
    : "--";
  const avgHum = hums.length
    ? (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1)
    : "--";

  // Oben: Durchschnitt (gleicher Wert wie im Dashboard)
  statsEl.innerHTML = `
    <div>Temperatur: <span>${avgTemp}°C</span></div>
    <div>Luftfeuchte: <span>${avgHum}%</span></div>
  `;

  // Darunter: Kacheln für jedes Gerät
  container.innerHTML = "";
  roomDevices.forEach(d => {
    const card = document.createElement("div");
    card.className = "room-device-card";

    const t = d.lastState?.temperature ?? "--";
    const h = d.lastState?.humidity ?? "--";

    card.innerHTML = `
      <div class="rd-header">
        <span class="rd-name">${d.alias || d.id}</span>
        <button class="rd-remove-btn" data-id="${d.id}">✕</button>
      </div>
      <div class="rd-values">
        <div class="rd-temp">${t}°C</div>
        <div class="rd-hum">${h}%</div>
      </div>
    `;

    container.appendChild(card);
  });

  // Entfernen-Buttons neu binden
  container.querySelectorAll(".rd-remove-btn").forEach(btn => {
    btn.onclick = async () => {
      const deviceId = btn.getAttribute("data-id");
      await fetch(`/api/rooms/${encodeURIComponent(roomName)}/remove`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ deviceId })
      });
      await reloadRoomDevices();
      renderRoom();
    };
  });
}

// ==========================================================
// Start
// ==========================================================
initRoom();
