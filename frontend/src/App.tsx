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
import { RateCards } from "./pages/admin/RateCards";
import { ClientRateCards } from "./pages/admin/ClientRateCards";
import { CashReconciliation } from "./pages/CashReconciliation";
import { CarrierRemittance } from "./pages/admin/CarrierRemittance";
import { ClientLedger } from "./pages/admin/ClientLedger";
import { WeightDiscrepancies } from "./pages/WeightDiscrepancies";
import { ShipmentDetail } from "./pages/ShipmentDetail";
import { NdrQueue } from "./pages/NdrQueue";
import { Exceptions } from "./pages/Exceptions";
import { Invoices } from "./pages/admin/Invoices";
import { VendorReconciliation } from "./pages/admin/VendorReconciliation";
import { CreateReversePickup } from "./pages/CreateReversePickup";
import { DtoRequests } from "./pages/DtoRequests";
import { ClientApiKeys } from "./pages/admin/ClientApiKeys";
import { UnicommerceCredentials } from "./pages/admin/UnicommerceCredentials";

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
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
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
            <Route
              path="/admin/rate-cards"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
                  <RateCards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/client-rate-cards"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
                  <ClientRateCards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cash-reconciliation"
              element={
                <ProtectedRoute>
                  <CashReconciliation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/carrier-remittance"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
                  <CarrierRemittance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/client-ledger"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
                  <ClientLedger />
                </ProtectedRoute>
              }
            />
            <Route
              path="/weight-discrepancies"
              element={
                <ProtectedRoute>
                  <WeightDiscrepancies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipments/:id"
              element={
                <ProtectedRoute>
                  <ShipmentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ndr-queue"
              element={
                <ProtectedRoute>
                  <NdrQueue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exceptions"
              element={
                <ProtectedRoute>
                  <Exceptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/invoices"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/vendor-reconciliation"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounts_ops"]}>
                  <VendorReconciliation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-reverse-pickup"
              element={
                <ProtectedRoute>
                  <CreateReversePickup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dto-requests"
              element={
                <ProtectedRoute>
                  <DtoRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/client-api-keys"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ClientApiKeys />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/unicommerce-credentials"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UnicommerceCredentials />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
