export function printNodeStructure(node: Node, indent = 0): string {
  const spacing = " ".repeat(indent * 2)
  let result = ""

  if (node.nodeType === 3) {
    const text = node.textContent?.trim() || ""
    if (text) {
      result += `${spacing}"${text}"\n`
    }
  } else if (node.nodeType === 1) {
    const elem = node as HTMLElement
    const tagName = elem.tagName.toLowerCase()
    const attrs = Array.from(elem.attributes, (attr) => `${attr.name}="${attr.value}"`).join(" ")

    result += `${spacing}<${tagName}${attrs ? ` ${attrs}` : ""}>\n`

    if (elem.childNodes.length > 0) {
      ;[...elem.childNodes].forEach((child) => {
        result += printNodeStructure(child, indent + 1)
      })
    }

    result += `${spacing}</${tagName}>\n`
  }

  return result
}
