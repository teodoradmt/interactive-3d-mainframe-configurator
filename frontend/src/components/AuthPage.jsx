import { ArrowLeft, Building2, Eye, EyeOff, Lock, LogIn, Mail, UserPlus, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { loginUser, registerUser } from '../services/mainframeApi.js';

const initialForm = {
  confirmPassword: '',
  email: '',
  password: '',
  profileName: '',
  workplace: '',
};

function getPasswordRules(password) {
  return [
    {
      isValid: password.length >= 8,
      label: '8+ символа',
    },
    {
      isValid: /[A-ZА-Я]/.test(password),
      label: 'главна буква',
    },
    {
      isValid: /[a-zа-я]/.test(password),
      label: 'малка буква',
    },
    {
      isValid: /\d/.test(password),
      label: 'цифра',
    },
    {
      isValid: /[^A-Za-zА-Яа-я0-9]/.test(password),
      label: 'специален знак',
    },
  ];
}

export function AuthPage({ mode, onAuthSuccess, onBack, onModeChange, reason }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const isRegister = mode === 'register';
  const passwordRules = useMemo(() => getPasswordRules(form.password), [form.password]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setError('');
    setDetails([]);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (isRegister && form.password !== form.confirmPassword) {
      setError('Паролите не съвпадат.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setDetails([]);

    try {
      const result = isRegister
        ? await registerUser({
          email: form.email,
          password: form.password,
          profileName: form.profileName,
          workplace: form.workplace,
        })
        : await loginUser({
          email: form.email,
          password: form.password,
        });

      onAuthSuccess(result);
    } catch (requestError) {
      setError(requestError.message);
      setDetails(Array.isArray(requestError.details) ? requestError.details : []);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="account-screen auth-screen">
      <div className="account-topbar">
        <button className="ghost-button" onClick={onBack} type="button">
          <ArrowLeft size={17} />
          Към конфигуратора
        </button>
      </div>

      <section className="auth-layout">
        <div className="auth-intro">
          <span className="eyebrow">Профил</span>
          <h1>{isRegister ? 'Създай профил' : 'Влез в профила си'}</h1>
          <p>
            {reason || 'Запазените конфигурации са лични и могат да се експортират от профила.'}
          </p>
        </div>

        <form className="auth-panel" onSubmit={submit}>
          <div className="auth-switch" role="tablist" aria-label="Вход или регистрация">
            <button
              aria-selected={!isRegister}
              className={!isRegister ? 'active' : ''}
              onClick={() => onModeChange('login')}
              role="tab"
              type="button"
            >
              <LogIn size={16} />
              Вход
            </button>
            <button
              aria-selected={isRegister}
              className={isRegister ? 'active' : ''}
              onClick={() => onModeChange('register')}
              role="tab"
              type="button"
            >
              <UserPlus size={16} />
              Регистрация
            </button>
          </div>

          {isRegister && (
            <>
              <label className="field-label">
                Име на профила
                <span className="input-shell">
                  <UserRound size={17} />
                  <input
                    autoComplete="name"
                    onChange={(event) => updateField('profileName', event.target.value)}
                    placeholder="Име или организация"
                    type="text"
                    value={form.profileName}
                  />
                </span>
              </label>

              <label className="field-label">
                Месторабота
                <span className="input-shell">
                  <Building2 size={17} />
                  <input
                    autoComplete="organization"
                    onChange={(event) => updateField('workplace', event.target.value)}
                    placeholder="Банка, университет, IT отдел..."
                    type="text"
                    value={form.workplace}
                  />
                </span>
              </label>
            </>
          )}

          <label className="field-label">
            Email
            <span className="input-shell">
              <Mail size={17} />
              <input
                autoComplete="email"
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={form.email}
              />
            </span>
          </label>

          <label className="field-label">
            Парола
            <span className="input-shell password-shell">
              <Lock size={17} />
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="••••••••"
                required
                type={isPasswordVisible ? 'text' : 'password'}
                value={form.password}
              />
              <button
                aria-label={isPasswordVisible ? 'Скрий паролата' : 'Покажи паролата'}
                aria-pressed={isPasswordVisible}
                className="password-toggle"
                onClick={() => setIsPasswordVisible((current) => !current)}
                type="button"
              >
                {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          {isRegister && (
            <>
              <div className="password-rules" aria-label="Изисквания за парола">
                {passwordRules.map((rule) => (
                  <span className={rule.isValid ? 'valid' : ''} key={rule.label}>
                    {rule.label}
                  </span>
                ))}
              </div>

              <label className="field-label">
                Повтори паролата
                <span className="input-shell password-shell">
                  <Lock size={17} />
                  <input
                    autoComplete="new-password"
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="••••••••"
                    required
                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                    value={form.confirmPassword}
                  />
                  <button
                    aria-label={isConfirmPasswordVisible ? 'Скрий повторената парола' : 'Покажи повторената парола'}
                    aria-pressed={isConfirmPasswordVisible}
                    className="password-toggle"
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isConfirmPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="form-error">
              <p>{error}</p>
              {details.length > 0 && details.map((detail) => <span key={detail}>{detail}</span>)}
            </div>
          )}

          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isRegister ? <UserPlus size={17} /> : <LogIn size={17} />}
            {isSubmitting ? 'Моля, изчакай...' : isRegister ? 'Създай профил' : 'Влез'}
          </button>
        </form>
      </section>
    </main>
  );
}
