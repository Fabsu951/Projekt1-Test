import { describe, expect, it } from "vitest";
import { packageOf } from "../vite.config";

describe("the open-source licence list", () => {
  it("knows which package a bundled file comes from", () => {
    expect(packageOf("/repo/app/node_modules/leaflet/dist/leaflet-src.js")).toBe("leaflet");
    expect(packageOf("/repo/app/node_modules/@capacitor/core/dist/index.js")).toBe("@capacitor/core");
    expect(packageOf("/repo/app/node_modules/firebase/node_modules/@firebase/app/dist/x.js")).toBe("@firebase/app");
    expect(packageOf("/repo/app/src/main.tsx")).toBeNull();
  });
});
