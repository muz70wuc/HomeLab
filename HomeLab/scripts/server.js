import express from 'express';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.resolve(process.cwd(), 'public/config.yaml');

app.use(express.json());

app.post('/api/config', (req, res) => {
  try {
    const updatedConfig = req.body;

    // YAML sauber formatiert zurückschreiben
    const yamlString = yaml.stringify(updatedConfig);
    fs.writeFileSync(CONFIG_PATH, yamlString, 'utf8');

    console.log('✅ config.yaml von UI aktualisiert.');
    return res.status(200).json({ message: 'Erfolgreich gespeichert' });
  } catch (error) {
    console.error('❌ Fehler beim Schreiben der config.yaml:', error);
    return res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Config API Backend läuft auf Port ${PORT}`);
});