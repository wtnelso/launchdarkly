import { useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'abc.adminDrawerOpen';

/** Read the remembered open/closed state. Browser storage may be unavailable; default closed. */
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
    /* ignore */
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Header slot, e.g. the LaunchDarkly connection pill. */
  status?: ReactNode;
  children: ReactNode;
}

/**
 * Collapsible admin sidebar. It overlays the right edge of the page so
 * opening it never reflows the customer-facing view.
 */
export function AdminDrawer({ open, onOpenChange, status, children }: Props) {
  useEffect(() => {
    writeDrawerOpen(open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      <div className="drawer-body">{children}</div>
    </aside>
  );
}
