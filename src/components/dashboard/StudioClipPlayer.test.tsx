import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StudioClipPlayer from "./StudioClipPlayer";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Studio playback recovery", () => {
  it("retries loading the same saved clip after a media error", () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    render(<StudioClipPlayer videoUrl="https://example.com/saved.mp4" shot={1} saved />);
    const video = screen.getByLabelText("Shot 1");
    fireEvent.error(video);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open video in new tab" })).toHaveAttribute("href", "https://example.com/saved.mp4");
    fireEvent.click(screen.getByRole("button", { name: "Retry playback" }));
    expect(load).toHaveBeenCalledOnce();
    expect(video).toHaveAttribute("src", "https://example.com/saved.mp4");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});