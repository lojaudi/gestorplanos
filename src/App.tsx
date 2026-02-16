import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedPage from "./components/layout/ProtectedPage";
import Templates from "./pages/Templates";
import Services from "./pages/Services";
import Plans from "./pages/Plans";
import Clients from "./pages/Clients";
import AdminUsers from "./pages/AdminUsers";
import WhatsApp from "./pages/WhatsApp";
import Billing from "./pages/Billing";
import Logs from "./pages/Logs";
import PaymentGateway from "./pages/PaymentGateway";
import PaymentPage from "./pages/PaymentPage";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
            <Route path="/services" element={<ProtectedPage><Services /></ProtectedPage>} />
            <Route path="/plans" element={<ProtectedPage><Plans /></ProtectedPage>} />
            <Route path="/clients" element={<ProtectedPage><Clients /></ProtectedPage>} />
            <Route path="/templates" element={<ProtectedPage><Templates /></ProtectedPage>} />
            <Route path="/whatsapp" element={<ProtectedPage><WhatsApp /></ProtectedPage>} />
            <Route path="/billing" element={<ProtectedPage><Billing /></ProtectedPage>} />
            <Route path="/logs" element={<ProtectedPage><Logs /></ProtectedPage>} />
            <Route path="/payment-gateway" element={<ProtectedPage><PaymentGateway /></ProtectedPage>} />
            <Route path="/profile" element={<ProtectedPage><Profile /></ProtectedPage>} />
            <Route path="/admin/users" element={<ProtectedPage><AdminUsers /></ProtectedPage>} />
            <Route path="/pay" element={<PaymentPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
