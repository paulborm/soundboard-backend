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

class Store {
  #users = new Map<WebSocket, User>();

  get users() {
    return this.#users;
  }

  getUser(key: WebSocket) {
    return this.#users.get(key);
  }

  addUser(socket: WebSocket, user: User) {
    this.#users.set(socket, user);
    return this.getUser(socket);
  }

  deleteUser(user: User) {
    // this.#users.delete(socket);
    this.#users.forEach(({ id }, ws) => {
      if (user.id === id) {
        this.#users.delete(ws);
      }
    });
  }
}

const state = new Store();

const channel = new BroadcastChannel("ws");
channel.addEventListener("message", channelHandler);

const server = new Server({ handler });
const port = Number(Deno.env.get("PORT")) || 3001;

console.log(`Server listening on port ${port}`);

await server.serve(Deno.listen({ port }));

function channelHandler(event: MessageEvent) {
  if (event.target !== channel) {
    console.log("channel:message:postmessage", event);
    channel.postMessage(
      JSON.stringify(event.data),
    );
  }

  console.log("channel:message:further", event);

  if (event.type === "close") {
    const data = JSON.parse(event.data);

    state.users.forEach((_, ws) => {
      ws.send(
        JSON.stringify({
          type: "userleft",
          user: data.user,
        }),
      );
    });

    return;
  }

  if (event.type === "message") {
    const data = JSON.parse(event.data);

    if (data.type === "adduser") {
      console.log(
        "channel:message:adduser",
        data,
        Object.fromEntries(state.users),
      );
      state.users.forEach((_, ws) => {
        ws.send(
          JSON.stringify({
            type: "userjoined",
            user: data.user,
            users: Array.from(state.users.values()),
          }),
        );
      });
    }

    if (data.type === "sound") {
      state.users.forEach((_, ws) => {
        ws.send(
          JSON.stringify({
            type: "sound",
            sound: data.sound,
            user: data.user,
          }),
        );
      });
    }

    if (data.type === "updateuser") {
      state.users.forEach((_, ws) => {
        ws.send(
          JSON.stringify({
            type: "userupdated",
            user: data.user,
          }),
        );
      });
    }
  }
}

async function handler(request: Request) {
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
    });

    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "adduser") {
        const user = state.addUser(
          socket,
          new User(crypto.randomUUID(), data.name),
        );

        socket.send(
          JSON.stringify({
            type: "userlogin",
            user,
            users: Array.from(state.users.values()),
          }),
        );

        data.user = user;
      }

      if (data.type === "updateuser") {
        const { username } = data;

        if (
          !username ||
          username.length <= 0 ||
          username.length > 46 ||
          typeof username !== "string"
        ) {
          return;
        }

        const user = state.getUser(socket);

        if (user) {
          user.name = username;
          data.user = user;
        }

        state.users.forEach((_, ws) => {
          ws.send(
            JSON.stringify({
              type: "userupdated",
              user: data.user,
            }),
          );
        });
      }

      channelHandler(
        new MessageEvent("message", { data: JSON.stringify(data) }),
      );
    });

    socket.addEventListener("close", (event) => {
      const user = state.getUser(socket) as User;

      state.deleteUser(user);

      state.users.forEach((_, ws) => {
        ws.send(
          JSON.stringify({
            type: "userleft",
            user: user,
          }),
        );
      });

      channelHandler(
        new MessageEvent("close", { data: JSON.stringify({ user }) }),
      );
    });

    socket.addEventListener("error", () => {});

    return response;
  }

  return new Response("Nothing found 🥲", { status: 404 });
}
