import ts from 'typescript';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packagesRoot = resolve(root, 'packages');
const output = resolve(root, 'dist/npm/payouts');
const modules = ['payouts', 'client', 'sdk', 'crypto', 'protocol', 'ens', 'wallet', 'prover', 'contracts', 'graph-client'];
const entrypoints = {
  '.': 'payouts/src/index', './client': 'payouts/src/client', './cre': 'payouts/src/cre',
  './jobs': 'payouts/src/jobs', './withdrawals': 'payouts/src/withdrawals',
  './sdk': 'sdk/src/index', './ens': 'ens/src/index', './wallet': 'wallet/src/index',
  './prover': 'prover/src/index', './prover/runtime': 'prover/src/runtime',
};
const manifests = new Map();
const rootNames = [];
for (const name of modules) {
  manifests.set(`@null-protocol/${name}`, JSON.parse(await readFile(resolve(packagesRoot, name, 'package.json'), 'utf8')));
  for (const entry of await readdir(resolve(packagesRoot, name, 'src'))) {
    if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) rootNames.push(resolve(packagesRoot, name, 'src', entry));
  }
}

const config = ts.readConfigFile(resolve(root, 'tsconfig.base.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const { options, errors } = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, root);
if (errors.length) throw new Error(errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
Object.assign(options, { noEmit: false, declaration: true, rootDir: packagesRoot, outDir: resolve(output, 'dist'), noEmitOnError: true });
const program = ts.createProgram(rootNames, options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
}));

// Only remove this fixed build directory, never a caller-supplied path.
if (relative(root, output) !== ['dist', 'npm', 'payouts'].join(sep)) throw new Error('Unexpected npm output directory');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const external = new Set();
const emitted = [];
function rewriteSpecifier(specifier, sourceFile) {
  if (specifier.startsWith('@null-protocol/')) {
    const [, name, ...subpath] = specifier.split('/');
    const manifest = manifests.get(`@null-protocol/${name}`);
    const target = manifest?.exports[subpath.length ? `./${subpath.join('/')}` : '.'];
    if (typeof target !== 'string') throw new Error(`Unpackaged workspace import: ${specifier}`);
    const destination = resolve(packagesRoot, name, target).replace(/\.ts$/, '.js');
    const path = relative(dirname(sourceFile), destination).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
  }
  if (specifier.startsWith('.')) {
    if (/\.tsx?$/.test(specifier)) return specifier.replace(/\.tsx?$/, '.js');
    return /\.[a-z]+$/i.test(specifier) ? specifier : `${specifier}.js`;
  }
  if (!specifier.startsWith('node:')) external.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]);
  return specifier;
}
// Rewrite only module specifiers and the proof-worker URL, in JS and declarations.
function rewriteImports(context) {
  return source => {
    const visit = node => {
      if (ts.isStringLiteral(node)) {
        const parent = node.parent;
        const moduleSpecifier = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
        const importType = ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent) && parent.parent.argument === parent;
        const dynamicImport = ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword;
        const workerUrl = ts.isNewExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'URL' && node.text === './worker.ts';
        if (moduleSpecifier || importType || dynamicImport || workerUrl) return context.factory.createStringLiteral(rewriteSpecifier(node.text, source.fileName));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(source, visit);
  };
}
// Parse emitted files again so parent pointers are consistent for declaration transforms.
const result = program.emit(undefined, (filename, content) => {
  const parsed = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true, filename.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  // The preserved source directory layout makes relative paths identical in source and dist.
  const transformed = ts.transform(parsed, [context => source => {
    const originalName = source.fileName;
    source.fileName = resolve(packagesRoot, relative(resolve(output, 'dist'), filename));
    const rewritten = rewriteImports(context)(source);
    source.fileName = originalName;
    return rewritten;
  }]);
  emitted.push({ filename, content: ts.createPrinter().printFile(transformed.transformed[0]) });
  transformed.dispose();
});
if (result.emitSkipped) throw new Error('npm package compilation failed');
for (const file of emitted) {
  await mkdir(dirname(file.filename), { recursive: true });
  await writeFile(file.filename, file.content);
}

const manifest = JSON.parse(await readFile(resolve(root, 'tools/npm/payouts.package.json'), 'utf8'));
manifest.main = './dist/payouts/src/index.js';
manifest.types = './dist/payouts/src/index.d.ts';
manifest.exports = Object.fromEntries(Object.entries(entrypoints).map(([name, path]) => [name, {
  types: `./dist/${path}.d.ts`, import: `./dist/${path}.js`,
}]));
manifest.dependencies = {};
for (const name of [...external].sort()) {
  const versions = new Set([...manifests.values()].map(pkg => pkg.dependencies?.[name]).filter(Boolean));
  if (versions.size !== 1 || [...versions][0].startsWith('workspace:')) throw new Error(`Missing or inconsistent external dependency: ${name}`);
  manifest.dependencies[name] = [...versions][0];
}
await writeFile(resolve(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(output, 'README.md'), await readFile(resolve(root, 'tools/npm/README.md')));
await writeFile(resolve(output, 'LICENSE'), await readFile(resolve(root, 'LICENSE')));
const guide = (await readFile(resolve(root, 'docs/SDK_INTEGRATION.md'), 'utf8'))
  .replaceAll('@null-protocol/payouts', manifest.name)
  .replaceAll('@null-protocol/client', `${manifest.name}/client`)
  .replaceAll('@null-protocol/sdk', `${manifest.name}/sdk`)
  .replaceAll('@null-protocol/ens', `${manifest.name}/ens`)
  .replaceAll('@null-protocol/wallet', `${manifest.name}/wallet`);
await writeFile(resolve(output, 'INTEGRATION.md'), guide.replace(/\]\((\.\.\/|\.\/)?([^):\s]+)\)/g, (match, prefix, path) => {
  if (path.startsWith('https:')) return match;
  return `](https://github.com/Samarth208P/null/blob/main/${prefix === '../' ? '' : 'docs/'}${path})`;
}));
console.log(`Built ${manifest.name}@${manifest.version}: ${emitted.length} JavaScript/type files, ${external.size} external dependencies.\n${output}`);
