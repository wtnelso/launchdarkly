import { useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'abc.adminDrawerOpen';

export function readDrawerOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDrawerOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    return;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: ReactNode;
  top?: ReactNode;
  children: ReactNode;
}

export function AdminDrawer({ open, onOpenChange, status, top, children }: Props) {
  useEffect(() => {
    writeDrawerOpen(open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target && !target.closest('.drawer, .drawer-toggle')) onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <aside className={`drawer ${open ? 'open' : ''}`} aria-label="Admin tools" aria-hidden={!open}>
      <div className="drawer-head">
        <div>
          <h2>Admin</h2>
          <div className="small muted">LaunchDarkly: {status}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => onOpenChange(false)} aria-label="Close admin drawer">
          Close ✕
        </button>
      </div>
      {top && <div className="drawer-top">{top}</div>}
      <div className="drawer-body">{children}</div>
    </aside>
  );
}
