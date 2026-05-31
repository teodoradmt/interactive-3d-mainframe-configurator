import {
  ArrowLeft,
  Building2,
  FileJson,
  FileText,
  ImagePlus,
  LogOut,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  deleteSavedConfiguration,
  fetchConfigurationExport,
  fetchSavedConfigurations,
  logoutUser,
  updateProfile,
} from '../services/mainframeApi.js';
import { currency, dateTime } from '../utils/formatters.js';

const avatarColors = ['#2ea698', '#88d9ef', '#f5c15c', '#d86c61', '#7d8df1', '#6f7b82'];
const avatarMaxBytes = 180_000;
const avatarMaxDimensions = [720, 560, 420, 320, 240];
const avatarMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const avatarQualitySteps = [0.88, 0.78, 0.68, 0.58, 0.48];

function getInitials(user) {
  const label = user?.profileName || user?.email || 'П';
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value) {
  return value ? dateTime.format(new Date(value)) : '';
}

function sanitizeFileName(value) {
  return String(value ?? 'configuration')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'configuration';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Снимката не може да бъде прочетена.'));
    reader.readAsDataURL(file);
  });
}

function isSupportedAvatarFile(file) {
  const mimeType = String(file.type ?? '').toLowerCase();
  const fileName = String(file.name ?? '').toLowerCase();

  return avatarMimeTypes.has(mimeType) || /\.(png|jpe?g|webp)$/.test(fileName);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Снимката не може да бъде отворена. Избери друг PNG, JPG или WebP файл.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function renderCompressedAvatar(image, maxDimension, mimeType, quality) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Снимката няма валидни размери.');
  }

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Браузърът не може да обработи тази снимка.');
  }

  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#101113';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvasToBlob(canvas, mimeType, quality);
}

async function prepareAvatarImage(file) {
  const mimeType = String(file.type ?? '').toLowerCase();

  if (file.size <= avatarMaxBytes && avatarMimeTypes.has(mimeType)) {
    return readAvatarFile(file);
  }

  const image = await loadImageFromFile(file);
  let smallestBlob = null;

  for (const maxDimension of avatarMaxDimensions) {
    for (const outputType of ['image/webp', 'image/jpeg']) {
      for (const quality of avatarQualitySteps) {
        const blob = await renderCompressedAvatar(image, maxDimension, outputType, quality);

        if (!blob || !avatarMimeTypes.has(blob.type)) {
          continue;
        }

        if (!smallestBlob || blob.size < smallestBlob.size) {
          smallestBlob = blob;
        }

        if (blob.size <= avatarMaxBytes) {
          return readAvatarFile(blob);
        }
      }
    }
  }

  if (smallestBlob && smallestBlob.size <= avatarMaxBytes) {
    return readAvatarFile(smallestBlob);
  }

  throw new Error('Снимката не може да бъде намалена достатъчно. Избери по-малък PNG, JPG или WebP файл.');
}

