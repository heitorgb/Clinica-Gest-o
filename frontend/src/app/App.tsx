import { AuthProvider } from "../features/auth/AuthContext";
import { ThemeProvider } from "../features/settings/ThemeContext";
import { AppRoutes } from "../routes/AppRoutes";

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
