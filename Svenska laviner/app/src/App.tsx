import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RegionList from "./pages/RegionList";
import RegionDetail from "./pages/RegionDetail";
import SafetyGuide from "./pages/SafetyGuide";
import AboutPage from "./pages/AboutPage";
import PageLoading from "./components/PageLoading";
import "./App.css";

// Leaflet + react-leaflet + leaflet-relief are only needed on this one route
// (~180KB gzipped) — split it out so everyone else's first load skips them.
const MapPage = lazy(() => import("./pages/MapPage"));

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<RegionList />} />
        <Route path="/omrade/:id" element={<RegionDetail />} />
        <Route
          path="/karta"
          element={
            <Suspense fallback={<PageLoading />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route path="/sakerhetsguide" element={<SafetyGuide />} />
        <Route path="/om-appen" element={<AboutPage />} />
      </Route>
    </Routes>
  );
}

export default App;
