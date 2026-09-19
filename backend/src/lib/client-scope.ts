export class ClientScopeError extends Error {
  readonly code = "forbidden_client_scope" as const;

  constructor(message = "You can only view shipments for your own account.") {
    super(message);
    this.name = "ClientScopeError";
  }
}

export function requireClientId(clientId: string | null | undefined): string {
  if (!clientId) {
    throw new ClientScopeError("This account is not linked to a client.");
  }
  return clientId;
}

/** Backend service-role queries must always constrain by this client id. */
export function scopedClientId(userClientId: string | null | undefined): string {
  return requireClientId(userClientId);
}

export function assertClientOwnsShipment(
  shipmentClientId: string | null | undefined,
  userClientId: string | null | undefined,
): void {
  const clientId = requireClientId(userClientId);
  if (!shipmentClientId || shipmentClientId !== clientId) {
    throw new ClientScopeError();
  }
}

export function isClientPortalUser(
  role: string | null | undefined,
  clientId: string | null | undefined,
): boolean {
  return Boolean(clientId) && !role;
}

export function filterShipmentsForClient<T extends { client_id: string }>(
  rows: T[],
  userClientId: string | null | undefined,
): T[] {
  const clientId = requireClientId(userClientId);
  return rows.filter((row) => row.client_id === clientId);
}
