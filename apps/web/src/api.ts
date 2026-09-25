export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    // <T> se utliza para que pueda recibir cualquier tipo de dato, siempre 
    // y cuando cumpla con la interface que se le pasa
    const response = await fetch(`${import.meta.env.VITE_API_URL || "http:localhost:4000/api"}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            // applicaction/json, porque es el formato estándar de datos que se intercambia 
            // entre el cliente y el servidor.

            ...init.headers,
        }
    })
    if (response.status === 204) {
        return undefined as T
    }
    const body = await response.json().catch(() => ({
        error: 'Error inesperado del servidor'
    }))
    if (!response.ok) {
        throw new Error(body.error || `Error HTTP: ${response.status}`)
    }
    return body.data as T
}