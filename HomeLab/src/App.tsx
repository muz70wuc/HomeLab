import { useEffect, useState } from 'react';
import * as yaml from 'js-yaml';
import type { DashboardConfig } from './types/config';
import { DynamicIcon } from './components/DynamicIcon';
import { UptimeBadge } from './components/UptimeBadge';
import { ExternalLink, RefreshCw } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans selection:bg-indigo-500 selection:text-white">
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
          <button
            onClick={loadConfig}
            title="Config neu laden"
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Grid der Sections */}
        <main className="space-y-10">
          {config?.sections.map((section, sIdx) => (
            <section key={sIdx}>
              <h2 className="text-lg font-semibold mb-4 text-slate-300 tracking-wide uppercase text-xs font-mono">
                {section.name}
              </h2>
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
                        <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
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
    </div>
  );
}