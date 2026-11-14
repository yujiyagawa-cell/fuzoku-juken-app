import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Mode } from '../core/types';

// 子どもモード／保護者モード（起動時は子どもモード）

const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void; isParent: boolean }>({
  mode: 'child',
  setMode: () => {},
  isParent: false
});

export function ModeProvider({ children, initial = 'child' }: { children: ReactNode; initial?: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const value = useMemo(() => ({ mode, setMode, isParent: mode === 'parent' }), [mode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
