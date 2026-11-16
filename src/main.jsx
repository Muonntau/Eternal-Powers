import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "./offline.js";

async function boot() {
  const classic = new URLSearchParams(location.search).get("legacy") === "1";
  let App;
  if (classic) {
    const modules = await Promise.all([
      import("./App.jsx"),
      import("./styles.css"),
      import("./v2.css"),
    ]);
    App = modules[0].default;
  } else {
    App = (await import("./reborn/RebornApp.jsx")).default;
  }
  createRoot(document.getElementById("root")).render(<App />);
}
boot();
