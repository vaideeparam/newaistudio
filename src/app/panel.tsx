import { createContext, useContext, useState, type ReactNode } from 'react';

/** The right-hand panel (receipts, sources, artefacts), like Claude web's artefact pane. */
export interface PanelContent {
  title: string;
  body: ReactNode;
}

const Ctx = createContext<{ panel: PanelContent | null; open: (p: PanelContent) => void; close: () => void } | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelContent | null>(null);
  return <Ctx.Provider value={{ panel, open: setPanel, close: () => setPanel(null) }}>{children}</Ctx.Provider>;
}

export function usePanel() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePanel must be used inside <PanelProvider>');
  return v;
}
