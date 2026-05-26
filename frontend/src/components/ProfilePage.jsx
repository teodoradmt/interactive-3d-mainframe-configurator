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
  const [activeActionId, setActiveActionId] = useState('');

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

  const updateField = (field, value) => {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
    setProfileMessage('');
  };

  const chooseAvatar = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/') || file.size > 180_000) {
      setError('Избери PNG, JPG или WebP снимка до около 180 KB.');
      return;
    }

    try {
      const avatarImage = await readAvatarFile(file);
      updateField('avatarImage', avatarImage);
      setError('');
    } catch (avatarError) {
      setError(avatarError.message);
    }
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
      setError('Браузърът блокира новия прозорец за PDF export.');
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

  const deleteConfiguration = async (configuration) => {
    if (!window.confirm(`Да изтрия ли „${configuration.name}“?`)) {
      return;
    }

    setActiveActionId(configuration.id);
    setError('');

    try {
      await deleteSavedConfiguration(authToken, configuration.id);
      await loadConfigurations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActiveActionId('');
    }
  };

  const signOut = async () => {
    setError('');

    try {
      await logoutUser(authToken);
    } catch {
      // The local session still has to be cleared even if the backend token is already gone.
    } finally {
      onLogout();
    }
  };

  return (
    <main className="account-screen profile-screen">
      <div className="account-topbar">
        <button className="ghost-button" onClick={onBack} type="button">
          <ArrowLeft size={17} />
          Към конфигуратора
        </button>
        <button className="ghost-button danger" onClick={signOut} type="button">
          <LogOut size={17} />
          Изход
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
                onClick={() => updateField('avatarImage', '')}
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
                    onClick={() => deleteConfiguration(configuration)}
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
    </main>
  );
}
