import { Palette, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function MainframeDesignPanel({ designs, selectedDesignId, onSelectDesign }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDesign = designs.find((design) => design.id === selectedDesignId) ?? designs[0];

  const selectDesign = (designId) => {
    onSelectDesign(designId);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        aria-label={`Тема: ${selectedDesign?.name}`}
        className="design-trigger"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Palette size={17} />
        <span>Тема</span>
        <span className="design-trigger-swatches" aria-hidden="true">
          {selectedDesign?.swatches.map((color) => (
            <span className="design-trigger-swatch" key={color} style={{ '--swatch': color }} />
          ))}
        </span>
      </button>

      {isOpen && createPortal(
        <div className="design-modal-backdrop" onClick={() => setIsOpen(false)}>
          <section
            aria-modal="true"
            className="design-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="design-modal-head">
              <h2>Външен дизайн</h2>
              <button aria-label="Затвори" className="design-close-button" onClick={() => setIsOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="design-options" role="radiogroup" aria-label="Външен дизайн">
              {designs.map((design) => {
                const isSelected = selectedDesignId === design.id;

                return (
                  <button
                    aria-checked={isSelected}
                    className={`design-option ${isSelected ? 'selected' : ''}`}
                    key={design.id}
                    onClick={() => selectDesign(design.id)}
                    role="radio"
                    style={{
                      '--preview-accent': design.colors.accent,
                      '--preview-bay': design.colors.bay,
                      '--preview-base': design.colors.base,
                      '--preview-base-line': design.colors.baseLine,
                      '--preview-door': design.colors.doorShell,
                      '--preview-door-inset': design.colors.doorInset,
                      '--preview-door-rail': design.colors.doorRail,
                      '--preview-foot': design.colors.foot,
                      '--preview-front': design.colors.front,
                      '--preview-handle': design.colors.handleAccent,
                      '--preview-module': design.colors.moduleConfigured,
                      '--preview-rail': design.colors.rail,
                      '--preview-shell': design.colors.shell,
                      '--preview-slot-a': design.colors.slotA,
                      '--preview-slot-b': design.colors.slotB,
                      '--preview-top-cap': design.colors.topCap,
                    }}
                    type="button"
                  >
                    <span className="design-preview" aria-hidden="true">
                      <span className="design-preview-shell">
                        <span className="design-preview-top" />
                        <span className="design-preview-front">
                          <span className="design-preview-bay">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <span className="design-preview-module" key={index}>
                                <span className="design-preview-led" />
                                <span className="design-preview-module-line" />
                                <span className="design-preview-port" />
                              </span>
                            ))}
                          </span>
                          <span className="design-preview-rail design-preview-rail-left" />
                          <span className="design-preview-rail design-preview-rail-right" />
                        </span>
                        <span className="design-preview-base">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <span key={index} />
                          ))}
                        </span>
                        <span className="design-preview-foot design-preview-foot-left" />
                        <span className="design-preview-foot design-preview-foot-right" />
                        <span className="design-preview-door">
                          <span className="design-preview-door-line" />
                          <span className="design-preview-door-panel" />
                          <span className="design-preview-door-panel design-preview-door-panel-lower" />
                          <span className="design-preview-handle" />
                        </span>
                      </span>
                    </span>
                    <span className="design-option-name">
                      <Palette size={16} />
                      {design.name}
                    </span>
                    <span className="design-swatches" aria-hidden="true">
                      {design.swatches.map((color) => (
                        <span className="design-swatch" key={color} style={{ '--swatch': color }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
