import { Server } from 'lucide-react';

export function StatusPill({ children }) {
  return (
    <div className="status-pill">
      <Server size={18} />
      {children}
    </div>
  );
}
