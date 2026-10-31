// Shared by the edge function (npm:zod) and vitest (zod) — the zod instance is injected.
// deno-lint-ignore no-explicit-any
export function buildSchemas(z: any) {
  const HttpsUrl = z.string().url().refine((v: string) => v.startsWith("https://"), {
    message: "Frame URL must start with https:// (http: and data:/Base64 are rejected)",
  });
  const Submit = z.object({
    action: z.literal("submit"),
    tier: z.enum(["primary", "backup"]).default("primary"),
    prompt: z.string().min(1).max(4000),
    dialogue: z.string().max(1000).optional(),
    duration_seconds: z.number().min(2).max(30).default(10),
    resolution: z.enum(["720p", "1080p"]).default("720p"),
    aspect_ratio: z.enum(["16:9", "9:16"]).default("16:9"),
    camera_motion: z.string().max(100).optional(),
    seed: z.number().int().optional(),
    first_frame_url: HttpsUrl,
    last_frame_url: HttpsUrl,
  });
  const Status = z.object({
    action: z.literal("status"),
    tier: z.enum(["primary", "backup"]),
    job_id: z.string().min(1).max(200),
  });
  return { Submit, Status };
}
