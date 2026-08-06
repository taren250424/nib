export default interface Response<T> {
  result: boolean
  data: T
  /** Why `result` is false, in the words the OS used. Absent on success. */
  error?: string
}
