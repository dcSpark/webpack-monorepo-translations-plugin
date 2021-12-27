import type { Compiler } from 'webpack';
import fs from 'fs';
import * as ps from 'process';
import path from 'path';
import {
  loadPackageJsonContent,
  scanForMessageStrings,
  findRootPackageJson,
  createGeneratedDirectories,
  GEN_FOLDER,
  LANG,
  getAllLangFiles,
  getIntersectionBetween,
  getPackages,
  extractMessagesFromPackage,
} from './utils';

export default class BuildI18nPlugin {
  printHeader() {
    console.log('-'.repeat(80));
    console.log(`[${BuildI18nPlugin.name}]`);
    console.log('-'.repeat(80));
  }
  printFooter() {
    console.log('-'.repeat(80));
  }
  apply(compiler: Compiler) {
    compiler.hooks.initialize.tap(BuildI18nPlugin.name, async () => {
      this.printHeader();
      createGeneratedDirectories();
      await processI18nFiles();
      this.printFooter();
    });

    compiler.hooks.watchRun.tapAsync(BuildI18nPlugin.name, async (compiler, callback) => {
      let validFilesCount = 0;
      if (compiler.modifiedFiles) {
        const langFiles = await getAllLangFiles();
        for (const filename of compiler.modifiedFiles.values()) {
          if (langFiles.includes(filename)) {
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
      for (const filePath of await getAllLangFiles()) {
        compilation.fileDependencies.add(filePath);
      }
      callback();
    });
  }
}

module.exports = BuildI18nPlugin;

async function processI18nFiles() {
  console.log('Processing Language files...');
  // Naive implementation, any package that runs this plugin will update
  // all sibling packages.
  const currentPackage = loadPackageJsonContent(ps.cwd() + '/package.json');
  if (!currentPackage.hasOwnProperty(LANG)) {
    console.log('No lang property found in package, skipping...');
    return;
  }
  const allMessageStringsByPackage = await scanForMessageStrings();
  const packageKeys = Object.keys(allMessageStringsByPackage);

  // Merging...
  let messagesByLocale: any = {};
  for (const key of packageKeys) {
    if (!(key == currentPackage.name)) {
      for (const locale in allMessageStringsByPackage[key]) {
        if (messagesByLocale.hasOwnProperty(locale)) {
          messagesByLocale[locale] = {
            ...messagesByLocale[locale],
            ...allMessageStringsByPackage[key][locale],
          };
        } else {
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
    } else {
      messagesByLocale[locale] = {
        ...allMessageStringsByPackage[currentPackage.name][locale],
      };
    }
  }

  const rootPackage = findRootPackageJson();
  let rootSaveLocation: string;
  if (rootPackage.content.hasOwnProperty(LANG)) {
    rootSaveLocation = path.join(
      path.dirname(rootPackage.location),
      rootPackage.content[LANG],
      GEN_FOLDER
    );
  } else {
    // Use default path lang/
    rootSaveLocation = path.join(path.dirname(rootPackage.location), LANG, GEN_FOLDER);
  }

  // Save Root location
  for (const locale in messagesByLocale) {
    fs.writeFileSync(
      `${rootSaveLocation}/${locale}.json`,
      JSON.stringify(messagesByLocale[locale], null, 4),
      'utf-8'
    );
  }

  // Save per package translations.
  for (const pkg of getPackages()) {
    const messages = await extractMessagesFromPackage(pkg);
    const packageJson = loadPackageJsonContent(
      path.join(path.dirname(rootPackage.location), pkg.location, 'package.json')
    );
    if (!packageJson.hasOwnProperty(LANG)) {
      continue;
    }
    const saveLocation = path.join(
      path.dirname(rootPackage.location),
      pkg.location,
      packageJson[LANG],
      '..',
      GEN_FOLDER
    );
    for (const locale in messagesByLocale) {
      const newObj = getIntersectionBetween(messagesByLocale[locale], messages);
      fs.writeFileSync(`${saveLocation}/${locale}.json`, JSON.stringify(newObj, null, 4), 'utf-8');
    }
  }
}
