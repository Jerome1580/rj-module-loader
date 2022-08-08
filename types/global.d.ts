
interface fn {
    (require,exports,module): void
}

declare function define(fn): void;
declare var startUp: any;


declare global {
    interface Window {
        // startUp: any;
        [key:string]:any
    }
}
