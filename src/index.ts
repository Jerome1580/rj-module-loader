///<reference path="../types/global.d.ts"/>
enum STATUS {
    INIT,
    FETCHED = 1,
    SAVED,
    LOADING,
    LOADED,
    EXECUTING,
    EXECUTED
}

type DATA = {
    preload: any[]
    cwd?: string
}


(function (global) {

    let data: DATA = {
        preload: []
    }
    let cache = {}
    // 模块的生命周期
    let status: STATUS
    let anonymousMeta = {}

    let isArray = function (obj) {
        // @ts-ignore
        return Object.prototype.toString.call(obj) === '[object Array]'
    }
    let isFunction = function (obj) {
        // @ts-ignore
        return Object.prototype.toString.call(obj) === '[object Function]'
    }

    // 构造函数 模块初始化数据
    class Module {
        public uri: string
        public deps: any[] = []
        public exports: any
        public status: STATUS
        public factory: (r: any, e: any, m: any) => any
        public callback: (...arg: any[]) => void

        // 谁依赖我，谁等着我
        private _waitings: any
        // 我依赖谁
        private _remain: number

        constructor(uri: any, deps: any[]) {
            this.uri = uri
            this.deps = deps
            this.exports = null
            this.status = STATUS.INIT
            this._waitings = {}
            this._remain = 0  // 我依赖的数量
            this.factory = f => f
            this.callback = f => {
            }
        }

        // 检测缓存对象是否有当前模块信息
        static get(uri, deps = []) {
            if (!cache[uri]) {
                /**
                 * cache {
                 *     localhost://a.js : {
                 *         id:,
                 *         deps:,
                 *         factory:
                 *     }
                 * }
                 */
                cache[uri] = new Module(uri, deps)
            }
            return cache[uri]
        }

        static use(deps, callback, uri) {
            let m = Module.get(uri, isArray(deps) ? deps : [deps])
            m.callback = function () {
                // debugger
                let exports: any[] = []
                let uris = m.resolve()
                for (let i = 0; i < uris.length; i++) {
                    exports[i] = cache[uris[i]].exec()
                }
                if (callback) {
                    callback.apply(global, exports)
                }
            }
            m.load()
        }

        static preload(callback) {
            let length = data?.preload?.length
            if (!length) callback()

        }

        // 定义一个模块
        static define(factory: () => void) {
            // debugger
            let deps;
            if (isFunction(factory)) {
                deps = parseDependencies(factory.toString())
            }

            anonymousMeta = {
                id: '',
                uri: "",
                deps: deps,
                factory
            }
        }

        public exec() {
            let m = this
            if (m.status >= STATUS.EXECUTING) {
                return m.exports
            }
            m.status = STATUS.EXECUTING

            let uri = m.uri

            function require(id) {
                return Module.get(startUp.resolve(id, uri)).exec()
            }


            let factory = m.factory
            let exports = factory(require, m.exports = {}, m)
            // 兼容没有返回值，直接赋值模块中exports的情况
            if (exports === undefined) {
                exports = m.exports
            }
            m.exports = exports
            m.status = STATUS.EXECUTED
            return exports
        }

        // 分析主干依赖项
        public load() {
            // debugger
            let m = this
            m.status = STATUS.LOADING // 正在加载依赖项
            let uris = m.resolve() // 获取该模块所有依赖的资源
            let len = m._remain = uris.length

            let seed;
            for (let i = 0; i < len; i++) {
                seed = Module.get(uris[i]) // 没有缓存注册缓存
                // debugger
                if (seed.status < STATUS.LOADED) {// LOAD == 4 准备加载
                    seed._waitings[m.uri] = seed._waitings[m.uri] || 1
                } else {
                    seed._remain--;
                }

            }

            // 如果依赖列表模块全部加载完毕
            if (m._remain === 0) {
                // 获取模块接口对象
                m.onload()
            }

            // 准备执行根目录下的依赖列表中的模块
            let requestCache = {}
            for (let i = 0; i < len; i++) {
                seed = Module.get(uris[i])
                if (seed.status < STATUS.FETCHED) { // 如果没有请求过，注册请求事件，包括分析依赖啊等等
                   // 给 requestCache 赋值
                    seed.fetch(requestCache)
                }

            }

            /**
             * requestCache {
             *     ['localhost://a.js']:() => start.up('uri/a.js',save a info and load a)
             *     ['localhost://b.js']:() => start.up('uri/b.js',save b info and load b)
             * }
             */
            for (let uri in requestCache) {
                requestCache[uri]()
            }
        }

        public save(uri, meta) {
            let m = Module.get(uri)
            m.uri = uri
            m.deps = meta.deps || []
            m.factory = meta.factory
            m.status = STATUS.SAVED
        }

        public fetch(requestCache) {
            let m = this
            m.status = STATUS.FETCHED
            let uri = m.uri // a.js 绝对路径地址
            requestCache[uri] = sendRequest

            function sendRequest() {
                startUp.request(uri, onRequest)
            }

            function onRequest() {
                if (anonymousMeta) {
                    m.save(uri, anonymousMeta)
                }
                // a 加载完后，要执行
                m.load()
            }
        }

        // 资源定位，收集该模块的所有依赖
        public resolve() {
            let mod = this
            let ids = mod.deps
            let uris: any[] = []
            for (let i = 0; i < ids.length; i++) {
                uris[i] = startUp.resolve(ids[i], mod.uri)
            }
            return uris

        }

        public onload() {
            // debugger
            let m = this;
            m.status = STATUS.LOADED
            if (m.callback) {
                m.callback()
            }
            /**
             * a.js 的 waitings : {
             *     ['主程序 _use_0_.js']:1,
             *     ['主程序 _use_1_.js']:1
             *
             * }
             */
            let waitings = m._waitings  // waiting 就是当前主程序
            for (let key in waitings) { // 遍历当前所有依赖该模块的 模块
                let m = cache[key]
                // 取出当前主应用的依赖数
                m._remain -= waitings[key]

                // 如果依赖这个 a.js 的依赖项，全部加载完，加载主程序
                if (m._remain === 0) {
                    m.onload()
                }

            }
        }

    }

    let REQUIRE_RE = /\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g

    function parseDependencies(code) {
        let ret: any[] = []
        code.replace(REQUIRE_RE, function (m, m1, m2) {
            if (m2) ret.push(m2)
        })
        return ret
    }


    class startUp {
        static version = '1.0.1'

        // 生成绝对路径
        static resolve(child, parent): string {
            if (!child) return ""
            return addBase(child, parent)

        }

        static use(list, callback) {
            Module.preload(function () {
                Module.use(list, callback, data.cwd + '_use_' + cid())
            })
        }

        static request(url, callback) {
            let node = document.createElement("script")
            node.src = url

            document.body.appendChild(node)
            node.onload = function () {
                node.onload = null
                document.body.removeChild(node)
                callback()
            }
        }
    }

    function addBase(id, uri): string {
        let result;
        if (id.charAt(0) === '.') {
            result = realPath((uri ? uri.match(/[^?]*\//)?.[0] : data.cwd) + id)
        } else {
            result = data.cwd + id
        }
        return result
    }

    let DOT_RE = /\/.\//g // /a/b/./c/./d  => /a/b/c/d
    let DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//g  // /a/b/c/../../d => /a/b/../d => /a/d

    function realPath(path) {
        path = path.replace(DOT_RE, '/')
        while (path.match(DOUBLE_DOT_RE, '/')) {
            path = path.replace(DOUBLE_DOT_RE, '/')
        }
        return path
    }

    let _cid = 0;
    const cid = () => _cid++

    data.preload = []
    data.cwd = document.URL.match(/[^?]*\//)?.[0];

    global.startUp = startUp
    global.define = Module.define

})(window)
