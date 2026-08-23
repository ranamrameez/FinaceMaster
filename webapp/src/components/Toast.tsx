import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    set({ message });
    setTimeout(() => set({ message: null }), 2600);
  },
}));

export function toast(message: string) {
  useToastStore.getState().show(message);
}

export function Toast() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;
  return <div className="toast show">{message}</div>;
}
