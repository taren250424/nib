import React from "react"

export const EmptyLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <main>{children}</main>
    </>
  )
}