function downloadJson(payload) {
  const fileName = `${sanitizeFileName(payload.configuration?.name)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createPrintHtml(payload) {
  const { configuration, owner } = payload;
  const rows = configuration.modulesSnapshot.map((item) => `
    <tr>
      <td>${escapeHtml(item.moduleTitle)}</td>
      <td>${escapeHtml(item.option.name)}</td>
      <td>${escapeHtml(item.option.spec ?? '')}</td>
      <td>${currency.format(item.option.price ?? 0)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
    <html lang="bg">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(configuration.name)}</title>
        <style>
          body { color: #111827; font-family: Arial, sans-serif; margin: 32px; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 18px; color: #4b5563; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border-bottom: 1px solid #d1d5db; padding: 10px; text-align: left; }
          th { background: #f3f4f6; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
          .metric { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
          .metric span { color: #6b7280; display: block; font-size: 12px; text-transform: uppercase; }
          .metric strong { display: block; font-size: 18px; margin-top: 6px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(configuration.name)}</h1>
        <p>${escapeHtml(owner.profileName)}${owner.workplace ? `, ${escapeHtml(owner.workplace)}` : ''}</p>
        <div class="metrics">
          <div class="metric"><span>Цена</span><strong>${currency.format(configuration.totals.total)}</strong></div>
          <div class="metric"><span>Енергия</span><strong>${configuration.totals.kw.toFixed(1)} kW</strong></div>
          <div class="metric"><span>Годишен разход</span><strong>${currency.format(configuration.totals.yearlyCost)}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Модул</th>
              <th>Избор</th>
              <th>Спецификация</th>
              <th>Цена</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
}

export function ProfilePage({
  authToken,
  currentUser,
  onBack,
  onLoadConfiguration,
  onLogout,
  onUpdateUser,
}) {
  const [profileForm, setProfileForm] = useState({
    avatarColor: currentUser.avatarColor ?? '#2ea698',
    avatarImage: currentUser.avatarImage ?? '',
    profileName: currentUser.profileName ?? '',
    workplace: currentUser.workplace ?? '',
  });
  const [configurations, setConfigurations] = useState([]);
  const [error, setError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [activeActionId, setActiveActionId] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [confirmationError, setConfirmationError] = useState('');

  useEffect(() => {
    setProfileForm({
      avatarColor: currentUser.avatarColor ?? '#2ea698',
      avatarImage: currentUser.avatarImage ?? '',
      profileName: currentUser.profileName ?? '',
      workplace: currentUser.workplace ?? '',
    });
  }, [currentUser]);

  const loadConfigurations = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await fetchSavedConfigurations(authToken);
      setConfigurations(result.configurations ?? []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isConfirming) {
        setConfirmation(null);
        setConfirmationInput('');
        setConfirmationError('');
      }
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [confirmation, isConfirming]);

  const updateField = (field, value) => {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
    setProfileMessage('');
  };

  const chooseAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isSupportedAvatarFile(file)) {
      setError('Избери PNG, JPG или WebP снимка до около 180 KB.');
      return;
    }

    try {
      const avatarImage = await prepareAvatarImage(file);
      updateField('avatarImage', avatarImage);
      setError('');
    } catch (avatarError) {
      setError(avatarError.message);
    }
  };

  const closeConfirmation = () => {
    setConfirmation(null);
    setConfirmationInput('');
    setConfirmationError('');
  };

  const requestRemoveAvatarImage = () => {
    setConfirmation({
      confirmLabel: 'Махни снимката',
      message: 'Ще останат инициалите и избраният цвят на аватара.',
      title: 'Махане на профилна снимка',
      type: 'remove-avatar',
    });
    setConfirmationInput('');
    setConfirmationError('');
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setError('');
    setProfileMessage('');

    try {
      const result = await updateProfile(authToken, profileForm);
      onUpdateUser(result.user);
      setProfileMessage('Профилът е обновен.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const exportAsJson = async (configuration) => {
    setActiveActionId(configuration.id);
    setError('');

    try {
      downloadJson(await fetchConfigurationExport(authToken, configuration.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActiveActionId('');
    }
  };

  const exportAsPdf = async (configuration) => {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      setError('Браузърът блокира новия прозорец за PDF експорт.');
      return;
    }

    printWindow.document.write('<p>Подготвяне на PDF изглед...</p>');
    setActiveActionId(configuration.id);
    setError('');

    try {
      const payload = await fetchConfigurationExport(authToken, configuration.id);
      printWindow.document.open();
      printWindow.document.write(createPrintHtml(payload));
      printWindow.document.close();
      printWindow.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    } catch (requestError) {
      printWindow.close();
      setError(requestError.message);
    } finally {
      setActiveActionId('');
    }
  };

  const requestDeleteConfiguration = (configuration) => {
    const configurationName = String(configuration.name ?? '');

    setConfirmation({
      configuration,
      confirmLabel: 'Изтрий',
      message: `Това ще изтрие „${configurationName}“ от запазените конфигурации.`,
      requireName: configurationName,
      title: 'Изтриване на конфигурация',
      type: 'delete-configuration',
    });
    setConfirmationInput('');
    setConfirmationError('');
  };

  const requestSignOut = () => {
    setConfirmation({
      confirmLabel: 'Изход',
      message: 'Сигурни ли сте че искате да излезете?',
      title: 'Изход от профила',
      type: 'logout',
    });
    setConfirmationInput('');
    setConfirmationError('');
  };

  const confirmAction = async (event) => {
    event.preventDefault();

    if (!confirmation || isConfirming) {
      return;
    }

    if (confirmation.requireName && confirmationInput.trim() !== confirmation.requireName) {
      setConfirmationError('Името не съвпада. Провери главните/малките букви и интервалите.');
      return;
    }

    if (confirmation.type === 'remove-avatar') {
      updateField('avatarImage', '');
      closeConfirmation();
      return;
    }

    setIsConfirming(true);
    setError('');
    setConfirmationError('');

    if (confirmation.type === 'delete-configuration') {
      const configuration = confirmation.configuration;

      setActiveActionId(configuration.id);

      try {
        await deleteSavedConfiguration(authToken, configuration.id);
        await loadConfigurations();
        closeConfirmation();
      } catch (requestError) {
        setConfirmationError(requestError.message);
      } finally {
        setActiveActionId('');
        setIsConfirming(false);
      }

      return;
    }

    if (confirmation.type === 'logout') {
      try {
        await logoutUser(authToken);
      } catch {
        // Локалната сесия пак трябва да се изчисти, дори backend token-ът вече да липсва.
      } finally {
        setIsConfirming(false);
        closeConfirmation();
        onLogout();
      }
    }
  };

  return (
    <main className="account-screen profile-screen">
      <div className="account-topbar">
        <button className="ghost-button" onClick={onBack} type="button">
          <ArrowLeft size={17} />
          Към конфигуратора
        </button>
      </div>

      <section className="profile-layout">
        <form className="profile-editor" onSubmit={saveProfile}>
          <span className="eyebrow">Профил</span>
          <div className="profile-avatar-large" style={{ '--avatar-color': profileForm.avatarColor }}>
            {profileForm.avatarImage ? <img alt="" src={profileForm.avatarImage} /> : getInitials(profileForm)}
          </div>

          <div className="avatar-tools">
            <label className="secondary-action icon-action">
              <ImagePlus size={17} />
              Снимка
              <input accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} type="file" />
            </label>
            {profileForm.avatarImage && (
              <button
                className="secondary-action icon-action"
                onClick={requestRemoveAvatarImage}
                type="button"
              >
                <RefreshCcw size={17} />
                Инициали
              </button>
            )}
          </div>

          <div className="avatar-colors" aria-label="Цвят на аватара">
            {avatarColors.map((color) => (
              <button
                aria-label={`Избери цвят ${color}`}
                className={profileForm.avatarColor === color ? 'active' : ''}
                key={color}
                onClick={() => updateField('avatarColor', color)}
                style={{ '--swatch': color }}
                type="button"
              />
            ))}
          </div>

          <label className="field-label">
            Име на профила
            <span className="input-shell">
              <UserRound size={17} />
              <input
                maxLength={64}
                onChange={(event) => updateField('profileName', event.target.value)}
                required
                type="text"
                value={profileForm.profileName}
              />
            </span>
          </label>

          <label className="field-label">
            Месторабота
            <span className="input-shell">
              <Building2 size={17} />
              <input
                maxLength={96}
                onChange={(event) => updateField('workplace', event.target.value)}
                placeholder="Напр. финансов сектор, университет, datacenter"
                type="text"
                value={profileForm.workplace}
              />
            </span>
          </label>

          {profileMessage && <p className="form-success">{profileMessage}</p>}

          <button className="primary-action" disabled={isSavingProfile} type="submit">
            <Save size={17} />
            {isSavingProfile ? 'Запазване...' : 'Запази профила'}
          </button>

          <button className="secondary-action danger profile-logout-action" onClick={requestSignOut} type="button">
            <LogOut size={17} />
            Изход
          </button>
        </form>

        <section className="profile-configurations">
          <div className="profile-section-head">
            <div>
              <span className="eyebrow">Конфигурации</span>
              <h1>Запазени конфигурации</h1>
            </div>
            <button className="secondary-action icon-action" onClick={loadConfigurations} type="button">
              <RefreshCcw size={17} />
              Обнови
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {isLoading && <p className="summary-empty">Зареждане...</p>}
          {!isLoading && configurations.length === 0 && (
            <p className="summary-empty">Все още няма запазени конфигурации.</p>
          )}

          <div className="configuration-list">
            {configurations.map((configuration) => (
              <article className="configuration-card" key={configuration.id}>
                <div className="configuration-card-head">
                  <div>
                    <h2>{configuration.name}</h2>
                    <span>Обновена: {formatDate(configuration.updatedAt)}</span>
                  </div>
                  <strong>{currency.format(configuration.totals.total)}</strong>
                </div>

                <div className="configuration-options">
                  {configuration.frameConfiguration?.effectiveFrameName && (
                    <span>
                      Frame: {configuration.frameConfiguration.effectiveFrameName}
                    </span>
                  )}
                  {configuration.modulesSnapshot.slice(0, 4).map((item) => (
                    <span key={item.moduleId}>
                      {item.moduleShort}: {item.option.name}
                    </span>
                  ))}
                </div>

                <div className="configuration-actions">
                  <button
                    className="secondary-action icon-action"
                    onClick={() => onLoadConfiguration(configuration)}
                    type="button"
                  >
                    <Upload size={16} />
                    Зареди
                  </button>
                  <button
                    className="secondary-action icon-action"
                    disabled={activeActionId === configuration.id}
                    onClick={() => exportAsJson(configuration)}
                    type="button"
                  >
                    <FileJson size={16} />
                    JSON
                  </button>
                  <button
                    className="secondary-action icon-action"
                    disabled={activeActionId === configuration.id}
                    onClick={() => exportAsPdf(configuration)}
                    type="button"
                  >
                    <FileText size={16} />
                    PDF
                  </button>
                  <button
                    className="secondary-action icon-action danger"
                    disabled={activeActionId === configuration.id}
                    onClick={() => requestDeleteConfiguration(configuration)}
                    type="button"
                  >
                    <Trash2 size={16} />
                    Изтрий
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {confirmation && (
        <div className="confirmation-backdrop">
          <form className="confirmation-dialog" onSubmit={confirmAction}>
            <div className="confirmation-dialog-head">
              <span className="eyebrow">Потвърждение</span>
              <h2>{confirmation.title}</h2>
            </div>

            <p>{confirmation.message}</p>

            {confirmation.requireName && (
              <label className="field-label">
                Напишете името на конфигурацията, за да потвърдите изтриването
                
                <input
                  autoComplete="off"
                  autoFocus
                  className="confirmation-name-input"
                  onChange={(event) => {
                    setConfirmationInput(event.target.value);
                    setConfirmationError('');
                  }}
                  spellCheck="false"
                  type="text"
                  value={confirmationInput}
                />
              </label>
            )}

            {confirmationError && <p className="form-error">{confirmationError}</p>}

            <div className="confirmation-actions">
              <button
                className="secondary-action"
                disabled={isConfirming}
                onClick={closeConfirmation}
                type="button"
              >
                Отказ
              </button>
              <button
                className={`confirmation-confirm ${['delete-configuration', 'logout'].includes(confirmation.type) ? 'danger' : ''}`}
                disabled={isConfirming}
                type="submit"
              >
                {confirmation.type === 'delete-configuration' && <Trash2 size={16} />}
                {confirmation.type === 'logout' && <LogOut size={16} />}
                {confirmation.type === 'remove-avatar' && <RefreshCcw size={16} />}
                {isConfirming ? 'Моля, изчакай...' : confirmation.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
