# Evidencia 22 septiembre 2026
# Cine flow

Se realizo un nuevo proyecto de nombre **cineflow** que tiene el rporposito de tener una interfaz similar a netflix o plataformas similarees; se basa rincipalemnte en un componente de nombre **React**

**Esquema del proyecto nuevo**
```text
apps---|
       ├──api
            ├──src
                ├──app.ts
                ├──catalog.ts
                ├──model.ts
                ├──server.ts
                ├──store.ts
            ├──test
            ├──.env.example
            ├──package.json
            ├──tsconfig.json            
       ├──web
            ├──src
                ├──api.ts
                ├──App.tsx
                ├──main.tsx
                ├──styles.css
                ├──types.ts
            ├──node_modules

|---.gitignore
|---.nvmrc
|---.package.json
```
A comtignuacion se mostrara los codigos de los archivos mencionados en el esquma anterior en su respectivo orden iniciando con el apartado de **api** y concluyendo con el apartado de raiz

## api->src

**app.ts**

```ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  addProfile,
  mediaSchema,
  nameSchema,
  Problem,
  profileOf,
  progressSchema,
  saveHistory,
  type Media,
} from "./model.js";
import type { Store } from "./store.js";
import type { Catalog } from "./catalog.js";
export function createApp(deps: {
  store: Store;
  verify: (token: string) => Promise<string>;
  catalog: Catalog;
  origin: string;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: deps.origin }));
  app.use(express.json({ limit: "8kb" }));
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/catalog", async (req, res) => {
    const query = z
      .object({
        type: z.enum(["movie", "tv"]).default("movie"),
        q: z.string().trim().max(100).default(""),
        page: z.coerce.number().int().min(1).max(500).default(1),
      })
      .parse(req.query);
    res.json({
      data: await deps.catalog.list(query.type, query.q, query.page),
    });
  });
  app.get("/api/catalog/:type/:id", async (req, res) => {
    const m = mediaSchema.parse(req.params);
    res.json({ data: await deps.catalog.detail(m.type, m.id) });
  });
  app.get("/api/catalog/:type/:id/videos", async (req, res) => {
    const m = mediaSchema.parse(req.params);
    res.json({ data: await deps.catalog.videos(m.type, m.id) });
  });
  app.use("/api", async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Problem(401, "Inicia sesión");
    res.locals.uid = await deps.verify(token);
    next();
  });
  app.put("/api/me", async (_req, res) =>
    res.json({ data: await deps.store.change(res.locals.uid, (a) => a) }),
  );
  app.get("/api/me", async (_req, res) =>
    res.json({ data: await deps.store.read(res.locals.uid) }),
  );
  app.patch("/api/me", async (req, res) => {
    const { name } = nameSchema.parse(req.body);
    res.json({
      data: await deps.store.change(res.locals.uid, (a) => {
        a.name = name;
        return a;
      }),
    });
  });
  app.post("/api/profiles", async (req, res) => {
    const { name } = nameSchema.parse(req.body);
    const id = randomUUID();
    res.status(201).json({
      data: await deps.store.change(res.locals.uid, (a) => {
        addProfile(a, id, name);
        return a;
      }),
    });
  });
  app.patch("/api/profiles/:profileId", async (req, res) => {
    const { name } = nameSchema.parse(req.body);
    res.json({
      data: await deps.store.change(res.locals.uid, (a) => {
        profileOf(a, String(req.params.profileId)).name = name;
        return a;
      }),
    });
  });
  app.delete("/api/profiles/:profileId", async (req, res) => {
    await deps.store.change(res.locals.uid, (a) => {
      const p = profileOf(a, String(req.params.profileId));
      if (p.id === "main")
        throw new Problem(409, "El perfil principal no se puede borrar");
      a.profiles = a.profiles.filter((v) => v.id !== p.id);
    });
    res.status(204).end();
  });
  function compact(m: Media): Media {
    return { ...m, overview: "" };
  }
  app.put("/api/profiles/:profileId/favorites/:type/:id", async (req, res) => {
    const m = mediaSchema.parse(req.params);
    const id = String(req.params.profileId);
    profileOf(await deps.store.read(res.locals.uid), id);
    const media = compact(await deps.catalog.detail(m.type, m.id));
    await deps.store.change(res.locals.uid, (a) => {
      const p = profileOf(a, id);
      const key = `${m.type}_${m.id}`;
      if (!p.favorites[key] && Object.keys(p.favorites).length >= 50)
        throw new Problem(409, "Máximo 50 favoritos por perfil");
      p.favorites[key] ??= { media, addedAt: new Date().toISOString() };
    });
    res.json({ data: { saved: true } });
  });
  app.delete(
    "/api/profiles/:profileId/favorites/:type/:id",
    async (req, res) => {
      const m = mediaSchema.parse(req.params);
      await deps.store.change(res.locals.uid, (a) => {
        delete profileOf(a, String(req.params.profileId)).favorites[
          `${m.type}_${m.id}`
        ];
      });
      res.status(204).end();
    },
  );
  app.put("/api/profiles/:profileId/history/:type/:id", async (req, res) => {
    const m = mediaSchema.parse(req.params);
    const input = progressSchema.parse(req.body);
    const id = String(req.params.profileId);
    profileOf(await deps.store.read(res.locals.uid), id);
    if (
      !(await deps.catalog.videos(m.type, m.id)).some(
        (v) => v.id === input.videoId,
      )
    )
      throw new Problem(400, "El video no pertenece al título");
    const media = compact(await deps.catalog.detail(m.type, m.id));
    res.json({
      data: await deps.store.change(res.locals.uid, (a) =>
        saveHistory(profileOf(a, id), media, input),
      ),
    });
  });
  app.delete("/api/profiles/:profileId/history/:key", async (req, res) => {
    const key = z
      .string()
      .regex(/^(movie|tv)_\d+_[\w-]{11}$/)
      .parse(req.params.key);
    await deps.store.change(res.locals.uid, (a) => {
      delete profileOf(a, String(req.params.profileId)).history[key];
    });
    res.status(204).end();
  });
  app.use((_req, _res, next) => next(new Problem(404, "Ruta no encontrada")));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Revisa los datos enviados" });
        return;
      }
      if (error instanceof SyntaxError && "body" in error) {
        res.status(400).json({ error: "JSON inválido" });
        return;
      }
      const status = error instanceof Problem ? error.status : 500;
      if (status === 500)
        console.error(
          "Error interno de la API; revisa la configuración de Firebase y sus permisos.",
        );
      res
        .status(status)
        .json({
          error:
            error instanceof Problem
              ? error.message
              : "Error interno del servidor",
        });
    },
  );
  return app;
}

```

