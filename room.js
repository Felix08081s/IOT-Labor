// ==========================================================
// MQTT WebSocket URL bestimmen (abhängig vom Deployment)
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

// ==========================================================
// Hauptfunktion: Geräte laden + MQTT verbinden + UI steuern
// ==========================================================
async function initRoom() {

   // Räume laden und Raum finden
  const roomsRes = await fetch("/api/rooms");
  const rooms = await roomsRes.json();

  const room = rooms.find(r => r.name === roomName);
  if (!room) {
    alert("Raum nicht gefunden: " + roomName);
    return;
  }

  // Alle Geräte laden
  const devRes = await fetch("/api/devices");
  const allDevices = await devRes.json();

  // Nur Geräte dieses Raums herausfiltern
  const devices = allDevices.filter(d => room.devices.includes(d.id));

    // MQTT Client verbinden
    const client = mqtt.connect(MQTT_WS);

    // ----------------------------------------------------------
    // Sobald MQTT verbunden ist → alle Gerätetopics abonnieren
    // ----------------------------------------------------------
    client.on("connect", () => {
        devices.forEach(d => {
            // Jedes Gerät sendet seinen Zustand an <topicBase>/state
            client.subscribe(`${d.topicBase || "home/devices/" + d.id}/state`);
        });
    });

    // ----------------------------------------------------------
    // Eingehende MQTT Nachrichten verarbeiten (Live Sensorwerte)
    // ----------------------------------------------------------
    client.on("message", (topic, msg) => {
        const data = JSON.parse(msg.toString());

        // Temperatur aktualisieren, falls vorhanden
        if (data.temperature !== undefined)
            document.getElementById("current-temp").textContent = data.temperature;

        // Luftfeuchtigkeit aktualisieren, falls vorhanden
        if (data.humidity !== undefined)
            document.getElementById("current-humidity").textContent = data.humidity;
    });

    // ----------------------------------------------------------
    // Slider zur Einstellung der Zieltemperatur
    // ----------------------------------------------------------
    document.getElementById("temp-slider").oninput = async () => {
        const val = document.getElementById("temp-slider").value;
        document.getElementById("target-temp").textContent = val;

        // Passendes Gerät mit "targetTemperature" Fähigkeit finden
        const actor = devices.find(d => d.capabilities?.includes("targetTemperature"));
        if (!actor) return;

        // Zieltemperatur über REST API setzen
        await fetch(`/api/devices/${actor.id}/set`, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ targetTemperature: Number(val) })
        });
    };
    // Raum löschen Button
  const deleteBtn = document.getElementById("delete-room-btn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm(`Raum "${roomName}" wirklich löschen?`)) return;
        // encodeURIComponent für gültigen URL falls Raumname z.B. aus 2 Wörtern besteht
      await fetch(`/api/rooms/${encodeURIComponent(roomName)}`, {
        method: "DELETE"
      });

      window.location.href = "index.html";
    };
  }
}

// Skript starten
initRoom();
