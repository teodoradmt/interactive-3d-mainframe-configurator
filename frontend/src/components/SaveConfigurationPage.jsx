import { ArrowLeft, Check, Database, Save, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { currency, formatOptionSpec, number } from '../utils/formatters.js';

function createDefaultName() {
  return `Mainframe ${new Date().toLocaleDateString('bg-BG')}`;
}

function normalizeConfigurationName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

const duplicateNameMessage = 'Конфигурацията вече е създадена.';

export function SaveConfigurationPage({
  currentUser,
  frameEvaluation,
  isComplete,
  modules,
  onBack,
  onGoToProfile,
  onSaveConfiguration,
  sceneBackground,
  selectedDesign,
  selectedFrameId,
  selection,
  totals,
}) {
  const defaultName = useMemo(createDefaultName, []);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');
  const [savedConfiguration, setSavedConfiguration] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedModules = useMemo(
    () => modules.map((module) => ({
      module,
      option: module.options[selection[module.id]],
    })).filter((item) => item.option),
    [modules, selection],
  );
  const previewTotals = useMemo(() => selectedModules.reduce((accumulator, { option }) => ({
    accelerator: accumulator.accelerator + (option.accelerator ?? 0),
    cpu: accumulator.cpu + (option.cpu ?? 0),
    total: accumulator.total + (option.price ?? 0),
  }), {
    accelerator: 0,
    cpu: 0,
    total: 0,
  }), [selectedModules]);
  const displayTotals = totals.total > 0 ? totals : previewTotals;

  const submitSave = async () => {
    if (!isComplete) {
      setError('Завърши всички модули преди запазване.');
      return;
    }

    const submittedName = name.trim();

    if (!submittedName) {
      setError('Добави име на конфигурацията.');
      return;
    }

    if (
      savedConfiguration
      && normalizeConfigurationName(submittedName) === normalizeConfigurationName(savedConfiguration.name)
    ) {
      setSaveMessage('');
      setError(duplicateNameMessage);
      return;
    }

    setIsSaving(true);
    setError('');
    setSaveMessage('');

    try {
      const result = await onSaveConfiguration({
        background: sceneBackground,
        designId: selectedDesign.id,
        designName: selectedDesign.name,
        frameConfiguration: {
          effectiveFrameId: frameEvaluation.effectiveFrame.id,
          effectiveFrameName: frameEvaluation.effectiveFrame.name,
          isValid: frameEvaluation.isValid,
          recommendedFrameId: frameEvaluation.recommendedFrame.id,
          recommendedFrameName: frameEvaluation.recommendedFrame.name,
          selectedFrameId,
          warnings: frameEvaluation.warnings,
        },
        name: submittedName,
        selection,
      });

      setSavedConfiguration(result.configuration);
      setSaveMessage(`Конфигурацията е запазена като „${result.configuration.name}“.`);
    } catch (requestError) {
      if (requestError.status === 409) {
        setSaveMessage('');
        setError(requestError.message || duplicateNameMessage);
        return;
      }

      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    await submitSave();
  };

  return (
    <main className="account-screen save-screen">
      <div className="account-topbar">
        <button className="ghost-button" onClick={onBack} type="button">
          <ArrowLeft size={17} />
          Към конфигуратора
        </button>
        <button className="ghost-button" onClick={onGoToProfile} type="button">
          <UserRound size={17} />
          Профил
        </button>
      </div>

      <section className="save-layout">
        <div className="save-summary">
          <span className="eyebrow">Запазване</span>
          <h1>Именувай конфигурацията</h1>
          <p>{currentUser.profileName}, тази конфигурация ще бъде записана в твоя профил.</p>

          <div className="save-metrics">
            <div>
              <span>Цена</span>
              <strong>{currency.format(displayTotals.total)}</strong>
            </div>
            <div>
              <span>Капацитет</span>
              <strong>{number.format(displayTotals.cpu)} единици</strong>
            </div>
            <div>
              <span>AI оценка</span>
              <strong>{number.format(displayTotals.accelerator)}</strong>
            </div>
          </div>
        </div>

        <form className="save-panel" onSubmit={save}>
          <label className="field-label">
            Име на конфигурацията
            <span className="input-shell">
              <Database size={17} />
              <input
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                  setSaveMessage('');
                  setSavedConfiguration(null);
                }}
                required
                type="text"
                value={name}
              />
            </span>
          </label>

          <div className="saved-options-preview">
            <div>
              <span>Frame конфигурация</span>
              <strong>{frameEvaluation.effectiveFrame.name}</strong>
              <small>{frameEvaluation.isValid ? 'Валидна инфраструктурна конфигурация' : 'Има предупреждения за преглед'}</small>
            </div>
            {selectedModules.map(({ module, option }) => (
              <div key={module.id}>
                <span>{module.title}</span>
                <strong>{option.name}</strong>
                <small>{formatOptionSpec(option)}</small>
              </div>
            ))}
          </div>

          {error && <p className="form-error">{error}</p>}
          {saveMessage && (
            <p className="form-success">
              <Check size={16} />
              {saveMessage}
            </p>
          )}

          <div className="save-actions">
            <button className="primary-action" disabled={isSaving || !isComplete} type="submit">
              <Save size={17} />
              {isSaving ? 'Запазване...' : 'Запази'}
            </button>
            <button className="secondary-action" onClick={onGoToProfile} type="button">
              Виж профила
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
