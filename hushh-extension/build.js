// build.js — esbuild bundler for Hushh Chrome extension
// Bundles ES modules into single files Chrome MV3 can load directly.
//
// Usage:
//   node build.js          → development build (sourcemaps, no minify)
//   node build.js --watch  → watch mode
//   node build.js --prod   → production build (minified, no sourcemaps)

const esbuild = require('esbuild');
const path = require('path');

const isProd  = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  format: 'iife',   // IIFE — no import/export in output (Chrome MV3 compat)
  target: ['chrome109'],
  sourcemap: !isProd,
  minify: isProd,
  logLevel: 'info',
};

const entryPoints = [
  {
    in: 'content/index.js',
    out: 'dist/content/index',
  },
  {
    in: 'background/service-worker.js',
    out: 'dist/background/service-worker',
    // Service workers use ESM in MV3
    format: 'esm',
  },
  {
    in: 'popup/popup.js',
    out: 'dist/popup/popup',
  },
];

async function build() {
  const contexts = await Promise.all(
    entryPoints.map(({ in: entryIn, out, format }) =>
      esbuild.context({
        ...sharedConfig,
        entryPoints: [entryIn],
        outfile: `${out}.js`,
        format: format ?? sharedConfig.format,
      })
    )
  );

  if (isWatch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching for changes…');
  } else {
    await Promise.all(contexts.map(ctx => ctx.rebuild().then(() => ctx.dispose())));
    console.log('Build complete.');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
