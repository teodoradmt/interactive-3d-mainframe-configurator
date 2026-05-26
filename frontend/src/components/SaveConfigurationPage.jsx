import { ArrowLeft, Check, Database, Save, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { currency, formatOptionSpec, number } from '../utils/formatters.js';

function createDefaultName() {
  return `Mainframe ${new Date().toLocaleDateString('bg-BG')}`;
}

export function SaveConfigurationPage({
  currentUser,
  isComplete,
  modules,
  onBack,
  onGoToProfile,
  onSaveConfiguration,
  sceneBackground,
  selectedDesign,
  selection,
  totals,
}) {
  const defaultName = useMemo(createDefaultName, []);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');
  const [savedConfiguration, setSavedConfiguration] = useState(null);
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

  const save = async (event) => {
    event.preventDefault();

    if (!isComplete) {
      setError('Завърши всички модули преди запазване.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const result = await onSaveConfiguration({
        background: sceneBackground,
        designId: selectedDesign.id,
        designName: selectedDesign.name,
        name,
        selection,
      });

      setSavedConfiguration(result.configuration);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
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
              <strong>{number.format(displayTotals.cpu)} units</strong>
            </div>
            <div>
              <span>AI score</span>
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
                  setSavedConfiguration(null);
                }}
                required
                type="text"
                value={name}
              />
            </span>
          </label>

          <div className="saved-options-preview">
            {selectedModules.map(({ module, option }) => (
              <div key={module.id}>
                <span>{module.title}</span>
                <strong>{option.name}</strong>
                <small>{formatOptionSpec(option)}</small>
              </div>
            ))}
          </div>

          {error && <p className="form-error">{error}</p>}
          {savedConfiguration && (
            <p className="form-success">
              <Check size={16} />
              Конфигурацията е запазена като „{savedConfiguration.name}“.
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
