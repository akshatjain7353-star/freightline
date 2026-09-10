import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth-context";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Shipments } from "./pages/Shipments";
import { CreateShipment } from "./pages/CreateShipment";
import { RateCalculator } from "./pages/RateCalculator";
import { BulkUpload } from "./pages/BulkUpload";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipments"
              element={
                <ProtectedRoute>
                  <Shipments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-shipment"
              element={
                <ProtectedRoute>
                  <CreateShipment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rate-calculator"
              element={
                <ProtectedRoute>
                  <RateCalculator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulk-upload"
              element={
                <ProtectedRoute>
                  <BulkUpload />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
