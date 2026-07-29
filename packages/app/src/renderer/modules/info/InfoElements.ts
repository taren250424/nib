import { injectable } from "inversify"

@injectable()
export class InfoElements {
  public readonly overlay: HTMLElement
  public readonly close: HTMLElement
  public readonly version: HTMLElement

  constructor() {
    this.overlay = document.querySelector("#info-overlay") as HTMLElement
    this.close = document.querySelector("#info-close") as HTMLElement
    this.version = document.querySelector("#info-version > span") as HTMLElement
  }
}
