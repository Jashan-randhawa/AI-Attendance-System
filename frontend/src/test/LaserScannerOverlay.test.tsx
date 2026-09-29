import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LaserScannerOverlay from "../components/camera/LaserScannerOverlay";

describe("LaserScannerOverlay component", () => {
  it("renders null when scanning is false", () => {
    const { container } = render(<LaserScannerOverlay scanning={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders scanner overlay when scanning is true", () => {
    const { container } = render(<LaserScannerOverlay scanning={true} />);
    expect(container.firstChild).not.toBeNull();
    const beam = container.querySelector(".animate-laser-scan");
    expect(beam).not.toBeNull();
  });
});
