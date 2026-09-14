#!/usr/bin/env node
// Importa pacotes gerados pelo admin (tools/admin.html) e atualiza o site.
// Uso: node tools/importar.mjs projeto-exemplo.zip [outro.zip] [--substituir]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject, SLUG_RE } from './lib/projeto.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const replace = args.includes('--substituir');
const zips = args.filter((arg) => !arg.startsWith('--'));

if (!zips.length) {
  console.error('Uso: node tools/importar.mjs projeto-exemplo.zip [outro.zip] [--substituir]');
  process.exit(1);
}

function extract(zip, dest) {
  // tar (Windows 10+, macOS) descompacta .zip; em Linux usa o unzip
  for (const [command, commandArgs] of [['tar', ['-xf', zip, '-C', dest]], ['unzip', ['-q', zip, '-d', dest]]]) {
    try {
      execFileSync(command, commandArgs, { stdio: 'pipe' });
      return;
    } catch {
      // tenta a próxima opção
    }
  }
  throw new Error('não foi possível descompactar o arquivo (instale o "unzip").');
}

function findProjectDir(dir, depth = 0) {
  if (existsSync(join(dir, 'projeto.json'))) return dir;
  if (depth > 2) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const found = findProjectDir(join(dir, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

let imported = 0;
for (const arg of zips) {
  const zip = resolve(arg);
  const tmp = mkdtempSync(join(tmpdir(), 'muma-'));
  try {
    if (!existsSync(zip)) throw new Error('arquivo não encontrado.');
    extract(zip, tmp);

    const source = findProjectDir(tmp);
    if (!source) throw new Error('o pacote não tem projeto.json.');
    // pacote com a pasta do projeto dentro; se vier "solto", usa o nome do .zip
    const slug = source === tmp ? basename(zip, '.zip').replace(/^projeto-/, '') : basename(source);
    if (!SLUG_RE.test(slug)) throw new Error(`"${slug}" não é um endereço válido.`);

    const data = JSON.parse(readFileSync(join(source, 'projeto.json'), 'utf8'));
    const { errors, warnings } = validateProject(data, slug, (file) => existsSync(join(source, file)));
    if (errors.length) throw new Error(`\n  - ${errors.join('\n  - ')}`);

    const target = join(ROOT, 'assets', 'projetos', slug);
    const exists = existsSync(target);
    if (exists && !replace) throw new Error(`já existe assets/projetos/${slug}. Para atualizar, rode de novo com --substituir.`);

    rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
    warnings.forEach((warning) => console.warn(`  aviso: ${warning}`));
    console.log(`✓ ${slug} ${exists ? 'atualizado' : 'importado'}`);
    imported++;
  } catch (error) {
    console.error(`✗ ${basename(zip)}: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (imported) execFileSync(process.execPath, [join(ROOT, 'tools', 'build.mjs')], { stdio: 'inherit' });
