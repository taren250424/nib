import { assert } from "../utils"

export interface NibSelectChangeDetail {
  value: string
  index: number
}

interface NibSelectOption {
  value: string
  label: string
}

const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12">
	<path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`

/**
 * Light-DOM custom select. Options are declared as <nib-option value="...">Label</nib-option>
 * children; they act as a data source only and are hidden by CSS.
 *
 * - Setting `value` programmatically updates the UI silently.
 * - User interaction fires a bubbling "nib-select-changed" CustomEvent<NibSelectChangeDetail>.
 */
export class NibSelect extends HTMLElement {
  private _options: NibSelectOption[] = []
  private _selectedIndex = -1
  private _highlightIndex = -1

  private _trigger!: HTMLButtonElement
  private _label!: HTMLSpanElement
  private _panel!: HTMLUListElement
  private _items: HTMLLIElement[] = []

  private readonly _onDocumentMousedown = (e: MouseEvent) => {
    if (!this.contains(e.target as Node)) this._close()
  }

  connectedCallback() {
    if (!this._trigger) {
      this._readOptions()
      this._build()
      this._selectIndex(0, { emit: false })
    }

    document.addEventListener("mousedown", this._onDocumentMousedown)
  }

  disconnectedCallback() {
    document.removeEventListener("mousedown", this._onDocumentMousedown)
  }

  //

  get value(): string {
    return this._options[this._selectedIndex]?.value ?? ""
  }

  set value(value: string) {
    const index = this._options.findIndex((option) => option.value === value)
    // The value comes from user input or a persisted session file, so
    // tolerate unknown values in production but surface them in dev.
    assert(index !== -1, `NibSelect: no option with value "${value}"`)
    if (index === -1) return
    this._selectIndex(index, { emit: false })
  }

  get optionIndex(): number {
    return this._selectedIndex
  }

  //

  private _readOptions() {
    this._options = Array.from(this.querySelectorAll("nib-option")).map((el) => ({
      value: el.getAttribute("value") ?? "",
      label: el.textContent?.trim() ?? "",
    }))

    assert(this._options.length > 0, "NibSelect: requires at least one <nib-option>")
  }

  private _build() {
    this._trigger = document.createElement("button")
    this._trigger.type = "button"
    this._trigger.className = "nib-select-trigger"

    this._label = document.createElement("span")
    this._label.className = "nib-select-label"

    const chevron = document.createElement("span")
    chevron.className = "nib-select-chevron"
    chevron.innerHTML = CHEVRON_SVG

    this._trigger.appendChild(this._label)
    this._trigger.appendChild(chevron)

    this._panel = document.createElement("ul")
    this._panel.className = "nib-select-panel"
    this._panel.setAttribute("role", "listbox")

    this._items = this._options.map((option, index) => {
      const item = document.createElement("li")
      item.className = "nib-select-item"
      item.setAttribute("role", "option")
      item.textContent = option.label

      item.addEventListener("click", () => {
        this._selectIndex(index, { emit: true })
        this._close()
        this._trigger.focus()
      })

      item.addEventListener("mouseenter", () => this._setHighlightIndex(index))

      this._panel.appendChild(item)
      return item
    })

    this._trigger.addEventListener("click", () => {
      if (this.classList.contains("open")) this._close()
      else this._open()
    })

    this.addEventListener("keydown", (e) => this._handleKeydown(e))

    this.appendChild(this._trigger)
    this.appendChild(this._panel)
  }

  //

  private _open() {
    this.classList.add("open")
    this._setHighlightIndex(this._selectedIndex)
    this._items[this._selectedIndex]?.scrollIntoView({ block: "nearest" })
  }

  private _close() {
    this.classList.remove("open")
    this._setHighlightIndex(-1)
  }

  private _selectIndex(index: number, { emit }: { emit: boolean }) {
    if (index === this._selectedIndex) return

    this._selectedIndex = index
    this._label.textContent = this._options[index].label
    this._items.forEach((item, i) => item.classList.toggle("selected", i === index))

    if (emit) {
      this.dispatchEvent(
        new CustomEvent<NibSelectChangeDetail>("nib-select-changed", {
          detail: { value: this._options[index].value, index },
          bubbles: true,
        })
      )
    }
  }

  private _setHighlightIndex(index: number) {
    this._items[this._highlightIndex]?.classList.remove("highlight")
    this._highlightIndex = index
    if (index !== -1) this._items[index]?.classList.add("highlight")
  }

  private _handleKeydown(e: KeyboardEvent) {
    const open = this.classList.contains("open")

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        this._open()
      }
      // Enter/Space activate the trigger button natively and toggle via its click handler.
      return
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const delta = e.key === "ArrowDown" ? 1 : -1
      const next = Math.min(Math.max(this._highlightIndex + delta, 0), this._items.length - 1)
      this._setHighlightIndex(next)
      this._items[next].scrollIntoView({ block: "nearest" })
    } else if (e.key === "Enter" || e.key === " ") {
      // preventDefault also stops the trigger button's native activation,
      // which would immediately re-toggle the panel.
      e.preventDefault()
      if (this._highlightIndex !== -1) this._selectIndex(this._highlightIndex, { emit: true })
      this._close()
    } else if (e.key === "Escape") {
      // Consumed here so the app-level Esc shortcut does not also fire.
      e.preventDefault()
      e.stopPropagation()
      this._close()
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nib-select": NibSelect
  }

  interface GlobalEventHandlersEventMap {
    "nib-select-changed": CustomEvent<NibSelectChangeDetail>
  }
}

customElements.define("nib-select", NibSelect)
