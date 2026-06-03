import { Check, Save } from 'lucide-react';
import { currency, formatOptionSpec } from '../utils/formatters.js';

function isExternalModule(module) {
  return module.required === false || module.category === 'external';
}

function ModuleCard({
  activeModule,
  module,
  selection,
  setActiveModule,
  updateSelection,
}) {
  const Icon = module.icon;
  const selectedIndex = selection[module.id];
  const isActive = activeModule === module.id;
  const isComplete = selectedIndex !== undefined;

  return (
    <article
      className={`module-card ${isExternalModule(module) ? 'external-module' : ''} ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
      style={{ '--accent': module.color }}
    >
      <button className="module-button" onClick={() => setActiveModule(module.id)} type="button">
        <Icon size={19} />
        <span>{module.title}</span>
        {isExternalModule(module) && <small>Optional</small>}
        {isComplete && <Check aria-hidden="true" size={17} />}
      </button>

      <div className="option-grid" aria-label={module.title}>
        {module.options.map((option, index) => {
          const isSelected = selectedIndex === index;

          return (
            <button
              aria-label={
                isSelected
                  ? `${option.name}, selected. Press to remove the selection.`
                  : `${option.name}. Press to select.`
              }
              aria-pressed={isSelected}
              className={`option-choice ${isSelected ? 'selected' : ''}`}
              key={option.name}
              onClick={() => updateSelection(module.id, index)}
              type="button"
            >
              <span className="option-name">{option.name}</span>
              <span className="option-spec">{formatOptionSpec(option)}</span>
              <span className="option-price">{currency.format(option.price)}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

export function ModuleConfigurationPanel({
  activeModule,
  modules,
  onSaveConfiguration,
  selection,
  section = 'all',
  selectedCount,
  setActiveModule,
  updateSelection,
}) {
  const cpcModules = modules.filter((module) => !isExternalModule(module));
  const externalModules = modules.filter(isExternalModule);
  const selectedExternalCount = externalModules.filter((module) => selection[module.id] !== undefined).length;
  const showCpcModules = section === 'all' || section === 'cpc';
  const showExternalModules = section === 'all' || section === 'external';
  const isExternalOnly = section === 'external';

  return (
    <>
      <div className="panel-head">
        <h2>{isExternalOnly ? 'External systems' : 'Configuration'}</h2>
        <div className="panel-head-actions">
          <span>
            {isExternalOnly
              ? `${selectedExternalCount}/${externalModules.length || 0} optional`
              : `${selectedCount}/${cpcModules.length || 0} CPC`}
          </span>
          {!isExternalOnly && onSaveConfiguration && (
            <button className="config-save-action" onClick={onSaveConfiguration} type="button">
              <Save size={16} />
              Save
            </button>
          )}
        </div>
      </div>

      <div className="module-list">
        {showCpcModules && (
          <>
            <div className="module-section-title">CPC modules</div>
            {cpcModules.map((module) => (
              <ModuleCard
                activeModule={activeModule}
                key={module.id}
                module={module}
                selection={selection}
                setActiveModule={setActiveModule}
                updateSelection={updateSelection}
              />
            ))}
          </>
        )}

        {showExternalModules && externalModules.length > 0 && (
          <>
            <div className="module-section-title external">Optional external systems</div>
            {externalModules.map((module) => (
              <ModuleCard
                activeModule={activeModule}
                key={module.id}
                module={module}
                selection={selection}
                setActiveModule={setActiveModule}
                updateSelection={updateSelection}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
