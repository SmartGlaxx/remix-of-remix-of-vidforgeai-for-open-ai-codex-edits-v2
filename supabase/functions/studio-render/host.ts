// Artwork is separate from the existing joint hierarchy and world-space gait.
const palette = { ink: "#29333e", skin: "#d99a73", shade: "#bc7957", hair: "#343039", shirt: "#3096a3", shirtShade: "#237380", collar: "#d5ece9", pants: "#48546b", pantsShade: "#364256", shoe: "#333a48", sole: "#e3e6e8", eye: "#fffaf4" };
const p = palette;

function hand(id: string) {
  return `<g><path d="M-7 -4Q-12 -2 -11 5L-9 15Q-8 20 -5 18L-5 9 -3 20Q0 23 2 20L2 10 5 18Q8 20 9 16L8 5Q14 7 14 2Q13 -2 8 -5L7 -9 -6 -9Z" fill="${p.skin}" stroke="${p.shade}" stroke-width="1.2"/>
  ${id === "rightArm" ? `<path id="finger" d="M2 6L2 27Q2 31 6 31Q10 31 10 27L9 6Z" fill="${p.skin}" stroke="${p.shade}" stroke-width="1.2" opacity="0"/>` : ""}</g>`;
}

function limb(id: string, leg: boolean) {
  const length = leg ? 60 : 38;
  const upper = leg
    ? `<path d="M-14 -9Q0 -13 14 -8L11 57Q0 66 -11 57Z" fill="${p.pants}"/><path d="M9 -4L7 55" stroke="${p.pantsShade}" stroke-width="3"/>`
    : `<path d="M-12 -7Q0 -14 12 -6L9 37Q0 44 -9 37Z" fill="${p.skin}"/><path d="M-14 -8Q0 -16 14 -7L13 17Q0 23 -13 17Z" fill="${p.shirt}"/><path d="M-12 17Q0 21 12 17" stroke="${p.shirtShade}" stroke-width="2"/>`;
  const lower = leg
    ? `<path d="M-11 -7Q0 -10 11 -6L9 58 -9 58Z" fill="${p.pants}"/><path d="M7 5L6 55" stroke="${p.pantsShade}" stroke-width="2"/><path d="M-9 55H9" stroke="${p.pantsShade}" stroke-width="4"/>`
    : `<path d="M-9 -6Q0 -11 9 -5L7 35Q0 41 -7 35Z" fill="${p.skin}"/><path d="M-7 4L-5 30" stroke="${p.shade}" stroke-width="1.5"/>`;
  const tip = leg
    ? `<path d="M-10 -3L8 -3Q12 0 18 1L24 5Q28 11 21 12H-11L-12 5Z" fill="${p.shoe}"/><path d="M-11 10H23" stroke="${p.sole}" stroke-width="3"/><path d="M6 1L12 3M3 4L10 6" stroke="${p.sole}" stroke-width="1.5"/>`
    : hand(id);
  return `<g id="${id}">${upper}<g transform="translate(0 ${length})"><g id="${id}Lower">${lower}<g transform="translate(0 ${length})"><g id="${id}Tip">${tip}</g></g></g></g></g>`;
}

function shoulder(id: string, x: number, arm: string) {
  return `<g id="${id}"><g transform="translate(${x} -24)">${limb(arm, false)}</g></g>`;
}

export const cartoonHost = `<g id="host"><g id="hostScale"><g id="body" transform="translate(0 -173)" stroke="none">
<g transform="translate(-17 53)">${limb("leftLeg", true)}</g><g transform="translate(17 53)">${limb("rightLeg", true)}</g>
${shoulder("shL", -35, "leftArm")}
<g id="torso"><path d="M-17 -43L-34 -34Q-43 -28 -39 -12L-30 23 -30 55Q0 62 30 55L30 23 40 -12Q43 -28 33 -34L17 -43Z" fill="${p.shirt}"/>
<path d="M-29 13L-27 51M29 14L27 51" stroke="${p.shirtShade}" stroke-width="2"/><path d="M-30 54Q0 61 30 54L30 62H-30Z" fill="${p.pantsShade}"/>
<path d="M-12 -57H12V-36Q0 -23 -12 -36Z" fill="${p.skin}"/><path d="M-12 -50Q0 -41 12 -50V-43Q0 -34 -12 -43Z" fill="${p.shade}"/>
<path d="M-13 -40L0 -29 -9 -18 -22 -33ZM13 -40L0 -29 9 -18 22 -33Z" fill="${p.collar}"/><path d="M0 -28V-9" stroke="${p.shirtShade}" stroke-width="3"/><circle cx="2" cy="-18" r="1.5" fill="${p.collar}"/>
<path d="M16 -6H29V8Q22 14 16 8Z" fill="${p.shirtShade}"/></g>
<g id="head"><ellipse cx="-29" cy="-80" rx="7" ry="11" fill="${p.skin}"/><ellipse cx="29" cy="-80" rx="7" ry="11" fill="${p.skin}"/>
<path d="M-29 -103Q-25 -124 0 -124Q26 -123 29 -102L27 -73Q24 -58 13 -52Q0 -46 -13 -53Q-26 -60 -28 -76Z" fill="${p.skin}"/>
<path d="M-29 -81L-33 -104Q-34 -124 -21 -127Q-13 -141 8 -135Q35 -135 34 -112L29 -82 24 -102Q10 -103 3 -112Q-7 -102 -23 -105L-24 -82Z" fill="${p.hair}"/>
<path d="M-24 -116Q-8 -130 14 -124" fill="none" stroke="#55505b" stroke-width="3"/>
<g id="face"><g id="eyes"><ellipse cx="-12" cy="-85" rx="8" ry="7" fill="${p.eye}"/><ellipse cx="13" cy="-85" rx="8" ry="7" fill="${p.eye}"/><ellipse cx="-10" cy="-84" rx="4" ry="5" fill="${p.ink}"/><ellipse cx="15" cy="-84" rx="4" ry="5" fill="${p.ink}"/><circle cx="-11" cy="-86" r="1.5" fill="${p.eye}"/><circle cx="14" cy="-86" r="1.5" fill="${p.eye}"/></g>
<path id="brow" d="M-20 -96Q-12 -100 -5 -96M6 -96Q14 -100 21 -96" fill="none" stroke="${p.hair}" stroke-width="3"/>
<path d="M0 -84L-3 -73Q0 -69 5 -73" fill="none" stroke="${p.shade}" stroke-width="2"/>
<path id="mouth" d="M-10 -65Q1 -60 13 -65Q5 -51 -5 -58Z" fill="${p.eye}" stroke="${p.shade}" stroke-width="1.5"/></g></g>
${shoulder("shR", 35, "rightArm")}</g></g></g>`;