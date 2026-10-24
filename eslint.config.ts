import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "apps/desktop/dist/**", "node_modules/**", "evidence/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
