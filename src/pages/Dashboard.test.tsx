import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "director@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollTo = vi.fn();
});
afterEach(cleanup);

it("retains the Director draft through navigation and a fresh page load", async () => {
  const first = render(<MemoryRouter initialEntries={["/dashboard/director"]}><Dashboard /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Shot description"), { target: { value: "Astronaut crossing Mars" } });
  fireEvent.change(screen.getByLabelText("Start frame (required)"), { target: { value: "https://example.com/start.png" } });
  fireEvent.change(screen.getByLabelText("End frame (required)"), { target: { value: "https://example.com/end.png" } });
  fireEvent.change(screen.getByLabelText("Dialogue"), { target: { value: "We made it." } });
  fireEvent.change(screen.getByText("Length").closest("label")?.querySelector("select") as HTMLSelectElement, { target: { value: "15" } });
  fireEvent.click(screen.getAllByRole("link", { name: "Sequence" })[0]);
  fireEvent.change(await screen.findByLabelText("GPU pool rate"), { target: { value: "3.75" } });
  fireEvent.click(screen.getAllByRole("link", { name: "Director" })[0]);
  expect(screen.getByLabelText("Shot description")).toHaveValue("Astronaut crossing Mars");
  await waitFor(() => expect(JSON.parse(localStorage.getItem("vidforge_project_state_v1") || "{}").poolRate).toBe(3.75));
  first.unmount();
  render(<MemoryRouter initialEntries={["/dashboard/director"]}><Dashboard /></MemoryRouter>);
  expect(await screen.findByLabelText("Shot description")).toHaveValue("Astronaut crossing Mars");
  expect(screen.getByLabelText("Start frame (required)")).toHaveValue("https://example.com/start.png");
  expect(screen.getByLabelText("End frame (required)")).toHaveValue("https://example.com/end.png");
  expect(screen.getByLabelText("Dialogue")).toHaveValue("We made it.");
});

it("opens Script without the retired Title step and persists script edits", async () => {
  localStorage.setItem("vidforge_project_state_v1", JSON.stringify({ scriptSections: [{ section: "Opening", text: "Old scene" }] }));
  const first = render(<MemoryRouter initialEntries={["/dashboard"]}><Dashboard /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Title / topic"), { target: { value: "A journey home" } });
  fireEvent.change(screen.getByLabelText("Script section 1"), { target: { value: "The traveler arrives at dawn." } });
  first.unmount();
  render(<MemoryRouter initialEntries={["/dashboard/script"]}><Dashboard /></MemoryRouter>);
  expect(await screen.findByLabelText("Title / topic")).toHaveValue("A journey home");
  expect(screen.getByLabelText("Script section 1")).toHaveValue("The traveler arrives at dawn.");
});