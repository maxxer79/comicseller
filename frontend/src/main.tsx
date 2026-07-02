import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth";
import "./styles.css";
import "./theme.css";

const savedTheme =
  localStorage.getItem("comicseller.theme") ||
  (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.dataset.theme = savedTheme;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
