import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RegionList from "./pages/RegionList";
import RegionDetail from "./pages/RegionDetail";
import SafetyGuide from "./pages/SafetyGuide";
import AboutPage from "./pages/AboutPage";
import MapPage from "./pages/MapPage";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<RegionList />} />
        <Route path="/omrade/:id" element={<RegionDetail />} />
        <Route path="/karta" element={<MapPage />} />
        <Route path="/sakerhetsguide" element={<SafetyGuide />} />
        <Route path="/om-appen" element={<AboutPage />} />
      </Route>
    </Routes>
  );
}

export default App;
