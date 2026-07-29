import { injectable } from "inversify"

@injectable()
export class SideElements {
  public readonly side: HTMLElement
  public readonly tree: HTMLElement
  public readonly resizer: HTMLElement

  constructor() {
    this.side = document.querySelector("#side") as HTMLElement
    this.tree = document.querySelector("#tree") as HTMLElement
    this.resizer = document.querySelector("#side-resizer") as HTMLElement
  }
}
