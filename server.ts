import index from "./index.html";

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/src/*": async (req) => {
      const url = new URL(req.url);
      const filePath = `.${url.pathname}`;

      try {
        const file = Bun.file(filePath);
        const exists = await file.exists();

        if (!exists) {
          return new Response("File not found", { status: 404 });
        }

        const contentType = filePath.endsWith('.ts') || filePath.endsWith('.js')
          ? 'application/javascript'
          : 'text/plain';

        return new Response(file, {
          headers: {
            'Content-Type': contentType,
          },
        });
      } catch (error) {
        return new Response(`Error: ${error}`, { status: 500 });
      }
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("🚀 Serveur démarré sur http://localhost:3000");