import { Footer } from "../components/footer"
import { Header } from "../components/header"

export const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Header />
      <div className="divider"></div>
      <main>{children}</main>
      <div className="divider"></div>
      <Footer />
    </>
  )
}
