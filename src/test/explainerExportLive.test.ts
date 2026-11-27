// Opt-in integration checks against the connected backend; no provider generation calls.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";

const enabled = process.env.EXPLAINER_LIVE_CHECK === "1";
describe.skipIf(!enabled)("live explainer export ownership and claiming", () => {
  const session = enabled ? JSON.parse(readFileSync("/root/.cache/lovable-auth/session.json", "utf8")) : null;
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const owner = session?.session?.user?.id;
  const foreignOwner = crypto.randomUUID();
  const ownId = crypto.randomUUID();
  const foreignId = crypto.randomUUID();
  const call = (path: string, token: string | undefined, method = "GET", body?: unknown) => {
    if (!url || !service || !anon || !token) throw new Error("Live verification credentials unavailable");
    return fetch(url + "/rest/v1/" + path, {
      method, headers: { apikey: token === service ? service : anon, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=representation" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  const input = { format: "illustrated", topic: "30-second release check; no paid generation", seconds: 30, host: "none" };
  beforeAll(async () => {
    if (!url || !service || !anon || !session.session?.access_token) throw new Error("Live verification credentials unavailable");
      // Service-owned test fixtures are held in attention so no poller can generate them.
      const seed = await call("explainer_exports", service, "POST", [
        { ...input, id: ownId, owner_id: owner, state: "attention", progress: "Release check: no paid generation" },
        { ...input, id: foreignId, owner_id: foreignOwner, state: "attention", progress: "Release check: no paid generation" },
      ]);
      expect(seed.status).toBe(201);
  });
  afterAll(async () => {
    const response = await call("explainer_exports?id=in.(" + ownId + "," + foreignId + ")", service, "DELETE");
    expect(response.ok).toBe(true);
  });
  it("reads own jobs", async () => {
      const own = await call("explainer_exports?id=eq." + ownId, session.session.access_token);
      expect(own.status).toBe(200);
      expect((await own.json()).map((row: {id: string}) => row.id)).toEqual([ownId]);
  });
  it("cannot read another owner's jobs", async () => {
      const foreign = await call("explainer_exports?id=eq." + foreignId, session.session.access_token);
      expect(await foreign.json()).toEqual([]);
  });
  it("cannot submit under another owner", async () => {
      const spoof = await call("explainer_exports", session.session.access_token, "POST", { ...input, id: crypto.randomUUID(), owner_id: foreignOwner });
      expect(spoof.status).toBe(403);
  });
  it("cannot update job status", async () => {
      const update = await call("explainer_exports?id=eq." + ownId, session.session.access_token, "PATCH", { state: "done" });
      expect(update.status).toBe(403);
  });
  it("cannot delete jobs", async () => {
      const remove = await call("explainer_exports?id=eq." + ownId, session.session.access_token, "DELETE");
      expect(remove.status).toBe(403);
  });
  it("cannot claim jobs as an authenticated client", async () => {
      const claim = await call("rpc/claim_explainer_export", session.session.access_token, "POST", { token: crypto.randomUUID() });
      expect(claim.status).toBe(403);
  });
  it("rejects anonymous table access", async () => {
      const anonymous = await fetch(url + "/rest/v1/explainer_exports?select=id", { headers: { apikey: anon } });
      expect(anonymous.status).toBe(401);
  });
  it("lets only the service claim a queued job without generation", async () => {
      // A queued sentinel can be claimed, but its persisted operation forbids provider work.
      const queue = await call("explainer_exports?id=eq." + ownId, service, "PATCH", { state: "queued", operation: "Release verification: paid calls prohibited" });
      expect(queue.status).toBe(200);
      const token = crypto.randomUUID();
      const worker = await call("rpc/claim_explainer_export", service, "POST", { token });
      expect(worker.status).toBe(200);
      const claimed = await worker.json();
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({ id: ownId, lease: token, state: "running" });
  });
});