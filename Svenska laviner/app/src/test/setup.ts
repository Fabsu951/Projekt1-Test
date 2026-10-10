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

// The app picks English for non-Scandinavian browsers (jsdom says en-US); tests read the Swedish texts.
localStorage.setItem("fjallkoll:language", "sv");
