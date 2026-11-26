import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { directedChapterSchema, sceneSchema } from "../_shared/automaticDirectionSchema.ts";

const SYSTEM = `You are an elite YouTube long-form scriptwriter. Given a title, tone, duration, hook style, and language, write a high-retention script structured into clearly timed sections.
Return STRICT JSON only.`;

const directionPlan=z.object({shots:z.array(z.object({
  purpose:z.string().min(1).max(300), visual:z.string().min(1).max(1200),
  action:z.string().min(1).max(600), transition:z.enum(["cut","continue"])
})).min(1).max(12)});
const explainerPlan = z.object({
  scenes: z.array(z.object({
    line: z.string().trim().min(1).max(600),
    prompt: z.string().trim().min(1).max(2200),
    endPrompt:z.string().trim().min(1).max(1100), transitionText:z.string().trim().min(1).max(500),
    label: z.string().trim().min(1).max(100),
    diagram: z.object({
      kind: z.enum(["flow", "comparison", "sequence"]),
      labels: z.array(z.string().trim().min(1).max(32)).length(3),
    }).optional().catch(undefined),
  })).length(6),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("TOGETHER_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const { title, tone, duration, hook, language, explainerBrief, format, shotLines, previousBeat, automatic, sceneRecords, chapterSeconds } = await req.json().catch(() => ({}));
    const directing=Array.isArray(shotLines);
    if(directing && !z.array(z.string().max(600)).min(1).max(12).safeParse(shotLines).success)return json({error:"Invalid chapter"},400);
    if(automatic && (!directing || !z.number().int().min(2).max(120).safeParse(chapterSeconds).success || !z.array(sceneSchema.passthrough()).max(360).safeParse(sceneRecords).success))return json({error:"Invalid automatic direction request"},400);
    const shortFilm = explainerBrief !== undefined;
    if (shortFilm && (typeof explainerBrief !== "string" || !explainerBrief.trim())) {
      return json({ error: "Enter a video brief and retry." }, 400);
    }
    if (!directing && !shortFilm && (typeof title !== "string" || !title.trim())) return json({ error: "Enter a title or topic and retry." }, 400);
    const userPrompt = automatic ? `Direct this chapter as discrete, achievable physical events. Return strict JSON {scenes:[{id,layout,materials,lighting,cast:[{id,appearance,position,facing}],props:[{id,position,owner,hand}],landmarks:[{id,position}]}],shots:[{line,purpose,visual,action,transition,duration,direction:{scene_id,camera,start_pose,end_pose,movements:[string],motion_prompt,start_state,end_state,continuity}}]}. All fields required. Reuse existing scene IDs/layout/landmarks/cast; only add new scenes when needed. Use world-space locations and stable IDs for every important character/prop (who holds it, in which hand). Establish a location once; props/poses change only through actions. Each shot has ONE event, with 1–5 chronologically ordered physical movements and its own motion_prompt. Durations are whole seconds from 2 to 10 and must sum EXACTLY to ${chapterSeconds}; at most ${Math.ceil(chapterSeconds/5)} shots. Prefer fewer shots when the action fits; holds can fill a short action's remaining time. Preserve the narration EXACTLY, split across shot lines in order with no rewriting. No image words/letters, panels or duplicated characters. One continuous camera per clip; change angles BETWEEN clips using a cut and the scene's world-space layout. For continuous shots set continuity:"shared", transition:"continue", and COPY the preceding end_pose, end_state, camera and scene_id VERBATIM into this start_pose, start_state, camera and scene_id. The shared image will be stored once and reused. For a cut use continuity:"shared", transition:"cut"; never interpolate camera moves inside a clip. The first shot must be a cut unless there is a preceding event. Existing scenes: ${JSON.stringify(sceneRecords)}. Previous event: ${JSON.stringify(previousBeat)}. Narration: ${JSON.stringify(shotLines)}` : directing ? `Direct these voiced storyboard beats as one coherent YouTube explainer chapter. Keep narration unchanged. Give each line its own specific opening composition (visual), editorial purpose and physical action including the transition and exact ending pose. Preserve cast, props and locations; use meaningful close-ups and intentional cuts. Use continue for uninterrupted movement, including chapter boundaries. Return JSON {shots:[{visual,purpose,action,transition:"cut" or "continue"}]} with exactly one entry per line, in order. Previous chapter ending: ${String(previousBeat??"Opening").slice(0,650)}. Lines: ${JSON.stringify(shotLines)}` : shortFilm ? `Write a one-minute illustrated explainer based on this creative brief:
${explainerBrief.slice(0, 5000)}
Output JSON with a title and exactly six scenes. EACH of the six scene objects MUST contain all these fields: line (16–21 spoken words), prompt (one concrete opening illustration; repeat exact identity, outfit, scene and palette for recurring characters), label (a short takeaway, four words maximum), endPrompt (a string describing THAT scene's final pose/composition), transitionText (a string describing exactly what changes WITHIN THAT scene), and diagram {kind: "flow" | "comparison" | "sequence", labels: [three short labels, up to 14 characters each]}. Do not place endPrompt or transitionText at the root: they belong INSIDE EVERY scene. Required shape: {"title":"...","scenes":[{"line":"...","prompt":"...","label":"...","endPrompt":"...","transitionText":"...","diagram":{"kind":"flow","labels":["...","...","..."]}}]} with exactly six complete entries. Make each scene advance the explanation. Use examples from the brief accurately. No words or letters in image prompts; labels are separate overlays. Start with a hook and close with a useful payoff. Style: ${format==="comic"?"graphic novel panels with dialogue":format==="whiteboard"?"sparse black line drawings of a single readable idea per scene":"illustrated narrative"}.` : `Title: """${String(title).slice(0, 300)}"""
Tone: ${tone || "Engaging & Dramatic"}
Duration: ${duration || "8-10 min"}
Hook style: ${hook || "Shocking Fact"}
Language: ${language || "English"}

Write a full script. Reply with ONLY this JSON:
{
  "sections": [
    { "section": "HOOK (0:00 - 0:30)", "text": "..." },
    { "section": "CONTEXT (0:30 - 2:00)", "text": "..." },
    { "section": "RISING ACTION (2:00 - 5:00)", "text": "..." },
    { "section": "CLIMAX (5:00 - 8:00)", "text": "..." },
    { "section": "RESOLUTION (8:00 - 10:00)", "text": "..." }
  ],
  "meta": { "words": number, "minutes": number, "retention": number }
}
Each section text should be a punchy paragraph. Respect the requested total spoken word count and duration, even for a 30-second script. Adjust section timestamps to match the requested duration.`;

    const r = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V4.1-Flash",
        messages: [{ role: "system", content: automatic ? "Direct a physically coherent animated scene using the provided observed reference. Return strictly typed JSON. All fields named in the user schema are required INSIDE each object. Every field is a string except scenes/shots/cast/props/landmarks/movements arrays and integer duration. start_pose and end_pose describe the CHARACTER'S BODY, HANDS, SEATING AND PROPS, never camera coordinates; camera is a separate string. For the first shot, start_pose and start_state must match the observed opening image exactly. Keep existing cast appearance and room facts unchanged. Preserve a continuous fixed angle for related seated mug-lift/sip actions unless the script explicitly needs a cut. Prefer shared boundaries and copy pose/state/camera verbatim at adjacent continuous boundaries." : shortFilm ? "Direct a clear illustrated short film. Return strict JSON with title and exactly six scenes. Every scene must contain line, prompt, label, endPrompt, transitionText and diagram. endPrompt and transitionText must be inside each scene, never at the root." : SYSTEM }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return json({ error: "Rate limit exceeded." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!r.ok) { console.error(await r.text()); return json({ error: "AI request failed" }, 502); }
    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      try {
        parsed = extractJson(content);
      } catch (e) {
        console.error("Invalid JSON from AI:", content);
        return json({ error: "AI returned invalid JSON" }, 502);
      }
    }
    if(automatic){const plan=directedChapterSchema.safeParse(parsed);if(!plan.success){console.error("Automatic direction validation",JSON.stringify(plan.error.issues));return json({error:"Director returned an incomplete event or scene record: "+plan.error.issues.slice(0,3).map(issue=>issue.path.join(".")+" "+issue.message).join("; ")},502);}return json(plan.data);}
    if(directing){const plan=directionPlan.safeParse(parsed);if(!plan.success||plan.data.shots.length!==shotLines.length)return json({error:"Director returned an incomplete chapter"},502);return json(plan.data);}
    if (shortFilm) {
      const result = explainerPlan.safeParse(parsed);
      if (!result.success) {
        console.error("Explainer plan validation", JSON.stringify(result.error.issues.map(issue=>({path:issue.path,code:issue.code,message:issue.message}))));
        return json({ error: "The planner returned an incomplete scene list. Click Generate film to try again." }, 502);
      }
      return json(result.data);
    }
    return json(parsed);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function extractJson(raw: string): unknown {
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[\{\[]/);
  const open = s[start];
  const close = open === "[" ? "]" : "}";
  const end = s.lastIndexOf(close);
  if (start === -1 || end === -1) throw new Error("No JSON found");
  s = s.substring(start, end + 1);
  try { return JSON.parse(s); } catch {
    s = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(s);
  }
}