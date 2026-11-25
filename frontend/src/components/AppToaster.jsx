import { useEffect, useRef } from 'react';
import { resolveValue, toast, ToastBar, useToasterStore } from 'react-hot-toast';

const DEFAULT_DURATION_MS = 3000;
const DEFAULT_REMOVE_DELAY_MS = 450;
const MAX_VISIBLE_AUTO_TOASTS = 5;

/**
 * Custom Toaster built on react-hot-toast's store and ToastBar UI.
 * Manages independent per-toast dismissal timers without mouse-hover pause
 * handlers, preventing synthetic mobile touch events from freezing dismissal.
 */
export default function AppToaster({ toastOptions = {} }) {
  const { toasts } = useToasterStore(toastOptions);
  const dismissTimersRef = useRef(new Map());
  const removeTimersRef = useRef(new Map());

  useEffect(() => {
    const activeIds = new Set(toasts.map((t) => t.id));

    // Clear timers for toasts already removed from store.
    for (const [id, entry] of dismissTimersRef.current.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(entry.timerId);
        dismissTimersRef.current.delete(id);
      }
    }
    for (const [id, timerId] of removeTimersRef.current.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(timerId);
        removeTimersRef.current.delete(id);
      }
    }

    // Enforce a cap on stacked auto-dismissing toasts so mobile viewports stay clear.
    const visibleAutoToasts = toasts.filter(
      (t) => t.visible && !t.dismissed && Number.isFinite(t.duration ?? DEFAULT_DURATION_MS)
    );
    if (visibleAutoToasts.length > MAX_VISIBLE_AUTO_TOASTS) {
      visibleAutoToasts.slice(MAX_VISIBLE_AUTO_TOASTS).forEach((oldest) => {
        toast.dismiss(oldest.id);
      });
    }

    const now = Date.now();

    toasts.forEach((t) => {
      if (t.dismissed || !t.visible) {
        const pendingDismiss = dismissTimersRef.current.get(t.id);
        if (pendingDismiss) {
          clearTimeout(pendingDismiss.timerId);
          dismissTimersRef.current.delete(t.id);
        }

        if (!removeTimersRef.current.has(t.id)) {
          const removeDelay = t.removeDelay ?? DEFAULT_REMOVE_DELAY_MS;
          const removeId = setTimeout(() => {
            removeTimersRef.current.delete(t.id);
            toast.remove(t.id);
          }, removeDelay);
          removeTimersRef.current.set(t.id, removeId);
        }
        return;
      }

      // If an existing toast ID was reactivated (e.g. network-status back online), cancel pending removal.
      const pendingRemove = removeTimersRef.current.get(t.id);
      if (pendingRemove) {
        clearTimeout(pendingRemove);
        removeTimersRef.current.delete(t.id);
      }

      const duration = t.duration ?? DEFAULT_DURATION_MS;
      if (!Number.isFinite(duration)) {
        const existing = dismissTimersRef.current.get(t.id);
        if (existing) {
          clearTimeout(existing.timerId);
          dismissTimersRef.current.delete(t.id);
        }
        return;
      }

      const existing = dismissTimersRef.current.get(t.id);
      if (existing && existing.createdAt === t.createdAt && existing.duration === duration) {
        return;
      }

      if (existing) {
        clearTimeout(existing.timerId);
      }

      const remaining = Math.max(0, duration - (now - t.createdAt));
      const timerId = setTimeout(() => {
        dismissTimersRef.current.delete(t.id);
        toast.dismiss(t.id);
      }, remaining);

      dismissTimersRef.current.set(t.id, {
        timerId,
        createdAt: t.createdAt,
        duration,
      });
    });
  }, [toasts]);

  // Clean up all pending timers on unmount (including React Strict Mode remounts).
  useEffect(() => {
    const dismissTimers = dismissTimersRef.current;
    const removeTimers = removeTimersRef.current;
    return () => {
      dismissTimers.forEach(({ timerId }) => clearTimeout(timerId));
      dismissTimers.clear();
      removeTimers.forEach((timerId) => clearTimeout(timerId));
      removeTimers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  const centerToasts = toasts.filter((t) => t.position === 'top-center');
  const defaultToasts = toasts.filter((t) => t.position !== 'top-center');

  const renderToast = (t, position) => {
    const isInteractive = t.type === 'custom' || typeof t.message === 'function';
    const toastWithHeight = { ...t, height: t.height || 1 };

    return (
      <div
        key={t.id}
        data-toast-id={t.id}
        onClick={!isInteractive && t.visible ? () => toast.dismiss(t.id) : undefined}
        className={`max-w-full ${t.visible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        {t.type === 'custom' ? (
          resolveValue(t.message, t)
        ) : (
          <ToastBar toast={toastWithHeight} position={position} />
        )}
      </div>
    );
  };

  return (
    <div
      data-rht-toaster=""
      className="fixed inset-x-4 top-4 z-[9999] pointer-events-none flex flex-col gap-2"
    >
      {centerToasts.length > 0 && (
        <div className="flex flex-col items-center gap-2 w-full">
          {centerToasts.map((t) => renderToast(t, 'top-center'))}
        </div>
      )}
      {defaultToasts.length > 0 && (
        <div className="flex flex-col items-center sm:items-end gap-2 w-full">
          {defaultToasts.map((t) => renderToast(t, t.position || 'top-right'))}
        </div>
      )}
    </div>
  );
}
