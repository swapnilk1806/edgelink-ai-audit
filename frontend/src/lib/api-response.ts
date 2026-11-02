export async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (HTTP ${response.status}). Check the server logs and try again.`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}). Check the server logs and try again.`);
  }

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Request failed (HTTP ${response.status}).`;
    const requestId = payload && typeof payload === "object" && "request_id" in payload && typeof payload.request_id === "string"
      ? ` Reference: ${payload.request_id}.`
      : "";
    throw new Error(`${message}${requestId}`);
  }

  return payload as T;
}
