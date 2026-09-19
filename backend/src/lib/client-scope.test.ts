import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ClientScopeError,
  assertClientOwnsShipment,
  filterShipmentsForClient,
  isClientPortalUser,
  requireClientId,
  scopedClientId,
} from "./client-scope.js";

const CLIENT_A = "00000000-0000-0000-0000-000000000201";
const CLIENT_B = "00000000-0000-0000-0000-000000000202";

describe("client shipment scope", () => {
  it("rejects an ops or unlinked user with no client_id", () => {
    assert.throws(() => requireClientId(null), ClientScopeError);
    assert.throws(() => scopedClientId(undefined), ClientScopeError);
  });

  it("allows a shipment that belongs to the signed-in client", () => {
    assert.doesNotThrow(() => assertClientOwnsShipment(CLIENT_A, CLIENT_A));
  });

  it("rejects another client's shipment", () => {
    assert.throws(() => assertClientOwnsShipment(CLIENT_B, CLIENT_A), ClientScopeError);
    assert.throws(() => assertClientOwnsShipment(null, CLIENT_A), ClientScopeError);
  });

  it("filters a mixed list down to the caller's client only", () => {
    const rows = [
      { id: "1", client_id: CLIENT_A, order_id: "MINE" },
      { id: "2", client_id: CLIENT_B, order_id: "THEIRS" },
      { id: "3", client_id: CLIENT_A, order_id: "MINE-2" },
    ];
    assert.deepEqual(
      filterShipmentsForClient(rows, CLIENT_A).map((r) => r.order_id),
      ["MINE", "MINE-2"],
    );
  });

  it("treats a linked user without an ops role as a portal user", () => {
    assert.equal(isClientPortalUser(null, CLIENT_A), true);
    assert.equal(isClientPortalUser("admin", CLIENT_A), false);
    assert.equal(isClientPortalUser("ops_only", null), false);
    assert.equal(isClientPortalUser(null, null), false);
  });

  it("does not return other clients' rows even if the caller has no id", () => {
    assert.throws(
      () =>
        filterShipmentsForClient(
          [{ id: "1", client_id: CLIENT_B, order_id: "THEIRS" }],
          null,
        ),
      ClientScopeError,
    );
  });
});
