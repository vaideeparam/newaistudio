// Shapes returned by the Param ai/Studio Gateway MCP, as observed live on 2026-11-25.
// Fields marked optional were absent in at least one real response.

export interface Workspace {
  name: string;
  role?: string;
  default?: boolean;
  /** Only workspaces this app is connected to can be used. */
  this_app_can_use?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  default?: boolean;
}

export interface Step {
  tool: string;
  status: 'done' | 'running' | string;
}

/** Raw citation as the Gateway sends it: the number lives inside `source`, e.g. "[1] report.pdf". */
export interface RawCitation {
  source: string;
  page?: number | string;
  quote?: string;
}

export interface Citation {
  n: number;
  title: string;
  page?: number | string;
  quote?: string;
}

export interface AskResponse {
  answer?: string;
  conversation_id?: string;
  run_id?: string;
  status?: 'running' | string;
  progress?: string;
  steps?: Step[];
  citations?: RawCitation[];
  took_s?: number;
  project?: string;
  note?: string;
}

export interface Answer {
  text: string;
  citations: Citation[];
  conversationId?: string;
  tookS?: number;
  project?: string;
}

export interface Turn {
  id: string;
  question: string;
  state: 'running' | 'done' | 'error';
  progress?: string;
  steps?: Step[];
  answer?: Answer;
  error?: string;
}
