// El paquete no publica tipos; solo se usa su config plana desde eslint.config.ts.
declare module 'eslint-plugin-jsx-a11y' {
  import type { Linter } from 'eslint'

  const plugin: { flatConfigs: { recommended: Linter.Config; strict: Linter.Config } }
  export default plugin
}
