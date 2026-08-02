import { useEffect, useState } from 'react';
import * as yaml from 'js-yaml';
import type { DashboardConfig, ServiceItem } from './types/config';
import { DynamicIcon } from './components/DynamicIcon';
import { UptimeBadge } from './components/UptimeBadge';
import { ExternalLink, RefreshCw, Plus, X } from 'lucide-react';

export default function App() {
  interface NewItemState {
    name: string;
    url: string;
    icon: string;
    description: string;
    type: 'link' | 'ping';
    enableUptimeKuma: boolean;
    kumaSlug: string;
  }

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal-Zustände
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);

  // Formular-Zustände
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItem, setNewItem] = useState<NewItemState>({
    name: '',
    url: '',
    icon: 'Server',
    description: '',
    type: 'link',
    enableUptimeKuma: false,
    kumaSlug: ''
  });

  const filteredSections = config?.sections
    .map((section, sectionIndex) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const filteredItems = section.items.filter((item) => {
        if (!normalizedQuery) return true;
        return [item.name, item.url, item.description]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      });

      const sectionMatches = normalizedQuery
        ? section.name.toLowerCase().includes(normalizedQuery)
        : false;

      return {
        ...section,
        items: sectionMatches ? section.items : filteredItems,
        originalIndex: sectionIndex,
      };
    })
    .filter((section) => section.items.length > 0);

  const hasSearch = Boolean(searchQuery.trim());

  const formatUrlLabel = (url: string) => url.replace(/^https?:\/\//, '');

  const sectionCount = config?.sections.length ?? 0;
  const itemCount = config?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0;

  const loadConfig = () => {
    setLoading(true);
    fetch('/api/config?cache=' + Date.now())
      .then((res) => {
        if (!res.ok) throw new Error('config konnte nicht geladen werden.');
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

    const url = newItem.url.trim();
    const normalizedUrl = /^(https?:\/\/)/i.test(url) ? url : `http://${url}`;

    const updatedSections = [...config.sections];
    const targetSection = { ...updatedSections[selectedSectionIndex] };

    const itemPayload: ServiceItem = {
      name: newItem.name.trim(),
      url: normalizedUrl,
      icon: newItem.icon.trim() || 'Server',
      description: newItem.description.trim() || undefined,
      type: newItem.type,
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

    setNewItem({
      name: '',
      url: '',
      icon: 'Server',
      description: '',
      type: 'link',
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
        <header className="flex flex-col gap-6 mb-12 border-b border-slate-800/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {config?.title}
            </h1>
            {config?.subtitle && (
              <p className="text-slate-400 mt-2 text-sm md:text-base font-normal">
                {config.subtitle}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-slate-900/70 px-3 py-1">{sectionCount} Kategorien</span>
              <span className="rounded-full bg-slate-900/70 px-3 py-1">{itemCount} Dienste</span>
              {hasSearch && <span className="rounded-full bg-indigo-700/20 text-indigo-200 px-3 py-1">Suche: "{searchQuery.trim()}"</span>}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[24rem]">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche Dienste oder Kategorien..."
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-4 pr-12 text-sm text-slate-100 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                aria-label="Suche Dienste oder Kategorien"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-2 inline-flex items-center rounded-full bg-slate-900/80 px-2 text-slate-400 hover:text-slate-200"
                  aria-label="Suche löschen"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/10 transition hover:bg-indigo-500"
              >
                <Plus className="w-4 h-4" />
                <span>Kategorie</span>
              </button>

              <button
                onClick={loadConfig}
                title="Config neu laden"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Grid der Sections */}
        <main className="space-y-10">
          {filteredSections && filteredSections.length > 0 ? (
            filteredSections.map((section, sIdx) => (
              <section key={sIdx}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-300 tracking-wide uppercase text-xs font-mono">
                      {section.name}
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">
                      {section.items.length} Dienst{section.items.length === 1 ? '' : 'e'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedSectionIndex(section.originalIndex ?? sIdx);
                      setIsItemModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
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
                          {formatUrlLabel(item.url)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                          <span className="rounded-full bg-slate-900/70 px-2 py-1">{item.type ?? 'link'}</span>
                          {item.uptimeKuma?.slug && <span className="rounded-full bg-slate-900/70 px-2 py-1">Kuma: {item.uptimeKuma.slug}</span>}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-12 text-center text-slate-400">
              <p className="text-lg font-semibold text-slate-100">Keine Dienste gefunden</p>
              <p className="mt-2 text-sm">Passe deine Suche an oder füge neue Dienste hinzu.</p>
            </div>
          )}
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

            <div className="grid gap-4 md:grid-cols-2">
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
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Typ</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'link' | 'ping' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="link">Link</option>
                  <option value="ping">Ping</option>
                </select>
              </div>
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