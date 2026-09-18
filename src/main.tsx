import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startEmbedLog } from "./bridge/embedLog";
import "./index.css";

startEmbedLog();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