**model.ts**
```ts

import { z } from "zod";
export type Kind = "movie" | "tv";
export interface Media {
  id: number;
  type: Kind;
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
  version: number;
  completed: boolean;
  updatedAt: string;
}
export interface Profile {
  id: string;
  name: string;
  favorites: Record<string, Favorite>;
  history: Record<string, History>;
}
export interface Account {
  name: string;
  profiles: Profile[];
}
export const emptyAccount = (): Account => ({
  name: "Mi cuenta",
  profiles: [{ id: "main", name: "Principal", favorites: {}, history: {} }],
});
export class Problem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const nameSchema = z
  .object({ name: z.string().trim().min(1).max(30) })
  .strict();
export const mediaSchema = z.object({
  type: z.enum(["movie", "tv"]),
  id: z.coerce.number().int().positive(),
});
export const progressSchema = z
  .object({
    videoId: z.string().regex(/^[\w-]{11}$/),
    position: z.number().finite().min(0),
    duration: z.number().finite().positive().max(14400),
    version: z.number().int().min(0),
  })
  .strict()
  .refine((v) => v.position <= v.duration, "La posición supera la duración");
export function profileOf(account: Account, id: string): Profile {
  const p = account.profiles.find((p) => p.id === id);
  if (!p) throw new Problem(404, "Perfil no disponible");
  return p;
}
export function addProfile(account: Account, id: string, name: string) {
  if (account.profiles.length >= 5)
    throw new Problem(409, "Máximo cinco perfiles");
  account.profiles.push({ id, name, favorites: {}, history: {} });
}
export function saveHistory(
  profile: Profile,
  media: Media,
  input: z.infer<typeof progressSchema>,
): History {
  const key = `${media.type}_${media.id}_${input.videoId}`;
  const old = profile.history[key];
  if ((old?.version ?? 0) !== input.version)
    throw new Problem(
      409,
      "El progreso cambió. Cierra el reproductor y vuelve a abrirlo.",
    );
  const item = {
    media,
    videoId: input.videoId,
    position: input.position,
    duration: input.duration,
    version: input.version + 1,
    completed: input.position / input.duration >= 0.95,
    updatedAt: new Date().toISOString(),
  };
  profile.history[key] = item;
  const keys = Object.keys(profile.history).sort((a, b) =>
    profile.history[b].updatedAt.localeCompare(profile.history[a].updatedAt),
  );
  for (const key of keys.slice(50)) delete profile.history[key];
  return item;
}

```

