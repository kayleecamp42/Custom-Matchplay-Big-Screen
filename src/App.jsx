import { BrowserRouter, Routes, Route } from "react-router-dom";
import Launcher from "./pages/launcher/Launcher.jsx";
import Checkin from "./pages/checkin/Checkin.jsx";
import Wallboard from "./pages/wallboard/Wallboard.jsx";
import Finals from "./pages/finals/Finals.jsx";
import DevToolsModal from "./components/DevToolsModal.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Launcher />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/wallboard" element={<Wallboard />} />
        <Route path="/finals" element={<Finals />} />
      </Routes>
      <DevToolsModal />
    </BrowserRouter>
  );
}
