import { useEffect, useState } from 'react';
import * as yaml from 'js-yaml';
import type { DashboardConfig, ServiceItem } from './types/config';
import { DynamicIcon } from './components/DynamicIcon';
import { UptimeBadge } from './components/UptimeBadge';
import { ExternalLink, RefreshCw, Plus, X } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal-Zustände
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);

  // Formular-Zustände
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItem, setNewItem] = useState({
    name: '',
    url: '',
    icon: 'Server',
    description: '',
    enableUptimeKuma: false,
    kumaSlug: ''
  });

  const loadConfig = () => {
    setLoading(true);
    fetch('/config.yaml?cache=' + Date.now())
      .then((res) => {
        if (!res.ok) throw new Error('config.yaml konnte nicht geladen werden.');
        return res.text();
      })
      .then((text) => {
        const parsed = yaml.load(text) as DashboardConfig;
        setConfig(parsed);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Hilfsfunktion: Konfiguration an Backend senden & speichern
  const saveConfigToBackend = async (updatedConfig: DashboardConfig) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      if (!res.ok) {
        throw new Error('Fehler beim Speichern der Konfiguration auf dem Server');
      }
      setConfig({ ...updatedConfig });
    } catch (err: any) {
      alert(`Fehler: ${err.message || 'Konnte nicht gespeichert werden'}`);
    }
  };

  // 1. Neue Sektion/Kategorie hinzufügen
  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !config) return;

    const updatedConfig: DashboardConfig = {
      ...config,
      sections: [
        ...(config.sections || []),
        {
          name: newCategoryName.trim(),
          items: []
        }
      ]
    };

    saveConfigToBackend(updatedConfig);
    setNewCategoryName('');
    setIsCategoryModalOpen(false);
  };

  // 2. Neuen Dienst zu einer Sektion hinzufügen
const handleAddItem = () => {
  if (selectedSectionIndex === null || !newItem.name.trim() || !newItem.url.trim() || !config) return;

  const updatedSections = [...config.sections];
  const targetSection = { ...updatedSections[selectedSectionIndex] };

  const itemPayload: ServiceItem = {
    name: newItem.name.trim(),
    url: newItem.url.trim(),
    icon: newItem.icon.trim() || 'Server',
    description: newItem.description.trim() || undefined,
    // Wenn Hook aktiviert ist, fügen wir das UptimeKuma-Objekt an, sonst lassen wir es weg (undefined)
    ...(newItem.enableUptimeKuma && {
      uptimeKuma: {
        slug: newItem.kumaSlug.trim() || 'localhost'
      }
    })
  };

  targetSection.items = [...targetSection.items, itemPayload];
  updatedSections[selectedSectionIndex] = targetSection;

  const updatedConfig: DashboardConfig = {
    ...config,
    sections: updatedSections
  };

  saveConfigToBackend(updatedConfig);

  // Formular zurücksetzen
  setNewItem({
    name: '',
    url: '',
    icon: 'Server',
    description: '',
    enableUptimeKuma: false,
    kumaSlug: ''
  });
  setIsItemModalOpen(false);
};

// Erstellte Sektionen und Dienste löschen
const handleDeleteItem = (sectionIndex: number, itemIndex: number) => {
  if (!config) return;

  // Bestätigungsabfrage vor dem Löschen
  if (!window.confirm("Möchtest du diesen Dienst wirklich löschen?")) return;

  // Deep Copy der Sektionen erstellen
  const updatedSections = [...config.sections];
  const targetSection = { ...updatedSections[sectionIndex] };

  // Item an der Stelle 'itemIndex' entfernen
  targetSection.items = targetSection.items.filter((_, idx) => idx !== itemIndex);
  updatedSections[sectionIndex] = targetSection;

  const updatedConfig: DashboardConfig = {
    ...config,
    sections: updatedSections
  };

  // Speichert die neue Config per API ab -> schreibt in config.yaml
  saveConfigToBackend(updatedConfig);
};

  if (loading && !config) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="animate-pulse text-slate-400">Lade Dashboard Config...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-red-950/40 border border-red-500/50 p-6 rounded-2xl max-w-md w-full">
          <h2 className="text-red-400 text-lg font-bold mb-2">Fehler beim Laden</h2>
          <p className="text-slate-300 text-sm mb-4">{error}</p>
          <button
            onClick={loadConfig}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-indigo-500 selection:text-white relative">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {config?.title}
            </h1>
            {config?.subtitle && (
              <p className="text-slate-400 mt-2 text-sm md:text-base font-normal">
                {config.subtitle}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>Kategorie</span>
            </button>

            <button
              onClick={loadConfig}
              title="Config neu laden"
              className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Grid der Sections */}
        <main className="space-y-10">
          {config?.sections.map((section, sIdx) => (
            <section key={sIdx}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-300 tracking-wide uppercase text-xs font-mono">
                  {section.name}
                </h2>
                
                <button
                  onClick={() => {
                    setSelectedSectionIndex(sIdx);
                    setIsItemModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dienst hinzufügen</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {section.items.map((item, iIdx) => (
                  <a
                    key={iIdx}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative flex items-start gap-4 p-4 bg-slate-900/40 hover:bg-slate-900/90 border border-slate-800/60 hover:border-indigo-500/40 rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5"
                  >
                    <div className="p-2.5 bg-slate-800/60 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 rounded-xl text-slate-400 transition-colors">
                      <DynamicIcon name={item.icon} className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <h3 className="font-semibold text-slate-200 group-hover:text-white transition-colors truncate text-sm">
                            {item.name}
                          </h3>
                          <UptimeBadge
                            baseUrl={item.uptimeKuma?.apiUrl || config?.uptimeKumaBaseUrl}
                            slug={item.uptimeKuma?.slug}
                            monitorId={item.uptimeKuma?.monitorId}
                            type={item.type}
                            targetUrl={item.url}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteItem(sIdx, iIdx);
                            }}
                            aria-label="Dienst löschen"
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {item.description}
                        </p>
                      )}

                      <p className="text-[11px] font-mono text-slate-600 group-hover:text-slate-500 mt-2 truncate">
                        {item.url.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>

      {/* Modal: Neue Kategorie */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-100 mb-4">Neue Kategorie erstellen</h3>
            
            <input
              type="text"
              placeholder="Kategorie-Name (z.B. Media Server)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 mb-6"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neuer Dienst */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsItemModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-100">Neuen Dienst hinzufügen</h3>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Name</label>
              <input
                type="text"
                placeholder="z.B. Portainer"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">URL</label>
              <input
                type="text"
                placeholder="z.B. http://localhost:9000"
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Lucide-Icon Name</label>
              <input
                type="text"
                placeholder="z.B. Server, HardDrive, Cpu..."
                value={newItem.icon}
                onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Beschreibung (Optional)</label>
              <input
                type="text"
                placeholder="z.B. Docker Management"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={newItem.enableUptimeKuma}
                onChange={(e) => setNewItem({ ...newItem, enableUptimeKuma: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <span className="text-xs text-slate-300">Mit Uptime Kuma überwachen</span>
            </label>

            {/* Eingabefeld für Uptime Kuma Slug */}
            {newItem.enableUptimeKuma && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Uptime Kuma Slug / Status Page Slug</label>
                <input
                  type="text"
                  placeholder="z.B. status-page-slug"
                  value={newItem.kumaSlug}
                  onChange={(e) => setNewItem({ ...newItem, kumaSlug: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}