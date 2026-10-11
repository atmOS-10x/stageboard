type FontOptions = { variable?: string; weight?: string | string[]; subsets?: string[]; display?: string; src?: unknown }

const loaded = new Set<string>()

function familyName(name: string): string {
  return name.replace(/_/g, " ")
}

function ensureGoogleFont(family: string) {
  if (typeof document === "undefined" || loaded.has(family) || family === "local") return
  loaded.add(family)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,100..900;1,100..900&display=swap`
  link.onerror = () => {
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`
  }
  document.head.appendChild(link)
}

function ensureVariableClass(className: string, variable: string, stack: string) {
  if (typeof document === "undefined") return
  const id = `sb-font-${className}`
  if (document.getElementById(id)) return
  const style = document.createElement("style")
  style.id = id
  style.textContent = `.${className}{${variable}:${stack}}`
  document.head.appendChild(style)
}

export function createFont(name: string) {
  return (options: FontOptions = {}) => {
    const family = familyName(name)
    ensureGoogleFont(family)
    const stack = `'${family}', ui-sans-serif, system-ui, sans-serif`
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    let variable = ""
    if (options.variable) {
      variable = `sb-font-${slug}-${options.variable.replace(/[^a-z0-9]/gi, "")}`
      ensureVariableClass(variable, options.variable, stack)
    }
    return { className: "", variable, style: { fontFamily: stack } }
  }
}

export default createFont("local")
