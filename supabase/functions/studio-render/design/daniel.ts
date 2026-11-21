// Proposed original artwork; not connected to the active proof until owner approval.
export const daniel = {
  id: "daniel", version: "phase0-art-v1", review: "pending" as const,
  name: "Daniel", base: "adult-male-average", age: 30,
  face: "soft-square", hair: "short-side-swept", accessory: "round-square-glasses",
  outfit: { top: "blue-short-sleeve-shirt", bottom: "beige-chinos", shoes: "brown-lace-ups" },
  colours: {
    ink: "#263234", skin: "#F1BB8F", skinDetail: "#CF8F66", hair: "#2C3036",
    hairDetail: "#454A52", shirt: "#378BCC", shirtDetail: "#256AA5", white: "#FFFFFF",
    trousers: "#D7C399", trouserDetail: "#AC956D", shoes: "#80513C", sole: "#4F3830",
  },
};

const c = daniel.colours;
export type Hand = "rest" | "open" | "point";
export function handArt(kind: Hand) {
  if (kind === "point") return `<path d="M-9 -4Q-11 2 -9 11L-6 19Q-4 23 0 21L7 19Q11 16 10 11L9 3 7 -1 7 -20Q7 -24 3 -24Q0 -24 0 -20L-1 0 -5 -6Q-8 -9 -10 -6Z"/><path d="M0 6L8 5M0 11L9 10M0 16L7 15" fill="none" stroke="${c.skinDetail}" stroke-width="1.3"/>`;
  if (kind === "open") return `<path d="M-8 -3L-13 -12Q-15 -16 -12 -18Q-9 -20 -7 -15L-3 -7 -6 -24Q-7 -29 -3 -30Q0 -31 1 -26L4 -10 4 -30Q4 -34 8 -34Q11 -34 11 -30L11 -10 14 -26Q15 -30 18 -29Q21 -28 20 -24L17 -6 22 -18Q24 -22 27 -20Q30 -19 28 -15L22 4Q20 18 9 20Q-4 20 -8 7Z"/><path d="M1 7Q8 3 15 5M4 -8L5 -1M11 -8L11 -1M17 -6L16 0" fill="none" stroke="${c.skinDetail}" stroke-width="1.4"/>`;
  return `<path d="M-9 -5L9 -5 11 10Q12 14 9 15L7 15 6 23Q5 27 2 26L0 25Q-3 28 -5 25L-7 22Q-10 23 -11 19L-13 8Q-14 4 -11 2L-9 4Z"/><path d="M-6 10L-5 21M0 11V24M6 10L5 22" fill="none" stroke="${c.skinDetail}" stroke-width="1.3"/>`;
}

export function headArt(expression: "smile" | "thinking" = "smile", gaze = 0) {
  return `<g data-part="head">
  <path d="M-31 -18Q-44 -25 -42 -12Q-41 2 -31 1M31 -18Q44 -25 42 -12Q41 2 31 1" fill="${c.skin}"/>
  <path d="M-34 -42Q-32 -66 0 -67Q32 -66 34 -42L33 -10Q31 12 15 22Q0 29 -15 22Q-31 12 -33 -10Z" fill="${c.skin}"/>
  <path d="M-33 -17L-38 -42Q-42 -69 -22 -74Q-7 -88 14 -79Q34 -80 39 -60Q41 -46 33 -17L27 -42Q8 -42 1 -55Q-13 -42 -28 -44L-29 -18Z" fill="${c.hair}"/>
  <path d="M-27 -58Q-10 -72 12 -65M-17 -66Q2 -75 22 -64" stroke="${c.hairDetail}" stroke-width="2.5" fill="none"/>
  <path d="M-29 -7Q-34 -9 -36 -16M29 -7Q34 -9 36 -16" stroke="${c.skinDetail}" fill="none" stroke-width="1.6"/>
  <g data-part="eyes"><ellipse cx="-15" cy="-24" rx="10" ry="9" fill="${c.white}" stroke="none"/><ellipse cx="15" cy="-24" rx="10" ry="9" fill="${c.white}" stroke="none"/>
  <g transform="translate(${gaze} 0)"><ellipse cx="-14" cy="-23" rx="4.5" ry="6" fill="${c.hair}" stroke="none"/><ellipse cx="16" cy="-23" rx="4.5" ry="6" fill="${c.hair}" stroke="none"/><circle cx="-15" cy="-25" r="1.5" fill="${c.white}" stroke="none"/><circle cx="15" cy="-25" r="1.5" fill="${c.white}" stroke="none"/></g></g>
  <g data-part="glasses" fill="none" stroke="${c.ink}" stroke-width="2.8"><rect x="-31" y="-36" width="28" height="24" rx="8"/><rect x="3" y="-36" width="28" height="24" rx="8"/><path d="M-3 -27Q0 -30 3 -27M-36 -31L-31 -28M31 -28L36 -31"/></g>
  <path d="M-24 -43Q-16 -47 -8 -43M8 -43Q16 -${expression === "thinking" ? 43 : 47} 24 -${expression === "thinking" ? 47 : 43}" fill="none" stroke="${c.hair}" stroke-width="3"/>
  <path d="M1 -22L-2 -7Q2 -4 7 -8" stroke="${c.skinDetail}" fill="none" stroke-width="1.8"/>
  ${expression === "smile" ? `<path data-part="mouth" d="M-13 4Q0 10 13 4Q9 17 0 17Q-9 17 -13 4Z" fill="${c.white}" stroke-width="1.6"/><path d="M-10 8Q0 12 10 8" stroke="${c.skinDetail}" stroke-width="1" fill="none"/>` : `<path data-part="mouth" d="M-8 9Q1 13 10 7" fill="none" stroke-width="2.2"/>`}
  </g>`;
}

