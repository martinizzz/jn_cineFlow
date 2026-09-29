import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useData } from './useData'
import type { Media, Detail } from './types.tsx'

function mediaFromDetail(d: Detail): Media {
    return {
        id: String(d.id),
        title: d.title,
        type: d.media_type,
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w1280${d.poster_path}` : "",
    }
}

export function Detail() {
    const [searchParams, setSearchParams] = useSearchParams();
    const type = searchParams.get("tipo") === "tv" ? "tv" : "movie";
    const id = useParams().id!;
    const { data: detail, loading, error, reload } = useData<Detail>(`/detail/${type}/${id}`);
    return (
        <>
            <section className="panel">
                {loading ? (
                    <p role="status">Cargando ficha...</p>
                ) : error ? (
                    <div className="error" role="alert">
                        {error}{" "}
                        <button className="btn" onClick={reload}>
                            Reintentar
                        </button>
                    </div>
                ) : (
                    <>
                        <Link to="/" className="block mb-3">
                            ← Volver al catálogo
                        </Link>
                        <div className="md:flex gap-4">
                            <div className="w-full md:w-48 shrink-0">
                                {detail?.poster_path ? (
                                    <img
                                        alt=""
                                        className="w-full"
                                        src={`https://image.tmdb.org/t/p/w342${detail.poster_path}`}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : (
                                    <div className="h-72 bg-slate-800 flex items-center justify-center">
                                        <span className="text-5xl">P</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h1 className="mt-4 md:mt-0 text-4xl">{detail?.title}</h1>
                                <div className="muted mt-2">{detail?.tagline}</div>
                                <div className="mt-4 text-lg">{detail?.overview}</div>
                                <div className="mt-4">
                                    <p>
                                        <strong>Fecha de estreno</strong>{" "}
                                        {detail?.release_date
                                            ? new Date(detail.release_date).toLocaleDateString("es-MX", {
                                                  year: "numeric",
                                                  month: "long",
                                                  day: "numeric",
                                              })
                                            : "-"}
                                    </p>
                                    <p>
                                        <strong>Puntuación</strong>{" "}
                                        {detail?.vote_average?.toFixed(1)} ({detail?.vote_count || 0} votos)
                                    </p>
                                    <p>
                                        <strong>Genres</strong>{" "}
                                        {detail?.genres?.map((g) => g.name).join(", ") || "-"}
                                    </p>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            setSearchParams({ tipo: type, q: "", pagina: "1" });
                                        }}
                                    >
                                        <button className="btn primary">
                                            Ver otro título
                                        </button>
                                    </form>
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            const formData = new FormData(e.currentTarget);
                                            const tipo = formData.get("tipo") === "tv" ? "tv" : "movie";
                                            const q = formData.get("q") || "";
                                            setSearchParams({ tipo, q });
                                        }}
                                    >
                                        <input name="tipo" value={type} type="hidden" />
                                        <input
                                            name="q"
                                            defaultValue={type === "movie" ? "acción" : "comedia"}
                                            placeholder="Buscar título..."
                                        />
                                        <button className="btn">Buscar</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {!loading && !error && detail && (
                <>
                    <Trailer
                        mediaId={id}
                        mediaType={type}
                        title={detail.title}
                        type={type}
                    />
                    <Recommendations
                        mediaId={id}
                        mediaType={type}
                        title={detail.title}
                    />
                </>
            )}
        </>
    )
}

function Trailer({ mediaId, mediaType, title, type }: { mediaId: string; mediaType: string; title: string; type: string }) {
    const { data: videos } = useData<{
        results: { key: string; type: string; site: string; official: boolean }
    }[]>(`/media/${mediaType}/${mediaId}/videos`);

    const trailer = (videos?.results || []).find(
        (v) => v.type === "Trailer" && v.site === "YouTube" && v.official
    ) || (videos?.results || []).find(
        (v) => v.type === "Trailer" && v.site === "YouTube"
    );

    return (
        <section className="panel mb-6">
            <h2 className="mb-4">Tráiler de {title}</h2>
            {trailer ? (
                <iframe
                    width="100%"
                    height="315"
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    title={`Tráiler de ${title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            ) : (
                <p>No hay tráiler disponible para esta película/serie.</p>
            )}
        </section>
    );
}

function Recommendations({
    mediaId,
    mediaType,
    title
}: {
    mediaId: string;
    mediaType: string;
    title: string;
}) {
    const url = `/media/${mediaType}/${mediaId}/recommendations`;
    const { data: list } = useData<{
        results: { page: number; results: Media[] }
    }>(url);
    const results = list?.results || [];

    return (
        <section className="panel mb-6">
            <h2 className="mb-4">Te podría interesar también</h2>
            {results.length > 0 ? (
                <div className="grid-media">
                    {results.slice(0, 12).map((m) => (
                        <Card key={`${m.type}_${m.id}`} media={m} />
                    ))}
                </div>
            ) : (
                <p>No hay recomendaciones.</p>
            )}
        </section>
    );
}

function Card({ media }: { media: Media }) {
    return (
        <article className="panel">
            <Link to={`/titulo/${media.type}/${media.id}`}>
                <div className="poster">
                    {media.poster ? (
                        <img
                            alt=""
                            src={media.poster}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    ) : (
                        <span aria-hidden="true" className="text-5xl">P</span>
                    )}
                </div>
                <h2 className="mt-3 text-lg">{media.title}</h2>
            </Link>
            <p className="muted">
                {media.type === "movie" ? "Película" : "Serie"}
            </p>
        </article>
    );
}