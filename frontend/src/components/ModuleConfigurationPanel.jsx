import { Check, Save } from 'lucide-react';
import { currency, formatOptionSpec } from '../utils/formatters.js';

export function ModuleConfigurationPanel({
  activeModule,
  modules,
  onSaveConfiguration,
  selection,
  selectedCount,
  setActiveModule,
  updateSelection,
}) {
  return (
    <>
      <div className="panel-head">
        <h2>Конфигурация</h2>
        <div className="panel-head-actions">
          <span>
            {selectedCount}/{modules.length || 0} избрани
          </span>
          <button className="config-save-action" onClick={onSaveConfiguration} type="button">
            <Save size={16} />
            Запази
          </button>
        </div>
      </div>

      <div className="module-list">
        {modules.map((module) => {
          const Icon = module.icon;
          const selectedIndex = selection[module.id];
          const isActive = activeModule === module.id;
          const isComplete = selectedIndex !== undefined;

          return (
            <article
              className={`module-card ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
              key={module.id}
              style={{ '--accent': module.color }}
            >
              <button className="module-button" onClick={() => setActiveModule(module.id)} type="button">
                <Icon size={19} />
                <span>{module.title}</span>
                {isComplete && <Check aria-hidden="true" size={17} />}
              </button>

              <div className="option-grid" aria-label={module.title}>
                {module.options.map((option, index) => {
                  const isSelected = selectedIndex === index;

                  return (
                    <button
                      aria-label={
                        isSelected
                          ? `${option.name}, избрано. Натисни за премахване на избора.`
                          : `${option.name}. Натисни за избор.`
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
        })}
      </div>
    </>
  );
}
