import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import dotenv from 'dotenv';
import chokidar from 'chokidar';

dotenv.config({ path: 'entry.env', override: false });

const KUMA_URL = process.env.KUMA_URL || 'http://uptime-kuma:3001';
const USERNAME = process.env.KUMA_USERNAME;
const PASSWORD = process.env.KUMA_PASSWORD;

const configPath = path.resolve('public/config.yaml');

if (!USERNAME || !PASSWORD) {
  console.error('❌ Fehler: Bitte KUMA_USERNAME und KUMA_PASSWORD eintragen!');
  process.exit(1);
}

function formatUrlForKuma(url) {
  if (!url) return url;
  return url.replace(/:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/, '://host.docker.internal$2');
}

function emitPromise(socket, event, ...args) {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ ok: false, msg: 'Timeout' });
      }
    }, 4000);

    socket.emit(event, ...args, (res) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(res || { ok: true });
      }
    });
  });
}

let isSyncing = false;

async function runSync() {
  if (isSyncing) return;
  isSyncing = true;

  console.log(`🔄 Starte Voll-Sync mit Uptime Kuma (${KUMA_URL})...`);

  const socket = io(KUMA_URL, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    reconnection: false
  });

  let existingMonitors = {};
  let existingStatusPages = {};
  let monitorListReceived = false;

  socket.on('monitorList', (data) => {
    existingMonitors = data;
    monitorListReceived = true;
  });

  socket.on('statusPageList', (data) => {
    existingStatusPages = data;
  });

  socket.on('connect', async () => {
    console.log('🔌 Verbunden! Führe Login aus...');

    try {
      // 1. Login
      const loginRes = await emitPromise(socket, 'login', {
        username: USERNAME,
        password: PASSWORD,
        token: ''
      });

      if (!loginRes || loginRes.ok === false) {
        throw new Error(`Login fehlgeschlagen: ${loginRes?.msg || 'Unbekannter Fehler'}`);
      }
      console.log('✅ Login erfolgreich!');

      // WICHTIG: Warten, bis Kuma die Monitor-Liste gesendet hat
      let waitCount = 0;
      while (!monitorListReceived && waitCount < 10) {
        await new Promise((res) => setTimeout(res, 300));
        waitCount++;
      }

      await new Promise((res) => setTimeout(res, 500));

      const localhostSlug = 'localhost';

      // 2. Status-Seite anlegen, falls noch nicht vorhanden
      if (!existingStatusPages[localhostSlug]) {
        console.log('📄 Erstelle Status-Seite "localhost"...');
        await emitPromise(socket, 'addStatusPage', 'Localhost Dashboard', localhostSlug);
        await new Promise((res) => setTimeout(res, 500));
      }

      // 3. config.yaml einlesen
      if (!fs.existsSync(configPath)) throw new Error(`Datei nicht gefunden: ${configPath}`);
      const file = fs.readFileSync(configPath, 'utf8');
      const config = yaml.parse(file);

      let isConfigUpdated = false;
      const activeMonitorIds = [];

      // 4. Monitore im Haupt-Dashboard anlegen / prüfen
      console.log('⚙️ Gleiche Config mit Uptime Kuma ab...');
      for (const section of config.sections || []) {
        for (const item of section.items || []) {
          if (item.uptimeKuma === false) {
            console.log(`⏩ Überspringe "${item.name}" (uptimeKuma ist deaktiviert)`);
            continue;
          }

          if (!item.uptimeKuma) {
            item.uptimeKuma = {};
          }

          const monitorName = item.name;
          const targetUrl = formatUrlForKuma(item.url);
          const isPing = item.type === 'ping';
          const yamlMonitorId = item.uptimeKuma.monitorId;

          // Exakte Suche nach ID oder Name/URL
          let monitor = Object.values(existingMonitors).find((m) => m.id === yamlMonitorId);
          if (!monitor) {
            monitor = Object.values(existingMonitors).find(
              (m) => m.name === monitorName && (isPing || m.url === targetUrl)
            );
          }

          if (!monitor) {
            console.log(`➕ Erstelle neuen Monitor im Dashboard: "${monitorName}" (${targetUrl})...`);
            const monitorPayload = {
              type: isPing ? 'ping' : 'http',
              name: monitorName,
              hostname: isPing ? item.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : undefined,
              url: isPing ? undefined : targetUrl,
              interval: 60,
              retryInterval: 60,
              maxretries: 3,
              accepted_statuscodes: ['200-299'],
              notificationIDList: {}
            };

            const addRes = await emitPromise(socket, 'add', monitorPayload);

            if (addRes && addRes.ok) {
              const newId = addRes.monitorID;
              console.log(`✅ Monitor "${monitorName}" erstellt (ID: ${newId})`);
              item.uptimeKuma.monitorId = newId;
              item.uptimeKuma.slug = localhostSlug;
              activeMonitorIds.push(newId);
              isConfigUpdated = true;
            } else {
              console.error(`❌ Fehler beim Erstellen von "${monitorName}":`, addRes?.msg || addRes);
            }
          } else {
            console.log(`ℹ️ Monitor "${monitorName}" existiert (ID: ${monitor.id})`);

            if (!isPing && monitor.url !== targetUrl) {
              console.log(`🔄 Aktualisiere Ziel-URL für "${monitorName}" auf ${targetUrl}`);
              await emitPromise(socket, 'editMonitor', {
                ...monitor,
                url: targetUrl
              });
            }

            if (item.uptimeKuma.monitorId !== monitor.id || item.uptimeKuma.slug !== localhostSlug) {
              item.uptimeKuma.monitorId = monitor.id;
              item.uptimeKuma.slug = localhostSlug;
              isConfigUpdated = true;
            }
            activeMonitorIds.push(monitor.id);
          }
        }
      }

      // 5. Verwaiste Monitore aus Kuma löschen
      const existingIds = Object.keys(existingMonitors).map((id) => parseInt(id, 10));
      const orphanIds = existingIds.filter((id) => !activeMonitorIds.includes(id));

      for (const orphanId of orphanIds) {
        const orphanName = existingMonitors[orphanId]?.name || orphanId;
        console.log(`🗑️ Lösche verwaisten Monitor aus Kuma: "${orphanName}" (ID: ${orphanId})...`);
        await emitPromise(socket, 'deleteMonitor', orphanId);
      }

      // 6. Monitore auf der Status-Seite verknüpfen
      console.log('⏳ Warte kurz auf Kuma-Datenbank...');
      await new Promise((res) => setTimeout(res, 1000)); // <-- Kritisches Time-Out für Kuma DB

      console.log(`📌 Verknüpfe Monitore [${activeMonitorIds.join(', ')}] mit Status-Seite "${localhostSlug}"...`);

      const currentConfig = existingStatusPages[localhostSlug] || {};

      const statusPagePayload = {
        title: currentConfig.title || 'Localhost Dashboard',
        description: currentConfig.description || '',
        icon: currentConfig.icon || '/icon.svg',
        theme: currentConfig.theme || 'auto',
        published: true,
        searchEngineIndex: false,
        showTags: false,
        domainNameList: currentConfig.domainNameList || [],
        customCSS: currentConfig.customCSS || '',
        footerText: currentConfig.footerText || '',
        showPoweredBy: false,
        publicGroupList: [
          {
            id: 1,
            name: 'Services',
            weight: 1,
            monitorList: activeMonitorIds.map((id) => ({ id }))
          }
        ]
      };

      const saveRes = await emitPromise(socket, 'saveStatusPage', localhostSlug, statusPagePayload, null);

      if (saveRes && saveRes.ok !== false) {
        console.log('✅ Monitore erfolgreich auf der Status-Seite eingebunden!');
      } else {
        console.error('⚠️ Fehler beim Speichern der Status-Seite:', saveRes?.msg || saveRes);
      }

      // 7. Config-Datei zurückschreiben
      if (isConfigUpdated) {
        console.log('💾 Speichere aktualisierte public/config.yaml...');
        watcher.unwatch(configPath);
        fs.writeFileSync(configPath, yaml.stringify(config), 'utf8');
        setTimeout(() => watcher.add(configPath), 1000);
      }

      console.log('🎉 Voll-Sync erfolgreich abgeschlossen!');
    } catch (err) {
      console.error('❌ Fehler beim Sync:', err.message || err);
    } finally {
      socket.disconnect();
      isSyncing = false;
    }
  });

  socket.on('connect_error', (err) => {
    console.error(`❌ Verbindungsfehler zu ${KUMA_URL}:`, err.message);
    socket.disconnect();
    isSyncing = false;
  });
}

// Initialer Run
runSync();

// Watcher
const watcher = chokidar.watch(configPath, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

watcher.on('change', () => {
  runSync();
});

console.log(`👀 Überwache ${configPath} auf Änderungen...`);