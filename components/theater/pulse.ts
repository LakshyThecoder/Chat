export const THEATER_WEBMCP_EVENT = "aegis:theater:webmcp";
export const THEATER_STATE_EVENT = "aegis:theater:state";

export interface TheaterToolPulse {
  name: string;
  ok: boolean;
  message: string;
  at: string;
  input?: Record<string, unknown>;
  output?: unknown;
  requestId?: string;
  code?: string;
}

export function pulseTheaterTool(pulse: TheaterToolPulse) {
  window.dispatchEvent(new CustomEvent<TheaterToolPulse>(THEATER_WEBMCP_EVENT, { detail: pulse }));
}

