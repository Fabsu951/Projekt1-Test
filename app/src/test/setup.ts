import "@testing-library/jest-dom/vitest";

if (!("geolocation" in navigator)) {
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: () => {},
      watchPosition: () => {},
      clearWatch: () => {},
    },
    configurable: true,
  });
}