**server.ts**
```ts

import "dotenv/config";
import { z } from "zod";
import { createApp } from "./app.js";
import { makeCatalog } from "./catalog.js";
import { store, verify } from "./store.js";
const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
    CATALOG_MODE: z.enum(["demo", "tmdb"]).default("demo"),
  })
  .parse(process.env);
if (process.env.NODE_ENV === "production" && env.CATALOG_MODE !== "tmdb")
  throw new Error("Producción requiere CATALOG_MODE=tmdb");
createApp({
  store,
  verify,
  catalog: makeCatalog(env.CATALOG_MODE),
  origin: env.CORS_ORIGIN,
}).listen(env.PORT, () =>
  console.log(
    `CineFlow API: http://localhost:${env.PORT} — catálogo ${env.CATALOG_MODE}`,
  ),
);

```

**store.ts**
```ts
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { emptyAccount, Problem, type Account } from "./model.js";
function app() {
  if (!process.env.FIREBASE_PROJECT_ID)
    throw new Problem(503, "Configura Firebase en apps/api/.env");
  return (
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  );
}
export async function verify(token: string): Promise<string> {
  const a = app();
  try {
    return (await getAuth(a).verifyIdToken(token, true)).uid;
  } catch {
    throw new Problem(401, "Sesión inválida. Vuelve a iniciar sesión.");
  }
}
export interface Store {
  read(uid: string): Promise<Account>;
  change<T>(uid: string, fn: (account: Account) => T): Promise<T>;
}
export const store: Store = {
  async read(uid) {
    const snapshot = await getFirestore(app())
      .collection("cineflowUsers")
      .doc(uid)
      .get();
    return snapshot.exists ? (snapshot.data() as Account) : emptyAccount();
  },
  async change(uid, fn) {
    const db = getFirestore(app());
    const ref = db.collection("cineflowUsers").doc(uid);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const state = snap.exists ? (snap.data() as Account) : emptyAccount();
      const result = fn(state);
      if (Buffer.byteLength(JSON.stringify(state)) > 400000)
        throw new Problem(
          409,
          "La cuenta alcanzó el límite de esta versión educativa",
        );
      tx.set(ref, state);
      return result;
    });
  },
};

```

## api


**.env**

```text
PORT=4000
CORS_ORIGIN=http://localhost:5173
CATALOG_MODE=demo
TMDB_READ_ACCESS_TOKEN=
FIREBASE_PROJECT_ID=

```

**.env.example**

```text
PORT=4000
CORS_ORIGIN=http://localhost:5173
CATALOG_MODE=demo
TMDB_READ_ACCESS_TOKEN=
FIREBASE_PROJECT_ID=
# Ruta absoluta al JSON descargado de Firebase, sólo al activar usuarios:
# GOOGLE_APPLICATION_CREDENTIALS=/ruta/privada/cineflow-admin.json

```

**package.json**

```js
{
  "name": "@cineflow/api",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --import tsx --env-file=.env src/server.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "node --import tsx --test tests/*.test.ts"
  },
  "dependencies": {
    "cors": "2.8.6",
    "dotenv": "18.0.2",
    "express": "5.2.1",
    "express-rate-limit": "8.7.0",
    "firebase-admin": "14.4.0",
    "helmet": "8.3.0",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@types/cors": "2.8.19",
    "@types/express": "5.0.6",
    "@types/node": "24.13.6",
    "@types/supertest": "7.2.1",
    "supertest": "7.2.2",
    "tsx": "4.23.15",
    "typescript": "5.9.3"
  }
}
```

**tsconfig.ts**

```ts
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```
## web-> src

**api.ts**

```ts
export async function request<T>(path:string, init:RequestInit={}): Promise<T>{

    const response=await fetch(`${import.meta.env
        VITE_API_URL || "http:localhost:4000/api"}${path}`, {
            ...init, 
            headers:{
                "Content-Type": "application/json", 
                ...init.headers
            }
        })


}
```

**App.tsx**

```tsx
export default function App(){
 return(
    <main className="wrap">
        <p className="text-rose-300 font-bold">CineFlow

        </p>
    <section className="panel">
        <h1>Tu historia comienza aqui</h1>
        <p>Peliculas, series y trailers</p>
    </section>

    <h2 className="my-6">Nuestro catalogo de practica</h2>
    <div className="grid-media">
        {['Órbita Azul', 'La ultima estacion', 'Codigo aurora'].
        map((title)=>(
            <article className="panel" key={title}>
                <div className="poster">
                    <span className="text-5xl">▶</span>
                </div>
                <h2 className="mt-4 text-lg">
                    {title}
                </h2>

            </article>
        ))}

    <p className="muted">
        Datods inventados para relizar pruebas
    </p>

        
    </div>

    </main>



 );   
}
```
**main.tsx**

```ts
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
**styles.css**

