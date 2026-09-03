export const CHAMBER_WEBMCP_EVENT = "aegis:webmcp";
export const CHAMBER_STATE_EVENT = "aegis:chamber";

export interface ChamberToolPulse {
  name: string;
  ok: boolean;
  message: string;
  at: string;
}

export function pulseChamberTool(pulse: ChamberToolPulse) {
  window.dispatchEvent(new CustomEvent<ChamberToolPulse>(CHAMBER_WEBMCP_EVENT, { detail: pulse }));
}
