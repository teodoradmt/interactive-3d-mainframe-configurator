import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthPage } from '../components/AuthPage.jsx';
import { MainframeScene } from '../components/MainframeScene.jsx';
import { MainframeChat } from '../components/MainframeChat.jsx';
import { MainframeBackgroundPanel } from '../components/MainframeBackgroundPanel.jsx';
import { MainframeDesignPanel } from '../components/MainframeDesignPanel.jsx';
import { FrameConfigurationPanel } from '../components/FrameConfigurationPanel.jsx';
import { ModuleConfigurationPanel } from '../components/ModuleConfigurationPanel.jsx';
import { ProfileButton } from '../components/ProfileButton.jsx';
import { ProfilePage } from '../components/ProfilePage.jsx';
import { SaveConfigurationPage } from '../components/SaveConfigurationPage.jsx';
import { SummaryPanel } from '../components/SummaryPanel.jsx';
import { getMainframeDesign, mainframeDesigns } from '../config/mainframeDesigns.js';
import {
  FRAME_AUTO_ID,
  evaluateFrameConfiguration,
  getFrameConfiguration,
} from '../config/frameConfigurations.js';
import { isSelectionComplete, mergeModulePresentation } from '../config/modulePresentation.js';
import {
  fetchCurrentUser,
  fetchEstimate,
  fetchModules,
  fetchSavedConfigurations,
  saveConfiguration,
} from '../services/mainframeApi.js';

