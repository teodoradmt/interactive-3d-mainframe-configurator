import { Image, RotateCcw, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function getBackgroundPreviewStyle(background) {
  return background.type === 'image' && background.imageUrl
    ? {
        backgroundColor: background.color,
        backgroundImage: `url("${background.imageUrl}")`,
      }
    : {
        backgroundColor: background.color,
      };
}

export function MainframeBackgroundPanel({
  background,
  onChangeColor,
  onClearImage,
  onResetBackground,
  onSelectImage,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const previewStyle = getBackgroundPreviewStyle(background);

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

  const selectImage = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      onSelectImage(file);
    }

    event.target.value = '';
  };

  return (
    <>
      <button className="background-trigger" onClick={() => setIsOpen(true)} type="button">
        <Image size={17} />
        <span>Фон</span>
        <span className="background-trigger-preview" style={previewStyle} aria-hidden="true" />
      </button>

      {isOpen && createPortal(
        <div className="background-modal-backdrop" onClick={() => setIsOpen(false)}>
          <section
            aria-modal="true"
            className="background-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="background-modal-head">
              <h2>Фон</h2>
              <div className="background-modal-actions">
                <button
                  aria-label="Стандартен фон"
                  className="background-reset-icon-button"
                  onClick={onResetBackground}
                  title="Стандартен фон"
                  type="button"
                >
                  <RotateCcw size={17} />
                </button>
                <button aria-label="Затвори" className="background-close-button" onClick={() => setIsOpen(false)} type="button">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="background-preview" style={previewStyle} />

            <div className="background-controls">
              <label className="background-color-control">
                <span>Цвят</span>
                <input
                  aria-label="Цвят на фона"
                  onChange={(event) => onChangeColor(event.target.value)}
                  type="color"
                  value={background.color}
                />
              </label>

              <label className="background-upload-button">
                <Upload size={17} />
                <span>Снимка от компютъра</span>
                <input accept="image/*" onChange={selectImage} type="file" />
              </label>
            </div>

            {background.imageUrl && (
              <div className="background-file-row">
                <span>{background.imageName}</span>
                <button onClick={onClearImage} type="button">
                  Махни снимката
                </button>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
