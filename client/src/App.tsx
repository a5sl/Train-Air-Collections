import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AddTrip from "./pages/AddTrip";
import EditTrip from "./pages/EditTrip";
import TripList from "./pages/TripList";
import MapView from "./pages/MapView";
import AnnualReport from "./pages/AnnualReport";
import Catalog from "./pages/Catalog";
import { ToastProvider } from "./components/fx/Toast";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="add" element={<AddTrip />} />
          <Route path="edit/:id" element={<EditTrip />} />
          <Route path="trips" element={<TripList />} />
          <Route path="map" element={<MapView />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="report/:year?" element={<AnnualReport />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}