const emptyTotals = {
  total: 0,
  cpu: 0,
  accelerator: 0,
  ram: 0,
  storage: 0,
  lpars: 0,
  io: 0,
  security: 0,
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
const authTokenStorageKey = 'mainframe-auth-token';
const duplicateConfigurationNameMessage = 'Такава конфигурация вече съществува. Сменете името!';

function normalizeConfigurationName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRequiredModule(module) {
  return module.required !== false && module.category !== 'external';
}

function getSourceSelectionValue(sourceSelection, module) {
  if (!sourceSelection || typeof sourceSelection !== 'object') {
    return undefined;
  }

  if (module.id === 'cooling' && sourceSelection.cooling === undefined) {
    return sourceSelection.power;
  }

  if (
    module.id === 'externalDASD'
    && sourceSelection.externalDASD === undefined
    && sourceSelection.cooling === undefined
  ) {
    return sourceSelection.storage;
  }

  return sourceSelection[module.id];
}

export function Configurator() {
  const [modules, setModules] = useState([]);
  const [selection, setSelection] = useState({});
  const [activeModule, setActiveModule] = useState(null);
  const [totals, setTotals] = useState(emptyTotals);
  const [error, setError] = useState('');
  const [isDoorOpen, setIsDoorOpen] = useState(true);
  const [selectedDesignId, setSelectedDesignId] = useState(mainframeDesigns[0].id);
  const [selectedFrameId, setSelectedFrameId] = useState(FRAME_AUTO_ID);
  const [sceneBackground, setSceneBackground] = useState(defaultSceneBackground);
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(authTokenStorageKey) ?? '');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(authToken));
  const [view, setView] = useState('configurator');
  const [authMode, setAuthMode] = useState('login');
  const [authReason, setAuthReason] = useState('');
  const [authRedirectView, setAuthRedirectView] = useState('profile');
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

  useEffect(() => {
    let ignore = false;

    async function loadCurrentUser() {
      if (!authToken) {
        setCurrentUser(null);
        setIsAuthLoading(false);
        return;
      }

      setIsAuthLoading(true);

      try {
        const result = await fetchCurrentUser(authToken);

        if (!ignore) {
          setCurrentUser(result.user);
        }
      } catch {
        if (!ignore) {
          window.localStorage.removeItem(authTokenStorageKey);
          setAuthToken('');
          setCurrentUser(null);
        }
      } finally {
        if (!ignore) {
          setIsAuthLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      ignore = true;
    };
  }, [authToken]);

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
    () => modules.filter((module) => isRequiredModule(module) && selection[module.id] !== undefined).length,
    [modules, selection],
  );

  const selectedDesign = useMemo(
    () => getMainframeDesign(selectedDesignId),
    [selectedDesignId],
  );

  const frameEvaluation = useMemo(
    () => evaluateFrameConfiguration({
      modules,
      selectedFrameId,
      selection,
      totals,
    }),
    [modules, selectedFrameId, selection, totals],
  );
  const rightMessages = useMemo(() => [
    ...frameEvaluation.warnings.map((message) => ({
      message,
      type: 'warning',
    })),
    ...(isConfigurationComplete
      ? frameEvaluation.info.map((message) => ({
          message,
          type: 'info',
        }))
      : []),
  ], [frameEvaluation.info, frameEvaluation.warnings, isConfigurationComplete]);

  useEffect(() => {
    if (!modules.length || !isConfigurationComplete) {
      setTotals(emptyTotals);
      setIsDoorOpen(true);
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

  const applyRecommendedFrame = () => {
    setSelectedFrameId(frameEvaluation.recommendedFrame.id);
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
  };

  const getValidSelection = (sourceSelection) => {
    const nextSelection = {};

    modules.forEach((module) => {
      const optionIndex = Number(getSourceSelectionValue(sourceSelection, module));

      if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < module.options.length) {
        nextSelection[module.id] = optionIndex;
      }
    });

    return nextSelection;
  };

  const applySelectionGradually = async (sourceSelection) => {
    const nextSelection = getValidSelection(sourceSelection);
    const sequence = applySequenceRef.current + 1;

    applySequenceRef.current = sequence;
    setSelection({});
    setActiveModule(modules.find((module) => nextSelection[module.id] !== undefined)?.id ?? modules[0]?.id ?? null);
    setIsDoorOpen(true);

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

  const applySuggestedSelection = (suggestedSelection) => applySelectionGradually(suggestedSelection);

  const openAuth = ({ mode = 'login', reason = '', redirectView = 'profile' } = {}) => {
    setAuthMode(mode);
    setAuthReason(reason);
    setAuthRedirectView(redirectView);
    setView('auth');
  };

  const openSaveConfiguration = () => {
    if (!isConfigurationComplete) {
      setError('Завърши всички модули преди запазване на конфигурация.');
      return;
    }

    if (!frameEvaluation.isValid) {
      setError('Конфигурацията има невалидна инфраструктура. Провери frame-а и външните системи в оценката.');
      return;
    }

    setError('');

    if (!currentUser) {
      openAuth({
        reason: 'За да запазиш тази конфигурация, влез в профила си или създай нов профил.',
        redirectView: 'save',
      });
      return;
    }

    setView('save');
  };

  const handleAuthSuccess = ({ token, user }) => {
    window.localStorage.setItem(authTokenStorageKey, token);
    setAuthToken(token);
    setCurrentUser(user);
    setView(authRedirectView === 'save' && isConfigurationComplete ? 'save' : 'profile');
  };

  const handleLogout = () => {
    window.localStorage.removeItem(authTokenStorageKey);
    setAuthToken('');
    setCurrentUser(null);
    setView('configurator');
  };

  const handleSaveConfiguration = async (payload) => {
    const submittedName = normalizeConfigurationName(payload.name);
    const result = await fetchSavedConfigurations(authToken);
    const hasDuplicateName = (result.configurations ?? []).some((configuration) => (
      normalizeConfigurationName(configuration.name) === submittedName
    ));

    if (hasDuplicateName) {
      const duplicateError = new Error(duplicateConfigurationNameMessage);
      duplicateError.status = 409;
      throw duplicateError;
    }

    return saveConfiguration(authToken, payload);
  };

  const handleLoadConfiguration = async (configuration) => {
    setSelectedDesignId(configuration.designId || mainframeDesigns[0].id);
    const savedFrameId = configuration.frameConfiguration?.selectedFrameId ?? configuration.frameConfiguration?.mode;
    setSelectedFrameId(savedFrameId ? (savedFrameId === FRAME_AUTO_ID ? FRAME_AUTO_ID : getFrameConfiguration(savedFrameId).id) : FRAME_AUTO_ID);
    setError('');

    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current);
      backgroundImageUrlRef.current = '';
    }

    setSceneBackground({
      type: 'color',
      color: configuration.background?.color ?? defaultSceneBackground.color,
      imageUrl: '',
      imageName: configuration.background?.imageName ?? '',
    });
    setView('configurator');
    await applySelectionGradually(configuration.selection);
  };

  if (view === 'auth') {
    return (
      <AuthPage
        mode={authMode}
        onAuthSuccess={handleAuthSuccess}
        onBack={() => setView('configurator')}
        onModeChange={setAuthMode}
        reason={authReason}
      />
    );
  }

  if (view === 'profile' && currentUser) {
    return (
      <ProfilePage
        authToken={authToken}
        currentUser={currentUser}
        onBack={() => setView('configurator')}
        onLoadConfiguration={handleLoadConfiguration}
        onLogout={handleLogout}
        onUpdateUser={setCurrentUser}
      />
    );
  }

  if (view === 'save' && currentUser) {
    return (
      <SaveConfigurationPage
        currentUser={currentUser}
        frameEvaluation={frameEvaluation}
        selectedFrameId={selectedFrameId}
        isComplete={isConfigurationComplete}
        modules={modules}
        onBack={() => setView('configurator')}
        onGoToProfile={() => setView('profile')}
        onSaveConfiguration={handleSaveConfiguration}
        sceneBackground={sceneBackground}
        selectedDesign={selectedDesign}
        selection={selection}
        totals={totals}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="panel controls-panel">
        {error && <p className="state-banner">{error}</p>}

        <MainframeChat onApplySelection={applySuggestedSelection} selection={selection} />

        <ModuleConfigurationPanel
          activeModule={activeModule}
          modules={modules}
          onSaveConfiguration={openSaveConfiguration}
          selectedCount={selectedCount}
          selection={selection}
          section="cpc"
          setActiveModule={setActiveModule}
          updateSelection={updateSelection}
        />
      </aside>

      <section className="stage">
        <div className="titlebar">
          <div className="titlebar-heading">
            <h1>Интерактивен 3D mainframe конфигуратор</h1>
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
            <FrameConfigurationPanel
              frameEvaluation={frameEvaluation}
              onApplyRecommendedFrame={applyRecommendedFrame}
              onSelectFrame={setSelectedFrameId}
              selectedFrameId={selectedFrameId}
            />
            <div className="title-profile-group">
              <ProfileButton
                currentUser={currentUser}
                isLoading={isAuthLoading}
                onOpenAuth={() => openAuth({
                  reason: 'Влез или се регистрирай, за да виждаш запазените си конфигурации.',
                  redirectView: 'profile',
                })}
                onOpenProfile={() => setView('profile')}
              />
            </div>
          </div>
        </div>

        <MainframeScene
          activeModule={activeModule}
          background={sceneBackground}
          design={selectedDesign}
          frame={frameEvaluation.effectiveFrame}
          isDoorClosed={isConfigurationComplete && !isDoorOpen}
          modules={modules}
          selection={selection}
          setActiveModule={setActiveModule}
        />
      </section>

      <aside className="right-column">
        {rightMessages.length > 0 && (
          <section className="right-messages" aria-live="polite">
            {rightMessages.map((item) => (
              <p className={`right-message ${item.type}`} key={`${item.type}-${item.message}`}>
                <strong>{item.type === 'warning' ? 'Съобщение' : 'Информация'}</strong>
                <span>{item.message}</span>
              </p>
            ))}
            {frameEvaluation.shouldOfferAutoFrameSwitch && (
              <button className="right-message-action" onClick={() => setSelectedFrameId(FRAME_AUTO_ID)} type="button">
                Смени frame на Авто
              </button>
            )}
          </section>
        )}

        <div className="panel external-systems-panel">
          <ModuleConfigurationPanel
            activeModule={activeModule}
            modules={modules}
            selection={selection}
            section="external"
            setActiveModule={setActiveModule}
            updateSelection={updateSelection}
          />
        </div>

        <section className="evaluation-panel">
          <SummaryPanel
            frameEvaluation={frameEvaluation}
            isComplete={isConfigurationComplete}
            totals={totals}
          />
        </section>
      </aside>
    </main>
  );
}
