import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Auth from "./pages/Auth.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DocumentManager from "./pages/DocumentManager.jsx";
import './index.css';

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth/>} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/document"
        element={
          <ProtectedRoute>
            <DocumentManager/>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
