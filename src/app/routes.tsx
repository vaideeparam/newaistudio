import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { RequireSession } from './RequireSession';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SignInPage } from '../pages/SignInPage';
import { ToolsPage } from '../pages/ToolsPage';

/**
 * Route table. Feature folders (src/features/<name>/) export RouteObject[]
 * and get spread into the signed-in children below.
 */
export const routes: RouteObject[] = [
  { path: '/signin', element: <SignInPage /> },
  {
    element: (
      <RequireSession>
        <AppShell />
      </RequireSession>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'dev/tools', element: <ToolsPage /> },
      // ...askRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
