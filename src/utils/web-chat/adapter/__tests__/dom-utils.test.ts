// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { extractCleanText, insertTextIntoElement } from "../dom-utils"

describe("DOM Utils for Web Chat", () => {
  it("should insert text into a textarea element", () => {
    const textarea = document.createElement("textarea")
    textarea.value = "Hello "
    document.body.appendChild(textarea)

    const success = insertTextIntoElement(textarea, "World!")
    expect(success).toBe(true)
    expect(textarea.value).toBe("Hello World!")

    textarea.remove()
  })

  it("should insert text into a contenteditable element", () => {
    const div = document.createElement("div")
    div.contentEditable = "true"
    div.innerHTML = "Xin chào "
    document.body.appendChild(div)

    const success = insertTextIntoElement(div, "bạn")
    expect(success).toBe(true)
    expect(div.textContent).toContain("Xin chào")

    div.remove()
  })

  it("should extract clean text and trim whitespace", () => {
    const div = document.createElement("div")
    div.innerHTML = "   \n  <b>Tin nhắn quan trọng</b> \t "
    expect(extractCleanText(div)).toBe("Tin nhắn quan trọng")
  })
})
