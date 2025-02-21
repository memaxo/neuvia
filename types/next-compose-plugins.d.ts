declare module 'next-compose-plugins' {
  import type { NextConfig } from 'next'

  type Plugin = (config: NextConfig) => NextConfig
  type PluginConfig = [Plugin, object?]

  function withPlugins(plugins: PluginConfig[], config: NextConfig): NextConfig

  export = withPlugins
}
