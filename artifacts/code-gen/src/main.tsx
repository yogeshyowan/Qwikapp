import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./components/theme-provider";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Attach JWT to every generated API-client request
setAuthTokenGetter(() => localStorage.getItem("qwikide_auth_token"));

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
