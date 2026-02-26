import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import CinematicBackground from "@/components/CinematicBackground";
import Navbar from "@/components/Navbar";
import MasterAIChat from "@/components/MasterAIChat";
import Home from "@/pages/Home";
import Vault from "@/pages/Vault";
import Forge from "@/pages/Forge";

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="font-sans antialiased bg-navy text-white min-h-screen overflow-x-hidden">
          <CinematicBackground />
          <Navbar />
          <main className="relative z-10 pt-16">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/forge" element={<Forge />} />
            </Routes>
          </main>
          <MasterAIChat />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
