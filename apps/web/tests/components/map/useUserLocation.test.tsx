import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationPrompt } from "@/components/map/LocationPrompt";
import { LOCATION_CHOICE_KEY, useUserLocation } from "@/components/map/useUserLocation";

function Probe() {
  const { asking, allow, dismiss, location } = useUserLocation();
  return (
    <>
      <p data-testid="status">{location.status}</p>
      {asking && <LocationPrompt onAllow={allow} onDismiss={dismiss} />}
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

const prompt = () => screen.queryByRole("region", { name: "Show where you are on the map?" });

describe("useUserLocation", () => {
  it("asks in the app on open and calls the browser only after Allow location", async () => {
    setBrowser("prompt");
    render(<Probe />);
    await waitFor(() => expect(prompt()).not.toBeNull());
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Allow location" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(prompt()).toBeNull();
    expect(screen.getByTestId("status").textContent).toBe("success");
    expect(localStorage.getItem(LOCATION_CHOICE_KEY)).toBe("allowed");
    // The position itself is never stored.
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/151\.21/);
  });

  it("remembers Not now and does not ask again", async () => {
    setBrowser("prompt");
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(prompt()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(prompt()).toBeNull();
    expect(localStorage.getItem(LOCATION_CHOICE_KEY)).toBe("dismissed");
    unmount();

    render(<Probe />);
    await act(async () => {});
    expect(prompt()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("shows the position without asking when an earlier Allow is still granted", async () => {
    setBrowser("granted");
    localStorage.setItem(LOCATION_CHOICE_KEY, "allowed");
    render(<Probe />);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledOnce());
    expect(prompt()).toBeNull();
  });

  it("asks again, without calling the browser, when permission was reset after an Allow", async () => {
    setBrowser("prompt");
    localStorage.setItem(LOCATION_CHOICE_KEY, "allowed");
    render(<Probe />);
    await waitFor(() => expect(prompt()).not.toBeNull());
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("does not ask when the browser already blocks location", async () => {
    setBrowser("denied");
    render(<Probe />);
    await act(async () => {});
    expect(prompt()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
