import { useEffect, useMemo, useRef, useState } from 'react';
import { MainframeScene } from '../components/MainframeScene.jsx';
import { MainframeChat } from '../components/MainframeChat.jsx';
import { MainframeBackgroundPanel } from '../components/MainframeBackgroundPanel.jsx';
import { MainframeDesignPanel } from '../components/MainframeDesignPanel.jsx';
import { ModuleConfigurationPanel } from '../components/ModuleConfigurationPanel.jsx';
import { SummaryPanel } from '../components/SummaryPanel.jsx';
import { getMainframeDesign, mainframeDesigns } from '../config/mainframeDesigns.js';
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
};
const applyStepDelayMs = 360;
const defaultSceneBackground = {
  type: 'color',
  color: '#101113',
  imageUrl: '',
  imageName: '',
};

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function Configurator() {
  const [modules, setModules] = useState([]);
  const [selection, setSelection] = useState({});
  const [activeModule, setActiveModule] = useState(null);
  const [totals, setTotals] = useState(emptyTotals);
  const [error, setError] = useState('');
  const [isDoorOpen, setIsDoorOpen] = useState(true);
  const [selectedDesignId, setSelectedDesignId] = useState(mainframeDesigns[0].id);
  const [sceneBackground, setSceneBackground] = useState(defaultSceneBackground);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiError, setAiError] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const applySequenceRef = useRef(0);
  const backgroundImageUrlRef = useRef('');

  useEffect(() => {
    let ignore = false;

    async function loadModules() {
      try {
        const apiModules = await fetchModules();
        const frontendModules = mergeModulePresentation(apiModules);

        if (!ignore) {
          setModules(frontendModules);
          setActiveModule(frontendModules[0]?.id ?? null);
          setError('');
        }
      } catch {
        if (!ignore) {
          setError('Backend API не отговаря.');
        }
      }
    }

    loadModules();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => () => {
    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current);
    }
  }, []);

  const isConfigurationComplete = useMemo(
    () => isSelectionComplete(modules, selection),
    [modules, selection],
  );

  const selectedCount = useMemo(
    () => modules.filter((module) => selection[module.id] !== undefined).length,
    [modules, selection],
  );

  const selectedDesign = useMemo(
    () => getMainframeDesign(selectedDesignId),
    [selectedDesignId],
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
      setAiError('Ollama не върна отговор. Провери дали работи и дали моделът qwen3:14b е наличен.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const clearSceneBackgroundImage = () => {
    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current);
      backgroundImageUrlRef.current = '';
    }

    setSceneBackground((current) => ({
      ...current,
      type: 'color',
      imageUrl: '',
      imageName: '',
    }));
  };

  const resetSceneBackground = () => {
    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current);
      backgroundImageUrlRef.current = '';
    }

    setSceneBackground(defaultSceneBackground);
  };

  const changeSceneBackgroundColor = (color) => {
    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current);
      backgroundImageUrlRef.current = '';
    }

    setSceneBackground({
      type: 'color',
      color,
      imageUrl: '',
      imageName: '',
    });
  };

  const selectSceneBackgroundImage = (file) => {
    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current);
    }

    const imageUrl = URL.createObjectURL(file);
    backgroundImageUrlRef.current = imageUrl;

    setSceneBackground((current) => ({
      ...current,
      type: 'image',
      imageUrl,
      imageName: file.name,
    }));
  };

  const updateSelection = (moduleId, optionIndex) => {
    applySequenceRef.current += 1;
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

  const applySuggestedSelection = async (suggestedSelection) => {
    const nextSelection = {};

    modules.forEach((module) => {
      const optionIndex = Number(suggestedSelection[module.id]);

      if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < module.options.length) {
        nextSelection[module.id] = optionIndex;
      }
    });

    const sequence = applySequenceRef.current + 1;

    applySequenceRef.current = sequence;
    setSelection({});
    setActiveModule(modules.find((module) => nextSelection[module.id] !== undefined)?.id ?? modules[0]?.id ?? null);
    setIsDoorOpen(true);
    setAiRecommendation('');
    setAiModel('');
    setAiError('');

    for (const module of modules) {
      if (applySequenceRef.current !== sequence) {
        return;
      }

      if (nextSelection[module.id] === undefined) {
        continue;
      }

      setActiveModule(module.id);
      setSelection((current) => ({
        ...current,
        [module.id]: nextSelection[module.id],
      }));

      await wait(applyStepDelayMs);
    }
  };

  return (
    <main className="app-shell">
      <section className="stage">
        <div className="titlebar">
          <div>
            <h1>Interactive 3D Mainframe Configurator</h1>
          </div>
          <div className="title-actions">
            <MainframeBackgroundPanel
              background={sceneBackground}
              onChangeColor={changeSceneBackgroundColor}
              onClearImage={clearSceneBackgroundImage}
              onResetBackground={resetSceneBackground}
              onSelectImage={selectSceneBackgroundImage}
            />
            <MainframeDesignPanel
              designs={mainframeDesigns}
              onSelectDesign={setSelectedDesignId}
              selectedDesignId={selectedDesignId}
            />
          </div>
        </div>

        <MainframeScene
          activeModule={activeModule}
          background={sceneBackground}
          design={selectedDesign}
          isDoorClosed={isConfigurationComplete && !isDoorOpen}
          modules={modules}
          selection={selection}
          setActiveModule={setActiveModule}
        />
      </section>

      <aside className="panel">
        {error && <p className="state-banner">{error}</p>}

        <MainframeChat onApplySelection={applySuggestedSelection} selection={selection} />

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
      </aside>
    </main>
  );
}
