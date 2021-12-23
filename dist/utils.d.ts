export declare const LANG: string;
export declare const GEN_FOLDER: string;
export declare type PackageJson = {
    location: string;
    content: Record<string, any>;
};
export declare type MessageStringsResponseType = Record<string, Record<string, Record<string, string>>>;
export declare const loadPackageJsonContent: (path: string) => any;
export declare function findRootPackageJson(directory?: string): PackageJson;
export declare type PackageType = {
    location: string;
    name: string;
};
export declare function getPackages(): PackageType[];
export declare function scanForMessageStrings(): Promise<MessageStringsResponseType>;
export declare function getAllPackageJsonPaths(): string[];
export declare function getAllLangFiles(): Promise<string[]>;
export declare function extractMessagesFromPackage(pkg: PackageType): any;
export declare function getIntersectionBetween(globalMessages: Record<string, string>, extractedMessages: Record<string, string>): Record<string, string>;
export declare function createGeneratedDirectories(): void;
