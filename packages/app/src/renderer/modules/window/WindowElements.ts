import { injectable } from "inversify"

@injectable()
export class WindowElements {
  public readonly maximizeBtn: HTMLElement
  public readonly minimizeBtn: HTMLElement
  public readonly exitBtn: HTMLElement

  constructor() {
    this.maximizeBtn = document.querySelector("#maximizeWindow") as HTMLElement
    this.minimizeBtn = document.querySelector("#minimizeWindow") as HTMLElement
    this.exitBtn = document.querySelector("#title-exit") as HTMLElement
  }
}
