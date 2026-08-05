import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "../app/globals.css";
import WebGIS from "../app/WebGIS";

const root = document.getElementById("root");

if (!root) throw new Error("Elemen aplikasi tidak ditemukan.");

createRoot(root).render(
  <StrictMode>
    <WebGIS />
  </StrictMode>,
);
