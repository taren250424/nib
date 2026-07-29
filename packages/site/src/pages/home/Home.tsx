import "./Home.scss"

export const Home = () => {
  return (
    <>
      <div className="home-page">
        <section className="preview">
          <img src={`${import.meta.env.BASE_URL}preview/preview.png`} />
        </section>
        <section className="introduction">
          <h2 className="introduction-title">Effortless Writing, Organized Thinking</h2>
          <p className="introduction-content">
            A seamless WYSIWYG Markdown editor for your desktop. <br />
            Manage complex projects with a native-style file system and flexible tab management.
          </p>
        </section>
      </div>
    </>
  )
}
