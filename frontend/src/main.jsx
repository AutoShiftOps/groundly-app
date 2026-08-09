import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initGA4, trackPageview } from "./lib/ga4";

initGA4();
trackPageview(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
