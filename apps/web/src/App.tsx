// 1. Todo en JS
export default function App() {
    return (
        <main className="wrap">
            <p className='text-rose-300 font-bold'>CineFlow - Inicio</p>
            <section className="panel">
                <h1> Tu historia comienza aquí</h1>
                <p> Películas, Series y Traílers, todo en un mismo lugar</p>
            </section>
            <h2 className="my-6"> Nuestro catálogo de práctica</h2>
            <div className="grid-media">
                { /* aqui se generan dinámicamente los elementos utilizamos Js */
                    // 1. Accedemos al backend (URL estática por ahora) y traemos la info
                    // 2. Mapeamos el array que nos devuelva para dibujar los posters
                    // 3. Importante: El poster es un enlace <Link> a /movie/:id o /tv/:id
                    ['Orbita Azul', 'La ultima seccion', 'Codigo R', 'Estado Final', 'A traves del tiempo'].map((title) => (
                        <article className="panel" key={title}>
                            <div className="poster">
                                <span className="text-5xl">P</span>
                            </div>
                            <h2 className="mt-4 text-lg">{title}</h2>
                        </article>
                    ))
                }
            </div>
            <p className="muted">
                Invented data for the practice
            </p>
            {/* TODO: Aquí irá tu código para mostrar el listado de películas/series (VARIABLES) */
            }
        </main>
    ); // Siempre ; al final

}