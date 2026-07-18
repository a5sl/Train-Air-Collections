import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AddTrip from "./pages/AddTrip";
import TripList from "./pages/TripList";
import MapView from "./pages/MapView";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="add" element={<AddTrip />} />
        <Route path="trips" element={<TripList />} />
        <Route path="map" element={<MapView />} />
      </Route>
    </Routes>
  );
}
