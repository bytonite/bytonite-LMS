// This is a partial mock of the Obsidian API to allow plugins to load.
export class App {
    vault: Vault;
    workspace: Workspace;
    
    constructor() {
        this.vault = new Vault();
        this.workspace = new Workspace();
    }
}

export class Vault {
    getFiles() { return []; }
    read(_file: any) { return ""; }
}

export class Workspace {
    on(_event: string, _callback: Function) {}
}

export class Plugin {
    app: App;
    manifest: any;
    
    constructor(app: App, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }

    onload() {}
    onunload() {}
}

export const Menu = class {};
export const Modal = class {};
export const Notice = class {};
