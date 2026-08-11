export default {
  tagFormat: 'v${version}',
  branches: ['main', { name: 'v5', prerelease: 'rc', channel: 'next' }],
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'angular',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'refactor', section: 'Code Refactoring', hidden: false },
            { type: 'perf', section: 'Performance Improvements', hidden: false },
            { type: 'docs', hidden: true },
            { type: 'style', hidden: true },
            { type: 'chore', hidden: true },
            { type: 'test', hidden: true },
            { type: 'build', hidden: true },
            { type: 'ci', hidden: true }
          ]
        }
      }
    ],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/update-versions.mjs ${nextRelease.version}',
        publishCmd: 'node scripts/publish-packages.mjs'
      }
    ],
    ['@semantic-release/github'],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'packages/core/package.json',
          'packages/wallets/*/package.json',
          'packages/frameworks/*/package.json'
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]'
      }
    ]
  ]
}
