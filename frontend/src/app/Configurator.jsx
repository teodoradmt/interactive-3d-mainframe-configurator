import { useEffect, useMemo, useState } from 'react';
import { MainframeScene } from '../components/MainframeScene.jsx';
import { MainframeChat } from '../components/MainframeChat.jsx';
import { ModuleConfigurationPanel } from '../components/ModuleConfigurationPanel.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { SummaryPanel } from '../components/SummaryPanel.jsx';
import { isSelectionComplete, mergeModulePresentation } from '../config/modulePresentation.js';
import { fetchAiRecommendation, fetchEstimate, fetchModules } from '../services/mainframeApi.js';

const emptyTotals = {
  total: 0,
  cpu: 0,
  accelerator: 0,
  ram: 0,
  storage: 0,
  kw: 0,
  monthlyCost: 0,
  yearlyCost: 0,
  recommendation: '',
};

export function Configurator() {
  const [modules, setModules] = useState([]);
  const [selection, setSelection] = useState({});
  const [activeModule, setActiveModule] = useState(null);
  const [totals, setTotals] = useState(emptyTotals);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDoorOpen, setIsDoorOpen] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiError, setAiError] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadModules() {
      try {
        const apiModules = await fetchModules();
        const frontendModules = mergeModulePresentation(apiModules);

        if (!ignore) {
          setModules(frontendModules);
          setActiveModule(frontendModules[0]?.id ?? null);
          setIsLoading(false);
          setError('');
        }
      } catch {
        if (!ignore) {
          setIsLoading(false);
          setError('Backend API не отговаря.');
        }
      }
    }

    loadModules();

    return () => {
      ignore = true;
    };
  }, []);

  const isConfigurationComplete = useMemo(
    () => isSelectionComplete(modules, selection),
    [modules, selection],
  );

  const selectedCount = useMemo(
    () => modules.filter((module) => selection[module.id] !== undefined).length,
    [modules, selection],
  );

  useEffect(() => {
    if (!modules.length || !isConfigurationComplete) {
      setTotals(emptyTotals);
      setIsDoorOpen(true);
      setAiRecommendation('');
      setAiModel('');
      setAiError('');
      setIsAiLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const closeDoorTimer = window.setTimeout(() => {
      setIsDoorOpen(false);
    }, 1100);

    async function loadEstimate() {
      try {
        const estimate = await fetchEstimate(selection, controller.signal);
        setTotals(estimate);
        setError('');
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError('Оценката от backend не се зарежда.');
        }
      }
    }

    loadEstimate();

    return () => {
      window.clearTimeout(closeDoorTimer);
      controller.abort();
    };
  }, [isConfigurationComplete, modules.length, selection]);

  const activeStatus = useMemo(() => {
    if (isLoading) {
      return 'Свързване';
    }

    return error ? 'Backend offline' : 'Backend online';
  }, [error, isLoading]);

  const requestAiRecommendation = async () => {
    if (!isConfigurationComplete || isAiLoading) {
      return;
    }

    const controller = new AbortController();
    setIsAiLoading(true);
    setAiError('');

    try {
      const result = await fetchAiRecommendation(selection, controller.signal);
      setAiRecommendation(result.recommendation);
      setAiModel(result.model);
    } catch {
      setAiError('Mistral/Ollama не върна отговор. Провери дали Ollama работи и дали моделът mistral е наличен.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateSelection = (moduleId, optionIndex) => {
    setSelection((current) => {
      if (current[moduleId] === optionIndex) {
        const nextSelection = { ...current };
        delete nextSelection[moduleId];
        return nextSelection;
      }

      return { ...current, [moduleId]: optionIndex };
    });
    setActiveModule(moduleId);
    setIsDoorOpen(true);
    setAiRecommendation('');
    setAiModel('');
    setAiError('');
  };

  return (
    <main className="app-shell">
      <section className="stage">
        <div className="titlebar">
          <div>
            <h1>Interactive 3D Mainframe Configurator</h1>
          </div>
          <StatusPill>{activeStatus}</StatusPill>
        </div>

        <MainframeScene
          activeModule={activeModule}
          isDoorClosed={isConfigurationComplete && !isDoorOpen}
          modules={modules}
          selection={selection}
          setActiveModule={setActiveModule}
        />
      </section>

      <aside className="panel">
        {error && <p className="state-banner">{error}</p>}

        <ModuleConfigurationPanel
          activeModule={activeModule}
          modules={modules}
          selectedCount={selectedCount}
          selection={selection}
          setActiveModule={setActiveModule}
          updateSelection={updateSelection}
        />

        <SummaryPanel
          aiError={aiError}
          aiModel={aiModel}
          aiRecommendation={aiRecommendation}
          isAiLoading={isAiLoading}
          isComplete={isConfigurationComplete}
          onRequestAiRecommendation={requestAiRecommendation}
          totals={totals}
        />

        <MainframeChat selection={selection} />
      </aside>
    </main>
  );
}
