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



app.delete('/api/rooms/:name', (req, res) => {
  const name = req.params.name;
  const idx = rooms.findIndex(r => r.name === name);
  if (idx === -1) return res.status(404).json({ error: 'room not found' });

  rooms.splice(idx, 1); // Raum entfernen
  persist();
  res.status(204).end();
}); 
