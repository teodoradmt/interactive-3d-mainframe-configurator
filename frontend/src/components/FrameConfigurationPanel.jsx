import { AlertTriangle, CheckCircle2, Server, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FRAME_AUTO_ID,
  frameSelectionOptions,
  getFrameSelectionOption,
} from '../config/frameConfigurations.js';

function FramePreview({ frameCount }) {
  const count = Math.max(1, frameCount ?? 1);

  return (
    <span className={`frame-preview frame-preview-${count}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span className="frame-preview-cabinet" key={index}>
          <span />
          <span />
          <span />
        </span>
      ))}
    </span>
  );
}

export function FrameConfigurationPanel({
  frameEvaluation,
  onApplyRecommendedFrame,
  onSelectFrame,
  selectedFrameId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = getFrameSelectionOption(selectedFrameId);
  const effectiveFrame = frameEvaluation.effectiveFrame;
  const isAutoSelected = selectedFrameId === FRAME_AUTO_ID;
  const isInvalid = !frameEvaluation.isFrameValid;
  const shouldOfferAutoFrameSwitch = frameEvaluation.shouldOfferAutoFrameSwitch && !isAutoSelected;
  const triggerValue = isAutoSelected ? 'Авто' : effectiveFrame.shortName;

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

  const selectFrame = (frameId) => {
    onSelectFrame(frameId);
  };

  return (
    <>
      <button
        aria-label={`Frame: ${selectedOption.name}${isInvalid ? ', невалидна конфигурация' : ''}`}
        className={`design-trigger frame-trigger ${isInvalid ? 'invalid' : ''}`}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Server size={17} />
        <span>Frame</span>
        <span className="frame-trigger-value">
          {triggerValue}
        </span>
        {isInvalid && (
          <span className="frame-trigger-warning">
            <AlertTriangle size={14} />
            Невалиден
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div className="design-modal-backdrop" onClick={() => setIsOpen(false)}>
          <section
            aria-modal="true"
            className="design-modal frame-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="design-modal-head">
              <h2>Frame конфигурация</h2>
              <button aria-label="Затвори" className="design-close-button" onClick={() => setIsOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="frame-status-grid">
              <div>
                <span>Текущ frame</span>
                <strong>{isAutoSelected ? `Авто: ${effectiveFrame.name}` : effectiveFrame.name}</strong>
              </div>
              <div>
                <span>Препоръчан frame</span>
                <strong>{frameEvaluation.recommendedFrame.name}</strong>
                {shouldOfferAutoFrameSwitch ? (
                  <button className="frame-apply-button" onClick={() => onSelectFrame(FRAME_AUTO_ID)} type="button">
                    Смени на Авто
                  </button>
                ) : !frameEvaluation.isRecommendedApplied && (
                  <button className="frame-apply-button" onClick={onApplyRecommendedFrame} type="button">
                    Приложи препоръчания frame
                  </button>
                )}
              </div>
              <div className={frameEvaluation.isFrameValid ? 'valid' : 'invalid'}>
                <span>Frame статус</span>
                <strong>
                  {frameEvaluation.isFrameValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {frameEvaluation.isFrameValid ? 'Валиден' : 'Невалиден'}
                </strong>
              </div>
            </div>

            <div className="frame-options" role="radiogroup" aria-label="Frame конфигурация">
              {frameSelectionOptions.map((frame) => {
                const isSelected = selectedFrameId === frame.id;
                const previewFrameCount = frame.id === FRAME_AUTO_ID
                  ? frameEvaluation.recommendedFrame.frameCount
                  : frame.frameCount;

                return (
                  <button
                    aria-checked={isSelected}
                    className={`frame-option ${isSelected ? 'selected' : ''}`}
                    key={frame.id}
                    onClick={() => selectFrame(frame.id)}
                    role="radio"
                    type="button"
                  >
                    <FramePreview frameCount={previewFrameCount} />
                    <span>
                      <strong>{frame.name}</strong>
                      <small>{frame.description}</small>
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
