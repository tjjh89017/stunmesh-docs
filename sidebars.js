// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/overview',
        'configuration/protocols',
        'configuration/stun-servers',
        'configuration/ping-monitoring',
      ],
    },
    {
      type: 'category',
      label: 'Storage Plugins',
      items: [
        'plugins/overview',
        'plugins/builtin',
        'plugins/exec-protocol',
        'plugins/shell-protocol',
      ],
    },
    {
      type: 'category',
      label: 'Deployment Guides',
      items: [
        'guides/vyos',
        'guides/macos',
        'guides/dynamic-routing',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/build',
        'reference/platform-internals',
      ],
    },
  ],
};

export default sidebars;
