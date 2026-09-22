import { Route, Routes } from "react-router-dom";
import RegionList from "./pages/RegionList";
import RegionDetail from "./pages/RegionDetail";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RegionList />} />
      <Route path="/omrade/:id" element={<RegionDetail />} />
    </Routes>
  );
}

export default App;
