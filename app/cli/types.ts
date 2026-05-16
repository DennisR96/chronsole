export type TabStatus = "connecting" | "connected" | "disconnected";

export interface Tab {
  id: string;
  label: string;
  status: TabStatus;
}

export interface TerminalResource {
  socket: WebSocket | null;
  dispose: (killSession?: boolean) => void;
  fit: () => void;
  focus: () => void;
  term?: any;
}

export type StatusConfig = {
  label: string;
  icon: string;
};
