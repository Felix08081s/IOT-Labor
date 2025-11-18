const MQTT_WS = (location.hostname === "localhost")
  ? "ws://localhost:9001"
  : `ws://${location.hostname}:9001`;

const params = new URLSearchParams(window.location.search);
const roomName = params.get("room");

document.getElementById("room-name").textContent = roomName;

async function initRoom() {
    const r = await fetch(`/api/rooms/${roomName}/devices`);
    const devices = await r.json();

    const client = mqtt.connect(MQTT_WS);

    client.on("connect", () => {
        devices.forEach(d => {
            client.subscribe(`${d.topicBase || "home/devices/" + d.id}/state`);
        });
    });

    client.on("message", (topic, msg) => {
        const data = JSON.parse(msg.toString());
        if (data.temperature !== undefined)
            document.getElementById("current-temp").textContent = data.temperature;
        if (data.humidity !== undefined)
            document.getElementById("current-humidity").textContent = data.humidity;
    });

    document.getElementById("temp-slider").oninput = async () => {
        const val = document.getElementById("temp-slider").value;
        document.getElementById("target-temp").textContent = val;

        const actor = devices.find(d => d.capabilities?.includes("targetTemperature"));
        if (!actor) return;

        await fetch(`/api/devices/${actor.id}/set`, {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ targetTemperature: Number(val) })
        });
    };
}

initRoom();
