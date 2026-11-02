import app from "./app";
import { config } from "./config/app";

const port = Number(process.env.PORT ?? config.port ?? 5000);

app.listen(port, () => {
  console.log(`Edgelink backend listening on http://localhost:${port}`);
});
