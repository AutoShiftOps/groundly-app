
// @ts-expect-error React DOM client types are unavailable in this project.
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// @ts-expect-error CSS is bundled by the build tool and has no TypeScript declarations.
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