export function torsoArt() {
  return `<g data-part="torso"><path d="M-13 -39H13V-17Q0 -7 -13 -17Z" fill="${c.skin}"/>
  <path d="M-15 -22L-35 -15Q-43 -8 -40 7L-31 28 -28 105Q0 113 28 105L31 28 40 7Q43 -8 35 -15L15 -22 0 -10Z" fill="${c.shirt}"/>
  <path d="M-15 -22L0 -10 -9 3 -24 -16ZM15 -22L0 -10 9 3 24 -16Z" fill="${c.shirt}"/>
  <path d="M0 -10V26M-28 31L-26 99M28 31L26 99" fill="none" stroke="${c.shirtDetail}" stroke-width="1.8"/>
  <circle cx="1" cy="10" r="1.5" fill="${c.white}" stroke="none"/><circle cx="1" cy="21" r="1.5" fill="${c.white}" stroke="none"/>
  <path d="M12 20H26V33Q19 41 12 33Z" fill="none" stroke="${c.shirtDetail}" stroke-width="1.6"/>
  <path d="M-28 103Q0 110 28 103L28 118H-28Z" fill="${c.trousers}"/><path d="M-26 110H26" stroke="${c.trouserDetail}" stroke-width="3"/><rect x="-4" y="107" width="8" height="6" rx="1" fill="${c.shoes}"/>
  </g>`;
}

export function armArt(upper: number, lower: number, kind: Hand, id: string) {
  return `<g data-part="${id}" transform="rotate(${upper})"><path d="M-12 -3Q0 -9 12 -3L9 48Q0 54 -9 48Z" fill="${c.skin}"/><path d="M-14 -5Q0 -14 14 -5L12 20Q0 25 -12 20Z" fill="${c.shirt}"/><path d="M-11 19Q0 23 11 19" stroke="${c.shirtDetail}" stroke-width="1.7" fill="none"/>
  <g data-part="${id}-forearm" transform="translate(0 49) rotate(${lower})"><path d="M-9 -4Q0 -9 9 -4L7 45 -7 45Z" fill="${c.skin}"/><g data-part="${id}-hand" transform="translate(0 46) rotate(${kind === "open" ? 180 : 0})" fill="${c.skin}">${handArt(kind)}</g></g></g>`;
}

export function legArt(upper: number, knee: number, id: string) {
  return `<g data-part="${id}" transform="rotate(${upper})"><path d="M-14 -6Q0 -11 14 -6L11 68Q0 74 -11 68Z" fill="${c.trousers}"/><path d="M8 4L7 59" fill="none" stroke="${c.trouserDetail}" stroke-width="1.5"/>
  <g data-part="${id}-shin" transform="translate(0 70) rotate(${knee})"><path d="M-11 -5Q0 -9 11 -5L9 67H-9Z" fill="${c.trousers}"/><path d="M6 6L6 61M-9 62H9" fill="none" stroke="${c.trouserDetail}" stroke-width="1.5"/>
  <g data-part="${id}-shoe" transform="translate(0 70) rotate(${-upper-knee})"><path d="M-10 -7L8 -7Q12 -3 21 -2Q29 0 28 7H-12L-12 0Z" fill="${c.shoes}"/><path d="M-12 5H28V10H-12Z" fill="${c.sole}"/><path d="M4 -3L12 0M1 0L10 2" stroke="${c.trouserDetail}" stroke-width="1.5" fill="none"/></g></g></g>`;
}