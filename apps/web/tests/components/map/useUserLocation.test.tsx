import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCATION_CHOICE_KEY, useUserLocation } from "@/components/map/useUserLocation";

function Probe() {
  const { location, request } = useUserLocation();
  return (
    <>
      <p data-testid="status">{location.status}</p>
      <button type="button" onClick={request}>
        Locate me
      </button>
    </>
  );
}

const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) =>
  success({ coords: { latitude: -33.86, longitude: 151.21 } } as GeolocationPosition),
);
function setBrowser(permission?: PermissionState) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: permission ? { query: vi.fn(async () => ({ state: permission })) } : undefined,
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
  Reflect.deleteProperty(navigator, "permissions");
  getCurrentPosition.mockClear();
});

describe("useUserLocation", () => {
  it("never asks on open and calls the browser only after Locate me", async () => {
    setBrowser("prompt");
    render(<Probe />);
    await act(async () => {});
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByTestId("status").textContent).toBe("idle");

    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(screen.getByTestId("status").textContent).toBe("success");
    expect(localStorage.getItem(LOCATION_CHOICE_KEY)).toBe("allowed");

    expect(JSON.stringify({ ...localStorage })).not.toMatch(/151\.21/);
  });

  it("shows the position without asking when an earlier tap is still granted", async () => {
    setBrowser("granted");
    localStorage.setItem(LOCATION_CHOICE_KEY, "allowed");
    render(<Probe />);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledOnce());
  });

  it("does not call the browser on open when permission was reset after an earlier tap", async () => {
    setBrowser("prompt");
    localStorage.setItem(LOCATION_CHOICE_KEY, "allowed");
    render(<Probe />);
    await act(async () => {});
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
