import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Landing } from "./landing"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
