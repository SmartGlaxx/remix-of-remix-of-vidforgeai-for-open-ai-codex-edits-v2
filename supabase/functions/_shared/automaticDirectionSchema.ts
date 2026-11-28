import { z } from "npm:zod@3.25.76";
const text = z.preprocess(value => Array.isArray(value) && value.every(item => typeof item === "string") ? value.join("; ") : value, z.string().trim().min(1).max(1800));
const regionSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
export const movementLocationSchema = z.object({ localized_limb_or_prop: z.boolean(), region: regionSchema.nullable() });
export const sceneSchema = z.object({
  id: z.string().min(1).max(80), layout: text, materials: text, lighting: text,
  cast: z.array(z.object({ id: text, appearance: text, position: text, facing: text })).min(1).max(8),
  props: z.array(z.object({ id: text, position: text, owner: text, hand: text })).max(20),
  landmarks: z.array(z.object({ id: text, position: text })).min(1).max(20),
});
export const directedChapterSchema = z.object({
  scenes: z.array(sceneSchema).max(24),
  shots: z.array(z.object({
    line: z.string().max(600), purpose: z.string().min(1).max(300), visual: z.string().min(1).max(2200),
    action: z.string().min(1).max(600), transition: z.enum(["cut", "continue"]), duration: z.number().int().min(2).max(10),
    direction: z.object({ edit_region: regionSchema.nullish(), scene_id: z.string().min(1).max(80), camera: text, start_pose: text, end_pose: text,
      movements: z.array(text).min(1).max(5), motion_prompt: z.string().min(1).max(2200),
      start_state: text, end_state: text, continuity: z.enum(["shared", "extracted"]) }),
  })).min(1).max(48),
});
// The strict wire schema intentionally has no optional fields or numeric/string bounds.
export const frameCheckSchema = z.object({ identity: z.boolean(), pose: z.boolean(), camera: z.boolean(), lighting: z.boolean(), landmarks: z.boolean(), props: z.boolean(), feasible: z.boolean(), issues: z.array(z.string()), correction: z.string(), offending_frame: z.enum(["start", "end"]), edit_region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable() });
export const sceneObservationSchema = z.object({ scene: z.object({
  id: z.string(), layout: z.string(), materials: z.string(), lighting: z.string(),
  cast: z.array(z.object({ id: z.string(), appearance: z.string(), position: z.string(), facing: z.string() })),
  props: z.array(z.object({ id: z.string(), position: z.string(), owner: z.string(), hand: z.string() })),
  landmarks: z.array(z.object({ id: z.string(), position: z.string() })),
}) });