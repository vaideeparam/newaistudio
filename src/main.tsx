import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, createMemoryRouter } from 'react-router-dom';
import { PanelProvider } from './app/panel';
import { SessionProvider, useSession } from './app/session';
import { StudioProvider } from './app/studio';
import { routes } from './app/routes';
import { ChatProvider } from './features/chat/store';
import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import './features/ask/ask.css';

// The static demo runs inside a frame that owns the URL, so it keeps its route in memory.
const router = import.meta.env.VITE_STATIC_MOCK === '1' ? createMemoryRouter(routes, { initialEntries: [location.hash.startsWith('#/') ? location.hash.slice(1) : '/'] }) : createBrowserRouter(routes);

/** Studio data loads only once someone is signed in. */
function SignedInProviders({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!session?.signedIn) return <>{children}</>;
  return (
    <StudioProvider>
      <ChatProvider>
        <PanelProvider>{children}</PanelProvider>
      </ChatProvider>
    </StudioProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <SignedInProviders>
        <RouterProvider router={router} />
      </SignedInProviders>
    </SessionProvider>
  </StrictMode>,
);
