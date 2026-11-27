import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useBack } from '../../app/back';
import { useSession } from '../../app/session';
import { useStudio } from '../../app/studio';
import { Composer } from '../../components/Composer';
import { Icon, type IconName } from '../../components/Icon';
import { useChats, type Target } from './store';
import { TurnView } from './TurnView';

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

export function NewChatPage() {
  const { session } = useSession();
  const { projects, defaultProject, workspace } = useStudio();
  const { start } = useChats();
  const nav = useNavigate();
  const [target, setTarget] = useState<Target | null>(null);
  const [connectors, setConnectors] = useState<string[]>([]);

  useEffect(() => {
    if (target || projects.length === 0) return;
    const p = projects.find((x) => x.name === defaultProject) ?? projects.find((x) => (x.documents ?? 1) > 0) ?? projects[0];
    if (p) setTarget({ kind: 'project', name: p.name });
  }, [projects, defaultProject, target]);

  const ask = (text: string) => {
    if (target) nav(`/c/${start(target, text, workspace, connectors)}`);
  };

  const ideas: { icon: IconName; label: string; go: () => void }[] = [
    { icon: 'doc', label: 'Ask your documents', go: () => ask('What did we learn from the Q3 launch?') },
    { icon: 'routine', label: 'Set up a routine', go: () => nav('/routines?new=1') },
    { icon: 'agent', label: 'Build an agent', go: () => nav('/agents/new') },
    { icon: 'graph', label: 'Explore the knowledge graph', go: () => nav('/knowledge') },
  ];

  return (
    <div className="newchat">
      <div className="newchat__inner">
        <h1 className="as-greeting">
          <span className="greeting-mark">✳</span> {greeting(session?.user?.name)}
        </h1>
        <Composer target={target} onTargetChange={setTarget} onSubmit={ask} autoFocus connectors={connectors} onConnectorsChange={setConnectors} />
        <div className="ideas">
          {ideas.map((i) => (
            <button key={i.label} type="button" className="idea" onClick={i.go}>
              <Icon name={i.icon} size={14} /> {i.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConversationPage() {
  const { id = '' } = useParams();
  const { get, send, setConnectors, stop } = useChats();
  const conv = get(id);
  const end = useRef<HTMLDivElement>(null);
  const turns = conv?.turns.length ?? 0;
  const last = conv?.turns[turns - 1]?.state;
  const back = useBack(conv?.target.kind === 'agent' ? `/agents/${encodeURIComponent(conv.target.id)}` : '/chats');

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, last]);

  if (!conv) return <Navigate to="/" replace />;
  const busy = last === 'running';

  return (
    <div className="conv">
      <header className="as-topbar conv__top">
        <button type="button" className="as-btn as-btn--ghost as-icon-btn conv__back" aria-label="Back" title="Back" onClick={back}>
          <Icon name="chevron" size={16} className="flip" />
        </button>
        <div className="conv__title">{conv.title}</div>
        {conv.target.kind === 'agent' ? (
          <Link to={`/agents/${encodeURIComponent(conv.target.id)}`} className="conv__scope conv__scope--link" title={`Open ${conv.target.name}`}>
            <Icon name="agent" size={14} />
            <span>{conv.target.name}</span>
            {conv.workspace && <span className="conv__ws">· {conv.workspace}</span>}
          </Link>
        ) : (
          <div className="conv__scope">
            <Icon name="doc" size={14} />
            <span>{conv.target.name}</span>
            {conv.workspace && <span className="conv__ws">· {conv.workspace}</span>}
          </div>
        )}
      </header>
      <div className="as-scroll">
        <div className="as-conversation">
          {conv.turns.map((t) => (
            <TurnView key={t.id} conv={conv} turn={t} />
          ))}
          <div ref={end} />
        </div>
      </div>
      <Composer
        target={conv.target}
        lockTarget
        onSubmit={(t) => send(conv.id, t)}
        running={busy}
        onStop={() => stop(conv.id)}
        placeholder="Reply…"
        connectors={conv.connectors ?? []}
        onConnectorsChange={(ids) => setConnectors(conv.id, ids)}
      />
    </div>
  );
}
