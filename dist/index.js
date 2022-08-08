"use strict";

// src/index.ts
(function(global) {
  var _a;
  let data = {
    preload: []
  };
  let cache = {};
  let status;
  let anonymousMeta = {};
  let isArray = function(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  let isFunction = function(obj) {
    return Object.prototype.toString.call(obj) === "[object Function]";
  };
  class Module {
    constructor(uri, deps) {
      this.deps = [];
      this.uri = uri;
      this.deps = deps;
      this.exports = null;
      this.status = 0 /* INIT */;
      this._waitings = {};
      this._remain = 0;
      this.factory = (f) => f;
      this.callback = (f) => {
      };
    }
    static get(uri, deps = []) {
      if (!cache[uri]) {
        cache[uri] = new Module(uri, deps);
      }
      return cache[uri];
    }
    static use(deps, callback, uri) {
      let m = Module.get(uri, isArray(deps) ? deps : [deps]);
      m.callback = function() {
        let exports = [];
        let uris = m.resolve();
        for (let i = 0; i < uris.length; i++) {
          exports[i] = cache[uris[i]].exec();
        }
        if (callback) {
          callback.apply(global, exports);
        }
      };
      m.load();
    }
    static preload(callback) {
      var _a2;
      let length = (_a2 = data == null ? void 0 : data.preload) == null ? void 0 : _a2.length;
      if (!length)
        callback();
    }
    static define(factory) {
      let deps;
      if (isFunction(factory)) {
        deps = parseDependencies(factory.toString());
      }
      anonymousMeta = {
        id: "",
        uri: "",
        deps,
        factory
      };
    }
    exec() {
      let m = this;
      if (m.status >= 5 /* EXECUTING */) {
        return m.exports;
      }
      m.status = 5 /* EXECUTING */;
      let uri = m.uri;
      function require2(id) {
        return Module.get(startUp.resolve(id, uri)).exec();
      }
      let factory = m.factory;
      let exports = factory(require2, m.exports = {}, m);
      if (exports === void 0) {
        exports = m.exports;
      }
      m.exports = exports;
      m.status = 6 /* EXECUTED */;
      return exports;
    }
    load() {
      let m = this;
      m.status = 3 /* LOADING */;
      let uris = m.resolve();
      let len = m._remain = uris.length;
      let seed;
      for (let i = 0; i < len; i++) {
        seed = Module.get(uris[i]);
        if (seed.status < 4 /* LOADED */) {
          seed._waitings[m.uri] = seed._waitings[m.uri] || 1;
        } else {
          seed._remain--;
        }
      }
      if (m._remain === 0) {
        m.onload();
      }
      let requestCache = {};
      for (let i = 0; i < len; i++) {
        seed = Module.get(uris[i]);
        if (seed.status < 1 /* FETCHED */) {
          seed.fetch(requestCache);
        }
      }
      for (let uri in requestCache) {
        requestCache[uri]();
      }
    }
    save(uri, meta) {
      let m = Module.get(uri);
      m.uri = uri;
      m.deps = meta.deps || [];
      m.factory = meta.factory;
      m.status = 2 /* SAVED */;
    }
    fetch(requestCache) {
      let m = this;
      m.status = 1 /* FETCHED */;
      let uri = m.uri;
      requestCache[uri] = sendRequest;
      function sendRequest() {
        startUp.request(uri, onRequest);
      }
      function onRequest() {
        if (anonymousMeta) {
          m.save(uri, anonymousMeta);
        }
        m.load();
      }
    }
    resolve() {
      let mod = this;
      let ids = mod.deps;
      let uris = [];
      for (let i = 0; i < ids.length; i++) {
        uris[i] = startUp.resolve(ids[i], mod.uri);
      }
      return uris;
    }
    onload() {
      let m = this;
      m.status = 4 /* LOADED */;
      if (m.callback) {
        m.callback();
      }
      let waitings = m._waitings;
      for (let key in waitings) {
        let m2 = cache[key];
        m2._remain -= waitings[key];
        if (m2._remain === 0) {
          m2.onload();
        }
      }
    }
  }
  let REQUIRE_RE = /\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
  function parseDependencies(code) {
    let ret = [];
    code.replace(REQUIRE_RE, function(m, m1, m2) {
      if (m2)
        ret.push(m2);
    });
    return ret;
  }
  class startUp {
    static resolve(child, parent) {
      if (!child)
        return "";
      return addBase(child, parent);
    }
    static use(list, callback) {
      Module.preload(function() {
        Module.use(list, callback, data.cwd + "_use_" + cid());
      });
    }
    static request(url, callback) {
      let node = document.createElement("script");
      node.src = url;
      document.body.appendChild(node);
      node.onload = function() {
        node.onload = null;
        document.body.removeChild(node);
        callback();
      };
    }
  }
  startUp.version = "1.0.1";
  function addBase(id, uri) {
    var _a2;
    let result;
    if (id.charAt(0) === ".") {
      result = realPath((uri ? (_a2 = uri.match(/[^?]*\//)) == null ? void 0 : _a2[0] : data.cwd) + id);
    } else {
      result = data.cwd + id;
    }
    return result;
  }
  let DOT_RE = /\/.\//g;
  let DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//g;
  function realPath(path) {
    path = path.replace(DOT_RE, "/");
    while (path.match(DOUBLE_DOT_RE, "/")) {
      path = path.replace(DOUBLE_DOT_RE, "/");
    }
    return path;
  }
  let _cid = 0;
  const cid = () => _cid++;
  data.preload = [];
  data.cwd = (_a = document.URL.match(/[^?]*\//)) == null ? void 0 : _a[0];
  global.startUp = startUp;
  global.define = Module.define;
})(window);
