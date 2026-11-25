import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import FormatStudio from "./FormatStudio";

vi.mock("@/contexts/AuthContext", () => ({useAuth: () => ({user:{id:"test-editor"}})}));
vi.mock("./AnimateImage", () => ({default: () => null}));

it("opens Character Animation, edits the sequence, and restores it on return", () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  render(<MemoryRouter><FormatStudio/></MemoryRouter>);
  const open = () => fireEvent.click(screen.getByRole("button", {name:/Character Animation/}));
  open();
  fireEvent.click(screen.getByRole("button",{name:"Recorded actions"}));
  fireEvent.click(screen.getByRole("button", {name:"+ Wave"}));
  expect(screen.getByText("Sequence · 8s")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Earlier"}));
  expect(screen.getByText("1. Wave")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Explainer formats"}));
  open();
  fireEvent.click(screen.getByRole("button",{name:"Recorded actions"}));
  expect(screen.getByText("1. Wave")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Remove"}));
  expect(screen.getByText("Sequence · 5s")).toBeInTheDocument();
});
