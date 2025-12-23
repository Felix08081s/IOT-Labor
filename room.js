// MQTT URL
const MQTT_WS = (location.hostname === "localhost")
  ? "ws://localhost:9001"
  : `ws://${location.hostname}:9001`;

// Raumname aus URL
const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");
document.getElementById("room-name").textContent = roomName;

// "Single Source of Truth" für den Raum
let roomDevices = [];
let client = null;

async function initRoom() {
  // Räume laden und Raum finden
  const roomsRes = await fetch("/api/rooms");
  const rooms = await roomsRes.json();
  const room = rooms.find(r => r.name === roomName);
  if (!room) {
    alert("Raum nicht gefunden: " + roomName);
    return;
  }

  // Geräte dieses Raums laden (inkl. lastState)
  const devRes = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/devices`);
  roomDevices = await devRes.json();

  // Erste Anzeige aus REST-Daten
  renderRoom();

  // MQTT verbinden
  client = mqtt.connect(MQTT_WS);

  client.on("connect", () => {
    // Alle state-Topics der Raumgeräte abonnieren
    roomDevices.forEach(d => {
      const base = d.topicBase || `home/devices/${d.id}`;
      client.subscribe(`${base}/state`);
    });
  });

  // Eingehende MQTT-Nachrichten: internes Array aktualisieren + neu rendern
  client.on("message", (topic, msg) => {
    try {
      const data = JSON.parse(msg.toString());
      const parts = topic.split("/");      // home, devices, <id>, state
      const id = parts[2];
      const dev = roomDevices.find(d => d.id === id);
      if (!dev) return;
      dev.lastState = data;
      renderRoom();
    } catch (e) {
      console.warn("MQTT parse error:", e);
    }
  });

  // Zieltemperatur-Slider (optional wie gehabt)
  document.getElementById("temp-slider").oninput = async () => {
    const val = document.getElementById("temp-slider").value;
    document.getElementById("target-temp").textContent = val;

    const actor = roomDevices.find(d => d.capabilities?.includes("targetTemperature"));
    if (!actor) return;

    await fetch(`/api/devices/${actor.id}/set`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ targetTemperature: Number(val) })
    });
  };

  // Raum löschen Button (wie gehabt)
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

// Zeichnet Durchschnitt + Kacheln aus roomDevices
function renderRoom() {
  const stats = document.getElementById("room-stats");
  const container = document.getElementById("room-devices");
  if (!stats || !container) return;

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

  // Oben: Durchschnitt
  stats.innerHTML = `
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

  // Entfernen-Buttons neu verdrahten
  container.querySelectorAll(".rd-remove-btn").forEach(btn => {
    btn.onclick = async () => {
      const deviceId = btn.getAttribute("data-id");
      await fetch(`/api/rooms/${encodeURIComponent(roomName)}/remove`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ deviceId })
      });
      // Raumgeräte neu laden (REST) und rendern
      const devRes = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/devices`);
      roomDevices = await devRes.json();
      renderRoom();
    };
  });
}

// Start
initRoom();
