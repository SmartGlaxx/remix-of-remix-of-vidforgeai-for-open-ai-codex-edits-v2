import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect,it,vi } from "vitest";
import ScriptAnimation from "./ScriptAnimation";
import {direct,schedule,hostMarkup} from "./characterScene";
import {renderCharacter} from "./localCharacterRender";
vi.mock("./localCharacterRender",()=>({renderCharacter:vi.fn()}));

it("directs the written script and fits the scene lengths to the supplied audio duration",()=>{
  const beats=direct("Hello. Look at $100. Why does it grow?");
  expect(beats.map(b=>b.action)).toEqual(["Wave","Point","Shrug"]);
  const timeline=schedule(beats,16);
  expect(timeline[0].length).toBe(2);
  expect(timeline[2].start+timeline[2].length).toBe(16);
  expect(hostMarkup("Wave",0)).not.toEqual(hostMarkup("Wave",1));
});

it("saves the gesture edit and exports the selected narration",async()=>{
  vi.mocked(renderCharacter).mockResolvedValue(new Blob(["test"],{type:"video/mp4"}));
  vi.stubGlobal("URL",Object.assign(class {},{createObjectURL:()=>"blob:test",revokeObjectURL:()=>{}}));
  const root=render(<ScriptAnimation storageKey="script-test"/>);
  fireEvent.change(screen.getByLabelText("Narration script"),{target:{value:"Watch the host. Look here."}});
  fireEvent.click(screen.getByText("Create scenes"));
  fireEvent.change(screen.getByLabelText("Scene 2 gesture"),{target:{value:"Shrug"}});
  root.unmount();
  render(<ScriptAnimation storageKey="script-test"/>);
  expect(screen.getByLabelText("Scene 2 gesture")).toHaveValue("Shrug");
  const voice=new File(["voice"],"narration.wav",{type:"audio/wav"});
  fireEvent.change(screen.getByLabelText("Narration audio (optional)"),{target:{files:[voice]}});
  fireEvent.click(screen.getByText("Export character film"));
  expect(await screen.findByText("Download film")).toHaveAttribute("download","character-film.mp4");
  expect(vi.mocked(renderCharacter).mock.calls[0][1]).toBe(voice);
  cleanup(); vi.unstubAllGlobals();
});
