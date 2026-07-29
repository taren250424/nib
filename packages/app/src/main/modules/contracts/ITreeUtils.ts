import type { TreeDto } from "@shared/dto/TreeDto"
import type TreeSessionModel from "@main/models/TreeSessionModel"

export default interface ITreeUtils {
  getDirectoryTree(dirPath: string, indent?: number): Promise<TreeDto | null>
  syncWithFs(node: TreeDto): Promise<TreeSessionModel | null>
}
