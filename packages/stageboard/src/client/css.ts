function rules(css: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}" && --depth === 0) {
      out.push(css.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return out.filter(Boolean)
}

export function pickCss(css: string, classes: RegExp): string {
  return rules(css)
    .flatMap((rule) => {
      const head = rule.slice(0, rule.indexOf("{")).trim()
      if (head.startsWith("@keyframes")) return [rule]
      if (head.startsWith("@media")) {
        const inner = pickCss(rule.slice(rule.indexOf("{") + 1, -1), classes)
        return inner ? [`${head} {\n${inner}\n}`] : []
      }
      return classes.test(head) ? [rule] : []
    })
    .join("\n")
}

function scopeSelector(selector: string, scope: string): string {
  return selector
    .split(",")
    .map((part) => `${scope} ${part.trim()}`)
    .join(", ")
}

export function scopeCss(css: string, scope: string): string {
  return rules(css)
    .map((rule) => {
      const at = rule.indexOf("{")
      const head = rule.slice(0, at).trim()
      if (head.startsWith("@keyframes")) return rule
      if (head.startsWith("@media")) return `${head} {\n${scopeCss(rule.slice(at + 1, -1), scope)}\n}`
      return `${scopeSelector(head, scope)} ${rule.slice(at)}`
    })
    .join("\n")
}
