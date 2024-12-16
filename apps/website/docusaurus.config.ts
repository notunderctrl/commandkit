import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'CommandKit',
  tagline: 'A Discord.js handler',
  favicon: 'img/favicon.ico',
  url: 'https://commandkit.dev',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/underctrl-io/commandkit/tree/main/apps/website/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'CommandKit',
      logo: {
        alt: 'CommandKit logo',
        src: 'img/logo_128.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guide',
          position: 'left',
          label: 'Guide',
        },
        {
          type: 'docSidebar',
          sidebarId: 'api',
          position: 'left',
          label: 'API Reference',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/underctrl-io/commandkit',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://ctrl.lol/discord',
          label: 'Discord',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      copyright: `Copyright © ${new Date().getFullYear()} CommandKit`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
