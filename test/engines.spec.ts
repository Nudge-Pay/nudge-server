import * as fs from 'fs';
import * as path from 'path';

interface PackageJson {
  engines?: {
    node?: string;
  };
}

describe('Node runtime engines specification', () => {
  const rootDir = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const nvmrcPath = path.join(rootDir, '.nvmrc');

  it('package.json should define engines.node matching Node 20+', () => {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw) as PackageJson;
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines?.node).toBeDefined();
    expect(pkg.engines?.node).toBe('>=20.0.0');
  });

  it('.nvmrc should specify CI major version 20', () => {
    expect(fs.existsSync(nvmrcPath)).toBe(true);
    const nvmrc = fs.readFileSync(nvmrcPath, 'utf8').trim();
    expect(nvmrc).toBe('20');
  });

  it('current runtime version should satisfy engines.node', () => {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw) as PackageJson;
    const nodeEngine = pkg.engines?.node ?? '>=20';
    const minMajor = parseInt(nodeEngine.replace(/\D+/, ''), 10);
    const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
    expect(currentMajor).toBeGreaterThanOrEqual(minMajor);
  });
});
