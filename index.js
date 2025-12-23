const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const cors = require('cors');
const { nanoid } = require('nanoid');

// ---------------------------------------------------------
// Dateipfade & JSON-Helfer
// ---------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const ROOMS_FILE   = path.join(DATA_DIR, 'rooms.json');

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('JSON read error for', file, err);
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('JSON write error for', file, err);
  }
}

// In-Memory-Daten (werden beim Start geladen)
const devices = readJson(DEVICES_FILE, []); // [{id, model, type, ...}]
const rooms   = readJson(ROOMS_FILE, []);   // [{name, devices:[id,...]}]

// Debounced persist, um SD-Karte zu schonen
let persistTimeout = null;
function persist() {
  if (persistTimeout) return;
  persistTimeout = setTimeout(() => {
    writeJson(DEVICES_FILE, devices);
    writeJson(ROOMS_FILE, rooms);
    persistTimeout = null;
  }, 500);
}

function getDevice(id) {
  return devices.find(d => d.id === id);
}

// ---------------------------------------------------------
// MQTT-Client
// ---------------------------------------------------------
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const mqttClient  = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker:', MQTT_BROKER);

  mqttClient.subscribe([
    'home/devices/register',
    'home/devices/+/state',
    'home/devices/+/ack',
    'home/devices/+/heartbeat'
  ], (err) => {
    if (err) console.error('MQTT subscribe error:', err);
  });
});

mqttClient.on('message', (topic, msgBuf) => {
  let payload;
  try {
    payload = JSON.parse(msgBuf.toString());
  } catch {
    console.warn('Invalid JSON on topic', topic);
    return;
  }

  const parts = topic.split('/');

  // Registrierung: home/devices/register
  if (topic === 'home/devices/register') {
    const id = payload.id;
    if (!id) {
      console.warn('Register without id:', payload);
      return;
    }

    let dev = getDevice(id);
    if (!dev) {
      dev = {
        id,
        model:        payload.model || null,
        type:         payload.type  || 'unknown',
        capabilities: payload.capabilities || [],
        alias:        payload.alias || null,
        topicBase:    payload.topicBase || `home/devices/${id}`,
        lastSeen:     Date.now(),
        lastState:    null,
        lastAck:      null,
        lastHeartbeat:null
      };
      devices.push(dev);
      console.log('Registered device', id);
    } else {
      dev.lastSeen = Date.now();
    }
    persist();
    return;
  }

  // State/Ack/Heartbeat: home/devices/<id>/...
  if (parts.length >= 4 && parts[0] === 'home' && parts[1] === 'devices') {
    const id   = parts[2];
    const kind = parts[3]; // state | ack | heartbeat
    let dev    = getDevice(id);

    // Auto-Registrierung, falls unbekannt
    if (!dev) {
      dev = {
        id,
        model:        null,
        type:         'unknown',
        capabilities: Object.keys(payload),
        alias:        null,
        topicBase:    `home/devices/${id}`,
        lastSeen:     Date.now(),
        lastState:    kind === 'state'      ? payload : null,
        lastAck:      kind === 'ack'        ? payload : null,
        lastHeartbeat:kind === 'heartbeat'  ? payload : null
      };
      devices.push(dev);
      console.log('Auto-registered device from', topic);
      persist();
      return;
    }

    dev.lastSeen = Date.now();
    if (kind === 'state')      dev.lastState      = payload;
    if (kind === 'ack')        dev.lastAck        = payload;
    if (kind === 'heartbeat')  dev.lastHeartbeat  = payload;
    persist();
    return;
  }
});

// ---------------------------------------------------------
// Express / REST-API
// ---------------------------------------------------------
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Statisches Frontend (./public)
app.use(express.static(path.join(__dirname, 'public')));

// ------- Geräte-API -------

// Alle Geräte
app.get('/api/devices', (req, res) => {
  res.json(devices);
});

// Alias setzen
app.post('/api/devices/:id/alias', (req, res) => {
  const dev = getDevice(req.params.id);
  if (!dev) return res.status(404).json({ error: 'device not found' });
  dev.alias = req.body.alias || null;
  persist();
  res.json({ success: true });
});

// Direktes Setzen von Werten -> MQTT publish
app.post('/api/devices/:id/set', (req, res) => {
  const id  = req.params.id;
  const dev = getDevice(id);
  if (!dev) return res.status(404).json({ error: 'device not found' });

  const topic = `${dev.topicBase || `home/devices/${id}`}/set`;
  mqttClient.publish(topic, JSON.stringify(req.body));
  res.json({ success: true });
});

// Optional: REST-Registrierung eines Gerätes (falls genutzt)
app.post('/api/devices/register', (req, res) => {
  const p  = req.body;
  const id = p.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  let dev = getDevice(id);
  if (!dev) {
    dev = {
      id,
      model:        p.model || null,
      type:         p.type  || 'unknown',
      capabilities: p.capabilities || [],
      alias:        p.alias || null,
      topicBase:    p.topicBase || `home/devices/${id}`,
      lastSeen:     Date.now()
    };
    devices.push(dev);
    persist();
  }
  res.json({ success: true });
});

// ------- Raum-API -------

// Alle Räume
app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

// Raum anlegen
app.post('/api/rooms', (req, res) => {
  const name = req.body.name;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (rooms.find(r => r.name === name)) {
    return res.status(400).json({ error: 'room exists' });
  }
  rooms.push({ name, devices: [] });
  persist();
  res.json({ success: true });
});

// Raum löschen
app.delete('/api/rooms/:name', (req, res) => {
  const name = req.params.name;
  const idx  = rooms.findIndex(r => r.name === name);
  if (idx === -1) return res.status(404).json({ error: 'room not found' });
  rooms.splice(idx, 1);
  persist();
  res.json({ success: true });
});

// Gerät einem Raum zuordnen
app.post('/api/rooms/:name/assign', (req, res) => {
  const name = req.params.name;
  const room = rooms.find(r => r.name === name);
  if (!room) return res.status(404).json({ error: 'room not found' });

  const id = req.body.deviceId;
  if (!getDevice(id)) return res.status(404).json({ error: 'device not found' });

  rooms.forEach(r => {
    if (r !== room && r.devices.includes(id)) {
      r.devices = r.devices.filter(did => did !== id);
    }
  });

  if (!room.devices.includes(id)) room.devices.push(id);
  persist();
  res.json({ success: true });
});

// Gerät aus einem Raum entfernen
app.post('/api/rooms/:name/remove', (req, res) => {
  const name = req.params.name;
  const room = rooms.find(r => r.name === name);
  if (!room) return res.status(404).json({ error: 'room not found' });

  const id = req.body.deviceId;
  room.devices = room.devices.filter(did => did !== id);
  persist();
  res.json({ success: true });
});

// Geräte eines Raums
app.get('/api/rooms/:name/devices', (req, res) => {
  const name = req.params.name;
  const room = rooms.find(r => r.name === name);
  if (!room) return res.status(404).json({ error: 'room not found' });

  const ds = devices.filter(d => room.devices.includes(d.id));
  res.json(ds);
});

//Raum löschen
app.delete('/api/rooms/:name', (req, res) => {
  const name = req.params.name;

  const idx = rooms.findIndex(r => r.name === name);
  if (idx === -1) {
    return res.status(404).json({ error: 'room not found' });
  }

  // Raum aus dem Array entfernen
  rooms.splice(idx, 1);
  persist();   // deine vorhandene Funktion zum Speichern

  // 204 = No Content, Löschung erfolgreich
  res.status(204).end();
});


// ---------------------------------------------------------
// Server starten
// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`REST server listening on http://localhost:${PORT}`);
});
