# Plugins


## Webpack Build i18n Plugin

A webpack plugin for merging all language files in a monorepo. 

### Features
* generates a global message file for translation systems.
* generate a message file for each package with only the required translation strings
* hooks into webpack and HMR for tracking language file changes


### Dependencies
* yarn workspaces
* formatjs

### How it works 
When added to your webpack config plugin list, BuildI18nPlugin will hook into 3 events:

**compiler.hooks.initialize** - Initialize will scan all package.json files and look for the 'lang' property. 
The `lang` property should provide the location to search for language files (e.g en-US.json)
With that information it will make sure directories needed, and paths are created.

**compiler.hooks.watchRun** - The bulk of the work is done here, it scans, parses all message files and merged them. 
This is then copied into the Root package for using it with translation services. It will also extract the required 
messages for each subpackage and place a generated translation file for each locale in the particular package.

e.g.
```bash
- rootPackage
   | - lang/generated
   | | - en-US.json (all messages merged)
   | - packageOne/src/i18n/
   | |--- locales/en-US.json (local messages/translations)
   | |--- generated/en-US.json (subset of messages that apply only to this package)
   | - packageTwo/app/i18n
   | |--- locales/en-US.json 
   | |--- generated/en-US.json (subset of messages that apply only to this package)
   | - packageThree/src/i18n
   | |--- locales/en-US.json
   | |--- generated/en-US.json (subset of messages that apply only to this package)
```

** compiler.hooks.afterCompile ** - Since the packages will point to a generated json file for loading their translations
we need a way ensure any change in the local translation will trigger a reload/rebuild of the generated files. We do that here.

## FAQ
**Which language should I use on my local files?**
The plugin language agnostic, plugin does not care about the language/locale of the message list. It tracks are available locales. 
So if you want to do your translations locally on a subpackage you can, the plugin will take care of merging and organize them.

**Why split message files?**
This allows to in the future package each subpackage independently with its own translations.