import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const repoName =
    process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "nasdaq100-dca-dashboard";
  const base =
    process.env.VITE_BASE_PATH ?? (mode === "production" ? `/${repoName}/` : "/");

  return {
    base,
    publicDir: "data",
  };
});
