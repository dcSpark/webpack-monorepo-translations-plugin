"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const ps = __importStar(require("process"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
class BuildI18nPlugin {
    printHeader() {
        console.log('-'.repeat(80));
        console.log(`[${BuildI18nPlugin.name}]`);
        console.log('-'.repeat(80));
    }
    printFooter() {
        console.log('-'.repeat(80));
    }
    apply(compiler) {
        compiler.hooks.initialize.tap(BuildI18nPlugin.name, async () => {
            this.printHeader();
            utils_1.createGeneratedDirectories();
            await processI18nFiles();
            this.printFooter();
        });
        compiler.hooks.watchRun.tapAsync(BuildI18nPlugin.name, async (compiler, callback) => {
            let validFilesCount = 0;
            if (compiler.modifiedFiles) {
                for (const filename of compiler.modifiedFiles.values()) {
                    if (!filename.includes(utils_1.GEN_FOLDER)) {
                        validFilesCount++;
                    }
                }
            }
            if (validFilesCount > 0) {
                this.printHeader();
                await processI18nFiles();
                this.printFooter();
            }
            callback();
        });
        compiler.hooks.afterCompile.tapAsync(BuildI18nPlugin.name, async (compilation, callback) => {
            for (const filePath of await utils_1.getAllLangFiles()) {
                compilation.fileDependencies.add(filePath);
            }
            callback();
        });
    }
}
exports.default = BuildI18nPlugin;
module.exports = BuildI18nPlugin;
async function processI18nFiles() {
    console.log('Processing Language files...');
    // Naive implementation, any package that runs this plugin will update
    // all sibling packages.
    const currentPackage = utils_1.loadPackageJsonContent(ps.cwd() + '/package.json');
    if (!currentPackage.hasOwnProperty(utils_1.LANG)) {
        console.log('No lang property found in package, skipping...');
        return;
    }
    const allMessageStringsByPackage = await utils_1.scanForMessageStrings();
    const packageKeys = Object.keys(allMessageStringsByPackage);
    // Merging...
    let messagesByLocale = {};
    for (const key of packageKeys) {
        if (!(key == currentPackage.name)) {
            for (const locale in allMessageStringsByPackage[key]) {
                if (messagesByLocale.hasOwnProperty(locale)) {
                    messagesByLocale[locale] = {
                        ...messagesByLocale[locale],
                        ...allMessageStringsByPackage[key][locale],
                    };
                }
                else {
                    messagesByLocale[locale] = {
                        ...allMessageStringsByPackage[key][locale],
                    };
                }
            }
        }
    }
    for (const locale in allMessageStringsByPackage[currentPackage.name]) {
        if (messagesByLocale.hasOwnProperty(locale)) {
            messagesByLocale[locale] = {
                ...messagesByLocale[locale],
                ...allMessageStringsByPackage[currentPackage.name][locale],
            };
        }
        else {
            messagesByLocale[locale] = {
                ...allMessageStringsByPackage[currentPackage.name][locale],
            };
        }
    }
    const rootPackage = utils_1.findRootPackageJson();
    let rootSaveLocation;
    if (rootPackage.content.hasOwnProperty(utils_1.LANG)) {
        rootSaveLocation = path_1.default.join(path_1.default.dirname(rootPackage.location), rootPackage.content[utils_1.LANG], utils_1.GEN_FOLDER);
    }
    else {
        // Use default path lang/
        rootSaveLocation = path_1.default.join(path_1.default.dirname(rootPackage.location), utils_1.LANG, utils_1.GEN_FOLDER);
    }
    // Save Root location
    for (const locale in messagesByLocale) {
        fs_1.default.writeFileSync(`${rootSaveLocation}/${locale}.json`, JSON.stringify(messagesByLocale[locale], null, 4), 'utf-8');
    }
    // Save per package translations.
    for (const pkg of utils_1.getPackages()) {
        const messages = await utils_1.extractMessagesFromPackage(pkg);
        const packageJson = utils_1.loadPackageJsonContent(path_1.default.join(path_1.default.dirname(rootPackage.location), pkg.location, 'package.json'));
        if (!packageJson.hasOwnProperty(utils_1.LANG)) {
            continue;
        }
        const saveLocation = path_1.default.join(path_1.default.dirname(rootPackage.location), pkg.location, packageJson[utils_1.LANG], '..', utils_1.GEN_FOLDER);
        for (const locale in messagesByLocale) {
            const newObj = utils_1.getIntersectionBetween(messagesByLocale[locale], messages);
            fs_1.default.writeFileSync(`${saveLocation}/${locale}.json`, JSON.stringify(newObj, null, 4), 'utf-8');
        }
    }
}
