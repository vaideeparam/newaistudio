import type { RouteObject } from 'react-router-dom';
import { AppFrame } from './AppFrame';
import { RequireSession } from './RequireSession';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SignInPage } from '../pages/SignInPage';
import { ToolsPage } from '../pages/ToolsPage';
import { ConversationPage, NewChatPage } from '../features/chat/ChatPage';
import { ChatsPage } from '../features/chat/ChatsPage';
import { AgentsPage } from '../features/agents/AgentsPage';
import { AgentPage } from '../features/agents/AgentPage';
import { DesignPage } from '../features/agents/DesignPage';
import { RoutinesPage } from '../features/routines/RoutinesPage';
import { KnowledgePage } from '../features/knowledge/KnowledgePage';
import { ConnectorsPage } from '../features/connectors/ConnectorsPage';
import { GovernancePage } from '../features/governance/GovernancePage';

export const routes: RouteObject[] = [
  { path: '/signin', element: <SignInPage /> },
  {
    element: (
      <RequireSession>
        <AppFrame />
      </RequireSession>
    ),
    children: [
      { index: true, element: <NewChatPage /> },
      { path: 'c/:id', element: <ConversationPage /> },
      { path: 'chats', element: <ChatsPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'agents/new', element: <DesignPage /> },
      { path: 'agents/:id', element: <AgentPage /> },
      { path: 'routines', element: <RoutinesPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'connectors', element: <ConnectorsPage /> },
      { path: 'governance', element: <GovernancePage /> },
      { path: 'dev/tools', element: <ToolsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
