import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RecognitionCardList, {
  type RecognizedPersonItem,
} from "../components/camera/RecognitionCardList";

describe("RecognitionCardList component", () => {
  it("renders empty state message when items list is empty", () => {
    render(<RecognitionCardList items={[]} emptyMessage="No faces detected in view." />);
    expect(screen.getByText("No faces detected in view.")).toBeInTheDocument();
  });

  it("renders default empty state when emptyMessage is not supplied", () => {
    render(<RecognitionCardList items={[]} />);
    expect(
      screen.getByText("No recognized faces yet in this session.")
    ).toBeInTheDocument();
  });

  it("renders recognized attendees with confidence, time, and match badges", () => {
    const mockItems: RecognizedPersonItem[] = [
      {
        azure_person_id: "person-1",
        name: "Alice Johnson",
        confidence: 0.942,
        already_marked: false,
        time: "10:15 AM",
      },
      {
        azure_person_id: "person-2",
        name: "Bob Smith",
        confidence: 0.885,
        already_marked: true,
        time: "10:16 AM",
      },
    ];

    render(<RecognitionCardList items={mockItems} />);

    // Check names
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();

    // Check timestamps
    expect(screen.getByText("10:15 AM")).toBeInTheDocument();
    expect(screen.getByText("10:16 AM")).toBeInTheDocument();

    // Check confidence display
    expect(screen.getByText("94.2% match")).toBeInTheDocument();
    expect(screen.getByText("88.5% match")).toBeInTheDocument();

    // Check badge states
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Already Marked")).toBeInTheDocument();

    // Check initials avatar
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("BO")).toBeInTheDocument();
  });
});
