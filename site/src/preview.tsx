import "./styles.css"
import type { Decorator } from "stageboard"

export const decorators: Decorator[] = [(Story) => <div className="bg-ink-900 font-sans text-fg antialiased"><Story /></div>]
