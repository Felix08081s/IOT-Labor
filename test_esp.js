// fake-esps.js
const mqtt = require("mqtt");

// Broker-Adresse (Pi-IP anpassen, wenn nicht localhost)
const MQTT_URL = "mqtt://localhost:1883";

// Virtuelle Geräte definieren
const devices = [
  {
    id: "esp-1",
    model: "esp32-dht11",
    type: "sensor",
    capabilities: ["temperature", "humidity", "targetTemperature"]
  },
  {
    id: "esp-2",
    model: "esp32-dht11",
    type: "sensor",
    capabilities: ["temperature", "humidity"]
  }
];

const client = mqtt.connect(MQTT_URL);

client.on("connect", () => {
  console.log("Fake ESPs connected to MQTT");

  // Registrierung + Subscription auf set-Topics
  devices.forEach(d => {
    sendRegister(d);

    const setTopic = `home/devices/${d.id}/set`;
    client.subscribe(setTopic, err => {
      if (!err) {
        console.log(`Subscribed to ${setTopic}`);
      }
    });
  });

  // Zyklisch State senden
  setInterval(() => {
    devices.forEach(d => sendDummyState(d));
  }, 5000); // alle 5s
});

// Registrierung wie dein echter ESP
function sendRegister(d) {
  const topic = "home/devices/register";
  const payload = {
    id: d.id,
    model: d.model,
    type: d.type,
    capabilities: d.capabilities
  };

  client.publish(topic, JSON.stringify(payload));
  console.log("Registered device:", d.id);
}

// Dummy-State (Temp+Feuchte) senden
function sendDummyState(d) {
  const topic = `home/devices/${d.id}/state`;

  // Einfache Dummy-Werte
  const temp = 20 + Math.random() * 5;   // 20–25°C
  const hum  = 40 + Math.random() * 20;  // 40–60%

  const payload = {
    temperature: Number(temp.toFixed(1)),
    humidity: Number(hum.toFixed(1))
  };

  client.publish(topic, JSON.stringify(payload));
  console.log(`State from ${d.id}:`, payload);
}

// Ankommende set-Befehle nur loggen
client.on("message", (topic, msg) => {
  console.log("SET received:", topic, msg.toString());
});
