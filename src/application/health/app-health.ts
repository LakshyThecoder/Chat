export type AppHealthStatus = "ok";

export interface AppHealthResponse {
  status: AppHealthStatus;
  service: "aegis";
  timestamp: string;
  requestId: string;
}

export function buildAppHealthResponse(requestId: string): AppHealthResponse {
  return {
    status: "ok",
    service: "aegis",
    timestamp: new Date().toISOString(),
    requestId,
  };
}
