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
  const triggerValue = isAutoSelected ? 'Auto' : effectiveFrame.shortName;

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
        aria-label={`Frame: ${selectedOption.name}`}
        className="design-trigger frame-trigger"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Server size={17} />
        <span>Frame</span>
        <span className="frame-trigger-value">
          {triggerValue}
        </span>
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
              <h2>Frame Configuration</h2>
              <button aria-label="Close" className="design-close-button" onClick={() => setIsOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="frame-status-grid">
              <div>
                <span>Current frame</span>
                <strong>{isAutoSelected ? `Auto: ${effectiveFrame.name}` : effectiveFrame.name}</strong>
              </div>
              <div>
                <span>Recommended frame</span>
                <strong>{frameEvaluation.recommendedFrame.name}</strong>
                {!frameEvaluation.isRecommendedApplied && (
                  <button className="frame-apply-button" onClick={onApplyRecommendedFrame} type="button">
                    Apply Recommended Frame
                  </button>
                )}
              </div>
              <div className={frameEvaluation.isValid ? 'valid' : 'invalid'}>
                <span>Configuration</span>
                <strong>
                  {frameEvaluation.isValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {frameEvaluation.isValid ? 'Valid' : 'Invalid'}
                </strong>
              </div>
            </div>

            <div className="frame-options" role="radiogroup" aria-label="Frame configuration">
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

            {(frameEvaluation.warnings.length > 0 || frameEvaluation.info.length > 0) && (
              <div className="frame-messages">
                {frameEvaluation.warnings.map((message) => (
                  <p className="frame-message warning" key={message}>
                    <AlertTriangle size={15} />
                    {message}
                  </p>
                ))}
                {frameEvaluation.info.map((message) => (
                  <p className="frame-message info" key={message}>
                    <Server size={15} />
                    {message}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
