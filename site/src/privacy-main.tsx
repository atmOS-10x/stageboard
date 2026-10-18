import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Privacy } from "./privacy"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Privacy />
  </StrictMode>,
)
