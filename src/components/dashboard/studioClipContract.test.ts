import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildSchemas } from "../../../supabase/functions/studio-clip/contract";

// The edge function answers HTTP 400 whenever Submit.safeParse fails.
const { Submit } = buildSchemas(z);
const base = { action: "submit", prompt: "Shot", first_frame_url: "https://example.com/a.png", last_frame_url: "https://example.com/b.png" };

describe("studio-clip server schema", () => {
  it("accepts two HTTPS frames", () => { expect(Submit.safeParse(base).success).toBe(true); });
  it.each([
    ["missing end frame", { last_frame_url: undefined }],
    ["missing start frame", { first_frame_url: undefined }],
    ["Base64 end frame", { last_frame_url: "data:image/png;base64,abc" }],
    ["http start frame", { first_frame_url: "http://example.com/a.png" }],
  ])("rejects %s (400)", (_, over) => {
    expect(Submit.safeParse({ ...base, ...over }).success).toBe(false);
  });
});
