import type { Compiler } from 'webpack';
export default class BuildI18nPlugin {
    printHeader(): void;
    printFooter(): void;
    apply(compiler: Compiler): void;
}
