import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ps from 'process';
import globby from 'globby';

export const LANG: string = 'lang';
export const GEN_FOLDER: string = 'generated';

export type PackageJson = { location: string; content: Record<string, any> };
export type MessageStringsResponseType = Record<string, Record<string, Record<string, string>>>;
export const loadPackageJsonContent = (path: string) => {
  // https://github.com/Microsoft/TypeScript/issues/19495
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(path);
};

// Recursively search for the root package.json on a yarn workspace
export function findRootPackageJson(directory: string = __dirname): PackageJson {
  if (directory === '/') {
    throw new Error('Unable to find root package.json');
  }
  const filePath = path.join(directory, 'package.json');
  // Check if file exists and we can read it.
  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);
    const packageJsonContent = loadPackageJsonContent(filePath);
    if (!packageJsonContent.workspaces) {
      // not a root package, try to find it in the directory above
      return findRootPackageJson(path.dirname(directory));
    }
    return { location: filePath, content: packageJsonContent };
  } catch (_) {
    // No package.json file here, go up.
    return findRootPackageJson(path.dirname(directory));
  }
}

// Use yarn to get the package list
export type PackageType = {
  location: string;
  name: string;
};
export function getPackages(): PackageType[] {
  let packages: { location: string; name: string }[] = [];
  const output = execSync('yarn workspaces list --json').toString('utf-8');
  const lines = output.split('\n');
  lines.forEach(line => {
    try {
      packages.push(JSON.parse(line));
    } catch {
      // Unable to parse line as JSON, continue
    }
  });
  return packages.filter(pkg => pkg.name !== 'root');
}

export async function scanForMessageStrings(): Promise<MessageStringsResponseType> {
  let allMessages: MessageStringsResponseType = {};
  const rootPackageJson = findRootPackageJson();
  let rootLocation = path.dirname(rootPackageJson.location);
  let packages = getPackages();
  packages.push({ name: 'root', location: '' });

  for (const pkgInfo of packages) {
    const pkg = loadPackageJsonContent(rootLocation + '/' + pkgInfo.location + '/package.json');
    // Do the package has lang data?
    if (pkg.hasOwnProperty(LANG)) {
      const localePath = `${rootLocation}/${pkgInfo.location}/${pkg.lang}/*.json`;

      const files = await globby(localePath);
      for (const filePath of files) {
        const locale = path.basename(filePath, '.json');
        if (!allMessages.hasOwnProperty(pkg.name)) {
          allMessages[pkg.name] = {};
        }
        allMessages[pkg.name][locale] = require(filePath);
      }
    }
  }
  return allMessages;
}

export function getAllPackageJsonPaths(): string[] {
  const rootPackageJson = findRootPackageJson();
  const packages = getPackages();
  let pkgJsonPaths: string[] = [];

  pkgJsonPaths.push(rootPackageJson.location);
  for (const pkg of packages) {
    pkgJsonPaths.push(
      path.dirname(rootPackageJson.location) + '/' + pkg.location + '/package.json'
    );
  }
  return pkgJsonPaths;
}

export async function getAllLangFiles(): Promise<string[]> {
  let paths: string[] = [];
  let pkgJsonPaths = getAllPackageJsonPaths();
  for (const pkgPath of pkgJsonPaths) {
    const pkg = require(pkgPath);
    if (pkg.hasOwnProperty(LANG)) {
      const langPath = path.dirname(pkgPath) + '/' + pkg[LANG] + '/*.json';
      const langFiles = await globby(langPath);
      paths = paths.concat(langFiles);
    }
  }
  return paths;
}

export function extractMessagesFromPackage(pkg: PackageType) {
  const rootLocation = path.dirname(findRootPackageJson().location);
  let relativePath = path.relative(ps.cwd(), path.join(rootLocation, pkg.location));
  if (!relativePath) {
    relativePath = '*';
  }
  let cmd = `yarn formatjs extract ${relativePath}/**/*.{ts,tsx} --ignore ${relativePath}/**/*.d.{ts,tsx} `;
  try {
    const output = execSync(cmd).toString('utf-8');
    return JSON.parse(output);
  } catch {
    throw new Error(
      'Unable to extract messages from package, make sure you have yarn and formatjs installed'
    );
  }
}

export function getIntersectionBetween(
  globalMessages: Record<string, string>,
  extractedMessages: Record<string, string>
) {
  let intersectedObject: Record<string, string> = {};
  const intersectedKeys = Object.keys(extractedMessages).filter(
    {}.hasOwnProperty.bind(globalMessages)
  );
  for (const key of intersectedKeys) {
    intersectedObject[key] = globalMessages[key];
  }
  return intersectedObject;
}

export function createGeneratedDirectories() {
  const rootPackageJson = findRootPackageJson();
  const packageJsonPaths = getAllPackageJsonPaths().slice(1);
  // All packages except rootPackage
  for (const jsonPath of packageJsonPaths) {
    const packageJson = loadPackageJsonContent(jsonPath);
    if (packageJson.hasOwnProperty(LANG)) {
      const langPath = path.join(path.dirname(jsonPath), packageJson[LANG]);
      const genFolder = path.join(langPath, '..', GEN_FOLDER);
      // Directory specified on the package.json file does not exist
      if (!fs.existsSync(langPath)) {
        fs.mkdirSync(langPath);
      }
      if (!fs.existsSync(genFolder)) {
        fs.mkdirSync(genFolder, { recursive: true });
      }
    }
  }
  // root package
  if (rootPackageJson.content.hasOwnProperty(LANG)) {
    const genRootFolder = path.join(
      path.dirname(rootPackageJson.location),
      rootPackageJson.content[LANG],
      GEN_FOLDER
    );
    if (!fs.existsSync(genRootFolder)) {
      fs.mkdirSync(genRootFolder, { recursive: true });
    }
  }
}
