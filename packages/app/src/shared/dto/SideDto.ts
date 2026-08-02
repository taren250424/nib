export interface SideDto {
  open: boolean
  width: number
  // Optional: session files written before the word count existed lack it.
  wordCountVisible?: boolean
}
