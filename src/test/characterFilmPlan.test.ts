import {expect,it} from "vitest";
import {planCharacterFilm,stitchInputs} from "../../supabase/functions/_shared/characterFilmPlan";

it("covers every supported duration with ordered, stitchable chapters and no padded paid footage",()=>{
  for(let seconds=30;seconds<=1800;seconds++){
    const film=planCharacterFilm(seconds);
    const shots=film.chapters.flatMap(c=>c.shots);
    if(shots.some((s,i)=>s.index!==i || s.start!==10*i || s.duration<1 || s.duration>10)
      || shots.reduce((t,s)=>t+s.duration,0)!==seconds
      || film.chapters.some(c=>c.shots.length<2 || c.shots.length>12)) throw Error("Invalid plan at "+seconds);
  }
  expect(planCharacterFilm(31).chapters[0].shots.at(-1)?.duration).toBe(1);
  expect(planCharacterFilm(1800)).toMatchObject({shotCount:180,estimatedUsd:9});
  expect(planCharacterFilm(600).estimatedUsd).toBe(3);
  for(const invalid of [0,29,30.5,1801,NaN]) expect(()=>planCharacterFilm(invalid)).toThrow();
});
it("assembles in story order after out-of-order completion and refuses missing clips",()=>{
  const saved=new Map([[7,"https://example.com/b"],[6,"https://example.com/a"]]);
  expect(stitchInputs([7,6],saved)).toEqual([{url:saved.get(6),shot_index:0},{url:saved.get(7),shot_index:1}]);
  expect(()=>stitchInputs([6,8],saved)).toThrow();
});
