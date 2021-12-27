"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeneratedDirectories = exports.getIntersectionBetween = exports.extractMessagesFromPackage = exports.getAllLangFiles = exports.getAllPackageJsonPaths = exports.scanForMessageStrings = exports.getPackages = exports.findRootPackageJson = exports.loadPackageJsonContent = exports.GEN_FOLDER = exports.LANG = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const process_1 = __importDefault(require("process"));
const globby_1 = __importDefault(require("globby"));
exports.LANG = 'lang';
exports.GEN_FOLDER = 'generated';
const loadPackageJsonContent = (path) => {
    // https://github.com/Microsoft/TypeScript/issues/19495
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(path);
};
exports.loadPackageJsonContent = loadPackageJsonContent;
// Recursively search for the root package.json on a yarn workspace
function findRootPackageJson(directory = __dirname) {
    if (directory === '/') {
        throw new Error('Unable to find root package.json');
    }
    const filePath = path_1.default.join(directory, 'package.json');
    // Check if file exists and we can read it.
    try {
        fs_1.default.accessSync(filePath, fs_1.default.constants.F_OK | fs_1.default.constants.R_OK);
        const packageJsonContent = exports.loadPackageJsonContent(filePath);
        if (!packageJsonContent.workspaces) {
            // not a root package, try to find it in the directory above
            return findRootPackageJson(path_1.default.dirname(directory));
        }
        return { location: filePath, content: packageJsonContent };
    }
    catch (_) {
        // No package.json file here, go up.
        return findRootPackageJson(path_1.default.dirname(directory));
    }
}
exports.findRootPackageJson = findRootPackageJson;
function getPackages() {
    let packages = [];
    const output = child_process_1.execSync('yarn workspaces list --json').toString('utf-8');
    const lines = output.split('\n');
    lines.forEach(line => {
        try {
            packages.push(JSON.parse(line));
        }
        catch {
            // Unable to parse line as JSON, continue
        }
    });
    return packages.filter(pkg => pkg.name !== 'root');
}
exports.getPackages = getPackages;
async function scanForMessageStrings() {
    let allMessages = {};
    const rootPackageJson = findRootPackageJson();
    let rootLocation = path_1.default.dirname(rootPackageJson.location);
    let packages = getPackages();
    packages.push({ name: 'root', location: '' });
    for (const pkgInfo of packages) {
        const pkg = exports.loadPackageJsonContent(rootLocation + '/' + pkgInfo.location + '/package.json');
        // Do the package has lang data?
        if (pkg.hasOwnProperty(exports.LANG)) {
            const localePath = `${rootLocation}/${pkgInfo.location}/${pkg.lang}/*.json`;
            const files = await globby_1.default(localePath);
            for (const filePath of files) {
                const locale = path_1.default.basename(filePath, '.json');
                if (!allMessages.hasOwnProperty(pkg.name)) {
                    allMessages[pkg.name] = {};
                }
                allMessages[pkg.name][locale] = require(filePath);
            }
        }
    }
    return allMessages;
}
exports.scanForMessageStrings = scanForMessageStrings;
function getAllPackageJsonPaths() {
    const rootPackageJson = findRootPackageJson();
    const packages = getPackages();
    let pkgJsonPaths = [];
    pkgJsonPaths.push(rootPackageJson.location);
    for (const pkg of packages) {
        pkgJsonPaths.push(path_1.default.dirname(rootPackageJson.location) + '/' + pkg.location + '/package.json');
    }
    return pkgJsonPaths;
}
exports.getAllPackageJsonPaths = getAllPackageJsonPaths;
async function getAllLangFiles() {
    let paths = [];
    let pkgJsonPaths = getAllPackageJsonPaths();
    for (const pkgPath of pkgJsonPaths) {
        const pkg = require(pkgPath);
        if (pkg.hasOwnProperty(exports.LANG)) {
            const langPath = path_1.default.dirname(pkgPath) + '/' + pkg[exports.LANG] + '/*.json';
            const langFiles = await globby_1.default(langPath);
            paths = paths.concat(langFiles);
        }
    }
    return paths;
}
exports.getAllLangFiles = getAllLangFiles;
function extractMessagesFromPackage(pkg) {
    const rootLocation = path_1.default.dirname(findRootPackageJson().location);
    let relativePath = path_1.default.relative(process_1.default.cwd(), path_1.default.join(rootLocation, pkg.location));
    if (!relativePath) {
        relativePath = '*';
    }
    let cmd = `yarn formatjs extract "${relativePath}/**/*.{ts,tsx}" --ignore "${relativePath}/**/*.d.{ts,tsx}" `;
    try {
        const output = child_process_1.execSync(cmd).toString('utf-8');
        return JSON.parse(output);
    }
    catch {
        throw new Error('Unable to extract messages from package, make sure you have yarn and formatjs installed');
    }
}
exports.extractMessagesFromPackage = extractMessagesFromPackage;
function getIntersectionBetween(globalMessages, extractedMessages) {
    let intersectedObject = {};
    const intersectedKeys = Object.keys(extractedMessages).filter({}.hasOwnProperty.bind(globalMessages));
    for (const key of intersectedKeys) {
        intersectedObject[key] = globalMessages[key];
    }
    return intersectedObject;
}
exports.getIntersectionBetween = getIntersectionBetween;
function createGeneratedDirectories() {
    const rootPackageJson = findRootPackageJson();
    const packageJsonPaths = getAllPackageJsonPaths().slice(1);
    // All packages except rootPackage
    for (const jsonPath of packageJsonPaths) {
        const packageJson = exports.loadPackageJsonContent(jsonPath);
        if (packageJson.hasOwnProperty(exports.LANG)) {
            const langPath = path_1.default.join(path_1.default.dirname(jsonPath), packageJson[exports.LANG]);
            const genFolder = path_1.default.join(langPath, '..', exports.GEN_FOLDER);
            // Directory specified on the package.json file does not exist
            if (!fs_1.default.existsSync(langPath)) {
                fs_1.default.mkdirSync(langPath);
            }
            if (!fs_1.default.existsSync(genFolder)) {
                fs_1.default.mkdirSync(genFolder, { recursive: true });
            }
        }
    }
    // root package
    if (rootPackageJson.content.hasOwnProperty(exports.LANG)) {
        const genRootFolder = path_1.default.join(path_1.default.dirname(rootPackageJson.location), rootPackageJson.content[exports.LANG], exports.GEN_FOLDER);
        if (!fs_1.default.existsSync(genRootFolder)) {
            fs_1.default.mkdirSync(genRootFolder, { recursive: true });
        }
    }
}
exports.createGeneratedDirectories = createGeneratedDirectories;
