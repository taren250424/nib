// Either separator: paths come from Main, which hands back whatever the OS uses,
// and the renderer only ever compares them.
const SEPARATOR = /[\\/]/

/**
 * Whether `path` lies inside `ancestor` — strictly inside, not equal to it.
 *
 * Compared segment by segment rather than by prefix: `/docs/notes-old` starts
 * with `/docs/notes` without being anywhere inside it.
 */
export function isPathInside(path: string, ancestor: string): boolean {
  const target = path.split(SEPARATOR)
  const parent = ancestor.split(SEPARATOR)

  if (target.length <= parent.length) return false
  return parent.every((segment, i) => segment === target[i])
}
