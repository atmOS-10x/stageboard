import "./styles.css"
import type { Decorator } from "stageboard"

export const decorators: Decorator[] = [(Story) => <div className="font-sans text-zinc-900 antialiased"><Story /></div>]
