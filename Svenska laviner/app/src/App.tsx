import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RegionList from "./pages/RegionList";
import RegionDetail from "./pages/RegionDetail";
import SafetyGuide from "./pages/SafetyGuide";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import ObservationsPage from "./pages/ObservationsPage";
import ToursPage from "./pages/ToursPage";
import AdminPage from "./pages/AdminPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import PageLoading from "./components/PageLoading";
import "./App.css";

// Leaflet + react-leaflet + leaflet-relief are only needed on this one route
// (~180KB gzipped) — split it out so everyone else's first load skips them.
const MapPage = lazy(() => import("./pages/MapPage"));
// Also Leaflet-heavy (location picker).
const NewObservationPage = lazy(() => import("./pages/NewObservationPage"));
// Leaflet (track map) and, for FIT files, Garmin's FIT SDK.
const NewTourPage = lazy(() => import("./pages/NewTourPage"));
const TourPage = lazy(() => import("./pages/TourPage"));

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
        <Route path="/observationer" element={<ObservationsPage />} />
        <Route
          path="/observationer/ny"
          element={
            <Suspense fallback={<PageLoading />}>
              <NewObservationPage />
            </Suspense>
          }
        />
        <Route path="/turer" element={<ToursPage />} />
        <Route
          path="/turer/ny"
          element={
            <Suspense fallback={<PageLoading />}>
              <NewTourPage />
            </Suspense>
          }
        />
        <Route
          path="/turer/:id"
          element={
            <Suspense fallback={<PageLoading />}>
              <TourPage />
            </Suspense>
          }
        />
        <Route path="/logga-in" element={<LoginPage />} />
        <Route path="/registrera" element={<RegisterPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/glomt-losenord" element={<ForgotPasswordPage />} />
        <Route path="/aterstall-losenord" element={<ResetPasswordPage />} />
        <Route path="/verifiera" element={<VerifyEmailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
