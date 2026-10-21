import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import TodayPage from "./pages/TodayPage";
import RegionDetail from "./pages/RegionDetail";
import OfflinePage from "./pages/OfflinePage";
import ObservationsPage from "./pages/ObservationsPage";
import ToursPage from "./pages/ToursPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";

// The start page, area pages, the main lists, log-in and the offline page
// load with the app; every other page is fetched when first opened (the
// service worker keeps them all for offline use). Leaflet in particular
// (map, location picker, track map) stays out of the first load. Layout
// shows PageLoading while a page loads.
const SeasonPage = lazy(() => import("./pages/SeasonPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const SafetyGuide = lazy(() => import("./pages/SafetyGuide"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const PressPage = lazy(() => import("./pages/PressPage"));
const NewObservationPage = lazy(() => import("./pages/NewObservationPage"));
const QuickObservationPage = lazy(() => import("./pages/QuickObservationPage"));
const HealthImportPage = lazy(() => import("./pages/HealthImportPage"));
const NewTourPage = lazy(() => import("./pages/NewTourPage"));
const TourPage = lazy(() => import("./pages/TourPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const PersonPage = lazy(() => import("./pages/PersonPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SharePositionPage = lazy(() => import("./pages/SharePositionPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminStatsPage = lazy(() => import("./pages/AdminStatsPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/omrade/:id" element={<RegionDetail />} />
        <Route path="/omrade/:id/sasong" element={<SeasonPage />} />
        <Route path="/karta" element={<MapPage />} />
        <Route path="/sakerhetsguide" element={<SafetyGuide />} />
        <Route path="/om-appen" element={<AboutPage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="/press" element={<PressPage />} />
        <Route path="/observationer" element={<ObservationsPage />} />
        <Route path="/observationer/ny" element={<NewObservationPage />} />
        <Route path="/observationer/snabb" element={<QuickObservationPage />} />
        <Route path="/turer" element={<ToursPage />} />
        <Route path="/turer/halsa" element={<HealthImportPage />} />
        <Route path="/turer/ny" element={<NewTourPage />} />
        <Route path="/turer/:id" element={<TourPage />} />
        <Route path="/flode" element={<FeedPage />} />
        <Route path="/person/:id" element={<PersonPage />} />
        <Route path="/notiser" element={<NotificationsPage />} />
        <Route path="/dela-position" element={<SharePositionPage />} />
        <Route path="/logga-in" element={<LoginPage />} />
        <Route path="/registrera" element={<RegisterPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/oversikt" element={<AdminStatsPage />} />
        <Route path="/glomt-losenord" element={<ForgotPasswordPage />} />
        <Route path="/aterstall-losenord" element={<ResetPasswordPage />} />
        <Route path="/verifiera" element={<VerifyEmailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
