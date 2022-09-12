import { Server } from "https://deno.land/std@0.154.0/http/server.ts";
import {
  serveDir,
  serveFile,
} from "https://deno.land/std@0.154.0/http/file_server.ts";
import { config as loadEnv } from "https://deno.land/std@0.154.0/dotenv/mod.ts";

await loadEnv({
  export: true,
  allowEmptyValues: true,
});

class Sound {
  #basePath = "./static";
  id;
  name;
  audio;
  image;

  constructor(props: Record<string, any>) {
    this.id = props.id;
    this.name = props.name;
    this.audio = {
      src: this.#resolvePath(`sounds/${props.audio.src}`),
    };
    this.image = {
      alt: props.image.alt,
      src: this.#resolvePath(`images/${props.image.src}`),
    };
  }

  #resolvePath(fileName: string) {
    return new URL(
      `${this.#basePath}/${fileName}`,
      Deno.env.get("SERVER_URL"),
    ).href;
  }
}

class User {
  id;
  name;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name || `anonymous`;
  }
}

const state = {
  get numUsers() {
    return this.users.size;
  },
  users: new Map(),
};

const handler = async (request: Request) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Serve static files
  if (pathname.startsWith("/static")) {
    return serveDir(request, {
      fsRoot: "static",
      urlRoot: "static",
    });
  }

  // Routes
  if (pathname === "/api/sounds") {
    const sounds = await fetch(
      new URL("./static/sounds/sounds.json", import.meta.url),
    ).then((response) => response.json()).then((data) =>
      data.map((item: any) => new Sound(item))
    );

    const corsHeaders = new Headers([
      ["Access-Control-Allow-Origin", Deno.env.get("CLIENT_URL") || "none"],
      ["Access-Control-Allow-Methods", "GET"],
    ]);

    if (url.searchParams.has("id")) {
      const found = sounds.find((item: any) =>
        item.id === url.searchParams.get("id")
      );

      if (found) {
        return new Response(JSON.stringify(found), {
          status: 200,
          headers: new Headers([
            ["Content-Type", "application/json"],
            ...corsHeaders,
          ]),
        });
      } else {
        return new Response(null, { status: 404 });
      }
    }

    return new Response(JSON.stringify(sounds), {
      status: 200,
      headers: new Headers([
        ["Content-Type", "application/json"],
        ...corsHeaders,
      ]),
    });
  }

  if (pathname.startsWith("/") && pathname.length === 1) {
    return serveFile(request, "static/index.html");
  }

  if (pathname === "/ws") {
    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.addEventListener("open", (event) => {
      console.log(`[EVENT: connection]:`, socket);
      console.log(`[>>>>>]:`, state.users);
    });

    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "adduser") {
        state.users.set(socket, new User(crypto.randomUUID(), data.name));

        socket.send(
          JSON.stringify({
            type: "userlogin",
            users: Array.from(state.users.values()),
            user: state.users.get(socket),
          }),
        );

        state.users.forEach((_, ws) => {
          if (ws !== socket) {
            ws.send(
              JSON.stringify({
                type: "userjoined",
                users: Array.from(state.users.values()),
                user: state.users.get(socket),
              }),
            );
          }
        });
      }

      if (data.type === "sound") {
        console.log("[sound]", data.sound);
        state.users.forEach((_, ws) => {
          if (ws !== socket) {
            ws.send(
              JSON.stringify({
                type: "sound",
                sound: data.sound,
                user: data.user,
              }),
            );
          }
        });
      }

      if (data.type === "updateuser") {
        if (
          !data.username ||
          data.username.length <= 0 ||
          data.username.length > 46 ||
          typeof data.username !== "string"
        ) {
          return;
        }

        state.users.get(socket).name = data.username;

        console.log(
          "[update user]",
          state.users.get(socket),
        );

        state.users.forEach((_, ws) => {
          if (ws !== socket) {
            ws.send(
              JSON.stringify({
                type: "usersupdated",
                users: Array.from(state.users.values()),
              }),
            );
          }
        });

        socket.send(JSON.stringify({
          type: "userupdated",
          user: state.users.get(socket),
        }));
      }
    });

    socket.addEventListener("close", () => {
      console.log("[EVENT: disconnect]", socket);

      const userleft = state.users.get(socket);
      state.users.delete(socket);

      state.users.forEach((_, ws) => {
        if (ws !== socket) {
          ws.send(
            JSON.stringify({
              type: "userleft",
              user: userleft,
              users: Array.from(state.users.values()),
            }),
          );
        }
      });
    });

    socket.addEventListener("error", () => {});

    return response;
  }

  return new Response("Nothing found 🥲", { status: 404 });
};

const server = new Server({ handler });
const port = Number(Deno.env.get("PORT")) || 3001;

console.log(`Server listening on port ${port}`);

await server.serve(Deno.listen({ port }));
