export interface Media {
    id: number;
    type: 'movie' | 'tv';
    title: string;
    overview: string;
    poster: string | null;
}

export interface Video {
    id: string;
    title: string;
}

export interface Favorite {
    media: Media;
    addedAt: string;
}

export interface History {
    media: Media;
    videoId: string;
    position: number;
    duration: number;
    completed: boolean;
    version: number;
    updatedAt: string;
}

export interface Profile {
    id: string;
    name: string;
    favorites: Record<string, Favorite>;
    history: Record<string, History>;
    // Record<string, History> -> me va a devolver un objeto, donde la llave es un string
    // y el valor es un objeto de tipo History. Por lo tanto, cuando acceda a history[miVideoId]
    // me va a devolver el objeto History que tiene como llave miVideoId.
    // Lo mismo pasa con favorites[miVideoId]
}

export interface Account {
    name: string;
    profiles: Profile[];
}