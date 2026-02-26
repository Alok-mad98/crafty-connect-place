import { BrowserRouter, Routes, Route } from "react-router-dom";
import CinematicBackground from "@/components/CinematicBackground";
import Navbar from "@/components/Navbar";
import MasterAIChat from "@/components/MasterAIChat";
import Index from "@/pages/Index";
import Forge from "@/pages/Forge";
import Vault from "@/pages/Vault";
import NotFound from "@/pages/NotFound";

const App = () => (
  <BrowserRouter>
    <div className="font-sans antialiased bg-bg text-fg min-h-screen overflow-x-hidden">
      <CinematicBackground />
      <Navbar />
      <main className="relative z-10 pt-14">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/forge" element={<Forge />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <MasterAIChat />
    </div>
  </BrowserRouter>
);

export default App;