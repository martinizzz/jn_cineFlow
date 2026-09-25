import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Catalog } from './Catalog'

function Layout() {
    return (
        <>
            <a href="#main-content" className="skip">
                Saltar al contenido principal
            </a>
            <header className="wrap boder-b border-slate-700">
                <strong className="text-2xl text-rose-300">
                    CineFlow
                </strong>
                <nav className="mt-4">
                    <Link to="/">Catálogo</Link>
                    <Link to="/">Creditos</Link>
                </nav>
            </header>
            <main className="wrap" id="contenido">
                <Routes>
                    <Route path="/" element={<Catalog />}> </Route>
                    <Route path="/titulo/:type/:id" element={
                        <p>
                            La ficha o tarjeta la vamos a poner despues
                            <Link to="/">Volver al catálogo</Link>
                        </p>
                    }></Route>
                    <Route path="/creditos" element={
                        <section className="panel mb-6">
                            <div>
                                <p>Alumno</p>
                                <p>Carrera</p>
                                <p>Materia</p>
                                <p className="muted">NUA</p>
                            </div>
                        </section>
                    }></Route>
                    <Route path="*" element={
                        <section className="panel mb-6">
                            <div>
                                <p>Error 404: Página no encontrada</p>
                                <Link to="/">Volver al catálogo</Link>
                            </div>
                        </section>
                    }></Route>
                </Routes>
            </main>
            <footer className="wrap muted">
                CineFlow  Catalogo de Peliculas y Series
            </footer>
        </>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <Layout></Layout>
        </BrowserRouter>
    )
}