```css
@import "tailwindcss";
:root {
  font-family: system-ui, sans-serif;
  color: #f8fafc;
  background: #0b0f19;
  color-scheme: dark;
}
body {
  margin: 0;
}
* {
  box-sizing: border-box;
}
a {
  color: inherit;
}
button,
input,
select {
  font: inherit;
}
button,
a,
input,
select {
  outline-offset: 4px;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid #fde047;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
input,
select {
  border: 1px solid #64748b;
  background: #161d2b;
  color: white;
  padding: 0.75rem;
  border-radius: 0.6rem;
  max-width: 100%;
}
label {
  display: grid;
  gap: 0.4rem;
}
nav {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}
.btn {
  display: inline-block;
  padding: 0.75rem 1rem;
  border: 1px solid #64748b;
  border-radius: 0.7rem;
  background: #172033;
  color: white;
  text-decoration: none;
  min-height: 44px;
}
.primary {
  background: #fb7185;
  color: #160811;
  border: 0;
  font-weight: 700;
}
.wrap {
  max-width: 1180px;
  margin: auto;
  padding: 1.25rem;
}
.panel {
  background: #161d2b;
  border: 1px solid #334155;
  border-radius: 1rem;
  padding: 1.25rem;
}
.grid-media {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}
.poster {
  aspect-ratio: 2/3;
  background: linear-gradient(135deg, #1e3a5f, #74284e);
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 0.75rem;
}
.poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.error {
  padding: 1rem;
  border: 1px solid #fb7185;
  background: #421e2b;
  border-radius: 0.7rem;
}
.muted {
  color: #cbd5e1;
}
.skip {
  position: absolute;
  top: -100px;
}
.skip:focus {
  top: 0;
  z-index: 5;
  background: #0b0f19;
  padding: 1rem;
}
h1 {
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 800;
}
h2 {
  font-size: 1.4rem;
  font-weight: 700;
}
p {
  margin: 0.8rem 0;
}
main {
  min-height: 65vh;
}
form {
  display: grid;
  gap: 1rem;
}
button + button {
  margin-left: 0.5rem;
}
iframe {
  width: 100%;
  height: clamp(220px, 50vw, 520px);
  border: 0;
}
progress {
  width: 100%;
  accent-color: #fb7185;
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
  }
}
```
**types.ts**

```ts
export interface Media{
    id:number;
    type: 'movie' | 'tv';
    title:string;
    overview:string;
    poster:string | null;
}

export interface Video{
    id:string;
    title:string;
}

export interface Favorite{
    media:Media;
    addedAt:string;
}

export interface History{
    media:Media;
    videoId: string;
    position:number;
    duration:number;
    completed:boolean;
    version:number;
    addedAt:string;
}

export interface Profile{
    id:string;
    name:string;
    favorites:Record<string, Favorite>;
    history: Record<string, History>;
}

export interface Account{
    name:string;
    profile:Profile;
}
```
## web

**api.ts**

```text
VITE_API_URL=http://localhost:4000/api
# Completar en la etapa 4 con la configuración WEB de Firebase:
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```
**index.html**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>CineFlow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
**package.json**

```js
{
  "name": "@cineflow/web",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173 --strictPort",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173"
  },
  "dependencies": {
    "firebase": "12.19.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-router-dom": "7.18.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.3.3",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vite": "8.3.0"
  }
}
```

**tsconfig.json**

```js
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

**vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwind()] });
```

## carpeta raiz
**.gitignore**

```text
node_modules/
dist/
.env
.env.*
!.env.example
secrets/
playwright-report/
test-results/
```
