import type TreeSessionModel from "@main/models/TreeSessionModel"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"

export const tabSessionPath = "/fake/path/tabSession.json"
export const treeSessionPath = "/fake/path/treeSession.json"
export const sideSessionPath = "/fake/path/sideSession.json"
export const settingsSessionPath = "/fake/path/settingsSession.json"
export const windowSessionPath = "/fake/path/windowSession.json"

const preFilePath = "preFilePath"
export const newFilePath = "newFilePath"
const preFileName = "preFileName"
const preFileContent = "preFileContent"

export const emptyFilePathTabEditorDto: TabEditorDto = {
  id: 0,
  isModified: true,
  filePath: "",
  fileName: preFileName,
  content: preFileContent,
  isBinary: false,
}

export const defaultTabEditorDto: TabEditorDto = {
  id: 0,
  isModified: true,
  filePath: preFilePath,
  fileName: preFileName,
  content: preFileContent,
  isBinary: false,
}

export const tabEidtorsDto: TabEditorsDto = {
  activatedId: 1,
  data: [
    {
      id: 0,
      isModified: false,
      filePath: "",
      fileName: "Untitled",
      content: "",
      isBinary: false,
    },
    {
      id: 1,
      isModified: false,
      filePath: `${preFilePath}_1`,
      fileName: `${preFileName}_1`,
      content: `${preFileContent}_1`,
      isBinary: false,
    },
    {
      id: 2,
      isModified: true,
      filePath: `${preFilePath}_2`,
      fileName: `${preFileName}_2`,
      content: `${preFileContent}_2`,
      isBinary: false,
    },
    {
      id: 3,
      isModified: true,
      filePath: "",
      fileName: `${preFileName}_3`,
      content: `${preFileContent}_3`,
      isBinary: false,
    },
  ],
}

export const treeDto: TreeDto = {
  path: "D:/workspace/root",
  name: "root",
  indent: 0,
  directory: true,
  expanded: true,
  children: [
    {
      path: "D:/workspace/velin/dir",
      name: "dir",
      indent: 1,
      directory: true,
      expanded: true,
      children: [
        {
          path: "D:/workspace/velin/dir/dir2",
          name: "dir2",
          indent: 2,
          directory: true,
          expanded: true,
          children: [
            {
              path: "D:/workspace/velin/dir/dir2/dir2_test.md",
              name: "dir2_test.md",
              indent: 3,
              directory: false,
              expanded: false,
              children: null,
            },
          ],
        },
        {
          path: "D:/workspace/velin/dir/dir_test.md",
          name: "dir_test.md",
          indent: 1,
          directory: false,
          expanded: false,
          children: null,
        },
        {
          path: "D:/workspace/velin/dir/dir_test-1.md",
          name: "dir_test-1.md",
          indent: 1,
          directory: false,
          expanded: false,
          children: null,
        },
        {
          path: "D:/workspace/velin/dir/dir_test-3.md",
          name: "dir_test-3.md",
          indent: 1,
          directory: false,
          expanded: false,
          children: null,
        },
      ],
    },
    {
      path: "D:/workspace/velin/test.md",
      name: "test.md",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    },
    {
      path: "D:/workspace/velin/test-1.md",
      name: "test-1.md",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    },
    {
      path: "D:/workspace/velin/test-3.md",
      name: "test-3.md",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    },
  ],
}

export const treeSessionModel: TreeSessionModel = {
  path: "D:/workspace/root",
  name: "root",
  indent: 0,
  directory: true,
  expanded: true,
  children: [
    {
      path: "D:/workspace/velin/dir",
      name: "dir",
      indent: 1,
      directory: true,
      expanded: true,
      children: [
        {
          path: "D:/workspace/velin/dir/dir2",
          name: "dir2",
          indent: 2,
          directory: true,
          expanded: true,
          children: [
            {
              path: "D:/workspace/velin/dir/dir2/dir2_test.md",
              name: "dir2_test.md",
              indent: 3,
              directory: false,
              expanded: false,
              children: null,
            },
          ],
        },
        {
          path: "D:/workspace/velin/dir/dir_test.md",
          name: "dir_test.md",
          indent: 1,
          directory: false,
          expanded: false,
          children: null,
        },
        {
          path: "D:/workspace/velin/dir/dir_test-1.md",
          name: "dir_test-1.md",
          indent: 1,
          directory: false,
          expanded: false,
          children: null,
        },
        {
          path: "D:/workspace/velin/dir/dir_test-3.md",
          name: "dir_test-3.md",
          indent: 1,
          directory: false,
          expanded: false,
          children: null,
        },
      ],
    },
    {
      path: "D:/workspace/velin/test.md",
      name: "test.md",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    },
    {
      path: "D:/workspace/velin/test-1.md",
      name: "test-1.md",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    },
    {
      path: "D:/workspace/velin/test-3.md",
      name: "test-3.md",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    },
  ],
}
