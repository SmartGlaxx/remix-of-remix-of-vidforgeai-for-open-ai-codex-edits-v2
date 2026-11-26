import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,expect,it,vi} from "vitest";
import FormatStudio from "./FormatStudio";
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:{id:"viewer"}})}));
const insert=vi.hoisted(()=>vi.fn(async()=>({error:null})));
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:()=>({
  insert, select:()=>({eq:()=>({eq:()=>({order:()=>({limit:async()=>({data:[]})})})})})
})}}));
afterEach(cleanup);
it("queues the chosen type, topic and runtime without collecting artwork or opening an editor",async()=>{
  render(<MemoryRouter><FormatStudio/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Video type"),{target:{value:"whiteboard"}});
  fireEvent.change(screen.getByLabelText("Topic"),{target:{value:"What is inflation?"}});
  fireEvent.change(screen.getByLabelText("Length"),{target:{value:"180"}});
  fireEvent.click(screen.getByRole("button",{name:"Generate video"}));
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({format:"whiteboard",topic:"What is inflation?",seconds:180,host:"none"}));
});
