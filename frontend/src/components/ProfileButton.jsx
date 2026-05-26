import { LogIn, UserRound } from 'lucide-react';

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

export function ProfileButton({ currentUser, isLoading, onOpenAuth, onOpenProfile }) {
  if (!currentUser) {
    return (
      <button className="profile-chip" disabled={isLoading} onClick={onOpenAuth} type="button">
        <span className="profile-avatar empty">
          <LogIn size={17} />
        </span>
        <span>{isLoading ? 'Проверка...' : 'Вход'}</span>
      </button>
    );
  }

  return (
    <button className="profile-chip" onClick={onOpenProfile} type="button">
      <span className="profile-avatar" style={{ '--avatar-color': currentUser.avatarColor }}>
        {currentUser.avatarImage ? <img alt="" src={currentUser.avatarImage} /> : getInitials(currentUser)}
      </span>
      <span>{currentUser.profileName || 'Профил'}</span>
      <UserRound size={16} />
    </button>
  );
}
