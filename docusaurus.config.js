// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'STUNMESH-go',
  tagline: 'P2P WireGuard mesh through NAT, without self-hosted infrastructure',
  favicon: 'img/logo.svg',

  url: 'https://docs.stunmesh.dev',
  baseUrl: '/',

  organizationName: 'tjjh89017',
  projectName: 'stunmesh-docs',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/tjjh89017/stunmesh-docs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'STUNMESH-go',
        logo: {
          alt: 'STUNMESH-go logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/tjjh89017/stunmesh-go',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Introduction', to: '/'},
              {label: 'Getting Started', to: '/getting-started'},
              {label: 'Configuration', to: '/configuration/overview'},
            ],
          },
          {
            title: 'Project',
            items: [
              {
                label: 'stunmesh-go',
                href: 'https://github.com/tjjh89017/stunmesh-go',
              },
              {
                label: 'Releases',
                href: 'https://github.com/tjjh89017/stunmesh-go/releases',
              },
              {
                label: 'Docker Hub',
                href: 'https://hub.docker.com/r/tjjh89017/stunmesh',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'FOSDEM 2026 Talk',
                href: 'https://fosdem.org/2026/schedule/event/YQWEDC-stunmesh-go_building_p2p_wireguard_mesh_without_self-hosted_infrastructure/',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} STUNMESH-go contributors. Licensed under GPL-2.0-or-later.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'yaml', 'ini', 'python'],
      },
    }),
};

export default config;
