"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to2, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to2, key) && key !== except)
          __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to2;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/events/events.js
  var require_events = __commonJS({
    "node_modules/events/events.js"(exports, module) {
      "use strict";
      var R2 = typeof Reflect === "object" ? Reflect : null;
      var ReflectApply = R2 && typeof R2.apply === "function" ? R2.apply : function ReflectApply2(target, receiver, args) {
        return Function.prototype.apply.call(target, receiver, args);
      };
      var ReflectOwnKeys;
      if (R2 && typeof R2.ownKeys === "function") {
        ReflectOwnKeys = R2.ownKeys;
      } else if (Object.getOwnPropertySymbols) {
        ReflectOwnKeys = function ReflectOwnKeys2(target) {
          return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));
        };
      } else {
        ReflectOwnKeys = function ReflectOwnKeys2(target) {
          return Object.getOwnPropertyNames(target);
        };
      }
      function ProcessEmitWarning(warning) {
        if (console && console.warn) console.warn(warning);
      }
      var NumberIsNaN = Number.isNaN || function NumberIsNaN2(value) {
        return value !== value;
      };
      function EventEmitter() {
        EventEmitter.init.call(this);
      }
      module.exports = EventEmitter;
      module.exports.once = once;
      EventEmitter.EventEmitter = EventEmitter;
      EventEmitter.prototype._events = void 0;
      EventEmitter.prototype._eventsCount = 0;
      EventEmitter.prototype._maxListeners = void 0;
      var defaultMaxListeners = 10;
      function checkListener(listener) {
        if (typeof listener !== "function") {
          throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
        }
      }
      Object.defineProperty(EventEmitter, "defaultMaxListeners", {
        enumerable: true,
        get: function() {
          return defaultMaxListeners;
        },
        set: function(arg) {
          if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
            throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".");
          }
          defaultMaxListeners = arg;
        }
      });
      EventEmitter.init = function() {
        if (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) {
          this._events = /* @__PURE__ */ Object.create(null);
          this._eventsCount = 0;
        }
        this._maxListeners = this._maxListeners || void 0;
      };
      EventEmitter.prototype.setMaxListeners = function setMaxListeners(n2) {
        if (typeof n2 !== "number" || n2 < 0 || NumberIsNaN(n2)) {
          throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n2 + ".");
        }
        this._maxListeners = n2;
        return this;
      };
      function _getMaxListeners(that) {
        if (that._maxListeners === void 0)
          return EventEmitter.defaultMaxListeners;
        return that._maxListeners;
      }
      EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
        return _getMaxListeners(this);
      };
      EventEmitter.prototype.emit = function emit(type) {
        var args = [];
        for (var i2 = 1; i2 < arguments.length; i2++) args.push(arguments[i2]);
        var doError = type === "error";
        var events = this._events;
        if (events !== void 0)
          doError = doError && events.error === void 0;
        else if (!doError)
          return false;
        if (doError) {
          var er2;
          if (args.length > 0)
            er2 = args[0];
          if (er2 instanceof Error) {
            throw er2;
          }
          var err = new Error("Unhandled error." + (er2 ? " (" + er2.message + ")" : ""));
          err.context = er2;
          throw err;
        }
        var handler = events[type];
        if (handler === void 0)
          return false;
        if (typeof handler === "function") {
          ReflectApply(handler, this, args);
        } else {
          var len = handler.length;
          var listeners = arrayClone(handler, len);
          for (var i2 = 0; i2 < len; ++i2)
            ReflectApply(listeners[i2], this, args);
        }
        return true;
      };
      function _addListener(target, type, listener, prepend) {
        var m2;
        var events;
        var existing;
        checkListener(listener);
        events = target._events;
        if (events === void 0) {
          events = target._events = /* @__PURE__ */ Object.create(null);
          target._eventsCount = 0;
        } else {
          if (events.newListener !== void 0) {
            target.emit(
              "newListener",
              type,
              listener.listener ? listener.listener : listener
            );
            events = target._events;
          }
          existing = events[type];
        }
        if (existing === void 0) {
          existing = events[type] = listener;
          ++target._eventsCount;
        } else {
          if (typeof existing === "function") {
            existing = events[type] = prepend ? [listener, existing] : [existing, listener];
          } else if (prepend) {
            existing.unshift(listener);
          } else {
            existing.push(listener);
          }
          m2 = _getMaxListeners(target);
          if (m2 > 0 && existing.length > m2 && !existing.warned) {
            existing.warned = true;
            var w2 = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners added. Use emitter.setMaxListeners() to increase limit");
            w2.name = "MaxListenersExceededWarning";
            w2.emitter = target;
            w2.type = type;
            w2.count = existing.length;
            ProcessEmitWarning(w2);
          }
        }
        return target;
      }
      EventEmitter.prototype.addListener = function addListener(type, listener) {
        return _addListener(this, type, listener, false);
      };
      EventEmitter.prototype.on = EventEmitter.prototype.addListener;
      EventEmitter.prototype.prependListener = function prependListener(type, listener) {
        return _addListener(this, type, listener, true);
      };
      function onceWrapper() {
        if (!this.fired) {
          this.target.removeListener(this.type, this.wrapFn);
          this.fired = true;
          if (arguments.length === 0)
            return this.listener.call(this.target);
          return this.listener.apply(this.target, arguments);
        }
      }
      function _onceWrap(target, type, listener) {
        var state = { fired: false, wrapFn: void 0, target, type, listener };
        var wrapped = onceWrapper.bind(state);
        wrapped.listener = listener;
        state.wrapFn = wrapped;
        return wrapped;
      }
      EventEmitter.prototype.once = function once2(type, listener) {
        checkListener(listener);
        this.on(type, _onceWrap(this, type, listener));
        return this;
      };
      EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener) {
        checkListener(listener);
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };
      EventEmitter.prototype.removeListener = function removeListener(type, listener) {
        var list, events, position, i2, originalListener;
        checkListener(listener);
        events = this._events;
        if (events === void 0)
          return this;
        list = events[type];
        if (list === void 0)
          return this;
        if (list === listener || list.listener === listener) {
          if (--this._eventsCount === 0)
            this._events = /* @__PURE__ */ Object.create(null);
          else {
            delete events[type];
            if (events.removeListener)
              this.emit("removeListener", type, list.listener || listener);
          }
        } else if (typeof list !== "function") {
          position = -1;
          for (i2 = list.length - 1; i2 >= 0; i2--) {
            if (list[i2] === listener || list[i2].listener === listener) {
              originalListener = list[i2].listener;
              position = i2;
              break;
            }
          }
          if (position < 0)
            return this;
          if (position === 0)
            list.shift();
          else {
            spliceOne(list, position);
          }
          if (list.length === 1)
            events[type] = list[0];
          if (events.removeListener !== void 0)
            this.emit("removeListener", type, originalListener || listener);
        }
        return this;
      };
      EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
      EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
        var listeners, events, i2;
        events = this._events;
        if (events === void 0)
          return this;
        if (events.removeListener === void 0) {
          if (arguments.length === 0) {
            this._events = /* @__PURE__ */ Object.create(null);
            this._eventsCount = 0;
          } else if (events[type] !== void 0) {
            if (--this._eventsCount === 0)
              this._events = /* @__PURE__ */ Object.create(null);
            else
              delete events[type];
          }
          return this;
        }
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          var key;
          for (i2 = 0; i2 < keys.length; ++i2) {
            key = keys[i2];
            if (key === "removeListener") continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners("removeListener");
          this._events = /* @__PURE__ */ Object.create(null);
          this._eventsCount = 0;
          return this;
        }
        listeners = events[type];
        if (typeof listeners === "function") {
          this.removeListener(type, listeners);
        } else if (listeners !== void 0) {
          for (i2 = listeners.length - 1; i2 >= 0; i2--) {
            this.removeListener(type, listeners[i2]);
          }
        }
        return this;
      };
      function _listeners(target, type, unwrap) {
        var events = target._events;
        if (events === void 0)
          return [];
        var evlistener = events[type];
        if (evlistener === void 0)
          return [];
        if (typeof evlistener === "function")
          return unwrap ? [evlistener.listener || evlistener] : [evlistener];
        return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
      }
      EventEmitter.prototype.listeners = function listeners(type) {
        return _listeners(this, type, true);
      };
      EventEmitter.prototype.rawListeners = function rawListeners(type) {
        return _listeners(this, type, false);
      };
      EventEmitter.listenerCount = function(emitter, type) {
        if (typeof emitter.listenerCount === "function") {
          return emitter.listenerCount(type);
        } else {
          return listenerCount.call(emitter, type);
        }
      };
      EventEmitter.prototype.listenerCount = listenerCount;
      function listenerCount(type) {
        var events = this._events;
        if (events !== void 0) {
          var evlistener = events[type];
          if (typeof evlistener === "function") {
            return 1;
          } else if (evlistener !== void 0) {
            return evlistener.length;
          }
        }
        return 0;
      }
      EventEmitter.prototype.eventNames = function eventNames() {
        return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
      };
      function arrayClone(arr, n2) {
        var copy = new Array(n2);
        for (var i2 = 0; i2 < n2; ++i2)
          copy[i2] = arr[i2];
        return copy;
      }
      function spliceOne(list, index) {
        for (; index + 1 < list.length; index++)
          list[index] = list[index + 1];
        list.pop();
      }
      function unwrapListeners(arr) {
        var ret = new Array(arr.length);
        for (var i2 = 0; i2 < ret.length; ++i2) {
          ret[i2] = arr[i2].listener || arr[i2];
        }
        return ret;
      }
      function once(emitter, name) {
        return new Promise(function(resolve, reject) {
          function errorListener(err) {
            emitter.removeListener(name, resolver);
            reject(err);
          }
          function resolver() {
            if (typeof emitter.removeListener === "function") {
              emitter.removeListener("error", errorListener);
            }
            resolve([].slice.call(arguments));
          }
          ;
          eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
          if (name !== "error") {
            addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
          }
        });
      }
      function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
        if (typeof emitter.on === "function") {
          eventTargetAgnosticAddListener(emitter, "error", handler, flags);
        }
      }
      function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
        if (typeof emitter.on === "function") {
          if (flags.once) {
            emitter.once(name, listener);
          } else {
            emitter.on(name, listener);
          }
        } else if (typeof emitter.addEventListener === "function") {
          emitter.addEventListener(name, function wrapListener(arg) {
            if (flags.once) {
              emitter.removeEventListener(name, wrapListener);
            }
            listener(arg);
          });
        } else {
          throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
        }
      }
    }
  });

  // node_modules/bowser/es5.js
  var require_es5 = __commonJS({
    "node_modules/bowser/es5.js"(exports, module) {
      !(function(e2, t2) {
        "object" == typeof exports && "object" == typeof module ? module.exports = t2() : "function" == typeof define && define.amd ? define([], t2) : "object" == typeof exports ? exports.bowser = t2() : e2.bowser = t2();
      })(exports, (function() {
        return (function(e2) {
          var t2 = {};
          function r2(i2) {
            if (t2[i2]) return t2[i2].exports;
            var n2 = t2[i2] = { i: i2, l: false, exports: {} };
            return e2[i2].call(n2.exports, n2, n2.exports, r2), n2.l = true, n2.exports;
          }
          return r2.m = e2, r2.c = t2, r2.d = function(e3, t3, i2) {
            r2.o(e3, t3) || Object.defineProperty(e3, t3, { enumerable: true, get: i2 });
          }, r2.r = function(e3) {
            "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e3, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e3, "__esModule", { value: true });
          }, r2.t = function(e3, t3) {
            if (1 & t3 && (e3 = r2(e3)), 8 & t3) return e3;
            if (4 & t3 && "object" == typeof e3 && e3 && e3.__esModule) return e3;
            var i2 = /* @__PURE__ */ Object.create(null);
            if (r2.r(i2), Object.defineProperty(i2, "default", { enumerable: true, value: e3 }), 2 & t3 && "string" != typeof e3) for (var n2 in e3) r2.d(i2, n2, function(t4) {
              return e3[t4];
            }.bind(null, n2));
            return i2;
          }, r2.n = function(e3) {
            var t3 = e3 && e3.__esModule ? function() {
              return e3.default;
            } : function() {
              return e3;
            };
            return r2.d(t3, "a", t3), t3;
          }, r2.o = function(e3, t3) {
            return Object.prototype.hasOwnProperty.call(e3, t3);
          }, r2.p = "", r2(r2.s = 90);
        })({ 17: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2 = r2(18), n2 = (function() {
            function e3() {
            }
            return e3.getFirstMatch = function(e4, t3) {
              var r3 = t3.match(e4);
              return r3 && r3.length > 0 && r3[1] || "";
            }, e3.getSecondMatch = function(e4, t3) {
              var r3 = t3.match(e4);
              return r3 && r3.length > 1 && r3[2] || "";
            }, e3.matchAndReturnConst = function(e4, t3, r3) {
              if (e4.test(t3)) return r3;
            }, e3.getWindowsVersionName = function(e4) {
              switch (e4) {
                case "NT":
                  return "NT";
                case "XP":
                  return "XP";
                case "NT 5.0":
                  return "2000";
                case "NT 5.1":
                  return "XP";
                case "NT 5.2":
                  return "2003";
                case "NT 6.0":
                  return "Vista";
                case "NT 6.1":
                  return "7";
                case "NT 6.2":
                  return "8";
                case "NT 6.3":
                  return "8.1";
                case "NT 10.0":
                  return "10";
                default:
                  return;
              }
            }, e3.getMacOSVersionName = function(e4) {
              var t3 = e4.split(".").splice(0, 2).map((function(e5) {
                return parseInt(e5, 10) || 0;
              }));
              t3.push(0);
              var r3 = t3[0], i3 = t3[1];
              if (10 === r3) switch (i3) {
                case 5:
                  return "Leopard";
                case 6:
                  return "Snow Leopard";
                case 7:
                  return "Lion";
                case 8:
                  return "Mountain Lion";
                case 9:
                  return "Mavericks";
                case 10:
                  return "Yosemite";
                case 11:
                  return "El Capitan";
                case 12:
                  return "Sierra";
                case 13:
                  return "High Sierra";
                case 14:
                  return "Mojave";
                case 15:
                  return "Catalina";
                default:
                  return;
              }
              switch (r3) {
                case 11:
                  return "Big Sur";
                case 12:
                  return "Monterey";
                case 13:
                  return "Ventura";
                case 14:
                  return "Sonoma";
                case 15:
                  return "Sequoia";
                default:
                  return;
              }
            }, e3.getAndroidVersionName = function(e4) {
              var t3 = e4.split(".").splice(0, 2).map((function(e5) {
                return parseInt(e5, 10) || 0;
              }));
              if (t3.push(0), !(1 === t3[0] && t3[1] < 5)) return 1 === t3[0] && t3[1] < 6 ? "Cupcake" : 1 === t3[0] && t3[1] >= 6 ? "Donut" : 2 === t3[0] && t3[1] < 2 ? "Eclair" : 2 === t3[0] && 2 === t3[1] ? "Froyo" : 2 === t3[0] && t3[1] > 2 ? "Gingerbread" : 3 === t3[0] ? "Honeycomb" : 4 === t3[0] && t3[1] < 1 ? "Ice Cream Sandwich" : 4 === t3[0] && t3[1] < 4 ? "Jelly Bean" : 4 === t3[0] && t3[1] >= 4 ? "KitKat" : 5 === t3[0] ? "Lollipop" : 6 === t3[0] ? "Marshmallow" : 7 === t3[0] ? "Nougat" : 8 === t3[0] ? "Oreo" : 9 === t3[0] ? "Pie" : void 0;
            }, e3.getVersionPrecision = function(e4) {
              return e4.split(".").length;
            }, e3.compareVersions = function(t3, r3, i3) {
              void 0 === i3 && (i3 = false);
              var n3 = e3.getVersionPrecision(t3), a2 = e3.getVersionPrecision(r3), o2 = Math.max(n3, a2), s2 = 0, u2 = e3.map([t3, r3], (function(t4) {
                var r4 = o2 - e3.getVersionPrecision(t4), i4 = t4 + new Array(r4 + 1).join(".0");
                return e3.map(i4.split("."), (function(e4) {
                  return new Array(20 - e4.length).join("0") + e4;
                })).reverse();
              }));
              for (i3 && (s2 = o2 - Math.min(n3, a2)), o2 -= 1; o2 >= s2; ) {
                if (u2[0][o2] > u2[1][o2]) return 1;
                if (u2[0][o2] === u2[1][o2]) {
                  if (o2 === s2) return 0;
                  o2 -= 1;
                } else if (u2[0][o2] < u2[1][o2]) return -1;
              }
            }, e3.map = function(e4, t3) {
              var r3, i3 = [];
              if (Array.prototype.map) return Array.prototype.map.call(e4, t3);
              for (r3 = 0; r3 < e4.length; r3 += 1) i3.push(t3(e4[r3]));
              return i3;
            }, e3.find = function(e4, t3) {
              var r3, i3;
              if (Array.prototype.find) return Array.prototype.find.call(e4, t3);
              for (r3 = 0, i3 = e4.length; r3 < i3; r3 += 1) {
                var n3 = e4[r3];
                if (t3(n3, r3)) return n3;
              }
            }, e3.assign = function(e4) {
              for (var t3, r3, i3 = e4, n3 = arguments.length, a2 = new Array(n3 > 1 ? n3 - 1 : 0), o2 = 1; o2 < n3; o2++) a2[o2 - 1] = arguments[o2];
              if (Object.assign) return Object.assign.apply(Object, [e4].concat(a2));
              var s2 = function() {
                var e5 = a2[t3];
                "object" == typeof e5 && null !== e5 && Object.keys(e5).forEach((function(t4) {
                  i3[t4] = e5[t4];
                }));
              };
              for (t3 = 0, r3 = a2.length; t3 < r3; t3 += 1) s2();
              return e4;
            }, e3.getBrowserAlias = function(e4) {
              return i2.BROWSER_ALIASES_MAP[e4];
            }, e3.getBrowserTypeByAlias = function(e4) {
              return i2.BROWSER_MAP[e4] || "";
            }, e3;
          })();
          t2.default = n2, e2.exports = t2.default;
        }, 18: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.ENGINE_MAP = t2.OS_MAP = t2.PLATFORMS_MAP = t2.BROWSER_MAP = t2.BROWSER_ALIASES_MAP = void 0;
          t2.BROWSER_ALIASES_MAP = { AmazonBot: "amazonbot", "Amazon Silk": "amazon_silk", "Android Browser": "android", BaiduSpider: "baiduspider", Bada: "bada", BingCrawler: "bingcrawler", Brave: "brave", BlackBerry: "blackberry", "ChatGPT-User": "chatgpt_user", Chrome: "chrome", ClaudeBot: "claudebot", Chromium: "chromium", Diffbot: "diffbot", DuckDuckBot: "duckduckbot", DuckDuckGo: "duckduckgo", Electron: "electron", Epiphany: "epiphany", FacebookExternalHit: "facebookexternalhit", Firefox: "firefox", Focus: "focus", Generic: "generic", "Google Search": "google_search", Googlebot: "googlebot", GPTBot: "gptbot", "Internet Explorer": "ie", InternetArchiveCrawler: "internetarchivecrawler", "K-Meleon": "k_meleon", LibreWolf: "librewolf", Linespider: "linespider", Maxthon: "maxthon", "Meta-ExternalAds": "meta_externalads", "Meta-ExternalAgent": "meta_externalagent", "Meta-ExternalFetcher": "meta_externalfetcher", "Meta-WebIndexer": "meta_webindexer", "Microsoft Edge": "edge", "MZ Browser": "mz", "NAVER Whale Browser": "naver", "OAI-SearchBot": "oai_searchbot", Omgilibot: "omgilibot", Opera: "opera", "Opera Coast": "opera_coast", "Pale Moon": "pale_moon", PerplexityBot: "perplexitybot", "Perplexity-User": "perplexity_user", PhantomJS: "phantomjs", PingdomBot: "pingdombot", Puffin: "puffin", QQ: "qq", QQLite: "qqlite", QupZilla: "qupzilla", Roku: "roku", Safari: "safari", Sailfish: "sailfish", "Samsung Internet for Android": "samsung_internet", SlackBot: "slackbot", SeaMonkey: "seamonkey", Sleipnir: "sleipnir", "Sogou Browser": "sogou", Swing: "swing", Tizen: "tizen", "UC Browser": "uc", Vivaldi: "vivaldi", "WebOS Browser": "webos", WeChat: "wechat", YahooSlurp: "yahooslurp", "Yandex Browser": "yandex", YandexBot: "yandexbot", YouBot: "youbot" };
          t2.BROWSER_MAP = { amazonbot: "AmazonBot", amazon_silk: "Amazon Silk", android: "Android Browser", baiduspider: "BaiduSpider", bada: "Bada", bingcrawler: "BingCrawler", blackberry: "BlackBerry", brave: "Brave", chatgpt_user: "ChatGPT-User", chrome: "Chrome", claudebot: "ClaudeBot", chromium: "Chromium", diffbot: "Diffbot", duckduckbot: "DuckDuckBot", duckduckgo: "DuckDuckGo", edge: "Microsoft Edge", electron: "Electron", epiphany: "Epiphany", facebookexternalhit: "FacebookExternalHit", firefox: "Firefox", focus: "Focus", generic: "Generic", google_search: "Google Search", googlebot: "Googlebot", gptbot: "GPTBot", ie: "Internet Explorer", internetarchivecrawler: "InternetArchiveCrawler", k_meleon: "K-Meleon", librewolf: "LibreWolf", linespider: "Linespider", maxthon: "Maxthon", meta_externalads: "Meta-ExternalAds", meta_externalagent: "Meta-ExternalAgent", meta_externalfetcher: "Meta-ExternalFetcher", meta_webindexer: "Meta-WebIndexer", mz: "MZ Browser", naver: "NAVER Whale Browser", oai_searchbot: "OAI-SearchBot", omgilibot: "Omgilibot", opera: "Opera", opera_coast: "Opera Coast", pale_moon: "Pale Moon", perplexitybot: "PerplexityBot", perplexity_user: "Perplexity-User", phantomjs: "PhantomJS", pingdombot: "PingdomBot", puffin: "Puffin", qq: "QQ Browser", qqlite: "QQ Browser Lite", qupzilla: "QupZilla", roku: "Roku", safari: "Safari", sailfish: "Sailfish", samsung_internet: "Samsung Internet for Android", seamonkey: "SeaMonkey", slackbot: "SlackBot", sleipnir: "Sleipnir", sogou: "Sogou Browser", swing: "Swing", tizen: "Tizen", uc: "UC Browser", vivaldi: "Vivaldi", webos: "WebOS Browser", wechat: "WeChat", yahooslurp: "YahooSlurp", yandex: "Yandex Browser", yandexbot: "YandexBot", youbot: "YouBot" };
          t2.PLATFORMS_MAP = { bot: "bot", desktop: "desktop", mobile: "mobile", tablet: "tablet", tv: "tv" };
          t2.OS_MAP = { Android: "Android", Bada: "Bada", BlackBerry: "BlackBerry", ChromeOS: "Chrome OS", HarmonyOS: "HarmonyOS", iOS: "iOS", Linux: "Linux", MacOS: "macOS", PlayStation4: "PlayStation 4", Roku: "Roku", Tizen: "Tizen", WebOS: "WebOS", Windows: "Windows", WindowsPhone: "Windows Phone" };
          t2.ENGINE_MAP = { Blink: "Blink", EdgeHTML: "EdgeHTML", Gecko: "Gecko", Presto: "Presto", Trident: "Trident", WebKit: "WebKit" };
        }, 90: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2, n2 = (i2 = r2(91)) && i2.__esModule ? i2 : { default: i2 }, a2 = r2(18);
          function o2(e3, t3) {
            for (var r3 = 0; r3 < t3.length; r3++) {
              var i3 = t3[r3];
              i3.enumerable = i3.enumerable || false, i3.configurable = true, "value" in i3 && (i3.writable = true), Object.defineProperty(e3, i3.key, i3);
            }
          }
          var s2 = (function() {
            function e3() {
            }
            var t3, r3, i3;
            return e3.getParser = function(e4, t4, r4) {
              if (void 0 === t4 && (t4 = false), void 0 === r4 && (r4 = null), "string" != typeof e4) throw new Error("UserAgent should be a string");
              return new n2.default(e4, t4, r4);
            }, e3.parse = function(e4, t4) {
              return void 0 === t4 && (t4 = null), new n2.default(e4, t4).getResult();
            }, t3 = e3, i3 = [{ key: "BROWSER_MAP", get: function() {
              return a2.BROWSER_MAP;
            } }, { key: "ENGINE_MAP", get: function() {
              return a2.ENGINE_MAP;
            } }, { key: "OS_MAP", get: function() {
              return a2.OS_MAP;
            } }, { key: "PLATFORMS_MAP", get: function() {
              return a2.PLATFORMS_MAP;
            } }], (r3 = null) && o2(t3.prototype, r3), i3 && o2(t3, i3), e3;
          })();
          t2.default = s2, e2.exports = t2.default;
        }, 91: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2 = u2(r2(92)), n2 = u2(r2(93)), a2 = u2(r2(94)), o2 = u2(r2(95)), s2 = u2(r2(17));
          function u2(e3) {
            return e3 && e3.__esModule ? e3 : { default: e3 };
          }
          var d2 = (function() {
            function e3(e4, t4, r3) {
              if (void 0 === t4 && (t4 = false), void 0 === r3 && (r3 = null), null == e4 || "" === e4) throw new Error("UserAgent parameter can't be empty");
              this._ua = e4;
              var i3 = false;
              "boolean" == typeof t4 ? (i3 = t4, this._hints = r3) : this._hints = null != t4 && "object" == typeof t4 ? t4 : null, this.parsedResult = {}, true !== i3 && this.parse();
            }
            var t3 = e3.prototype;
            return t3.getHints = function() {
              return this._hints;
            }, t3.hasBrand = function(e4) {
              if (!this._hints || !Array.isArray(this._hints.brands)) return false;
              var t4 = e4.toLowerCase();
              return this._hints.brands.some((function(e5) {
                return e5.brand && e5.brand.toLowerCase() === t4;
              }));
            }, t3.getBrandVersion = function(e4) {
              if (this._hints && Array.isArray(this._hints.brands)) {
                var t4 = e4.toLowerCase(), r3 = this._hints.brands.find((function(e5) {
                  return e5.brand && e5.brand.toLowerCase() === t4;
                }));
                return r3 ? r3.version : void 0;
              }
            }, t3.getUA = function() {
              return this._ua;
            }, t3.test = function(e4) {
              return e4.test(this._ua);
            }, t3.parseBrowser = function() {
              var e4 = this;
              this.parsedResult.browser = {};
              var t4 = s2.default.find(i2.default, (function(t5) {
                if ("function" == typeof t5.test) return t5.test(e4);
                if (Array.isArray(t5.test)) return t5.test.some((function(t6) {
                  return e4.test(t6);
                }));
                throw new Error("Browser's test function is not valid");
              }));
              return t4 && (this.parsedResult.browser = t4.describe(this.getUA(), this)), this.parsedResult.browser;
            }, t3.getBrowser = function() {
              return this.parsedResult.browser ? this.parsedResult.browser : this.parseBrowser();
            }, t3.getBrowserName = function(e4) {
              return e4 ? String(this.getBrowser().name).toLowerCase() || "" : this.getBrowser().name || "";
            }, t3.getBrowserVersion = function() {
              return this.getBrowser().version;
            }, t3.getOS = function() {
              return this.parsedResult.os ? this.parsedResult.os : this.parseOS();
            }, t3.parseOS = function() {
              var e4 = this;
              this.parsedResult.os = {};
              var t4 = s2.default.find(n2.default, (function(t5) {
                if ("function" == typeof t5.test) return t5.test(e4);
                if (Array.isArray(t5.test)) return t5.test.some((function(t6) {
                  return e4.test(t6);
                }));
                throw new Error("Browser's test function is not valid");
              }));
              return t4 && (this.parsedResult.os = t4.describe(this.getUA())), this.parsedResult.os;
            }, t3.getOSName = function(e4) {
              var t4 = this.getOS().name;
              return e4 ? String(t4).toLowerCase() || "" : t4 || "";
            }, t3.getOSVersion = function() {
              return this.getOS().version;
            }, t3.getPlatform = function() {
              return this.parsedResult.platform ? this.parsedResult.platform : this.parsePlatform();
            }, t3.getPlatformType = function(e4) {
              void 0 === e4 && (e4 = false);
              var t4 = this.getPlatform().type;
              return e4 ? String(t4).toLowerCase() || "" : t4 || "";
            }, t3.parsePlatform = function() {
              var e4 = this;
              this.parsedResult.platform = {};
              var t4 = s2.default.find(a2.default, (function(t5) {
                if ("function" == typeof t5.test) return t5.test(e4);
                if (Array.isArray(t5.test)) return t5.test.some((function(t6) {
                  return e4.test(t6);
                }));
                throw new Error("Browser's test function is not valid");
              }));
              return t4 && (this.parsedResult.platform = t4.describe(this.getUA())), this.parsedResult.platform;
            }, t3.getEngine = function() {
              return this.parsedResult.engine ? this.parsedResult.engine : this.parseEngine();
            }, t3.getEngineName = function(e4) {
              return e4 ? String(this.getEngine().name).toLowerCase() || "" : this.getEngine().name || "";
            }, t3.parseEngine = function() {
              var e4 = this;
              this.parsedResult.engine = {};
              var t4 = s2.default.find(o2.default, (function(t5) {
                if ("function" == typeof t5.test) return t5.test(e4);
                if (Array.isArray(t5.test)) return t5.test.some((function(t6) {
                  return e4.test(t6);
                }));
                throw new Error("Browser's test function is not valid");
              }));
              return t4 && (this.parsedResult.engine = t4.describe(this.getUA())), this.parsedResult.engine;
            }, t3.parse = function() {
              return this.parseBrowser(), this.parseOS(), this.parsePlatform(), this.parseEngine(), this;
            }, t3.getResult = function() {
              return s2.default.assign({}, this.parsedResult);
            }, t3.satisfies = function(e4) {
              var t4 = this, r3 = {}, i3 = 0, n3 = {}, a3 = 0;
              if (Object.keys(e4).forEach((function(t5) {
                var o4 = e4[t5];
                "string" == typeof o4 ? (n3[t5] = o4, a3 += 1) : "object" == typeof o4 && (r3[t5] = o4, i3 += 1);
              })), i3 > 0) {
                var o3 = Object.keys(r3), u3 = s2.default.find(o3, (function(e5) {
                  return t4.isOS(e5);
                }));
                if (u3) {
                  var d3 = this.satisfies(r3[u3]);
                  if (void 0 !== d3) return d3;
                }
                var c2 = s2.default.find(o3, (function(e5) {
                  return t4.isPlatform(e5);
                }));
                if (c2) {
                  var f2 = this.satisfies(r3[c2]);
                  if (void 0 !== f2) return f2;
                }
              }
              if (a3 > 0) {
                var l2 = Object.keys(n3), b2 = s2.default.find(l2, (function(e5) {
                  return t4.isBrowser(e5, true);
                }));
                if (void 0 !== b2) return this.compareVersion(n3[b2]);
              }
            }, t3.isBrowser = function(e4, t4) {
              void 0 === t4 && (t4 = false);
              var r3 = this.getBrowserName().toLowerCase(), i3 = e4.toLowerCase(), n3 = s2.default.getBrowserTypeByAlias(i3);
              return t4 && n3 && (i3 = n3.toLowerCase()), i3 === r3;
            }, t3.compareVersion = function(e4) {
              var t4 = [0], r3 = e4, i3 = false, n3 = this.getBrowserVersion();
              if ("string" == typeof n3) return ">" === e4[0] || "<" === e4[0] ? (r3 = e4.substr(1), "=" === e4[1] ? (i3 = true, r3 = e4.substr(2)) : t4 = [], ">" === e4[0] ? t4.push(1) : t4.push(-1)) : "=" === e4[0] ? r3 = e4.substr(1) : "~" === e4[0] && (i3 = true, r3 = e4.substr(1)), t4.indexOf(s2.default.compareVersions(n3, r3, i3)) > -1;
            }, t3.isOS = function(e4) {
              return this.getOSName(true) === String(e4).toLowerCase();
            }, t3.isPlatform = function(e4) {
              return this.getPlatformType(true) === String(e4).toLowerCase();
            }, t3.isEngine = function(e4) {
              return this.getEngineName(true) === String(e4).toLowerCase();
            }, t3.is = function(e4, t4) {
              return void 0 === t4 && (t4 = false), this.isBrowser(e4, t4) || this.isOS(e4) || this.isPlatform(e4);
            }, t3.some = function(e4) {
              var t4 = this;
              return void 0 === e4 && (e4 = []), e4.some((function(e5) {
                return t4.is(e5);
              }));
            }, e3;
          })();
          t2.default = d2, e2.exports = t2.default;
        }, 92: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2, n2 = (i2 = r2(17)) && i2.__esModule ? i2 : { default: i2 };
          var a2 = /version\/(\d+(\.?_?\d+)+)/i, o2 = [{ test: [/gptbot/i], describe: function(e3) {
            var t3 = { name: "GPTBot" }, r3 = n2.default.getFirstMatch(/gptbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/chatgpt-user/i], describe: function(e3) {
            var t3 = { name: "ChatGPT-User" }, r3 = n2.default.getFirstMatch(/chatgpt-user\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/oai-searchbot/i], describe: function(e3) {
            var t3 = { name: "OAI-SearchBot" }, r3 = n2.default.getFirstMatch(/oai-searchbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/claudebot/i, /claude-web/i, /claude-user/i, /claude-searchbot/i], describe: function(e3) {
            var t3 = { name: "ClaudeBot" }, r3 = n2.default.getFirstMatch(/(?:claudebot|claude-web|claude-user|claude-searchbot)\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/omgilibot/i, /webzio-extended/i], describe: function(e3) {
            var t3 = { name: "Omgilibot" }, r3 = n2.default.getFirstMatch(/(?:omgilibot|webzio-extended)\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/diffbot/i], describe: function(e3) {
            var t3 = { name: "Diffbot" }, r3 = n2.default.getFirstMatch(/diffbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/perplexitybot/i], describe: function(e3) {
            var t3 = { name: "PerplexityBot" }, r3 = n2.default.getFirstMatch(/perplexitybot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/perplexity-user/i], describe: function(e3) {
            var t3 = { name: "Perplexity-User" }, r3 = n2.default.getFirstMatch(/perplexity-user\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/youbot/i], describe: function(e3) {
            var t3 = { name: "YouBot" }, r3 = n2.default.getFirstMatch(/youbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/meta-webindexer/i], describe: function(e3) {
            var t3 = { name: "Meta-WebIndexer" }, r3 = n2.default.getFirstMatch(/meta-webindexer\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/meta-externalads/i], describe: function(e3) {
            var t3 = { name: "Meta-ExternalAds" }, r3 = n2.default.getFirstMatch(/meta-externalads\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/meta-externalagent/i], describe: function(e3) {
            var t3 = { name: "Meta-ExternalAgent" }, r3 = n2.default.getFirstMatch(/meta-externalagent\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/meta-externalfetcher/i], describe: function(e3) {
            var t3 = { name: "Meta-ExternalFetcher" }, r3 = n2.default.getFirstMatch(/meta-externalfetcher\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/googlebot/i], describe: function(e3) {
            var t3 = { name: "Googlebot" }, r3 = n2.default.getFirstMatch(/googlebot\/(\d+(\.\d+))/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/linespider/i], describe: function(e3) {
            var t3 = { name: "Linespider" }, r3 = n2.default.getFirstMatch(/(?:linespider)(?:-[-\w]+)?[\s/](\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/amazonbot/i], describe: function(e3) {
            var t3 = { name: "AmazonBot" }, r3 = n2.default.getFirstMatch(/amazonbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/bingbot/i], describe: function(e3) {
            var t3 = { name: "BingCrawler" }, r3 = n2.default.getFirstMatch(/bingbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/baiduspider/i], describe: function(e3) {
            var t3 = { name: "BaiduSpider" }, r3 = n2.default.getFirstMatch(/baiduspider\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/duckduckbot/i], describe: function(e3) {
            var t3 = { name: "DuckDuckBot" }, r3 = n2.default.getFirstMatch(/duckduckbot\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/ia_archiver/i], describe: function(e3) {
            var t3 = { name: "InternetArchiveCrawler" }, r3 = n2.default.getFirstMatch(/ia_archiver\/(\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/facebookexternalhit/i, /facebookcatalog/i], describe: function() {
            return { name: "FacebookExternalHit" };
          } }, { test: [/slackbot/i, /slack-imgProxy/i], describe: function(e3) {
            var t3 = { name: "SlackBot" }, r3 = n2.default.getFirstMatch(/(?:slackbot|slack-imgproxy)(?:-[-\w]+)?[\s/](\d+(\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/yahoo!?[\s/]*slurp/i], describe: function() {
            return { name: "YahooSlurp" };
          } }, { test: [/yandexbot/i, /yandexmobilebot/i], describe: function() {
            return { name: "YandexBot" };
          } }, { test: [/pingdom/i], describe: function() {
            return { name: "PingdomBot" };
          } }, { test: [/opera/i], describe: function(e3) {
            var t3 = { name: "Opera" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/opr\/|opios/i], describe: function(e3) {
            var t3 = { name: "Opera" }, r3 = n2.default.getFirstMatch(/(?:opr|opios)[\s/](\S+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/SamsungBrowser/i], describe: function(e3) {
            var t3 = { name: "Samsung Internet for Android" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:SamsungBrowser)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/Whale/i], describe: function(e3) {
            var t3 = { name: "NAVER Whale Browser" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:whale)[\s/](\d+(?:\.\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/PaleMoon/i], describe: function(e3) {
            var t3 = { name: "Pale Moon" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:PaleMoon)[\s/](\d+(?:\.\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/MZBrowser/i], describe: function(e3) {
            var t3 = { name: "MZ Browser" }, r3 = n2.default.getFirstMatch(/(?:MZBrowser)[\s/](\d+(?:\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/focus/i], describe: function(e3) {
            var t3 = { name: "Focus" }, r3 = n2.default.getFirstMatch(/(?:focus)[\s/](\d+(?:\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/swing/i], describe: function(e3) {
            var t3 = { name: "Swing" }, r3 = n2.default.getFirstMatch(/(?:swing)[\s/](\d+(?:\.\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/coast/i], describe: function(e3) {
            var t3 = { name: "Opera Coast" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:coast)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/opt\/\d+(?:.?_?\d+)+/i], describe: function(e3) {
            var t3 = { name: "Opera Touch" }, r3 = n2.default.getFirstMatch(/(?:opt)[\s/](\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/yabrowser/i], describe: function(e3) {
            var t3 = { name: "Yandex Browser" }, r3 = n2.default.getFirstMatch(/(?:yabrowser)[\s/](\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/ucbrowser/i], describe: function(e3) {
            var t3 = { name: "UC Browser" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:ucbrowser)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/Maxthon|mxios/i], describe: function(e3) {
            var t3 = { name: "Maxthon" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:Maxthon|mxios)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/epiphany/i], describe: function(e3) {
            var t3 = { name: "Epiphany" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:epiphany)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/puffin/i], describe: function(e3) {
            var t3 = { name: "Puffin" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:puffin)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/sleipnir/i], describe: function(e3) {
            var t3 = { name: "Sleipnir" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:sleipnir)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/k-meleon/i], describe: function(e3) {
            var t3 = { name: "K-Meleon" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/(?:k-meleon)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/micromessenger/i], describe: function(e3) {
            var t3 = { name: "WeChat" }, r3 = n2.default.getFirstMatch(/(?:micromessenger)[\s/](\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/qqbrowser/i], describe: function(e3) {
            var t3 = { name: /qqbrowserlite/i.test(e3) ? "QQ Browser Lite" : "QQ Browser" }, r3 = n2.default.getFirstMatch(/(?:qqbrowserlite|qqbrowser)[/](\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/msie|trident/i], describe: function(e3) {
            var t3 = { name: "Internet Explorer" }, r3 = n2.default.getFirstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/\sedg\//i], describe: function(e3) {
            var t3 = { name: "Microsoft Edge" }, r3 = n2.default.getFirstMatch(/\sedg\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/edg([ea]|ios)/i], describe: function(e3) {
            var t3 = { name: "Microsoft Edge" }, r3 = n2.default.getSecondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/vivaldi/i], describe: function(e3) {
            var t3 = { name: "Vivaldi" }, r3 = n2.default.getFirstMatch(/vivaldi\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/seamonkey/i], describe: function(e3) {
            var t3 = { name: "SeaMonkey" }, r3 = n2.default.getFirstMatch(/seamonkey\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/sailfish/i], describe: function(e3) {
            var t3 = { name: "Sailfish" }, r3 = n2.default.getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/silk/i], describe: function(e3) {
            var t3 = { name: "Amazon Silk" }, r3 = n2.default.getFirstMatch(/silk\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/phantom/i], describe: function(e3) {
            var t3 = { name: "PhantomJS" }, r3 = n2.default.getFirstMatch(/phantomjs\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/slimerjs/i], describe: function(e3) {
            var t3 = { name: "SlimerJS" }, r3 = n2.default.getFirstMatch(/slimerjs\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/blackberry|\bbb\d+/i, /rim\stablet/i], describe: function(e3) {
            var t3 = { name: "BlackBerry" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/blackberry[\d]+\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/(web|hpw)[o0]s/i], describe: function(e3) {
            var t3 = { name: "WebOS Browser" }, r3 = n2.default.getFirstMatch(a2, e3) || n2.default.getFirstMatch(/w(?:eb)?[o0]sbrowser\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/bada/i], describe: function(e3) {
            var t3 = { name: "Bada" }, r3 = n2.default.getFirstMatch(/dolfin\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/tizen/i], describe: function(e3) {
            var t3 = { name: "Tizen" }, r3 = n2.default.getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/qupzilla/i], describe: function(e3) {
            var t3 = { name: "QupZilla" }, r3 = n2.default.getFirstMatch(/(?:qupzilla)[\s/](\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/librewolf/i], describe: function(e3) {
            var t3 = { name: "LibreWolf" }, r3 = n2.default.getFirstMatch(/(?:librewolf)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/firefox|iceweasel|fxios/i], describe: function(e3) {
            var t3 = { name: "Firefox" }, r3 = n2.default.getFirstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/electron/i], describe: function(e3) {
            var t3 = { name: "Electron" }, r3 = n2.default.getFirstMatch(/(?:electron)\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/sogoumobilebrowser/i, /metasr/i, /se 2\.[x]/i], describe: function(e3) {
            var t3 = { name: "Sogou Browser" }, r3 = n2.default.getFirstMatch(/(?:sogoumobilebrowser)[\s/](\d+(\.?_?\d+)+)/i, e3), i3 = n2.default.getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, e3), a3 = n2.default.getFirstMatch(/se ([\d.]+)x/i, e3), o3 = r3 || i3 || a3;
            return o3 && (t3.version = o3), t3;
          } }, { test: [/MiuiBrowser/i], describe: function(e3) {
            var t3 = { name: "Miui" }, r3 = n2.default.getFirstMatch(/(?:MiuiBrowser)[\s/](\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: function(e3) {
            return !!e3.hasBrand("DuckDuckGo") || e3.test(/\sDdg\/[\d.]+$/i);
          }, describe: function(e3, t3) {
            var r3 = { name: "DuckDuckGo" };
            if (t3) {
              var i3 = t3.getBrandVersion("DuckDuckGo");
              if (i3) return r3.version = i3, r3;
            }
            var a3 = n2.default.getFirstMatch(/\sDdg\/([\d.]+)$/i, e3);
            return a3 && (r3.version = a3), r3;
          } }, { test: function(e3) {
            return e3.hasBrand("Brave");
          }, describe: function(e3, t3) {
            var r3 = { name: "Brave" };
            if (t3) {
              var i3 = t3.getBrandVersion("Brave");
              if (i3) return r3.version = i3, r3;
            }
            return r3;
          } }, { test: [/chromium/i], describe: function(e3) {
            var t3 = { name: "Chromium" }, r3 = n2.default.getFirstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, e3) || n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/chrome|crios|crmo/i], describe: function(e3) {
            var t3 = { name: "Chrome" }, r3 = n2.default.getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/GSA/i], describe: function(e3) {
            var t3 = { name: "Google Search" }, r3 = n2.default.getFirstMatch(/(?:GSA)\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: function(e3) {
            var t3 = !e3.test(/like android/i), r3 = e3.test(/android/i);
            return t3 && r3;
          }, describe: function(e3) {
            var t3 = { name: "Android Browser" }, r3 = n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/playstation 4/i], describe: function(e3) {
            var t3 = { name: "PlayStation 4" }, r3 = n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/safari|applewebkit/i], describe: function(e3) {
            var t3 = { name: "Safari" }, r3 = n2.default.getFirstMatch(a2, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/.*/i], describe: function(e3) {
            var t3 = -1 !== e3.search("\\(") ? /^(.*)\/(.*)[ \t]\((.*)/ : /^(.*)\/(.*) /;
            return { name: n2.default.getFirstMatch(t3, e3), version: n2.default.getSecondMatch(t3, e3) };
          } }];
          t2.default = o2, e2.exports = t2.default;
        }, 93: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2, n2 = (i2 = r2(17)) && i2.__esModule ? i2 : { default: i2 }, a2 = r2(18);
          var o2 = [{ test: [/Roku\/DVP/], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/Roku\/DVP-(\d+\.\d+)/i, e3);
            return { name: a2.OS_MAP.Roku, version: t3 };
          } }, { test: [/windows phone/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i, e3);
            return { name: a2.OS_MAP.WindowsPhone, version: t3 };
          } }, { test: [/windows /i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/Windows ((NT|XP)( \d\d?.\d)?)/i, e3), r3 = n2.default.getWindowsVersionName(t3);
            return { name: a2.OS_MAP.Windows, version: t3, versionName: r3 };
          } }, { test: [/Macintosh(.*?) FxiOS(.*?)\//], describe: function(e3) {
            var t3 = { name: a2.OS_MAP.iOS }, r3 = n2.default.getSecondMatch(/(Version\/)(\d[\d.]+)/, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/macintosh/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/mac os x (\d+(\.?_?\d+)+)/i, e3).replace(/[_\s]/g, "."), r3 = n2.default.getMacOSVersionName(t3), i3 = { name: a2.OS_MAP.MacOS, version: t3 };
            return r3 && (i3.versionName = r3), i3;
          } }, { test: [/(ipod|iphone|ipad)/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i, e3).replace(/[_\s]/g, ".");
            return { name: a2.OS_MAP.iOS, version: t3 };
          } }, { test: [/OpenHarmony/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/OpenHarmony\s+(\d+(\.\d+)*)/i, e3);
            return { name: a2.OS_MAP.HarmonyOS, version: t3 };
          } }, { test: function(e3) {
            var t3 = !e3.test(/like android/i), r3 = e3.test(/android/i);
            return t3 && r3;
          }, describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/android[\s/-](\d+(\.\d+)*)/i, e3), r3 = n2.default.getAndroidVersionName(t3), i3 = { name: a2.OS_MAP.Android, version: t3 };
            return r3 && (i3.versionName = r3), i3;
          } }, { test: [/(web|hpw)[o0]s/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/(?:web|hpw)[o0]s\/(\d+(\.\d+)*)/i, e3), r3 = { name: a2.OS_MAP.WebOS };
            return t3 && t3.length && (r3.version = t3), r3;
          } }, { test: [/blackberry|\bbb\d+/i, /rim\stablet/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i, e3) || n2.default.getFirstMatch(/blackberry\d+\/(\d+([_\s]\d+)*)/i, e3) || n2.default.getFirstMatch(/\bbb(\d+)/i, e3);
            return { name: a2.OS_MAP.BlackBerry, version: t3 };
          } }, { test: [/bada/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/bada\/(\d+(\.\d+)*)/i, e3);
            return { name: a2.OS_MAP.Bada, version: t3 };
          } }, { test: [/tizen/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/tizen[/\s](\d+(\.\d+)*)/i, e3);
            return { name: a2.OS_MAP.Tizen, version: t3 };
          } }, { test: [/linux/i], describe: function() {
            return { name: a2.OS_MAP.Linux };
          } }, { test: [/CrOS/], describe: function() {
            return { name: a2.OS_MAP.ChromeOS };
          } }, { test: [/PlayStation 4/], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/PlayStation 4[/\s](\d+(\.\d+)*)/i, e3);
            return { name: a2.OS_MAP.PlayStation4, version: t3 };
          } }];
          t2.default = o2, e2.exports = t2.default;
        }, 94: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2, n2 = (i2 = r2(17)) && i2.__esModule ? i2 : { default: i2 }, a2 = r2(18);
          var o2 = [{ test: [/googlebot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Google" };
          } }, { test: [/linespider/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Line" };
          } }, { test: [/amazonbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Amazon" };
          } }, { test: [/gptbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "OpenAI" };
          } }, { test: [/chatgpt-user/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "OpenAI" };
          } }, { test: [/oai-searchbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "OpenAI" };
          } }, { test: [/baiduspider/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Baidu" };
          } }, { test: [/bingbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Bing" };
          } }, { test: [/duckduckbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "DuckDuckGo" };
          } }, { test: [/claudebot/i, /claude-web/i, /claude-user/i, /claude-searchbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Anthropic" };
          } }, { test: [/omgilibot/i, /webzio-extended/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Webz.io" };
          } }, { test: [/diffbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Diffbot" };
          } }, { test: [/perplexitybot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Perplexity AI" };
          } }, { test: [/perplexity-user/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Perplexity AI" };
          } }, { test: [/youbot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "You.com" };
          } }, { test: [/ia_archiver/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Internet Archive" };
          } }, { test: [/meta-webindexer/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Meta" };
          } }, { test: [/meta-externalads/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Meta" };
          } }, { test: [/meta-externalagent/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Meta" };
          } }, { test: [/meta-externalfetcher/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Meta" };
          } }, { test: [/facebookexternalhit/i, /facebookcatalog/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Meta" };
          } }, { test: [/slackbot/i, /slack-imgProxy/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Slack" };
          } }, { test: [/yahoo/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Yahoo" };
          } }, { test: [/yandexbot/i, /yandexmobilebot/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Yandex" };
          } }, { test: [/pingdom/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.bot, vendor: "Pingdom" };
          } }, { test: [/huawei/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/(can-l01)/i, e3) && "Nova", r3 = { type: a2.PLATFORMS_MAP.mobile, vendor: "Huawei" };
            return t3 && (r3.model = t3), r3;
          } }, { test: [/nexus\s*(?:7|8|9|10).*/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet, vendor: "Nexus" };
          } }, { test: [/ipad/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet, vendor: "Apple", model: "iPad" };
          } }, { test: [/Macintosh(.*?) FxiOS(.*?)\//], describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet, vendor: "Apple", model: "iPad" };
          } }, { test: [/kftt build/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet, vendor: "Amazon", model: "Kindle Fire HD 7" };
          } }, { test: [/silk/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet, vendor: "Amazon" };
          } }, { test: [/tablet(?! pc)/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet };
          } }, { test: function(e3) {
            var t3 = e3.test(/ipod|iphone/i), r3 = e3.test(/like (ipod|iphone)/i);
            return t3 && !r3;
          }, describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/(ipod|iphone)/i, e3);
            return { type: a2.PLATFORMS_MAP.mobile, vendor: "Apple", model: t3 };
          } }, { test: [/nexus\s*[0-6].*/i, /galaxy nexus/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.mobile, vendor: "Nexus" };
          } }, { test: [/Nokia/i], describe: function(e3) {
            var t3 = n2.default.getFirstMatch(/Nokia\s+([0-9]+(\.[0-9]+)?)/i, e3), r3 = { type: a2.PLATFORMS_MAP.mobile, vendor: "Nokia" };
            return t3 && (r3.model = t3), r3;
          } }, { test: [/[^-]mobi/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.mobile };
          } }, { test: function(e3) {
            return "blackberry" === e3.getBrowserName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.mobile, vendor: "BlackBerry" };
          } }, { test: function(e3) {
            return "bada" === e3.getBrowserName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.mobile };
          } }, { test: function(e3) {
            return "windows phone" === e3.getBrowserName();
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.mobile, vendor: "Microsoft" };
          } }, { test: function(e3) {
            var t3 = Number(String(e3.getOSVersion()).split(".")[0]);
            return "android" === e3.getOSName(true) && t3 >= 3;
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.tablet };
          } }, { test: function(e3) {
            return "android" === e3.getOSName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.mobile };
          } }, { test: [/smart-?tv|smarttv/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tv };
          } }, { test: [/netcast/i], describe: function() {
            return { type: a2.PLATFORMS_MAP.tv };
          } }, { test: function(e3) {
            return "macos" === e3.getOSName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.desktop, vendor: "Apple" };
          } }, { test: function(e3) {
            return "windows" === e3.getOSName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.desktop };
          } }, { test: function(e3) {
            return "linux" === e3.getOSName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.desktop };
          } }, { test: function(e3) {
            return "playstation 4" === e3.getOSName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.tv };
          } }, { test: function(e3) {
            return "roku" === e3.getOSName(true);
          }, describe: function() {
            return { type: a2.PLATFORMS_MAP.tv };
          } }];
          t2.default = o2, e2.exports = t2.default;
        }, 95: function(e2, t2, r2) {
          "use strict";
          t2.__esModule = true, t2.default = void 0;
          var i2, n2 = (i2 = r2(17)) && i2.__esModule ? i2 : { default: i2 }, a2 = r2(18);
          var o2 = [{ test: function(e3) {
            return "microsoft edge" === e3.getBrowserName(true);
          }, describe: function(e3) {
            if (/\sedg\//i.test(e3)) return { name: a2.ENGINE_MAP.Blink };
            var t3 = n2.default.getFirstMatch(/edge\/(\d+(\.?_?\d+)+)/i, e3);
            return { name: a2.ENGINE_MAP.EdgeHTML, version: t3 };
          } }, { test: [/trident/i], describe: function(e3) {
            var t3 = { name: a2.ENGINE_MAP.Trident }, r3 = n2.default.getFirstMatch(/trident\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: function(e3) {
            return e3.test(/presto/i);
          }, describe: function(e3) {
            var t3 = { name: a2.ENGINE_MAP.Presto }, r3 = n2.default.getFirstMatch(/presto\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: function(e3) {
            var t3 = e3.test(/gecko/i), r3 = e3.test(/like gecko/i);
            return t3 && !r3;
          }, describe: function(e3) {
            var t3 = { name: a2.ENGINE_MAP.Gecko }, r3 = n2.default.getFirstMatch(/gecko\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }, { test: [/(apple)?webkit\/537\.36/i], describe: function() {
            return { name: a2.ENGINE_MAP.Blink };
          } }, { test: [/(apple)?webkit/i], describe: function(e3) {
            var t3 = { name: a2.ENGINE_MAP.WebKit }, r3 = n2.default.getFirstMatch(/webkit\/(\d+(\.?_?\d+)+)/i, e3);
            return r3 && (t3.version = r3), t3;
          } }];
          t2.default = o2, e2.exports = t2.default;
        } });
      }));
    }
  });

  // node_modules/@pipecat-ai/client-js/dist/index.module.js
  var import_events = __toESM(require_events());

  // node_modules/uuid/dist/esm-browser/stringify.js
  var byteToHex = [];
  for (i2 = 0; i2 < 256; ++i2) {
    byteToHex.push((i2 + 256).toString(16).slice(1));
  }
  var i2;
  function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  }

  // node_modules/uuid/dist/esm-browser/rng.js
  var getRandomValues;
  var rnds8 = new Uint8Array(16);
  function rng() {
    if (!getRandomValues) {
      getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
      if (!getRandomValues) {
        throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
      }
    }
    return getRandomValues(rnds8);
  }

  // node_modules/uuid/dist/esm-browser/native.js
  var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
  var native_default = {
    randomUUID
  };

  // node_modules/uuid/dist/esm-browser/v4.js
  function v4(options, buf, offset) {
    if (native_default.randomUUID && !buf && !options) {
      return native_default.randomUUID();
    }
    options = options || {};
    var rnds = options.random || (options.rng || rng)();
    rnds[6] = rnds[6] & 15 | 64;
    rnds[8] = rnds[8] & 63 | 128;
    if (buf) {
      offset = offset || 0;
      for (var i2 = 0; i2 < 16; ++i2) {
        buf[offset + i2] = rnds[i2];
      }
      return buf;
    }
    return unsafeStringify(rnds);
  }
  var v4_default = v4;

  // node_modules/@pipecat-ai/client-js/dist/index.module.js
  var import_bowser = __toESM(require_es5());
  function $parcel$exportWildcard(dest, source) {
    Object.keys(source).forEach(function(key) {
      if (key === "default" || key === "__esModule" || Object.prototype.hasOwnProperty.call(dest, key)) {
        return;
      }
      Object.defineProperty(dest, key, {
        enumerable: true,
        get: function get() {
          return source[key];
        }
      });
    });
    return dest;
  }
  function $parcel$interopDefault(a2) {
    return a2 && a2.__esModule ? a2.default : a2;
  }
  function $parcel$export(e2, n2, v2, s2) {
    Object.defineProperty(e2, n2, { get: v2, set: s2, enumerable: true, configurable: true });
  }
  var $05fa7b586184a19c$exports = {};
  var $364c127d152b1085$exports = {};
  $parcel$export($364c127d152b1085$exports, "PipecatClient", () => $364c127d152b1085$export$8f7f86a77535f7a3);
  var $e3bad9cc25e327f7$exports = {};
  $e3bad9cc25e327f7$exports = JSON.parse('{"name":"@pipecat-ai/client-js","version":"1.7.0","license":"BSD-2-Clause","main":"dist/index.js","module":"dist/index.module.js","types":"dist/index.d.ts","source":"index.ts","repository":{"type":"git","url":"git+https://github.com/pipecat-ai/pipecat-client-web.git"},"exports":{".":{"types":"./dist/index.d.ts","import":"./dist/index.module.js","require":"./dist/index.js"}},"files":["dist","package.json","README.md"],"scripts":{"build":"jest --silent --passWithNoTests && parcel build --no-cache","dev":"parcel watch","lint":"eslint . --report-unused-disable-directives --max-warnings 0","test":"jest"},"jest":{"preset":"ts-jest","testEnvironment":"jsdom","setupFilesAfterEnv":["<rootDir>/tests/jest.setup.ts"]},"devDependencies":{"@jest/globals":"^29.7.0","@types/clone-deep":"^4.0.4","@types/jest":"^29.5.12","@types/uuid":"^10.0.0","eslint":"^9.11.1","eslint-config-prettier":"^9.1.0","eslint-plugin-simple-import-sort":"^12.1.1","jest":"^29.7.0","jest-environment-jsdom":"^30.0.2","ts-jest":"^29.2.5","whatwg-fetch":"^3.6.20"},"dependencies":{"@types/events":"^3.0.3","bowser":"^2.11.0","clone-deep":"^4.0.1","events":"^3.3.0","typed-emitter":"^2.1.0","uuid":"^10.0.0"}}');
  var $fc3f408bb0b1f921$exports = {};
  var $6396333126da0e76$exports = {};
  $parcel$export($6396333126da0e76$exports, "TransportStateEnum", () => $6396333126da0e76$export$8f2038d3679a1d9b);
  var $6396333126da0e76$export$8f2038d3679a1d9b;
  (function(TransportStateEnum) {
    TransportStateEnum["DISCONNECTED"] = "disconnected";
    TransportStateEnum["INITIALIZING"] = "initializing";
    TransportStateEnum["INITIALIZED"] = "initialized";
    TransportStateEnum["AUTHENTICATING"] = "authenticating";
    TransportStateEnum["AUTHENTICATED"] = "authenticated";
    TransportStateEnum["CONNECTING"] = "connecting";
    TransportStateEnum["CONNECTED"] = "connected";
    TransportStateEnum["READY"] = "ready";
    TransportStateEnum["DISCONNECTING"] = "disconnecting";
    TransportStateEnum["ERROR"] = "error";
  })($6396333126da0e76$export$8f2038d3679a1d9b || ($6396333126da0e76$export$8f2038d3679a1d9b = {}));
  var $db6391dc7d757577$exports = {};
  $parcel$export($db6391dc7d757577$exports, "RTVIError", () => $db6391dc7d757577$export$59b4786f333aac02);
  $parcel$export($db6391dc7d757577$exports, "ConnectionTimeoutError", () => $db6391dc7d757577$export$c67992fa684a81a6);
  $parcel$export($db6391dc7d757577$exports, "StartBotError", () => $db6391dc7d757577$export$e7544ab812238a61);
  $parcel$export($db6391dc7d757577$exports, "TransportStartError", () => $db6391dc7d757577$export$e0624a511a2c4e9);
  $parcel$export($db6391dc7d757577$exports, "InvalidTransportParamsError", () => $db6391dc7d757577$export$b6ce555ea7f95fba);
  $parcel$export($db6391dc7d757577$exports, "BotNotReadyError", () => $db6391dc7d757577$export$885fb96b850e8fbb);
  $parcel$export($db6391dc7d757577$exports, "BotAlreadyStartedError", () => $db6391dc7d757577$export$cc240eab14fa4f50);
  $parcel$export($db6391dc7d757577$exports, "UnsupportedFeatureError", () => $db6391dc7d757577$export$bd0820eb8444fcd9);
  $parcel$export($db6391dc7d757577$exports, "MessageTooLargeError", () => $db6391dc7d757577$export$78e1011ee1942cf6);
  $parcel$export($db6391dc7d757577$exports, "DeviceError", () => $db6391dc7d757577$export$64c9f614187c1e59);
  var $db6391dc7d757577$export$59b4786f333aac02 = class extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  };
  var $db6391dc7d757577$export$c67992fa684a81a6 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message) {
      super(message ?? "Bot did not enter ready state within the specified timeout period.");
    }
  };
  var $db6391dc7d757577$export$e7544ab812238a61 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message, status) {
      super(message ?? `Failed to connect / invalid auth bundle from base url`, status ?? 500);
      this.error = "invalid-request-error";
    }
  };
  var $db6391dc7d757577$export$e0624a511a2c4e9 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message) {
      super(message ?? "Unable to connect to transport");
    }
  };
  var $db6391dc7d757577$export$b6ce555ea7f95fba = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message) {
      super(message ?? "Invalid transport connection parameters");
    }
  };
  var $db6391dc7d757577$export$885fb96b850e8fbb = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message) {
      super(message ?? "Attempt to call action on transport when not in 'ready' state.");
    }
  };
  var $db6391dc7d757577$export$cc240eab14fa4f50 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message) {
      super(message ?? "Pipecat client has already been started. Please call disconnect() before starting again.");
    }
  };
  var $db6391dc7d757577$export$bd0820eb8444fcd9 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(feature, source, message) {
      let msg = `${feature} not supported${message ? `: ${message}` : ""}`;
      if (source) msg = `${source} does not support ${feature}${message ? `: ${message}` : ""}`;
      super(msg);
      this.feature = feature;
    }
  };
  var $db6391dc7d757577$export$78e1011ee1942cf6 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(message) {
      super(message ?? "Message size exceeds the maximum allowed limit for transport.");
    }
  };
  var $db6391dc7d757577$export$64c9f614187c1e59 = class extends $db6391dc7d757577$export$59b4786f333aac02 {
    constructor(devices, type, message, details) {
      super(message ?? `Device error for ${devices.join(", ")}: ${type}`);
      this.devices = devices;
      this.type = type;
      this.details = details;
    }
  };
  var $c1b4da4af54f4fa1$exports = {};
  $parcel$export($c1b4da4af54f4fa1$exports, "RTVIEvent", () => $c1b4da4af54f4fa1$export$6b4624d233c61fcb);
  var $c1b4da4af54f4fa1$export$6b4624d233c61fcb;
  (function(RTVIEvent) {
    RTVIEvent["Connected"] = "connected";
    RTVIEvent["Disconnected"] = "disconnected";
    RTVIEvent["TransportStateChanged"] = "transportStateChanged";
    RTVIEvent["BotStarted"] = "botStarted";
    RTVIEvent["BotConnected"] = "botConnected";
    RTVIEvent["BotReady"] = "botReady";
    RTVIEvent["BotDisconnected"] = "botDisconnected";
    RTVIEvent["Error"] = "error";
    RTVIEvent["ServerMessage"] = "serverMessage";
    RTVIEvent["ServerResponse"] = "serverResponse";
    RTVIEvent["MessageError"] = "messageError";
    RTVIEvent["Metrics"] = "metrics";
    RTVIEvent["BotStartedSpeaking"] = "botStartedSpeaking";
    RTVIEvent["BotStoppedSpeaking"] = "botStoppedSpeaking";
    RTVIEvent["UserStartedSpeaking"] = "userStartedSpeaking";
    RTVIEvent["UserStoppedSpeaking"] = "userStoppedSpeaking";
    RTVIEvent["UserMuteStarted"] = "userMuteStarted";
    RTVIEvent["UserMuteStopped"] = "userMuteStopped";
    RTVIEvent["UserTranscript"] = "userTranscript";
    RTVIEvent["BotOutput"] = "botOutput";
    RTVIEvent["BotTranscript"] = "botTranscript";
    RTVIEvent["BotLlmText"] = "botLlmText";
    RTVIEvent["BotLlmStarted"] = "botLlmStarted";
    RTVIEvent["BotLlmStopped"] = "botLlmStopped";
    RTVIEvent["LLMFunctionCall"] = "llmFunctionCall";
    RTVIEvent["LLMFunctionCallStarted"] = "llmFunctionCallStarted";
    RTVIEvent["LLMFunctionCallInProgress"] = "llmFunctionCallInProgress";
    RTVIEvent["LLMFunctionCallStopped"] = "llmFunctionCallStopped";
    RTVIEvent["BotLlmSearchResponse"] = "botLlmSearchResponse";
    RTVIEvent["BotTtsText"] = "botTtsText";
    RTVIEvent["BotTtsStarted"] = "botTtsStarted";
    RTVIEvent["BotTtsStopped"] = "botTtsStopped";
    RTVIEvent["ParticipantConnected"] = "participantConnected";
    RTVIEvent["ParticipantLeft"] = "participantLeft";
    RTVIEvent["TrackStarted"] = "trackStarted";
    RTVIEvent["TrackStopped"] = "trackStopped";
    RTVIEvent["ScreenTrackStarted"] = "screenTrackStarted";
    RTVIEvent["ScreenTrackStopped"] = "screenTrackStopped";
    RTVIEvent["ScreenShareError"] = "screenShareError";
    RTVIEvent["LocalAudioLevel"] = "localAudioLevel";
    RTVIEvent["RemoteAudioLevel"] = "remoteAudioLevel";
    RTVIEvent["AvailableCamsUpdated"] = "availableCamsUpdated";
    RTVIEvent["AvailableMicsUpdated"] = "availableMicsUpdated";
    RTVIEvent["AvailableSpeakersUpdated"] = "availableSpeakersUpdated";
    RTVIEvent["CamUpdated"] = "camUpdated";
    RTVIEvent["MicUpdated"] = "micUpdated";
    RTVIEvent["SpeakerUpdated"] = "speakerUpdated";
    RTVIEvent["DeviceError"] = "deviceError";
  })($c1b4da4af54f4fa1$export$6b4624d233c61fcb || ($c1b4da4af54f4fa1$export$6b4624d233c61fcb = {}));
  var $c0d10c4690969999$exports = {};
  $parcel$export($c0d10c4690969999$exports, "RTVI_PROTOCOL_VERSION", () => $c0d10c4690969999$export$7bdaf0e0d661a8f5);
  $parcel$export($c0d10c4690969999$exports, "RTVI_MESSAGE_LABEL", () => $c0d10c4690969999$export$882b13c7fda338f5);
  $parcel$export($c0d10c4690969999$exports, "RTVIMessageType", () => $c0d10c4690969999$export$38b3db05cbf0e240);
  $parcel$export($c0d10c4690969999$exports, "AggregationType", () => $c0d10c4690969999$export$fa4739a8a27f18c0);
  $parcel$export($c0d10c4690969999$exports, "setAboutClient", () => $c0d10c4690969999$export$e4036f9b8ddb7379);
  $parcel$export($c0d10c4690969999$exports, "RTVIMessage", () => $c0d10c4690969999$export$69aa9ab0334b212);
  var $c0d10c4690969999$export$7bdaf0e0d661a8f5 = "1.2.0";
  var $c0d10c4690969999$export$882b13c7fda338f5 = "rtvi-ai";
  var $c0d10c4690969999$export$38b3db05cbf0e240;
  (function(RTVIMessageType) {
    RTVIMessageType["CLIENT_READY"] = "client-ready";
    RTVIMessageType["DISCONNECT_BOT"] = "disconnect-bot";
    RTVIMessageType["CLIENT_MESSAGE"] = "client-message";
    RTVIMessageType["SEND_TEXT"] = "send-text";
    RTVIMessageType["APPEND_TO_CONTEXT"] = "append-to-context";
    RTVIMessageType["BOT_READY"] = "bot-ready";
    RTVIMessageType["ERROR"] = "error";
    RTVIMessageType["METRICS"] = "metrics";
    RTVIMessageType["SERVER_MESSAGE"] = "server-message";
    RTVIMessageType["SERVER_RESPONSE"] = "server-response";
    RTVIMessageType["ERROR_RESPONSE"] = "error-response";
    RTVIMessageType["APPEND_TO_CONTEXT_RESULT"] = "append-to-context-result";
    RTVIMessageType["USER_STARTED_SPEAKING"] = "user-started-speaking";
    RTVIMessageType["USER_STOPPED_SPEAKING"] = "user-stopped-speaking";
    RTVIMessageType["BOT_STARTED_SPEAKING"] = "bot-started-speaking";
    RTVIMessageType["BOT_STOPPED_SPEAKING"] = "bot-stopped-speaking";
    RTVIMessageType["USER_MUTE_STARTED"] = "user-mute-started";
    RTVIMessageType["USER_MUTE_STOPPED"] = "user-mute-stopped";
    RTVIMessageType["USER_TRANSCRIPTION"] = "user-transcription";
    RTVIMessageType["BOT_OUTPUT"] = "bot-output";
    RTVIMessageType["BOT_TRANSCRIPTION"] = "bot-transcription";
    RTVIMessageType["USER_LLM_TEXT"] = "user-llm-text";
    RTVIMessageType["BOT_LLM_TEXT"] = "bot-llm-text";
    RTVIMessageType["BOT_LLM_STARTED"] = "bot-llm-started";
    RTVIMessageType["BOT_LLM_STOPPED"] = "bot-llm-stopped";
    RTVIMessageType["LLM_FUNCTION_CALL"] = "llm-function-call";
    RTVIMessageType["LLM_FUNCTION_CALL_STARTED"] = "llm-function-call-started";
    RTVIMessageType["LLM_FUNCTION_CALL_IN_PROGRESS"] = "llm-function-call-in-progress";
    RTVIMessageType["LLM_FUNCTION_CALL_STOPPED"] = "llm-function-call-stopped";
    RTVIMessageType["LLM_FUNCTION_CALL_RESULT"] = "llm-function-call-result";
    RTVIMessageType["BOT_LLM_SEARCH_RESPONSE"] = "bot-llm-search-response";
    RTVIMessageType["BOT_TTS_TEXT"] = "bot-tts-text";
    RTVIMessageType["BOT_TTS_STARTED"] = "bot-tts-started";
    RTVIMessageType["BOT_TTS_STOPPED"] = "bot-tts-stopped";
  })($c0d10c4690969999$export$38b3db05cbf0e240 || ($c0d10c4690969999$export$38b3db05cbf0e240 = {}));
  var $c0d10c4690969999$export$fa4739a8a27f18c0;
  (function(AggregationType) {
    AggregationType["WORD"] = "word";
    AggregationType["SENTENCE"] = "sentence";
  })($c0d10c4690969999$export$fa4739a8a27f18c0 || ($c0d10c4690969999$export$fa4739a8a27f18c0 = {}));
  var $c0d10c4690969999$var$_aboutClient;
  function $c0d10c4690969999$export$e4036f9b8ddb7379(about) {
    if ($c0d10c4690969999$var$_aboutClient) $c0d10c4690969999$var$_aboutClient = {
      ...$c0d10c4690969999$var$_aboutClient,
      ...about
    };
    else
      $c0d10c4690969999$var$_aboutClient = about;
  }
  var $c0d10c4690969999$export$69aa9ab0334b212 = class _$c0d10c4690969999$export$69aa9ab0334b212 {
    constructor(type, data, id) {
      this.label = $c0d10c4690969999$export$882b13c7fda338f5;
      this.type = type;
      this.data = data;
      this.id = id || (0, v4_default)().slice(0, 8);
    }
    // Outbound message types
    static clientReady() {
      return new _$c0d10c4690969999$export$69aa9ab0334b212($c0d10c4690969999$export$38b3db05cbf0e240.CLIENT_READY, {
        version: $c0d10c4690969999$export$7bdaf0e0d661a8f5,
        about: $c0d10c4690969999$var$_aboutClient || {
          library: (0, $e3bad9cc25e327f7$exports.name),
          library_version: (0, $e3bad9cc25e327f7$exports.version)
        }
      });
    }
    static disconnectBot() {
      return new _$c0d10c4690969999$export$69aa9ab0334b212($c0d10c4690969999$export$38b3db05cbf0e240.DISCONNECT_BOT, {});
    }
    static error(message, fatal = false) {
      return new _$c0d10c4690969999$export$69aa9ab0334b212($c0d10c4690969999$export$38b3db05cbf0e240.ERROR, {
        message,
        fatal
      });
    }
  };
  $parcel$exportWildcard($fc3f408bb0b1f921$exports, $6396333126da0e76$exports);
  $parcel$exportWildcard($fc3f408bb0b1f921$exports, $db6391dc7d757577$exports);
  $parcel$exportWildcard($fc3f408bb0b1f921$exports, $c1b4da4af54f4fa1$exports);
  $parcel$exportWildcard($fc3f408bb0b1f921$exports, $c0d10c4690969999$exports);
  function $c68ef2498d1a7177$export$f1586721024c4dab(_target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args) {
      if (this.state === "ready") return originalMethod.apply(this, args);
      else throw new (0, $db6391dc7d757577$export$885fb96b850e8fbb)(`Attempt to call ${propertyKey.toString()} when transport not in ready state. Await connect() first.`);
    };
    return descriptor;
  }
  function $c68ef2498d1a7177$export$ebc0d747cf8770bc(_target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const states = [
      "authenticating",
      "connecting",
      "connected",
      "ready"
    ];
    descriptor.value = function(...args) {
      if (states.includes(this.state)) throw new (0, $db6391dc7d757577$export$cc240eab14fa4f50)(`Attempt to call ${propertyKey.toString()} when client already started. Please call disconnect() before starting again.`);
      else return originalMethod.apply(this, args);
    };
    return descriptor;
  }
  var $769bb602511974a1$exports = {};
  $parcel$export($769bb602511974a1$exports, "MessageDispatcher", () => $769bb602511974a1$export$e9a960646cc432aa);
  var $e0900798b6cc045b$exports = {};
  $parcel$export($e0900798b6cc045b$exports, "LogLevel", () => $e0900798b6cc045b$export$243e62d78d3b544d);
  $parcel$export($e0900798b6cc045b$exports, "logger", () => $e0900798b6cc045b$export$af88d00dbe7f521);
  var $e0900798b6cc045b$export$243e62d78d3b544d;
  (function(LogLevel) {
    LogLevel[LogLevel["NONE"] = 0] = "NONE";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["INFO"] = 3] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
  })($e0900798b6cc045b$export$243e62d78d3b544d || ($e0900798b6cc045b$export$243e62d78d3b544d = {}));
  var $e0900798b6cc045b$var$Logger = class _$e0900798b6cc045b$var$Logger {
    constructor() {
      this.level = $e0900798b6cc045b$export$243e62d78d3b544d.DEBUG;
    }
    static getInstance() {
      if (!_$e0900798b6cc045b$var$Logger.instance) _$e0900798b6cc045b$var$Logger.instance = new _$e0900798b6cc045b$var$Logger();
      return _$e0900798b6cc045b$var$Logger.instance;
    }
    setLevel(level) {
      this.level = level;
    }
    debug(...args) {
      if (this.level >= $e0900798b6cc045b$export$243e62d78d3b544d.DEBUG) console.debug(...args);
    }
    info(...args) {
      if (this.level >= $e0900798b6cc045b$export$243e62d78d3b544d.INFO) console.info(...args);
    }
    warn(...args) {
      if (this.level >= $e0900798b6cc045b$export$243e62d78d3b544d.WARN) console.warn(...args);
    }
    error(...args) {
      if (this.level >= $e0900798b6cc045b$export$243e62d78d3b544d.ERROR) console.error(...args);
    }
  };
  var $e0900798b6cc045b$export$af88d00dbe7f521 = $e0900798b6cc045b$var$Logger.getInstance();
  var $769bb602511974a1$export$e9a960646cc432aa = class {
    constructor(sendMethod) {
      this._queue = new Array();
      this._gcInterval = void 0;
      this._queue = [];
      this._sendMethod = sendMethod;
    }
    disconnect() {
      this.clearQueue();
      clearInterval(this._gcInterval);
      this._gcInterval = void 0;
    }
    dispatch(message_data, type = (0, $c0d10c4690969999$export$38b3db05cbf0e240).CLIENT_MESSAGE, timeout = 1e4) {
      if (!this._gcInterval)
        this._gcInterval = setInterval(() => {
          this._gc();
        }, 2e3);
      const message = new (0, $c0d10c4690969999$export$69aa9ab0334b212)(type, message_data);
      const promise = new Promise((resolve, reject) => {
        this._queue.push({
          message,
          timestamp: Date.now(),
          timeout,
          resolve,
          reject
        });
      });
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[MessageDispatcher] dispatch", message);
      try {
        this._sendMethod(message);
      } catch (e2) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("[MessageDispatcher] Error sending message", e2);
        return Promise.reject(e2);
      }
      this._gc();
      return promise;
    }
    clearQueue() {
      this._queue = [];
    }
    _resolveReject(message, resolve = true) {
      const queuedMessage = this._queue.find((msg) => msg.message.id === message.id);
      if (queuedMessage) {
        if (resolve) {
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[MessageDispatcher] Resolve", message);
          queuedMessage.resolve(message);
        } else {
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[MessageDispatcher] Reject", message);
          queuedMessage.reject(message);
        }
        this._queue = this._queue.filter((msg) => msg.message.id !== message.id);
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[MessageDispatcher] Queue", this._queue);
      }
      return message;
    }
    resolve(message) {
      return this._resolveReject(message, true);
    }
    reject(message) {
      return this._resolveReject(message, false);
    }
    _gc() {
      const expired = [];
      this._queue = this._queue.filter((msg) => {
        const isValid = Date.now() - msg.timestamp < msg.timeout;
        if (!isValid) expired.push(msg);
        return isValid;
      });
      expired.forEach((msg) => {
        if (msg.message.type === (0, $c0d10c4690969999$export$38b3db05cbf0e240).CLIENT_MESSAGE) msg.reject(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).ERROR_RESPONSE, {
          error: "Timed out waiting for response",
          msgType: msg.message.data.t,
          data: msg.message.data.d,
          fatal: false
        }));
      });
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[MessageDispatcher] GC", this._queue);
    }
  };
  var $d0e914667cc5346b$exports = {};
  $parcel$export($d0e914667cc5346b$exports, "isAPIRequest", () => $d0e914667cc5346b$export$2dd7ca293b2783);
  $parcel$export($d0e914667cc5346b$exports, "makeRequest", () => $d0e914667cc5346b$export$699251e5611cc6db);
  function $d0e914667cc5346b$export$2dd7ca293b2783(value) {
    if (typeof value === "object" && value !== null && Object.keys(value).includes("endpoint")) {
      const endpoint = value["endpoint"];
      return typeof endpoint === "string" || endpoint instanceof URL || typeof Request !== "undefined" && endpoint instanceof Request;
    }
    return false;
  }
  async function $d0e914667cc5346b$export$699251e5611cc6db(cxnOpts, abortController) {
    if (!abortController) abortController = new AbortController();
    let handshakeTimeout;
    return new Promise((resolve, reject) => {
      (async () => {
        if (cxnOpts.timeout) handshakeTimeout = setTimeout(async () => {
          abortController.abort();
          reject(new Error("Timed out"));
        }, cxnOpts.timeout);
        let request;
        if (typeof Request !== "undefined" && cxnOpts.endpoint instanceof Request) {
          request = new Request(cxnOpts.endpoint, {
            signal: abortController.signal
          });
          if (cxnOpts.requestData) (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("[Pipecat Client] requestData in APIRequest is ignored when endpoint is a Request object");
          if (cxnOpts.headers) (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("[Pipecat Client] headers in APIRequest is ignored when endpoint is a Request object");
        } else request = new Request(cxnOpts.endpoint, {
          method: "POST",
          mode: "cors",
          headers: new Headers({
            "Content-Type": "application/json",
            ...Object.fromEntries((cxnOpts.headers ?? new Headers()).entries())
          }),
          body: JSON.stringify(cxnOpts.requestData),
          signal: abortController.signal
        });
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug(`[Pipecat Client] Fetching from ${request.url}`);
        fetch(request).then((res) => {
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug(`[Pipecat Client] Received response from ${request.url}`, res);
          if (!res.ok) {
            reject(res);
            return;
          }
          return res.json();
        }).then((data) => {
          resolve(data);
        }).catch((err) => {
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).error(`[Pipecat Client] Error fetching: ${err}`);
          reject(err);
        }).finally(() => {
          if (handshakeTimeout) clearTimeout(handshakeTimeout);
        });
      })();
    });
  }
  var $7ef5cee66c377f4d$exports = {};
  $parcel$export($7ef5cee66c377f4d$exports, "Transport", () => $7ef5cee66c377f4d$export$86495b081fef8e52);
  $parcel$export($7ef5cee66c377f4d$exports, "TransportWrapper", () => $7ef5cee66c377f4d$export$82b6ede160a64a3c);
  var $7ef5cee66c377f4d$export$86495b081fef8e52 = class {
    constructor() {
      this._state = "disconnected";
      this._maxMessageSize = 65536;
    }
    /**
     * Establishes a connection with the remote server. This is the main entry
     * point for the transport to start sending and receiving media and messages.
     * This is called from PipecatClient.connect() and should not be called directly.
     * @param connectParams - This type will ultimately be defned by the transport
     * implementation. It is used to pass connection parameters to the transport.
     */
    connect(connectParams) {
      this._abortController = new AbortController();
      let validatedParams = connectParams;
      try {
        validatedParams = this._validateConnectionParams(connectParams);
      } catch (e2) {
        throw new (0, $db6391dc7d757577$export$59b4786f333aac02)(`Invalid connection params: ${e2.message}. Please check your connection params and try again.`);
      }
      return this._connect(validatedParams);
    }
    /**
     * Allow the transports to determine how the bot was started.
     */
    get startBotParams() {
      return this._startBotParams;
    }
    /**
     * Set the parameters used to start the bot.
     * @param startBotParams
     */
    set startBotParams(startBotParams) {
      if (typeof Request !== "undefined" && startBotParams.endpoint instanceof Request) {
        this._startBotParams = {
          ...startBotParams,
          endpoint: startBotParams.endpoint.clone()
        };
        return;
      }
      this._startBotParams = startBotParams;
    }
    /**
     * Disconnects the transport from the remote server. This is called from
     * PipecatClient.disconnect() and should not be called directly.
     */
    disconnect() {
      if (this._abortController) this._abortController.abort();
      return this._disconnect();
    }
    /**
     * Maximum size, in bytes, of a single message that this transport will attempt
     * to send. Callers should ensure that any outbound {@link RTVIMessage} payloads
     * do not exceed this limit to avoid transport or server errors.
     */
    get maxMessageSize() {
      return this._maxMessageSize;
    }
  };
  var $7ef5cee66c377f4d$export$82b6ede160a64a3c = class {
    constructor(transport) {
      this._transport = transport;
      this._proxy = new Proxy(this._transport, {
        get: (target, prop, receiver) => {
          if (typeof target[prop] === "function") {
            let errMsg;
            switch (String(prop)) {
              // Disable methods that modify the lifecycle of the call. These operations
              // should be performed via the Pipecat client in order to keep state in sync.
              case "initialize":
                errMsg = `Direct calls to initialize() are disabled and used internally by the PipecatClient.`;
                break;
              case "initDevices":
                errMsg = `Direct calls to initDevices() are disabled. Please use the PipecatClient.initDevices() wrapper or let PipecatClient.connect() call it for you.`;
                break;
              case "sendReadyMessage":
                errMsg = `Direct calls to sendReadyMessage() are disabled and used internally by the PipecatClient.`;
                break;
              case "connect":
                errMsg = `Direct calls to connect() are disabled. Please use the PipecatClient.connect() wrapper.`;
                break;
              case "disconnect":
                errMsg = `Direct calls to disconnect() are disabled. Please use the PipecatClient.disconnect() wrapper.`;
                break;
            }
            if (errMsg) return () => {
              throw new Error(errMsg);
            };
            return (...args) => {
              return target[prop](...args);
            };
          }
          return Reflect.get(target, prop, receiver);
        }
      });
    }
    get proxy() {
      return this._proxy;
    }
  };
  var $dfd757760e36925b$exports = {};
  $parcel$export($dfd757760e36925b$exports, "learnAboutClient", () => $dfd757760e36925b$export$7eb7b0a641098f31);
  $parcel$export($dfd757760e36925b$exports, "messageSizeWithinLimit", () => $dfd757760e36925b$export$48f8227f1e7323f5);
  function $dfd757760e36925b$export$7eb7b0a641098f31() {
    let about = {
      library: (0, $e3bad9cc25e327f7$exports.name),
      library_version: (0, $e3bad9cc25e327f7$exports.version),
      platform_details: {}
    };
    let navAgentInfo = null;
    if (window?.navigator?.userAgent) try {
      navAgentInfo = (0, import_bowser.default).parse(window.navigator.userAgent);
    } catch (_2) {
    }
    if (navAgentInfo?.browser?.name) about.platform_details.browser = navAgentInfo.browser.name;
    if (navAgentInfo?.browser?.name === "Safari" && !navAgentInfo.browser.version) about.platform_details.browser_version = "Web View";
    else if (navAgentInfo?.browser?.version) about.platform_details.browser_version = navAgentInfo.browser.version;
    if (navAgentInfo?.platform?.type) about.platform_details.platform_type = navAgentInfo.platform.type;
    if (navAgentInfo?.engine?.name) about.platform_details.engine = navAgentInfo.engine.name;
    if (navAgentInfo?.os) {
      about.platform = navAgentInfo.os.name;
      about.platform_version = navAgentInfo.os.version;
    }
    return about;
  }
  function $dfd757760e36925b$export$48f8227f1e7323f5(message, maxSize) {
    const getSizeInBytes = (obj) => {
      const jsonString = JSON.stringify(obj);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonString);
      return bytes.length;
    };
    const size = getSizeInBytes(message);
    return size <= maxSize;
  }
  var $364c127d152b1085$var$__decorate = function(decorators, target, key, desc) {
    var c2 = arguments.length, r2 = c2 < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d2;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r2 = Reflect.decorate(decorators, target, key, desc);
    else for (var i2 = decorators.length - 1; i2 >= 0; i2--) if (d2 = decorators[i2]) r2 = (c2 < 3 ? d2(r2) : c2 > 3 ? d2(target, key, r2) : d2(target, key)) || r2;
    return c2 > 3 && r2 && Object.defineProperty(target, key, r2), r2;
  };
  var $364c127d152b1085$var$RTVIEventEmitter = class extends (0, import_events.default) {
  };
  var $364c127d152b1085$export$8f7f86a77535f7a3 = class extends $364c127d152b1085$var$RTVIEventEmitter {
    constructor(options) {
      super();
      this._functionCallCallbacks = {};
      this._botTranscriptionWarned = false;
      this._llmFunctionCallWarned = false;
      (0, $c0d10c4690969999$export$e4036f9b8ddb7379)((0, $dfd757760e36925b$export$7eb7b0a641098f31)());
      this._transport = options.transport;
      this._transportWrapper = new (0, $7ef5cee66c377f4d$export$82b6ede160a64a3c)(this._transport);
      this._disconnectOnBotDisconnect = options.disconnectOnBotDisconnect ?? true;
      const wrappedCallbacks = {
        ...options.callbacks,
        onMessageError: (message) => {
          options?.callbacks?.onMessageError?.(message);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).MessageError, message);
        },
        onError: (message) => {
          options?.callbacks?.onError?.(message);
          try {
            this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).Error, message);
          } catch (e2) {
            if (e2 instanceof Error && e2.message.includes("Unhandled error")) {
              if (!options?.callbacks?.onError) (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("No onError callback registered to handle error", message);
            } else (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("Could not emit error", message, e2);
          }
          const data = message.data;
          if (data?.fatal) {
            (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("Fatal error reported. Disconnecting...");
            this.disconnect();
          }
        },
        onConnected: () => {
          options?.callbacks?.onConnected?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).Connected);
        },
        onDisconnected: () => {
          options?.callbacks?.onDisconnected?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).Disconnected);
        },
        onTransportStateChanged: (state) => {
          options?.callbacks?.onTransportStateChanged?.(state);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).TransportStateChanged, state);
        },
        onParticipantJoined: (p2) => {
          options?.callbacks?.onParticipantJoined?.(p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).ParticipantConnected, p2);
        },
        onParticipantLeft: (p2) => {
          options?.callbacks?.onParticipantLeft?.(p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).ParticipantLeft, p2);
        },
        onTrackStarted: (track2, p2) => {
          options?.callbacks?.onTrackStarted?.(track2, p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).TrackStarted, track2, p2);
        },
        onTrackStopped: (track2, p2) => {
          options?.callbacks?.onTrackStopped?.(track2, p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).TrackStopped, track2, p2);
        },
        onScreenTrackStarted: (track2, p2) => {
          options?.callbacks?.onScreenTrackStarted?.(track2, p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).ScreenTrackStarted, track2, p2);
        },
        onScreenTrackStopped: (track2, p2) => {
          options?.callbacks?.onScreenTrackStopped?.(track2, p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).ScreenTrackStopped, track2, p2);
        },
        onScreenShareError: (errorMessage) => {
          options?.callbacks?.onScreenShareError?.(errorMessage);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).ScreenShareError, errorMessage);
        },
        onAvailableCamsUpdated: (cams) => {
          options?.callbacks?.onAvailableCamsUpdated?.(cams);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).AvailableCamsUpdated, cams);
        },
        onAvailableMicsUpdated: (mics) => {
          options?.callbacks?.onAvailableMicsUpdated?.(mics);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).AvailableMicsUpdated, mics);
        },
        onAvailableSpeakersUpdated: (speakers) => {
          options?.callbacks?.onAvailableSpeakersUpdated?.(speakers);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).AvailableSpeakersUpdated, speakers);
        },
        onCamUpdated: (cam) => {
          options?.callbacks?.onCamUpdated?.(cam);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).CamUpdated, cam);
        },
        onMicUpdated: (mic) => {
          options?.callbacks?.onMicUpdated?.(mic);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).MicUpdated, mic);
        },
        onSpeakerUpdated: (speaker) => {
          options?.callbacks?.onSpeakerUpdated?.(speaker);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).SpeakerUpdated, speaker);
        },
        onDeviceError: (error) => {
          options?.callbacks?.onDeviceError?.(error);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).DeviceError, error);
        },
        onBotStarted: (botResponse) => {
          options?.callbacks?.onBotStarted?.(botResponse);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotStarted, botResponse);
        },
        onBotConnected: (p2) => {
          options?.callbacks?.onBotConnected?.(p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotConnected, p2);
        },
        onBotReady: (botReadyData) => {
          options?.callbacks?.onBotReady?.(botReadyData);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotReady, botReadyData);
        },
        onBotDisconnected: (p2) => {
          options?.callbacks?.onBotDisconnected?.(p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotDisconnected, p2);
          if (this._disconnectOnBotDisconnect) {
            (0, $e0900798b6cc045b$export$af88d00dbe7f521).info("Bot disconnected. Disconnecting client...");
            this.disconnect();
          }
        },
        onUserStartedSpeaking: () => {
          options?.callbacks?.onUserStartedSpeaking?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).UserStartedSpeaking);
        },
        onUserStoppedSpeaking: () => {
          options?.callbacks?.onUserStoppedSpeaking?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).UserStoppedSpeaking);
        },
        onBotStartedSpeaking: () => {
          options?.callbacks?.onBotStartedSpeaking?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotStartedSpeaking);
        },
        onBotStoppedSpeaking: () => {
          options?.callbacks?.onBotStoppedSpeaking?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotStoppedSpeaking);
        },
        onRemoteAudioLevel: (level, p2) => {
          options?.callbacks?.onRemoteAudioLevel?.(level, p2);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).RemoteAudioLevel, level, p2);
        },
        onLocalAudioLevel: (level) => {
          options?.callbacks?.onLocalAudioLevel?.(level);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).LocalAudioLevel, level);
        },
        onUserMuteStarted: () => {
          options?.callbacks?.onUserMuteStarted?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).UserMuteStarted);
        },
        onUserMuteStopped: () => {
          options?.callbacks?.onUserMuteStopped?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).UserMuteStopped);
        },
        onUserTranscript: (data) => {
          options?.callbacks?.onUserTranscript?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).UserTranscript, data);
        },
        onBotOutput: (data) => {
          options?.callbacks?.onBotOutput?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotOutput, data);
        },
        onBotTranscript: (text) => {
          if (!this._botTranscriptionWarned) {
            (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("[Pipecat Client] Bot transcription is deprecated. Please use the onBotOutput instead.");
            this._botTranscriptionWarned = true;
          }
          options?.callbacks?.onBotTranscript?.(text);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotTranscript, text);
        },
        onBotLlmText: (text) => {
          options?.callbacks?.onBotLlmText?.(text);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotLlmText, text);
        },
        onBotLlmStarted: () => {
          options?.callbacks?.onBotLlmStarted?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotLlmStarted);
        },
        onBotLlmStopped: () => {
          options?.callbacks?.onBotLlmStopped?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotLlmStopped);
        },
        onBotTtsText: (text) => {
          options?.callbacks?.onBotTtsText?.(text);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotTtsText, text);
        },
        onBotTtsStarted: () => {
          options?.callbacks?.onBotTtsStarted?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotTtsStarted);
        },
        onBotTtsStopped: () => {
          options?.callbacks?.onBotTtsStopped?.();
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotTtsStopped);
        }
      };
      this._options = {
        ...options,
        callbacks: wrappedCallbacks,
        enableMic: options.enableMic ?? true,
        enableCam: options.enableCam ?? false,
        enableScreenShare: options.enableScreenShare ?? false
      };
      this._initialize();
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[Pipecat Client] Initialized", this.version);
    }
    setLogLevel(level) {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).setLevel(level);
    }
    // ------ Transport methods
    /**
     * Initialize local media devices
     */
    async initDevices() {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[Pipecat Client] Initializing devices...");
      await this._transport.initDevices();
    }
    /**
     * startBot() is a method that initiates the bot by posting to a specified endpoint
     * that optionally returns connection parameters for establishing a transport session.
     * @param startBotParams
     * @returns Promise that resolves to TransportConnectionParams or unknown
     */
    async startBot(startBotParams) {
      if (this._transport.state === "disconnected") await this._transport.initDevices();
      this._transport.state = "authenticating";
      this._transport.startBotParams = startBotParams;
      this._abortController = new AbortController();
      let response;
      try {
        response = await (0, $d0e914667cc5346b$export$699251e5611cc6db)(startBotParams, this._abortController);
      } catch (e2) {
        let errMsg = "An unknown error occurred while starting the bot.";
        let status;
        if (e2 instanceof Response) {
          const errResp = await e2.json();
          errMsg = errResp.info ?? errResp.detail ?? e2.statusText;
          status = e2.status;
        } else if (e2 instanceof Error) errMsg = e2.message;
        this._options.callbacks?.onError?.(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).ERROR_RESPONSE, {
          message: errMsg,
          fatal: true
        }));
        throw new $db6391dc7d757577$export$e7544ab812238a61(errMsg, status);
      }
      this._transport.state = "authenticated";
      this._options.callbacks?.onBotStarted?.(response);
      return response;
    }
    /**
     * The `connect` function establishes a transport session and awaits a
     * bot-ready signal, handling various connection states and errors.
     * @param {TransportConnectionParams} [connectParams] -
     * The `connectParams` parameter in the `connect` method should be of type
     * `TransportConnectionParams`. This parameter is passed to the transport
     * for establishing a transport session.
     * NOTE: `connectParams` as type `ConnectionEndpoint` IS NOW DEPRECATED. If you
     * want to authenticate and connect to a bot in one step, use
     * `startBotAndConnect()` instead.
     * @returns The `connect` method returns a Promise that resolves to an unknown value.
     */
    async connect(connectParams) {
      if (connectParams && (0, $d0e914667cc5346b$export$2dd7ca293b2783)(connectParams)) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("Calling connect with an API endpoint is deprecated. Use startBotAndConnect() instead.");
        return this.startBotAndConnect(connectParams);
      }
      return new Promise((resolve, reject) => {
        (async () => {
          this._connectResolve = resolve;
          if (this._transport.state === "disconnected") await this._transport.initDevices();
          try {
            await this._transport.connect(connectParams);
            await this._transport.sendReadyMessage();
          } catch (e2) {
            this.disconnect();
            reject(e2);
            return;
          }
        })();
      });
    }
    async startBotAndConnect(startBotParams) {
      const connectionParams = await this.startBot(startBotParams);
      return this.connect(connectionParams);
    }
    /**
     * Disconnect the voice client from the transport
     * Reset / reinitialize transport and abort any pending requests
     */
    async disconnect() {
      await this._transport.disconnect();
      this._messageDispatcher.disconnect();
    }
    /**
     * The _initialize function performs internal set up of the transport and
     * message dispatcher.
     */
    _initialize() {
      this._transport.initialize(this._options, this.handleMessage.bind(this));
      this._messageDispatcher = new (0, $769bb602511974a1$export$e9a960646cc432aa)(this._sendMessage.bind(this));
    }
    /**
     * Internal wrapper around the transport's sendMessage method
     */
    _sendMessage(message) {
      if (!(0, $dfd757760e36925b$export$48f8227f1e7323f5)(message, this._transport.maxMessageSize)) {
        const msg = `Message data too large. Max size is ${this._transport.maxMessageSize}`;
        this._options.callbacks?.onError?.((0, $c0d10c4690969999$export$69aa9ab0334b212).error(msg, false));
        throw new $db6391dc7d757577$export$78e1011ee1942cf6(msg);
      }
      try {
        this._transport.sendMessage(message);
      } catch (error) {
        if (error instanceof Error) this._options.callbacks?.onError?.((0, $c0d10c4690969999$export$69aa9ab0334b212).error(error.message, false));
        else this._options.callbacks?.onError?.((0, $c0d10c4690969999$export$69aa9ab0334b212).error("Unknown error sending message", false));
        throw error;
      }
    }
    /**
     * Get the current state of the transport
     */
    get connected() {
      return [
        "connected",
        "ready"
      ].includes(this._transport.state);
    }
    get transport() {
      return this._transportWrapper.proxy;
    }
    get state() {
      return this._transport.state;
    }
    get version() {
      return (0, /* @__PURE__ */ $parcel$interopDefault($e3bad9cc25e327f7$exports)).version;
    }
    // ------ Device methods
    async getAllMics() {
      return await this._transport.getAllMics();
    }
    async getAllCams() {
      return await this._transport.getAllCams();
    }
    async getAllSpeakers() {
      return await this._transport.getAllSpeakers();
    }
    get selectedMic() {
      return this._transport.selectedMic;
    }
    get selectedCam() {
      return this._transport.selectedCam;
    }
    get selectedSpeaker() {
      return this._transport.selectedSpeaker;
    }
    updateMic(micId) {
      this._transport.updateMic(micId);
    }
    updateCam(camId) {
      this._transport.updateCam(camId);
    }
    updateSpeaker(speakerId) {
      this._transport.updateSpeaker(speakerId);
    }
    enableMic(enable) {
      this._transport.enableMic(enable);
    }
    get isMicEnabled() {
      return this._transport.isMicEnabled;
    }
    enableCam(enable) {
      this._transport.enableCam(enable);
    }
    get isCamEnabled() {
      return this._transport.isCamEnabled;
    }
    tracks() {
      return this._transport.tracks();
    }
    enableScreenShare(enable) {
      return this._transport.enableScreenShare(enable);
    }
    get isSharingScreen() {
      return this._transport.isSharingScreen;
    }
    // ------ Messages
    /**
     * Directly send a message to the bot via the transport.
     * Do not await a response.
     * @param msgType - a string representing the message type
     * @param data - a dictionary of data to send with the message
     */
    sendClientMessage(msgType, data) {
      this._sendMessage(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).CLIENT_MESSAGE, {
        t: msgType,
        d: data
      }));
    }
    /**
     * Directly send a message to the bot via the transport.
     * Wait for and return the response.
     * @param msgType - a string representing the message type
     * @param data - a dictionary of data to send with the message
     * @param timeout - optional timeout in milliseconds for the response
     */
    async sendClientRequest(msgType, data, timeout) {
      const msgData = {
        t: msgType,
        d: data
      };
      const response = await this._messageDispatcher.dispatch(msgData, (0, $c0d10c4690969999$export$38b3db05cbf0e240).CLIENT_MESSAGE, timeout);
      const ret_data = response.data;
      return ret_data.d;
    }
    registerFunctionCallHandler(functionName, callback) {
      this._functionCallCallbacks[functionName] = callback;
    }
    unregisterFunctionCallHandler(functionName) {
      delete this._functionCallCallbacks[functionName];
    }
    unregisterAllFunctionCallHandlers() {
      this._functionCallCallbacks = {};
    }
    async appendToContext(context) {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("appendToContext() is deprecated. Use sendText() instead.");
      await this._sendMessage(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).APPEND_TO_CONTEXT, {
        role: context.role,
        content: context.content,
        run_immediately: context.run_immediately
      }));
      return true;
    }
    async sendText(content, options = {}) {
      await this._sendMessage(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).SEND_TEXT, {
        content,
        options
      }));
    }
    /**
     * Disconnects the bot, but keeps the session alive
     */
    disconnectBot() {
      this._sendMessage(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).DISCONNECT_BOT, {}));
    }
    handleMessage(ev) {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[RTVI Message]", ev);
      switch (ev.type) {
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_READY: {
          const data = ev.data;
          const botVersion = data.version ? data.version.split(".").map(Number) : [
            0,
            0,
            0
          ];
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug(`[Pipecat Client] Bot is ready. Version: ${data.version}`);
          if (botVersion[0] < 1) (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("[Pipecat Client] Bot version is less than 1.0.0, which may not be compatible with this client.");
          this._connectResolve?.(ev.data);
          this._options.callbacks?.onBotReady?.(ev.data);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).ERROR:
          this._options.callbacks?.onError?.(ev);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).SERVER_RESPONSE:
          this._messageDispatcher.resolve(ev);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).ERROR_RESPONSE: {
          const resp = this._messageDispatcher.reject(ev);
          this._options.callbacks?.onMessageError?.(resp);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).USER_STARTED_SPEAKING:
          this._options.callbacks?.onUserStartedSpeaking?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).USER_STOPPED_SPEAKING:
          this._options.callbacks?.onUserStoppedSpeaking?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_STARTED_SPEAKING:
          this._options.callbacks?.onBotStartedSpeaking?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_STOPPED_SPEAKING:
          this._options.callbacks?.onBotStoppedSpeaking?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).USER_MUTE_STARTED:
          this._options.callbacks?.onUserMuteStarted?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).USER_MUTE_STOPPED:
          this._options.callbacks?.onUserMuteStopped?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).USER_TRANSCRIPTION: {
          const TranscriptData = ev.data;
          this._options.callbacks?.onUserTranscript?.(TranscriptData);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_OUTPUT:
          this._options.callbacks?.onBotOutput?.(ev.data);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_TRANSCRIPTION:
          this._options.callbacks?.onBotTranscript?.(ev.data);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_LLM_TEXT:
          this._options.callbacks?.onBotLlmText?.(ev.data);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_LLM_STARTED:
          this._options.callbacks?.onBotLlmStarted?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_LLM_STOPPED:
          this._options.callbacks?.onBotLlmStopped?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_TTS_TEXT:
          this._options.callbacks?.onBotTtsText?.(ev.data);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_TTS_STARTED:
          this._options.callbacks?.onBotTtsStarted?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_TTS_STOPPED:
          this._options.callbacks?.onBotTtsStopped?.();
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).METRICS:
          this._options.callbacks?.onMetrics?.(ev.data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).Metrics, ev.data);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).SERVER_MESSAGE:
          this._options.callbacks?.onServerMessage?.(ev.data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).ServerMessage, ev.data);
          break;
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).LLM_FUNCTION_CALL_STARTED: {
          const data = ev.data;
          this._options.callbacks?.onLLMFunctionCallStarted?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).LLMFunctionCallStarted, data);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).LLM_FUNCTION_CALL_IN_PROGRESS: {
          const data = ev.data;
          this._maybeTriggerFunctionCallCallback(data);
          this._options.callbacks?.onLLMFunctionCallInProgress?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).LLMFunctionCallInProgress, data);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).LLM_FUNCTION_CALL_STOPPED: {
          const data = ev.data;
          this._options.callbacks?.onLLMFunctionCallStopped?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).LLMFunctionCallStopped, data);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).LLM_FUNCTION_CALL: {
          const data = ev.data;
          const inProgressData = {
            function_name: data.function_name,
            tool_call_id: data.tool_call_id,
            arguments: data.args
          };
          this._maybeTriggerFunctionCallCallback(inProgressData);
          if (this._options.callbacks?.onLLMFunctionCall) {
            if (!this._llmFunctionCallWarned) {
              (0, $e0900798b6cc045b$export$af88d00dbe7f521).warn("[Pipecat Client] onLLMFunctionCall is deprecated. Please use onLLMFunctionCallInProgress instead.");
              this._llmFunctionCallWarned = true;
            }
          }
          this._options.callbacks?.onLLMFunctionCall?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).LLMFunctionCall, data);
          break;
        }
        case (0, $c0d10c4690969999$export$38b3db05cbf0e240).BOT_LLM_SEARCH_RESPONSE: {
          const data = ev.data;
          this._options.callbacks?.onBotLlmSearchResponse?.(data);
          this.emit((0, $c1b4da4af54f4fa1$export$6b4624d233c61fcb).BotLlmSearchResponse, data);
          break;
        }
        default:
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("[Pipecat Client] Unrecognized message type", ev.type);
          break;
      }
    }
    _maybeTriggerFunctionCallCallback(data) {
      if (!data.function_name) return;
      const fc2 = this._functionCallCallbacks[data.function_name];
      if (fc2) {
        const params = {
          functionName: data.function_name ?? "",
          arguments: data.arguments ?? {}
        };
        fc2(params).then((result) => {
          if (result == void 0) return;
          this._sendMessage(new (0, $c0d10c4690969999$export$69aa9ab0334b212)((0, $c0d10c4690969999$export$38b3db05cbf0e240).LLM_FUNCTION_CALL_RESULT, {
            function_name: data.function_name,
            tool_call_id: data.tool_call_id,
            arguments: data.arguments ?? {},
            result
          }));
        }).catch((error) => {
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("Error in function call callback", error);
        });
      }
    }
  };
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$ebc0d747cf8770bc)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "startBot", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$ebc0d747cf8770bc)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "connect", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$ebc0d747cf8770bc)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "startBotAndConnect", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$f1586721024c4dab)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "sendClientMessage", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$f1586721024c4dab)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "sendClientRequest", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$f1586721024c4dab)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "appendToContext", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$f1586721024c4dab)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "sendText", null);
  $364c127d152b1085$var$__decorate([
    (0, $c68ef2498d1a7177$export$f1586721024c4dab)
  ], $364c127d152b1085$export$8f7f86a77535f7a3.prototype, "disconnectBot", null);
  $parcel$exportWildcard($05fa7b586184a19c$exports, $364c127d152b1085$exports);
  $parcel$exportWildcard($05fa7b586184a19c$exports, $769bb602511974a1$exports);
  $parcel$exportWildcard($05fa7b586184a19c$exports, $e0900798b6cc045b$exports);
  $parcel$exportWildcard($05fa7b586184a19c$exports, $d0e914667cc5346b$exports);
  $parcel$exportWildcard($05fa7b586184a19c$exports, $7ef5cee66c377f4d$exports);
  $parcel$exportWildcard($05fa7b586184a19c$exports, $dfd757760e36925b$exports);

  // node_modules/@daily-co/daily-js/dist/daily-esm.js
  function e(e2, t2) {
    if (null == e2) return {};
    var n2, r2, i2 = (function(e3, t3) {
      if (null == e3) return {};
      var n3 = {};
      for (var r3 in e3) if ({}.hasOwnProperty.call(e3, r3)) {
        if (-1 !== t3.indexOf(r3)) continue;
        n3[r3] = e3[r3];
      }
      return n3;
    })(e2, t2);
    if (Object.getOwnPropertySymbols) {
      var o2 = Object.getOwnPropertySymbols(e2);
      for (r2 = 0; r2 < o2.length; r2++) n2 = o2[r2], -1 === t2.indexOf(n2) && {}.propertyIsEnumerable.call(e2, n2) && (i2[n2] = e2[n2]);
    }
    return i2;
  }
  function t(e2, t2) {
    if (!(e2 instanceof t2)) throw new TypeError("Cannot call a class as a function");
  }
  function n(e2) {
    return n = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && "function" == typeof Symbol && e3.constructor === Symbol && e3 !== Symbol.prototype ? "symbol" : typeof e3;
    }, n(e2);
  }
  function r(e2) {
    var t2 = (function(e3, t3) {
      if ("object" != n(e3) || !e3) return e3;
      var r2 = e3[Symbol.toPrimitive];
      if (void 0 !== r2) {
        var i2 = r2.call(e3, t3 || "default");
        if ("object" != n(i2)) return i2;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t3 ? String : Number)(e3);
    })(e2, "string");
    return "symbol" == n(t2) ? t2 : t2 + "";
  }
  function i(e2, t2) {
    for (var n2 = 0; n2 < t2.length; n2++) {
      var i2 = t2[n2];
      i2.enumerable = i2.enumerable || false, i2.configurable = true, "value" in i2 && (i2.writable = true), Object.defineProperty(e2, r(i2.key), i2);
    }
  }
  function o(e2, t2, n2) {
    return t2 && i(e2.prototype, t2), n2 && i(e2, n2), Object.defineProperty(e2, "prototype", { writable: false }), e2;
  }
  function a(e2, t2) {
    if (t2 && ("object" == n(t2) || "function" == typeof t2)) return t2;
    if (void 0 !== t2) throw new TypeError("Derived constructors may only return object or undefined");
    return (function(e3) {
      if (void 0 === e3) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      return e3;
    })(e2);
  }
  function s(e2) {
    return s = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e3) {
      return e3.__proto__ || Object.getPrototypeOf(e3);
    }, s(e2);
  }
  function c(e2, t2) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e3, t3) {
      return e3.__proto__ = t3, e3;
    }, c(e2, t2);
  }
  function l(e2, t2) {
    if ("function" != typeof t2 && null !== t2) throw new TypeError("Super expression must either be null or a function");
    e2.prototype = Object.create(t2 && t2.prototype, { constructor: { value: e2, writable: true, configurable: true } }), Object.defineProperty(e2, "prototype", { writable: false }), t2 && c(e2, t2);
  }
  function u(e2, t2, n2) {
    return (t2 = r(t2)) in e2 ? Object.defineProperty(e2, t2, { value: n2, enumerable: true, configurable: true, writable: true }) : e2[t2] = n2, e2;
  }
  function d(e2, t2, n2, r2, i2, o2, a2) {
    try {
      var s2 = e2[o2](a2), c2 = s2.value;
    } catch (e3) {
      return void n2(e3);
    }
    s2.done ? t2(c2) : Promise.resolve(c2).then(r2, i2);
  }
  function p(e2) {
    return function() {
      var t2 = this, n2 = arguments;
      return new Promise((function(r2, i2) {
        var o2 = e2.apply(t2, n2);
        function a2(e3) {
          d(o2, r2, i2, a2, s2, "next", e3);
        }
        function s2(e3) {
          d(o2, r2, i2, a2, s2, "throw", e3);
        }
        a2(void 0);
      }));
    };
  }
  function h(e2, t2) {
    (null == t2 || t2 > e2.length) && (t2 = e2.length);
    for (var n2 = 0, r2 = Array(t2); n2 < t2; n2++) r2[n2] = e2[n2];
    return r2;
  }
  function f(e2, t2) {
    return (function(e3) {
      if (Array.isArray(e3)) return e3;
    })(e2) || (function(e3, t3) {
      var n2 = null == e3 ? null : "undefined" != typeof Symbol && e3[Symbol.iterator] || e3["@@iterator"];
      if (null != n2) {
        var r2, i2, o2, a2, s2 = [], c2 = true, l2 = false;
        try {
          if (o2 = (n2 = n2.call(e3)).next, 0 === t3) {
            if (Object(n2) !== n2) return;
            c2 = false;
          } else for (; !(c2 = (r2 = o2.call(n2)).done) && (s2.push(r2.value), s2.length !== t3); c2 = true) ;
        } catch (e4) {
          l2 = true, i2 = e4;
        } finally {
          try {
            if (!c2 && null != n2.return && (a2 = n2.return(), Object(a2) !== a2)) return;
          } finally {
            if (l2) throw i2;
          }
        }
        return s2;
      }
    })(e2, t2) || (function(e3, t3) {
      if (e3) {
        if ("string" == typeof e3) return h(e3, t3);
        var n2 = {}.toString.call(e3).slice(8, -1);
        return "Object" === n2 && e3.constructor && (n2 = e3.constructor.name), "Map" === n2 || "Set" === n2 ? Array.from(e3) : "Arguments" === n2 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n2) ? h(e3, t3) : void 0;
      }
    })(e2, t2) || (function() {
      throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    })();
  }
  function v(e2) {
    return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
  }
  var g;
  var m = { exports: {} };
  var y = (function() {
    if (g) return m.exports;
    g = 1;
    var e2, t2 = "object" == typeof Reflect ? Reflect : null, n2 = t2 && "function" == typeof t2.apply ? t2.apply : function(e3, t3, n3) {
      return Function.prototype.apply.call(e3, t3, n3);
    };
    e2 = t2 && "function" == typeof t2.ownKeys ? t2.ownKeys : Object.getOwnPropertySymbols ? function(e3) {
      return Object.getOwnPropertyNames(e3).concat(Object.getOwnPropertySymbols(e3));
    } : function(e3) {
      return Object.getOwnPropertyNames(e3);
    };
    var r2 = Number.isNaN || function(e3) {
      return e3 != e3;
    };
    function i2() {
      i2.init.call(this);
    }
    m.exports = i2, m.exports.once = function(e3, t3) {
      return new Promise((function(n3, r3) {
        function i3(n4) {
          e3.removeListener(t3, o3), r3(n4);
        }
        function o3() {
          "function" == typeof e3.removeListener && e3.removeListener("error", i3), n3([].slice.call(arguments));
        }
        f2(e3, t3, o3, { once: true }), "error" !== t3 && (function(e4, t4, n4) {
          "function" == typeof e4.on && f2(e4, "error", t4, n4);
        })(e3, i3, { once: true });
      }));
    }, i2.EventEmitter = i2, i2.prototype._events = void 0, i2.prototype._eventsCount = 0, i2.prototype._maxListeners = void 0;
    var o2 = 10;
    function a2(e3) {
      if ("function" != typeof e3) throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof e3);
    }
    function s2(e3) {
      return void 0 === e3._maxListeners ? i2.defaultMaxListeners : e3._maxListeners;
    }
    function c2(e3, t3, n3, r3) {
      var i3, o3, c3, l3;
      if (a2(n3), void 0 === (o3 = e3._events) ? (o3 = e3._events = /* @__PURE__ */ Object.create(null), e3._eventsCount = 0) : (void 0 !== o3.newListener && (e3.emit("newListener", t3, n3.listener ? n3.listener : n3), o3 = e3._events), c3 = o3[t3]), void 0 === c3) c3 = o3[t3] = n3, ++e3._eventsCount;
      else if ("function" == typeof c3 ? c3 = o3[t3] = r3 ? [n3, c3] : [c3, n3] : r3 ? c3.unshift(n3) : c3.push(n3), (i3 = s2(e3)) > 0 && c3.length > i3 && !c3.warned) {
        c3.warned = true;
        var u3 = new Error("Possible EventEmitter memory leak detected. " + c3.length + " " + String(t3) + " listeners added. Use emitter.setMaxListeners() to increase limit");
        u3.name = "MaxListenersExceededWarning", u3.emitter = e3, u3.type = t3, u3.count = c3.length, l3 = u3, console && console.warn && console.warn(l3);
      }
      return e3;
    }
    function l2() {
      if (!this.fired) return this.target.removeListener(this.type, this.wrapFn), this.fired = true, 0 === arguments.length ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
    }
    function u2(e3, t3, n3) {
      var r3 = { fired: false, wrapFn: void 0, target: e3, type: t3, listener: n3 }, i3 = l2.bind(r3);
      return i3.listener = n3, r3.wrapFn = i3, i3;
    }
    function d2(e3, t3, n3) {
      var r3 = e3._events;
      if (void 0 === r3) return [];
      var i3 = r3[t3];
      return void 0 === i3 ? [] : "function" == typeof i3 ? n3 ? [i3.listener || i3] : [i3] : n3 ? (function(e4) {
        for (var t4 = new Array(e4.length), n4 = 0; n4 < t4.length; ++n4) t4[n4] = e4[n4].listener || e4[n4];
        return t4;
      })(i3) : h2(i3, i3.length);
    }
    function p2(e3) {
      var t3 = this._events;
      if (void 0 !== t3) {
        var n3 = t3[e3];
        if ("function" == typeof n3) return 1;
        if (void 0 !== n3) return n3.length;
      }
      return 0;
    }
    function h2(e3, t3) {
      for (var n3 = new Array(t3), r3 = 0; r3 < t3; ++r3) n3[r3] = e3[r3];
      return n3;
    }
    function f2(e3, t3, n3, r3) {
      if ("function" == typeof e3.on) r3.once ? e3.once(t3, n3) : e3.on(t3, n3);
      else {
        if ("function" != typeof e3.addEventListener) throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof e3);
        e3.addEventListener(t3, (function i3(o3) {
          r3.once && e3.removeEventListener(t3, i3), n3(o3);
        }));
      }
    }
    return Object.defineProperty(i2, "defaultMaxListeners", { enumerable: true, get: function() {
      return o2;
    }, set: function(e3) {
      if ("number" != typeof e3 || e3 < 0 || r2(e3)) throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + e3 + ".");
      o2 = e3;
    } }), i2.init = function() {
      void 0 !== this._events && this._events !== Object.getPrototypeOf(this)._events || (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
    }, i2.prototype.setMaxListeners = function(e3) {
      if ("number" != typeof e3 || e3 < 0 || r2(e3)) throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + e3 + ".");
      return this._maxListeners = e3, this;
    }, i2.prototype.getMaxListeners = function() {
      return s2(this);
    }, i2.prototype.emit = function(e3) {
      for (var t3 = [], r3 = 1; r3 < arguments.length; r3++) t3.push(arguments[r3]);
      var i3 = "error" === e3, o3 = this._events;
      if (void 0 !== o3) i3 = i3 && void 0 === o3.error;
      else if (!i3) return false;
      if (i3) {
        var a3;
        if (t3.length > 0 && (a3 = t3[0]), a3 instanceof Error) throw a3;
        var s3 = new Error("Unhandled error." + (a3 ? " (" + a3.message + ")" : ""));
        throw s3.context = a3, s3;
      }
      var c3 = o3[e3];
      if (void 0 === c3) return false;
      if ("function" == typeof c3) n2(c3, this, t3);
      else {
        var l3 = c3.length, u3 = h2(c3, l3);
        for (r3 = 0; r3 < l3; ++r3) n2(u3[r3], this, t3);
      }
      return true;
    }, i2.prototype.addListener = function(e3, t3) {
      return c2(this, e3, t3, false);
    }, i2.prototype.on = i2.prototype.addListener, i2.prototype.prependListener = function(e3, t3) {
      return c2(this, e3, t3, true);
    }, i2.prototype.once = function(e3, t3) {
      return a2(t3), this.on(e3, u2(this, e3, t3)), this;
    }, i2.prototype.prependOnceListener = function(e3, t3) {
      return a2(t3), this.prependListener(e3, u2(this, e3, t3)), this;
    }, i2.prototype.removeListener = function(e3, t3) {
      var n3, r3, i3, o3, s3;
      if (a2(t3), void 0 === (r3 = this._events)) return this;
      if (void 0 === (n3 = r3[e3])) return this;
      if (n3 === t3 || n3.listener === t3) 0 == --this._eventsCount ? this._events = /* @__PURE__ */ Object.create(null) : (delete r3[e3], r3.removeListener && this.emit("removeListener", e3, n3.listener || t3));
      else if ("function" != typeof n3) {
        for (i3 = -1, o3 = n3.length - 1; o3 >= 0; o3--) if (n3[o3] === t3 || n3[o3].listener === t3) {
          s3 = n3[o3].listener, i3 = o3;
          break;
        }
        if (i3 < 0) return this;
        0 === i3 ? n3.shift() : (function(e4, t4) {
          for (; t4 + 1 < e4.length; t4++) e4[t4] = e4[t4 + 1];
          e4.pop();
        })(n3, i3), 1 === n3.length && (r3[e3] = n3[0]), void 0 !== r3.removeListener && this.emit("removeListener", e3, s3 || t3);
      }
      return this;
    }, i2.prototype.off = i2.prototype.removeListener, i2.prototype.removeAllListeners = function(e3) {
      var t3, n3, r3;
      if (void 0 === (n3 = this._events)) return this;
      if (void 0 === n3.removeListener) return 0 === arguments.length ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : void 0 !== n3[e3] && (0 == --this._eventsCount ? this._events = /* @__PURE__ */ Object.create(null) : delete n3[e3]), this;
      if (0 === arguments.length) {
        var i3, o3 = Object.keys(n3);
        for (r3 = 0; r3 < o3.length; ++r3) "removeListener" !== (i3 = o3[r3]) && this.removeAllListeners(i3);
        return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
      }
      if ("function" == typeof (t3 = n3[e3])) this.removeListener(e3, t3);
      else if (void 0 !== t3) for (r3 = t3.length - 1; r3 >= 0; r3--) this.removeListener(e3, t3[r3]);
      return this;
    }, i2.prototype.listeners = function(e3) {
      return d2(this, e3, true);
    }, i2.prototype.rawListeners = function(e3) {
      return d2(this, e3, false);
    }, i2.listenerCount = function(e3, t3) {
      return "function" == typeof e3.listenerCount ? e3.listenerCount(t3) : p2.call(e3, t3);
    }, i2.prototype.listenerCount = p2, i2.prototype.eventNames = function() {
      return this._eventsCount > 0 ? e2(this._events) : [];
    }, m.exports;
  })();
  var b = v(y);
  var _ = Object.prototype.hasOwnProperty;
  function w(e2, t2, n2) {
    for (n2 of e2.keys()) if (S(n2, t2)) return n2;
  }
  function S(e2, t2) {
    var n2, r2, i2;
    if (e2 === t2) return true;
    if (e2 && t2 && (n2 = e2.constructor) === t2.constructor) {
      if (n2 === Date) return e2.getTime() === t2.getTime();
      if (n2 === RegExp) return e2.toString() === t2.toString();
      if (n2 === Array) {
        if ((r2 = e2.length) === t2.length) for (; r2-- && S(e2[r2], t2[r2]); ) ;
        return -1 === r2;
      }
      if (n2 === Set) {
        if (e2.size !== t2.size) return false;
        for (r2 of e2) {
          if ((i2 = r2) && "object" == typeof i2 && !(i2 = w(t2, i2))) return false;
          if (!t2.has(i2)) return false;
        }
        return true;
      }
      if (n2 === Map) {
        if (e2.size !== t2.size) return false;
        for (r2 of e2) {
          if ((i2 = r2[0]) && "object" == typeof i2 && !(i2 = w(t2, i2))) return false;
          if (!S(r2[1], t2.get(i2))) return false;
        }
        return true;
      }
      if (n2 === ArrayBuffer) e2 = new Uint8Array(e2), t2 = new Uint8Array(t2);
      else if (n2 === DataView) {
        if ((r2 = e2.byteLength) === t2.byteLength) for (; r2-- && e2.getInt8(r2) === t2.getInt8(r2); ) ;
        return -1 === r2;
      }
      if (ArrayBuffer.isView(e2)) {
        if ((r2 = e2.byteLength) === t2.byteLength) for (; r2-- && e2[r2] === t2[r2]; ) ;
        return -1 === r2;
      }
      if (!n2 || "object" == typeof e2) {
        for (n2 in r2 = 0, e2) {
          if (_.call(e2, n2) && ++r2 && !_.call(t2, n2)) return false;
          if (!(n2 in t2) || !S(e2[n2], t2[n2])) return false;
        }
        return Object.keys(t2).length === r2;
      }
    }
    return e2 != e2 && t2 != t2;
  }
  var k = { "Amazon Silk": "amazon_silk", "Android Browser": "android", Bada: "bada", BlackBerry: "blackberry", Chrome: "chrome", Chromium: "chromium", Electron: "electron", Epiphany: "epiphany", Firefox: "firefox", Focus: "focus", Generic: "generic", "Google Search": "google_search", Googlebot: "googlebot", "Internet Explorer": "ie", "K-Meleon": "k_meleon", Maxthon: "maxthon", "Microsoft Edge": "edge", "MZ Browser": "mz", "NAVER Whale Browser": "naver", Opera: "opera", "Opera Coast": "opera_coast", PhantomJS: "phantomjs", Puffin: "puffin", QupZilla: "qupzilla", QQ: "qq", QQLite: "qqlite", Safari: "safari", Sailfish: "sailfish", "Samsung Internet for Android": "samsung_internet", SeaMonkey: "seamonkey", Sleipnir: "sleipnir", Swing: "swing", Tizen: "tizen", "UC Browser": "uc", Vivaldi: "vivaldi", "WebOS Browser": "webos", WeChat: "wechat", "Yandex Browser": "yandex", Roku: "roku" };
  var M = { amazon_silk: "Amazon Silk", android: "Android Browser", bada: "Bada", blackberry: "BlackBerry", chrome: "Chrome", chromium: "Chromium", electron: "Electron", epiphany: "Epiphany", firefox: "Firefox", focus: "Focus", generic: "Generic", googlebot: "Googlebot", google_search: "Google Search", ie: "Internet Explorer", k_meleon: "K-Meleon", maxthon: "Maxthon", edge: "Microsoft Edge", mz: "MZ Browser", naver: "NAVER Whale Browser", opera: "Opera", opera_coast: "Opera Coast", phantomjs: "PhantomJS", puffin: "Puffin", qupzilla: "QupZilla", qq: "QQ Browser", qqlite: "QQ Browser Lite", safari: "Safari", sailfish: "Sailfish", samsung_internet: "Samsung Internet for Android", seamonkey: "SeaMonkey", sleipnir: "Sleipnir", swing: "Swing", tizen: "Tizen", uc: "UC Browser", vivaldi: "Vivaldi", webos: "WebOS Browser", wechat: "WeChat", yandex: "Yandex Browser" };
  var C = { tablet: "tablet", mobile: "mobile", desktop: "desktop", tv: "tv" };
  var E = { WindowsPhone: "Windows Phone", Windows: "Windows", MacOS: "macOS", iOS: "iOS", Android: "Android", WebOS: "WebOS", BlackBerry: "BlackBerry", Bada: "Bada", Tizen: "Tizen", Linux: "Linux", ChromeOS: "Chrome OS", PlayStation4: "PlayStation 4", Roku: "Roku" };
  var T = { EdgeHTML: "EdgeHTML", Blink: "Blink", Trident: "Trident", Presto: "Presto", Gecko: "Gecko", WebKit: "WebKit" };
  var O = class _O {
    static getFirstMatch(e2, t2) {
      const n2 = t2.match(e2);
      return n2 && n2.length > 0 && n2[1] || "";
    }
    static getSecondMatch(e2, t2) {
      const n2 = t2.match(e2);
      return n2 && n2.length > 1 && n2[2] || "";
    }
    static matchAndReturnConst(e2, t2, n2) {
      if (e2.test(t2)) return n2;
    }
    static getWindowsVersionName(e2) {
      switch (e2) {
        case "NT":
          return "NT";
        case "XP":
        case "NT 5.1":
          return "XP";
        case "NT 5.0":
          return "2000";
        case "NT 5.2":
          return "2003";
        case "NT 6.0":
          return "Vista";
        case "NT 6.1":
          return "7";
        case "NT 6.2":
          return "8";
        case "NT 6.3":
          return "8.1";
        case "NT 10.0":
          return "10";
        default:
          return;
      }
    }
    static getMacOSVersionName(e2) {
      const t2 = e2.split(".").splice(0, 2).map(((e3) => parseInt(e3, 10) || 0));
      if (t2.push(0), 10 === t2[0]) switch (t2[1]) {
        case 5:
          return "Leopard";
        case 6:
          return "Snow Leopard";
        case 7:
          return "Lion";
        case 8:
          return "Mountain Lion";
        case 9:
          return "Mavericks";
        case 10:
          return "Yosemite";
        case 11:
          return "El Capitan";
        case 12:
          return "Sierra";
        case 13:
          return "High Sierra";
        case 14:
          return "Mojave";
        case 15:
          return "Catalina";
        default:
          return;
      }
    }
    static getAndroidVersionName(e2) {
      const t2 = e2.split(".").splice(0, 2).map(((e3) => parseInt(e3, 10) || 0));
      if (t2.push(0), !(1 === t2[0] && t2[1] < 5)) return 1 === t2[0] && t2[1] < 6 ? "Cupcake" : 1 === t2[0] && t2[1] >= 6 ? "Donut" : 2 === t2[0] && t2[1] < 2 ? "Eclair" : 2 === t2[0] && 2 === t2[1] ? "Froyo" : 2 === t2[0] && t2[1] > 2 ? "Gingerbread" : 3 === t2[0] ? "Honeycomb" : 4 === t2[0] && t2[1] < 1 ? "Ice Cream Sandwich" : 4 === t2[0] && t2[1] < 4 ? "Jelly Bean" : 4 === t2[0] && t2[1] >= 4 ? "KitKat" : 5 === t2[0] ? "Lollipop" : 6 === t2[0] ? "Marshmallow" : 7 === t2[0] ? "Nougat" : 8 === t2[0] ? "Oreo" : 9 === t2[0] ? "Pie" : void 0;
    }
    static getVersionPrecision(e2) {
      return e2.split(".").length;
    }
    static compareVersions(e2, t2, n2 = false) {
      const r2 = _O.getVersionPrecision(e2), i2 = _O.getVersionPrecision(t2);
      let o2 = Math.max(r2, i2), a2 = 0;
      const s2 = _O.map([e2, t2], ((e3) => {
        const t3 = o2 - _O.getVersionPrecision(e3), n3 = e3 + new Array(t3 + 1).join(".0");
        return _O.map(n3.split("."), ((e4) => new Array(20 - e4.length).join("0") + e4)).reverse();
      }));
      for (n2 && (a2 = o2 - Math.min(r2, i2)), o2 -= 1; o2 >= a2; ) {
        if (s2[0][o2] > s2[1][o2]) return 1;
        if (s2[0][o2] === s2[1][o2]) {
          if (o2 === a2) return 0;
          o2 -= 1;
        } else if (s2[0][o2] < s2[1][o2]) return -1;
      }
    }
    static map(e2, t2) {
      const n2 = [];
      let r2;
      if (Array.prototype.map) return Array.prototype.map.call(e2, t2);
      for (r2 = 0; r2 < e2.length; r2 += 1) n2.push(t2(e2[r2]));
      return n2;
    }
    static find(e2, t2) {
      let n2, r2;
      if (Array.prototype.find) return Array.prototype.find.call(e2, t2);
      for (n2 = 0, r2 = e2.length; n2 < r2; n2 += 1) {
        const r3 = e2[n2];
        if (t2(r3, n2)) return r3;
      }
    }
    static assign(e2, ...t2) {
      const n2 = e2;
      let r2, i2;
      if (Object.assign) return Object.assign(e2, ...t2);
      for (r2 = 0, i2 = t2.length; r2 < i2; r2 += 1) {
        const e3 = t2[r2];
        if ("object" == typeof e3 && null !== e3) {
          Object.keys(e3).forEach(((t3) => {
            n2[t3] = e3[t3];
          }));
        }
      }
      return e2;
    }
    static getBrowserAlias(e2) {
      return k[e2];
    }
    static getBrowserTypeByAlias(e2) {
      return M[e2] || "";
    }
  };
  var P = /version\/(\d+(\.?_?\d+)+)/i;
  var A = [{ test: [/googlebot/i], describe(e2) {
    const t2 = { name: "Googlebot" }, n2 = O.getFirstMatch(/googlebot\/(\d+(\.\d+))/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/opera/i], describe(e2) {
    const t2 = { name: "Opera" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/opr\/|opios/i], describe(e2) {
    const t2 = { name: "Opera" }, n2 = O.getFirstMatch(/(?:opr|opios)[\s/](\S+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/SamsungBrowser/i], describe(e2) {
    const t2 = { name: "Samsung Internet for Android" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:SamsungBrowser)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/Whale/i], describe(e2) {
    const t2 = { name: "NAVER Whale Browser" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:whale)[\s/](\d+(?:\.\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/MZBrowser/i], describe(e2) {
    const t2 = { name: "MZ Browser" }, n2 = O.getFirstMatch(/(?:MZBrowser)[\s/](\d+(?:\.\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/focus/i], describe(e2) {
    const t2 = { name: "Focus" }, n2 = O.getFirstMatch(/(?:focus)[\s/](\d+(?:\.\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/swing/i], describe(e2) {
    const t2 = { name: "Swing" }, n2 = O.getFirstMatch(/(?:swing)[\s/](\d+(?:\.\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/coast/i], describe(e2) {
    const t2 = { name: "Opera Coast" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:coast)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/opt\/\d+(?:.?_?\d+)+/i], describe(e2) {
    const t2 = { name: "Opera Touch" }, n2 = O.getFirstMatch(/(?:opt)[\s/](\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/yabrowser/i], describe(e2) {
    const t2 = { name: "Yandex Browser" }, n2 = O.getFirstMatch(/(?:yabrowser)[\s/](\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/ucbrowser/i], describe(e2) {
    const t2 = { name: "UC Browser" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:ucbrowser)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/Maxthon|mxios/i], describe(e2) {
    const t2 = { name: "Maxthon" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:Maxthon|mxios)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/epiphany/i], describe(e2) {
    const t2 = { name: "Epiphany" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:epiphany)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/puffin/i], describe(e2) {
    const t2 = { name: "Puffin" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:puffin)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/sleipnir/i], describe(e2) {
    const t2 = { name: "Sleipnir" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:sleipnir)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/k-meleon/i], describe(e2) {
    const t2 = { name: "K-Meleon" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/(?:k-meleon)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/micromessenger/i], describe(e2) {
    const t2 = { name: "WeChat" }, n2 = O.getFirstMatch(/(?:micromessenger)[\s/](\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/qqbrowser/i], describe(e2) {
    const t2 = { name: /qqbrowserlite/i.test(e2) ? "QQ Browser Lite" : "QQ Browser" }, n2 = O.getFirstMatch(/(?:qqbrowserlite|qqbrowser)[/](\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/msie|trident/i], describe(e2) {
    const t2 = { name: "Internet Explorer" }, n2 = O.getFirstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/\sedg\//i], describe(e2) {
    const t2 = { name: "Microsoft Edge" }, n2 = O.getFirstMatch(/\sedg\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/edg([ea]|ios)/i], describe(e2) {
    const t2 = { name: "Microsoft Edge" }, n2 = O.getSecondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/vivaldi/i], describe(e2) {
    const t2 = { name: "Vivaldi" }, n2 = O.getFirstMatch(/vivaldi\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/seamonkey/i], describe(e2) {
    const t2 = { name: "SeaMonkey" }, n2 = O.getFirstMatch(/seamonkey\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/sailfish/i], describe(e2) {
    const t2 = { name: "Sailfish" }, n2 = O.getFirstMatch(/sailfish\s?browser\/(\d+(\.\d+)?)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/silk/i], describe(e2) {
    const t2 = { name: "Amazon Silk" }, n2 = O.getFirstMatch(/silk\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/phantom/i], describe(e2) {
    const t2 = { name: "PhantomJS" }, n2 = O.getFirstMatch(/phantomjs\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/slimerjs/i], describe(e2) {
    const t2 = { name: "SlimerJS" }, n2 = O.getFirstMatch(/slimerjs\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/blackberry|\bbb\d+/i, /rim\stablet/i], describe(e2) {
    const t2 = { name: "BlackBerry" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/blackberry[\d]+\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/(web|hpw)[o0]s/i], describe(e2) {
    const t2 = { name: "WebOS Browser" }, n2 = O.getFirstMatch(P, e2) || O.getFirstMatch(/w(?:eb)?[o0]sbrowser\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/bada/i], describe(e2) {
    const t2 = { name: "Bada" }, n2 = O.getFirstMatch(/dolfin\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/tizen/i], describe(e2) {
    const t2 = { name: "Tizen" }, n2 = O.getFirstMatch(/(?:tizen\s?)?browser\/(\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/qupzilla/i], describe(e2) {
    const t2 = { name: "QupZilla" }, n2 = O.getFirstMatch(/(?:qupzilla)[\s/](\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/firefox|iceweasel|fxios/i], describe(e2) {
    const t2 = { name: "Firefox" }, n2 = O.getFirstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/electron/i], describe(e2) {
    const t2 = { name: "Electron" }, n2 = O.getFirstMatch(/(?:electron)\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/MiuiBrowser/i], describe(e2) {
    const t2 = { name: "Miui" }, n2 = O.getFirstMatch(/(?:MiuiBrowser)[\s/](\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/chromium/i], describe(e2) {
    const t2 = { name: "Chromium" }, n2 = O.getFirstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, e2) || O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/chrome|crios|crmo/i], describe(e2) {
    const t2 = { name: "Chrome" }, n2 = O.getFirstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/GSA/i], describe(e2) {
    const t2 = { name: "Google Search" }, n2 = O.getFirstMatch(/(?:GSA)\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test(e2) {
    const t2 = !e2.test(/like android/i), n2 = e2.test(/android/i);
    return t2 && n2;
  }, describe(e2) {
    const t2 = { name: "Android Browser" }, n2 = O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/playstation 4/i], describe(e2) {
    const t2 = { name: "PlayStation 4" }, n2 = O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/safari|applewebkit/i], describe(e2) {
    const t2 = { name: "Safari" }, n2 = O.getFirstMatch(P, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/.*/i], describe(e2) {
    const t2 = -1 !== e2.search("\\(") ? /^(.*)\/(.*)[ \t]\((.*)/ : /^(.*)\/(.*) /;
    return { name: O.getFirstMatch(t2, e2), version: O.getSecondMatch(t2, e2) };
  } }];
  var j = [{ test: [/Roku\/DVP/], describe(e2) {
    const t2 = O.getFirstMatch(/Roku\/DVP-(\d+\.\d+)/i, e2);
    return { name: E.Roku, version: t2 };
  } }, { test: [/windows phone/i], describe(e2) {
    const t2 = O.getFirstMatch(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i, e2);
    return { name: E.WindowsPhone, version: t2 };
  } }, { test: [/windows /i], describe(e2) {
    const t2 = O.getFirstMatch(/Windows ((NT|XP)( \d\d?.\d)?)/i, e2), n2 = O.getWindowsVersionName(t2);
    return { name: E.Windows, version: t2, versionName: n2 };
  } }, { test: [/Macintosh(.*?) FxiOS(.*?)\//], describe(e2) {
    const t2 = { name: E.iOS }, n2 = O.getSecondMatch(/(Version\/)(\d[\d.]+)/, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/macintosh/i], describe(e2) {
    const t2 = O.getFirstMatch(/mac os x (\d+(\.?_?\d+)+)/i, e2).replace(/[_\s]/g, "."), n2 = O.getMacOSVersionName(t2), r2 = { name: E.MacOS, version: t2 };
    return n2 && (r2.versionName = n2), r2;
  } }, { test: [/(ipod|iphone|ipad)/i], describe(e2) {
    const t2 = O.getFirstMatch(/os (\d+([_\s]\d+)*) like mac os x/i, e2).replace(/[_\s]/g, ".");
    return { name: E.iOS, version: t2 };
  } }, { test(e2) {
    const t2 = !e2.test(/like android/i), n2 = e2.test(/android/i);
    return t2 && n2;
  }, describe(e2) {
    const t2 = O.getFirstMatch(/android[\s/-](\d+(\.\d+)*)/i, e2), n2 = O.getAndroidVersionName(t2), r2 = { name: E.Android, version: t2 };
    return n2 && (r2.versionName = n2), r2;
  } }, { test: [/(web|hpw)[o0]s/i], describe(e2) {
    const t2 = O.getFirstMatch(/(?:web|hpw)[o0]s\/(\d+(\.\d+)*)/i, e2), n2 = { name: E.WebOS };
    return t2 && t2.length && (n2.version = t2), n2;
  } }, { test: [/blackberry|\bbb\d+/i, /rim\stablet/i], describe(e2) {
    const t2 = O.getFirstMatch(/rim\stablet\sos\s(\d+(\.\d+)*)/i, e2) || O.getFirstMatch(/blackberry\d+\/(\d+([_\s]\d+)*)/i, e2) || O.getFirstMatch(/\bbb(\d+)/i, e2);
    return { name: E.BlackBerry, version: t2 };
  } }, { test: [/bada/i], describe(e2) {
    const t2 = O.getFirstMatch(/bada\/(\d+(\.\d+)*)/i, e2);
    return { name: E.Bada, version: t2 };
  } }, { test: [/tizen/i], describe(e2) {
    const t2 = O.getFirstMatch(/tizen[/\s](\d+(\.\d+)*)/i, e2);
    return { name: E.Tizen, version: t2 };
  } }, { test: [/linux/i], describe: () => ({ name: E.Linux }) }, { test: [/CrOS/], describe: () => ({ name: E.ChromeOS }) }, { test: [/PlayStation 4/], describe(e2) {
    const t2 = O.getFirstMatch(/PlayStation 4[/\s](\d+(\.\d+)*)/i, e2);
    return { name: E.PlayStation4, version: t2 };
  } }];
  var I = [{ test: [/googlebot/i], describe: () => ({ type: "bot", vendor: "Google" }) }, { test: [/huawei/i], describe(e2) {
    const t2 = O.getFirstMatch(/(can-l01)/i, e2) && "Nova", n2 = { type: C.mobile, vendor: "Huawei" };
    return t2 && (n2.model = t2), n2;
  } }, { test: [/nexus\s*(?:7|8|9|10).*/i], describe: () => ({ type: C.tablet, vendor: "Nexus" }) }, { test: [/ipad/i], describe: () => ({ type: C.tablet, vendor: "Apple", model: "iPad" }) }, { test: [/Macintosh(.*?) FxiOS(.*?)\//], describe: () => ({ type: C.tablet, vendor: "Apple", model: "iPad" }) }, { test: [/kftt build/i], describe: () => ({ type: C.tablet, vendor: "Amazon", model: "Kindle Fire HD 7" }) }, { test: [/silk/i], describe: () => ({ type: C.tablet, vendor: "Amazon" }) }, { test: [/tablet(?! pc)/i], describe: () => ({ type: C.tablet }) }, { test(e2) {
    const t2 = e2.test(/ipod|iphone/i), n2 = e2.test(/like (ipod|iphone)/i);
    return t2 && !n2;
  }, describe(e2) {
    const t2 = O.getFirstMatch(/(ipod|iphone)/i, e2);
    return { type: C.mobile, vendor: "Apple", model: t2 };
  } }, { test: [/nexus\s*[0-6].*/i, /galaxy nexus/i], describe: () => ({ type: C.mobile, vendor: "Nexus" }) }, { test: [/[^-]mobi/i], describe: () => ({ type: C.mobile }) }, { test: (e2) => "blackberry" === e2.getBrowserName(true), describe: () => ({ type: C.mobile, vendor: "BlackBerry" }) }, { test: (e2) => "bada" === e2.getBrowserName(true), describe: () => ({ type: C.mobile }) }, { test: (e2) => "windows phone" === e2.getBrowserName(), describe: () => ({ type: C.mobile, vendor: "Microsoft" }) }, { test(e2) {
    const t2 = Number(String(e2.getOSVersion()).split(".")[0]);
    return "android" === e2.getOSName(true) && t2 >= 3;
  }, describe: () => ({ type: C.tablet }) }, { test: (e2) => "android" === e2.getOSName(true), describe: () => ({ type: C.mobile }) }, { test: (e2) => "macos" === e2.getOSName(true), describe: () => ({ type: C.desktop, vendor: "Apple" }) }, { test: (e2) => "windows" === e2.getOSName(true), describe: () => ({ type: C.desktop }) }, { test: (e2) => "linux" === e2.getOSName(true), describe: () => ({ type: C.desktop }) }, { test: (e2) => "playstation 4" === e2.getOSName(true), describe: () => ({ type: C.tv }) }, { test: (e2) => "roku" === e2.getOSName(true), describe: () => ({ type: C.tv }) }];
  var x = [{ test: (e2) => "microsoft edge" === e2.getBrowserName(true), describe(e2) {
    if (/\sedg\//i.test(e2)) return { name: T.Blink };
    const t2 = O.getFirstMatch(/edge\/(\d+(\.?_?\d+)+)/i, e2);
    return { name: T.EdgeHTML, version: t2 };
  } }, { test: [/trident/i], describe(e2) {
    const t2 = { name: T.Trident }, n2 = O.getFirstMatch(/trident\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: (e2) => e2.test(/presto/i), describe(e2) {
    const t2 = { name: T.Presto }, n2 = O.getFirstMatch(/presto\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test(e2) {
    const t2 = e2.test(/gecko/i), n2 = e2.test(/like gecko/i);
    return t2 && !n2;
  }, describe(e2) {
    const t2 = { name: T.Gecko }, n2 = O.getFirstMatch(/gecko\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }, { test: [/(apple)?webkit\/537\.36/i], describe: () => ({ name: T.Blink }) }, { test: [/(apple)?webkit/i], describe(e2) {
    const t2 = { name: T.WebKit }, n2 = O.getFirstMatch(/webkit\/(\d+(\.?_?\d+)+)/i, e2);
    return n2 && (t2.version = n2), t2;
  } }];
  var L = class {
    constructor(e2, t2 = false) {
      if (null == e2 || "" === e2) throw new Error("UserAgent parameter can't be empty");
      this._ua = e2, this.parsedResult = {}, true !== t2 && this.parse();
    }
    getUA() {
      return this._ua;
    }
    test(e2) {
      return e2.test(this._ua);
    }
    parseBrowser() {
      this.parsedResult.browser = {};
      const e2 = O.find(A, ((e3) => {
        if ("function" == typeof e3.test) return e3.test(this);
        if (e3.test instanceof Array) return e3.test.some(((e4) => this.test(e4)));
        throw new Error("Browser's test function is not valid");
      }));
      return e2 && (this.parsedResult.browser = e2.describe(this.getUA())), this.parsedResult.browser;
    }
    getBrowser() {
      return this.parsedResult.browser ? this.parsedResult.browser : this.parseBrowser();
    }
    getBrowserName(e2) {
      return e2 ? String(this.getBrowser().name).toLowerCase() || "" : this.getBrowser().name || "";
    }
    getBrowserVersion() {
      return this.getBrowser().version;
    }
    getOS() {
      return this.parsedResult.os ? this.parsedResult.os : this.parseOS();
    }
    parseOS() {
      this.parsedResult.os = {};
      const e2 = O.find(j, ((e3) => {
        if ("function" == typeof e3.test) return e3.test(this);
        if (e3.test instanceof Array) return e3.test.some(((e4) => this.test(e4)));
        throw new Error("Browser's test function is not valid");
      }));
      return e2 && (this.parsedResult.os = e2.describe(this.getUA())), this.parsedResult.os;
    }
    getOSName(e2) {
      const { name: t2 } = this.getOS();
      return e2 ? String(t2).toLowerCase() || "" : t2 || "";
    }
    getOSVersion() {
      return this.getOS().version;
    }
    getPlatform() {
      return this.parsedResult.platform ? this.parsedResult.platform : this.parsePlatform();
    }
    getPlatformType(e2 = false) {
      const { type: t2 } = this.getPlatform();
      return e2 ? String(t2).toLowerCase() || "" : t2 || "";
    }
    parsePlatform() {
      this.parsedResult.platform = {};
      const e2 = O.find(I, ((e3) => {
        if ("function" == typeof e3.test) return e3.test(this);
        if (e3.test instanceof Array) return e3.test.some(((e4) => this.test(e4)));
        throw new Error("Browser's test function is not valid");
      }));
      return e2 && (this.parsedResult.platform = e2.describe(this.getUA())), this.parsedResult.platform;
    }
    getEngine() {
      return this.parsedResult.engine ? this.parsedResult.engine : this.parseEngine();
    }
    getEngineName(e2) {
      return e2 ? String(this.getEngine().name).toLowerCase() || "" : this.getEngine().name || "";
    }
    parseEngine() {
      this.parsedResult.engine = {};
      const e2 = O.find(x, ((e3) => {
        if ("function" == typeof e3.test) return e3.test(this);
        if (e3.test instanceof Array) return e3.test.some(((e4) => this.test(e4)));
        throw new Error("Browser's test function is not valid");
      }));
      return e2 && (this.parsedResult.engine = e2.describe(this.getUA())), this.parsedResult.engine;
    }
    parse() {
      return this.parseBrowser(), this.parseOS(), this.parsePlatform(), this.parseEngine(), this;
    }
    getResult() {
      return O.assign({}, this.parsedResult);
    }
    satisfies(e2) {
      const t2 = {};
      let n2 = 0;
      const r2 = {};
      let i2 = 0;
      if (Object.keys(e2).forEach(((o2) => {
        const a2 = e2[o2];
        "string" == typeof a2 ? (r2[o2] = a2, i2 += 1) : "object" == typeof a2 && (t2[o2] = a2, n2 += 1);
      })), n2 > 0) {
        const e3 = Object.keys(t2), n3 = O.find(e3, ((e4) => this.isOS(e4)));
        if (n3) {
          const e4 = this.satisfies(t2[n3]);
          if (void 0 !== e4) return e4;
        }
        const r3 = O.find(e3, ((e4) => this.isPlatform(e4)));
        if (r3) {
          const e4 = this.satisfies(t2[r3]);
          if (void 0 !== e4) return e4;
        }
      }
      if (i2 > 0) {
        const e3 = Object.keys(r2), t3 = O.find(e3, ((e4) => this.isBrowser(e4, true)));
        if (void 0 !== t3) return this.compareVersion(r2[t3]);
      }
    }
    isBrowser(e2, t2 = false) {
      const n2 = this.getBrowserName().toLowerCase();
      let r2 = e2.toLowerCase();
      const i2 = O.getBrowserTypeByAlias(r2);
      return t2 && i2 && (r2 = i2.toLowerCase()), r2 === n2;
    }
    compareVersion(e2) {
      let t2 = [0], n2 = e2, r2 = false;
      const i2 = this.getBrowserVersion();
      if ("string" == typeof i2) return ">" === e2[0] || "<" === e2[0] ? (n2 = e2.substr(1), "=" === e2[1] ? (r2 = true, n2 = e2.substr(2)) : t2 = [], ">" === e2[0] ? t2.push(1) : t2.push(-1)) : "=" === e2[0] ? n2 = e2.substr(1) : "~" === e2[0] && (r2 = true, n2 = e2.substr(1)), t2.indexOf(O.compareVersions(i2, n2, r2)) > -1;
    }
    isOS(e2) {
      return this.getOSName(true) === String(e2).toLowerCase();
    }
    isPlatform(e2) {
      return this.getPlatformType(true) === String(e2).toLowerCase();
    }
    isEngine(e2) {
      return this.getEngineName(true) === String(e2).toLowerCase();
    }
    is(e2, t2 = false) {
      return this.isBrowser(e2, t2) || this.isOS(e2) || this.isPlatform(e2);
    }
    some(e2 = []) {
      return e2.some(((e3) => this.is(e3)));
    }
  };
  var D = class {
    static getParser(e2, t2 = false) {
      if ("string" != typeof e2) throw new Error("UserAgent should be a string");
      return new L(e2, t2);
    }
    static parse(e2) {
      return new L(e2).getResult();
    }
    static get BROWSER_MAP() {
      return M;
    }
    static get ENGINE_MAP() {
      return T;
    }
    static get OS_MAP() {
      return E;
    }
    static get PLATFORMS_MAP() {
      return C;
    }
  };
  function N() {
    return Date.now() + Math.random().toString();
  }
  function R() {
    throw new Error("Method must be implemented in subclass");
  }
  function F(e2, t2) {
    return null != t2 && t2.proxyUrl ? t2.proxyUrl + ("/" === t2.proxyUrl.slice(-1) ? "" : "/") + e2.substring(8) : e2;
  }
  function B(e2) {
    if (null != e2 && e2.callObjectBundleUrlOverride) return console.warn("The callObjectBundleUrlOverride property is deprecated and will be removed. Please use bundlePathOverride instead. When providing a bundlePathOverride, the URL should point to the directory containing all Daily bundles (call-machine-object-bundle.js and audio-processor-bundle.js)."), e2.callObjectBundleUrlOverride;
    var t2 = (function(e3) {
      if (null != e3 && e3.bundlePathOverride) {
        var t3 = e3.bundlePathOverride;
        return t3.endsWith("/") ? t3.slice(0, -1) : t3;
      }
      if (null != e3 && e3.callObjectBundleUrlOverride) {
        var n2 = e3.callObjectBundleUrlOverride, r2 = n2.substring(0, n2.lastIndexOf("/"));
        return r2.endsWith("/") ? r2.slice(0, -1) : r2;
      }
      var i2 = F("https://c.daily.co/call-machine/versioned/".concat("0.89.1", "/static"), e3);
      return i2.endsWith("/") ? i2.slice(0, -1) : i2;
    })(e2) + "/call-machine-object-bundle.js";
    return t2;
  }
  function U(e2) {
    try {
      new URL(e2);
    } catch (e3) {
      return false;
    }
    return true;
  }
  var V = "undefined" == typeof __SENTRY_DEBUG__ || __SENTRY_DEBUG__;
  var J = "8.55.0";
  var $ = globalThis;
  function q(e2, t2, n2) {
    const r2 = n2 || $, i2 = r2.__SENTRY__ = r2.__SENTRY__ || {}, o2 = i2[J] = i2[J] || {};
    return o2[e2] || (o2[e2] = t2());
  }
  var z = "undefined" == typeof __SENTRY_DEBUG__ || __SENTRY_DEBUG__;
  var W = ["debug", "info", "warn", "error", "log", "assert", "trace"];
  var H = {};
  function G(e2) {
    if (!("console" in $)) return e2();
    const t2 = $.console, n2 = {}, r2 = Object.keys(H);
    r2.forEach(((e3) => {
      const r3 = H[e3];
      n2[e3] = t2[e3], t2[e3] = r3;
    }));
    try {
      return e2();
    } finally {
      r2.forEach(((e3) => {
        t2[e3] = n2[e3];
      }));
    }
  }
  var Q = q("logger", (function() {
    let e2 = false;
    const t2 = { enable: () => {
      e2 = true;
    }, disable: () => {
      e2 = false;
    }, isEnabled: () => e2 };
    return z ? W.forEach(((n2) => {
      t2[n2] = (...t3) => {
        e2 && G((() => {
          $.console[n2](`Sentry Logger [${n2}]:`, ...t3);
        }));
      };
    })) : W.forEach(((e3) => {
      t2[e3] = () => {
      };
    })), t2;
  }));
  var K = "?";
  var Y = /\(error: (.*)\)/;
  var X = /captureMessage|captureException/;
  function Z(e2) {
    return e2[e2.length - 1] || {};
  }
  var ee = "<anonymous>";
  function te(e2) {
    try {
      return e2 && "function" == typeof e2 && e2.name || ee;
    } catch (e3) {
      return ee;
    }
  }
  function ne(e2) {
    const t2 = e2.exception;
    if (t2) {
      const e3 = [];
      try {
        return t2.values.forEach(((t3) => {
          t3.stacktrace.frames && e3.push(...t3.stacktrace.frames);
        })), e3;
      } catch (e4) {
        return;
      }
    }
  }
  var re = {};
  var ie = {};
  function oe(e2, t2) {
    re[e2] = re[e2] || [], re[e2].push(t2);
  }
  function ae(e2, t2) {
    if (!ie[e2]) {
      ie[e2] = true;
      try {
        t2();
      } catch (t3) {
        z && Q.error(`Error while instrumenting ${e2}`, t3);
      }
    }
  }
  function se(e2, t2) {
    const n2 = e2 && re[e2];
    if (n2) for (const r2 of n2) try {
      r2(t2);
    } catch (t3) {
      z && Q.error(`Error while triggering instrumentation handler.
Type: ${e2}
Name: ${te(r2)}
Error:`, t3);
    }
  }
  var ce = null;
  function le() {
    ce = $.onerror, $.onerror = function(e2, t2, n2, r2, i2) {
      return se("error", { column: r2, error: i2, line: n2, msg: e2, url: t2 }), !!ce && ce.apply(this, arguments);
    }, $.onerror.__SENTRY_INSTRUMENTED__ = true;
  }
  var ue = null;
  function de() {
    ue = $.onunhandledrejection, $.onunhandledrejection = function(e2) {
      return se("unhandledrejection", e2), !ue || ue.apply(this, arguments);
    }, $.onunhandledrejection.__SENTRY_INSTRUMENTED__ = true;
  }
  function pe() {
    return he($), $;
  }
  function he(e2) {
    const t2 = e2.__SENTRY__ = e2.__SENTRY__ || {};
    return t2.version = t2.version || J, t2[J] = t2[J] || {};
  }
  var fe = Object.prototype.toString;
  function ve(e2) {
    switch (fe.call(e2)) {
      case "[object Error]":
      case "[object Exception]":
      case "[object DOMException]":
      case "[object WebAssembly.Exception]":
        return true;
      default:
        return Ce(e2, Error);
    }
  }
  function ge(e2, t2) {
    return fe.call(e2) === `[object ${t2}]`;
  }
  function me(e2) {
    return ge(e2, "ErrorEvent");
  }
  function ye(e2) {
    return ge(e2, "DOMError");
  }
  function be(e2) {
    return ge(e2, "String");
  }
  function _e(e2) {
    return "object" == typeof e2 && null !== e2 && "__sentry_template_string__" in e2 && "__sentry_template_values__" in e2;
  }
  function we(e2) {
    return null === e2 || _e(e2) || "object" != typeof e2 && "function" != typeof e2;
  }
  function Se(e2) {
    return ge(e2, "Object");
  }
  function ke(e2) {
    return "undefined" != typeof Event && Ce(e2, Event);
  }
  function Me(e2) {
    return Boolean(e2 && e2.then && "function" == typeof e2.then);
  }
  function Ce(e2, t2) {
    try {
      return e2 instanceof t2;
    } catch (e3) {
      return false;
    }
  }
  function Ee(e2) {
    return !("object" != typeof e2 || null === e2 || !e2.__isVue && !e2._isVue);
  }
  var Te = $;
  function Oe(e2, t2 = {}) {
    if (!e2) return "<unknown>";
    try {
      let n2 = e2;
      const r2 = 5, i2 = [];
      let o2 = 0, a2 = 0;
      const s2 = " > ", c2 = s2.length;
      let l2;
      const u2 = Array.isArray(t2) ? t2 : t2.keyAttrs, d2 = !Array.isArray(t2) && t2.maxStringLength || 80;
      for (; n2 && o2++ < r2 && (l2 = Pe(n2, u2), !("html" === l2 || o2 > 1 && a2 + i2.length * c2 + l2.length >= d2)); ) i2.push(l2), a2 += l2.length, n2 = n2.parentNode;
      return i2.reverse().join(s2);
    } catch (e3) {
      return "<unknown>";
    }
  }
  function Pe(e2, t2) {
    const n2 = e2, r2 = [];
    if (!n2 || !n2.tagName) return "";
    if (Te.HTMLElement && n2 instanceof HTMLElement && n2.dataset) {
      if (n2.dataset.sentryComponent) return n2.dataset.sentryComponent;
      if (n2.dataset.sentryElement) return n2.dataset.sentryElement;
    }
    r2.push(n2.tagName.toLowerCase());
    const i2 = t2 && t2.length ? t2.filter(((e3) => n2.getAttribute(e3))).map(((e3) => [e3, n2.getAttribute(e3)])) : null;
    if (i2 && i2.length) i2.forEach(((e3) => {
      r2.push(`[${e3[0]}="${e3[1]}"]`);
    }));
    else {
      n2.id && r2.push(`#${n2.id}`);
      const e3 = n2.className;
      if (e3 && be(e3)) {
        const t3 = e3.split(/\s+/);
        for (const e4 of t3) r2.push(`.${e4}`);
      }
    }
    const o2 = ["aria-label", "type", "name", "title", "alt"];
    for (const e3 of o2) {
      const t3 = n2.getAttribute(e3);
      t3 && r2.push(`[${e3}="${t3}"]`);
    }
    return r2.join("");
  }
  function Ae(e2, t2 = 0) {
    return "string" != typeof e2 || 0 === t2 || e2.length <= t2 ? e2 : `${e2.slice(0, t2)}...`;
  }
  function je(e2, t2) {
    if (!Array.isArray(e2)) return "";
    const n2 = [];
    for (let t3 = 0; t3 < e2.length; t3++) {
      const r2 = e2[t3];
      try {
        Ee(r2) ? n2.push("[VueViewModel]") : n2.push(String(r2));
      } catch (e3) {
        n2.push("[value cannot be serialized]");
      }
    }
    return n2.join(t2);
  }
  function Ie(e2, t2, n2 = false) {
    return !!be(e2) && (ge(t2, "RegExp") ? t2.test(e2) : !!be(t2) && (n2 ? e2 === t2 : e2.includes(t2)));
  }
  function xe(e2, t2 = [], n2 = false) {
    return t2.some(((t3) => Ie(e2, t3, n2)));
  }
  function Le(e2, t2, n2) {
    if (!(t2 in e2)) return;
    const r2 = e2[t2], i2 = n2(r2);
    "function" == typeof i2 && Ne(i2, r2);
    try {
      e2[t2] = i2;
    } catch (n3) {
      z && Q.log(`Failed to replace method "${t2}" in object`, e2);
    }
  }
  function De(e2, t2, n2) {
    try {
      Object.defineProperty(e2, t2, { value: n2, writable: true, configurable: true });
    } catch (n3) {
      z && Q.log(`Failed to add non-enumerable property "${t2}" to object`, e2);
    }
  }
  function Ne(e2, t2) {
    try {
      const n2 = t2.prototype || {};
      e2.prototype = t2.prototype = n2, De(e2, "__sentry_original__", t2);
    } catch (e3) {
    }
  }
  function Re(e2) {
    return e2.__sentry_original__;
  }
  function Fe(e2) {
    if (ve(e2)) return { message: e2.message, name: e2.name, stack: e2.stack, ...Ue(e2) };
    if (ke(e2)) {
      const t2 = { type: e2.type, target: Be(e2.target), currentTarget: Be(e2.currentTarget), ...Ue(e2) };
      return "undefined" != typeof CustomEvent && Ce(e2, CustomEvent) && (t2.detail = e2.detail), t2;
    }
    return e2;
  }
  function Be(e2) {
    try {
      return t2 = e2, "undefined" != typeof Element && Ce(t2, Element) ? Oe(e2) : Object.prototype.toString.call(e2);
    } catch (e3) {
      return "<unknown>";
    }
    var t2;
  }
  function Ue(e2) {
    if ("object" == typeof e2 && null !== e2) {
      const t2 = {};
      for (const n2 in e2) Object.prototype.hasOwnProperty.call(e2, n2) && (t2[n2] = e2[n2]);
      return t2;
    }
    return {};
  }
  function Ve(e2) {
    return Je(e2, /* @__PURE__ */ new Map());
  }
  function Je(e2, t2) {
    if ((function(e3) {
      if (!Se(e3)) return false;
      try {
        const t3 = Object.getPrototypeOf(e3).constructor.name;
        return !t3 || "Object" === t3;
      } catch (e4) {
        return true;
      }
    })(e2)) {
      const n2 = t2.get(e2);
      if (void 0 !== n2) return n2;
      const r2 = {};
      t2.set(e2, r2);
      for (const n3 of Object.getOwnPropertyNames(e2)) void 0 !== e2[n3] && (r2[n3] = Je(e2[n3], t2));
      return r2;
    }
    if (Array.isArray(e2)) {
      const n2 = t2.get(e2);
      if (void 0 !== n2) return n2;
      const r2 = [];
      return t2.set(e2, r2), e2.forEach(((e3) => {
        r2.push(Je(e3, t2));
      })), r2;
    }
    return e2;
  }
  function $e() {
    return Date.now() / 1e3;
  }
  var qe = (function() {
    const { performance: e2 } = $;
    if (!e2 || !e2.now) return $e;
    const t2 = Date.now() - e2.now(), n2 = null == e2.timeOrigin ? t2 : e2.timeOrigin;
    return () => (n2 + e2.now()) / 1e3;
  })();
  function ze() {
    const e2 = $, t2 = e2.crypto || e2.msCrypto;
    let n2 = () => 16 * Math.random();
    try {
      if (t2 && t2.randomUUID) return t2.randomUUID().replace(/-/g, "");
      t2 && t2.getRandomValues && (n2 = () => {
        const e3 = new Uint8Array(1);
        return t2.getRandomValues(e3), e3[0];
      });
    } catch (e3) {
    }
    return ("10000000100040008000" + 1e11).replace(/[018]/g, ((e3) => (e3 ^ (15 & n2()) >> e3 / 4).toString(16)));
  }
  function We(e2) {
    return e2.exception && e2.exception.values ? e2.exception.values[0] : void 0;
  }
  function He(e2) {
    const { message: t2, event_id: n2 } = e2;
    if (t2) return t2;
    const r2 = We(e2);
    return r2 ? r2.type && r2.value ? `${r2.type}: ${r2.value}` : r2.type || r2.value || n2 || "<unknown>" : n2 || "<unknown>";
  }
  function Ge(e2, t2, n2) {
    const r2 = e2.exception = e2.exception || {}, i2 = r2.values = r2.values || [], o2 = i2[0] = i2[0] || {};
    o2.value || (o2.value = t2 || ""), o2.type || (o2.type = n2 || "Error");
  }
  function Qe(e2, t2) {
    const n2 = We(e2);
    if (!n2) return;
    const r2 = n2.mechanism;
    if (n2.mechanism = { type: "generic", handled: true, ...r2, ...t2 }, t2 && "data" in t2) {
      const e3 = { ...r2 && r2.data, ...t2.data };
      n2.mechanism.data = e3;
    }
  }
  function Ke(e2) {
    if ((function(e3) {
      try {
        return e3.__sentry_captured__;
      } catch (e4) {
      }
    })(e2)) return true;
    try {
      De(e2, "__sentry_captured__", true);
    } catch (e3) {
    }
    return false;
  }
  var Ye;
  function Xe(e2) {
    return new et(((t2) => {
      t2(e2);
    }));
  }
  function Ze(e2) {
    return new et(((t2, n2) => {
      n2(e2);
    }));
  }
  (() => {
    const { performance: e2 } = $;
    if (!e2 || !e2.now) return;
    const t2 = 36e5, n2 = e2.now(), r2 = Date.now(), i2 = e2.timeOrigin ? Math.abs(e2.timeOrigin + n2 - r2) : t2, o2 = i2 < t2, a2 = e2.timing && e2.timing.navigationStart, s2 = "number" == typeof a2 ? Math.abs(a2 + n2 - r2) : t2;
    (o2 || s2 < t2) && (i2 <= s2 && e2.timeOrigin);
  })(), (function(e2) {
    e2[e2.PENDING = 0] = "PENDING";
    e2[e2.RESOLVED = 1] = "RESOLVED";
    e2[e2.REJECTED = 2] = "REJECTED";
  })(Ye || (Ye = {}));
  var et = class _et {
    constructor(e2) {
      _et.prototype.__init.call(this), _et.prototype.__init2.call(this), _et.prototype.__init3.call(this), _et.prototype.__init4.call(this), this._state = Ye.PENDING, this._handlers = [];
      try {
        e2(this._resolve, this._reject);
      } catch (e3) {
        this._reject(e3);
      }
    }
    then(e2, t2) {
      return new _et(((n2, r2) => {
        this._handlers.push([false, (t3) => {
          if (e2) try {
            n2(e2(t3));
          } catch (e3) {
            r2(e3);
          }
          else n2(t3);
        }, (e3) => {
          if (t2) try {
            n2(t2(e3));
          } catch (e4) {
            r2(e4);
          }
          else r2(e3);
        }]), this._executeHandlers();
      }));
    }
    catch(e2) {
      return this.then(((e3) => e3), e2);
    }
    finally(e2) {
      return new _et(((t2, n2) => {
        let r2, i2;
        return this.then(((t3) => {
          i2 = false, r2 = t3, e2 && e2();
        }), ((t3) => {
          i2 = true, r2 = t3, e2 && e2();
        })).then((() => {
          i2 ? n2(r2) : t2(r2);
        }));
      }));
    }
    __init() {
      this._resolve = (e2) => {
        this._setResult(Ye.RESOLVED, e2);
      };
    }
    __init2() {
      this._reject = (e2) => {
        this._setResult(Ye.REJECTED, e2);
      };
    }
    __init3() {
      this._setResult = (e2, t2) => {
        this._state === Ye.PENDING && (Me(t2) ? t2.then(this._resolve, this._reject) : (this._state = e2, this._value = t2, this._executeHandlers()));
      };
    }
    __init4() {
      this._executeHandlers = () => {
        if (this._state === Ye.PENDING) return;
        const e2 = this._handlers.slice();
        this._handlers = [], e2.forEach(((e3) => {
          e3[0] || (this._state === Ye.RESOLVED && e3[1](this._value), this._state === Ye.REJECTED && e3[2](this._value), e3[0] = true);
        }));
      };
    }
  };
  function tt(e2) {
    const t2 = qe(), n2 = { sid: ze(), init: true, timestamp: t2, started: t2, duration: 0, status: "ok", errors: 0, ignoreDuration: false, toJSON: () => (function(e3) {
      return Ve({ sid: `${e3.sid}`, init: e3.init, started: new Date(1e3 * e3.started).toISOString(), timestamp: new Date(1e3 * e3.timestamp).toISOString(), status: e3.status, errors: e3.errors, did: "number" == typeof e3.did || "string" == typeof e3.did ? `${e3.did}` : void 0, duration: e3.duration, abnormal_mechanism: e3.abnormal_mechanism, attrs: { release: e3.release, environment: e3.environment, ip_address: e3.ipAddress, user_agent: e3.userAgent } });
    })(n2) };
    return e2 && nt(n2, e2), n2;
  }
  function nt(e2, t2 = {}) {
    if (t2.user && (!e2.ipAddress && t2.user.ip_address && (e2.ipAddress = t2.user.ip_address), e2.did || t2.did || (e2.did = t2.user.id || t2.user.email || t2.user.username)), e2.timestamp = t2.timestamp || qe(), t2.abnormal_mechanism && (e2.abnormal_mechanism = t2.abnormal_mechanism), t2.ignoreDuration && (e2.ignoreDuration = t2.ignoreDuration), t2.sid && (e2.sid = 32 === t2.sid.length ? t2.sid : ze()), void 0 !== t2.init && (e2.init = t2.init), !e2.did && t2.did && (e2.did = `${t2.did}`), "number" == typeof t2.started && (e2.started = t2.started), e2.ignoreDuration) e2.duration = void 0;
    else if ("number" == typeof t2.duration) e2.duration = t2.duration;
    else {
      const t3 = e2.timestamp - e2.started;
      e2.duration = t3 >= 0 ? t3 : 0;
    }
    t2.release && (e2.release = t2.release), t2.environment && (e2.environment = t2.environment), !e2.ipAddress && t2.ipAddress && (e2.ipAddress = t2.ipAddress), !e2.userAgent && t2.userAgent && (e2.userAgent = t2.userAgent), "number" == typeof t2.errors && (e2.errors = t2.errors), t2.status && (e2.status = t2.status);
  }
  function rt() {
    return ze();
  }
  function it() {
    return ze().substring(16);
  }
  function ot(e2, t2, n2 = 2) {
    if (!t2 || "object" != typeof t2 || n2 <= 0) return t2;
    if (e2 && t2 && 0 === Object.keys(t2).length) return e2;
    const r2 = { ...e2 };
    for (const e3 in t2) Object.prototype.hasOwnProperty.call(t2, e3) && (r2[e3] = ot(r2[e3], t2[e3], n2 - 1));
    return r2;
  }
  var at = "_sentrySpan";
  function st(e2, t2) {
    t2 ? De(e2, at, t2) : delete e2[at];
  }
  function ct(e2) {
    return e2[at];
  }
  var lt = class _lt {
    constructor() {
      this._notifyingListeners = false, this._scopeListeners = [], this._eventProcessors = [], this._breadcrumbs = [], this._attachments = [], this._user = {}, this._tags = {}, this._extra = {}, this._contexts = {}, this._sdkProcessingMetadata = {}, this._propagationContext = { traceId: rt(), spanId: it() };
    }
    clone() {
      const e2 = new _lt();
      return e2._breadcrumbs = [...this._breadcrumbs], e2._tags = { ...this._tags }, e2._extra = { ...this._extra }, e2._contexts = { ...this._contexts }, this._contexts.flags && (e2._contexts.flags = { values: [...this._contexts.flags.values] }), e2._user = this._user, e2._level = this._level, e2._session = this._session, e2._transactionName = this._transactionName, e2._fingerprint = this._fingerprint, e2._eventProcessors = [...this._eventProcessors], e2._requestSession = this._requestSession, e2._attachments = [...this._attachments], e2._sdkProcessingMetadata = { ...this._sdkProcessingMetadata }, e2._propagationContext = { ...this._propagationContext }, e2._client = this._client, e2._lastEventId = this._lastEventId, st(e2, ct(this)), e2;
    }
    setClient(e2) {
      this._client = e2;
    }
    setLastEventId(e2) {
      this._lastEventId = e2;
    }
    getClient() {
      return this._client;
    }
    lastEventId() {
      return this._lastEventId;
    }
    addScopeListener(e2) {
      this._scopeListeners.push(e2);
    }
    addEventProcessor(e2) {
      return this._eventProcessors.push(e2), this;
    }
    setUser(e2) {
      return this._user = e2 || { email: void 0, id: void 0, ip_address: void 0, username: void 0 }, this._session && nt(this._session, { user: e2 }), this._notifyScopeListeners(), this;
    }
    getUser() {
      return this._user;
    }
    getRequestSession() {
      return this._requestSession;
    }
    setRequestSession(e2) {
      return this._requestSession = e2, this;
    }
    setTags(e2) {
      return this._tags = { ...this._tags, ...e2 }, this._notifyScopeListeners(), this;
    }
    setTag(e2, t2) {
      return this._tags = { ...this._tags, [e2]: t2 }, this._notifyScopeListeners(), this;
    }
    setExtras(e2) {
      return this._extra = { ...this._extra, ...e2 }, this._notifyScopeListeners(), this;
    }
    setExtra(e2, t2) {
      return this._extra = { ...this._extra, [e2]: t2 }, this._notifyScopeListeners(), this;
    }
    setFingerprint(e2) {
      return this._fingerprint = e2, this._notifyScopeListeners(), this;
    }
    setLevel(e2) {
      return this._level = e2, this._notifyScopeListeners(), this;
    }
    setTransactionName(e2) {
      return this._transactionName = e2, this._notifyScopeListeners(), this;
    }
    setContext(e2, t2) {
      return null === t2 ? delete this._contexts[e2] : this._contexts[e2] = t2, this._notifyScopeListeners(), this;
    }
    setSession(e2) {
      return e2 ? this._session = e2 : delete this._session, this._notifyScopeListeners(), this;
    }
    getSession() {
      return this._session;
    }
    update(e2) {
      if (!e2) return this;
      const t2 = "function" == typeof e2 ? e2(this) : e2, [n2, r2] = t2 instanceof ut ? [t2.getScopeData(), t2.getRequestSession()] : Se(t2) ? [e2, e2.requestSession] : [], { tags: i2, extra: o2, user: a2, contexts: s2, level: c2, fingerprint: l2 = [], propagationContext: u2 } = n2 || {};
      return this._tags = { ...this._tags, ...i2 }, this._extra = { ...this._extra, ...o2 }, this._contexts = { ...this._contexts, ...s2 }, a2 && Object.keys(a2).length && (this._user = a2), c2 && (this._level = c2), l2.length && (this._fingerprint = l2), u2 && (this._propagationContext = u2), r2 && (this._requestSession = r2), this;
    }
    clear() {
      return this._breadcrumbs = [], this._tags = {}, this._extra = {}, this._user = {}, this._contexts = {}, this._level = void 0, this._transactionName = void 0, this._fingerprint = void 0, this._requestSession = void 0, this._session = void 0, st(this, void 0), this._attachments = [], this.setPropagationContext({ traceId: rt() }), this._notifyScopeListeners(), this;
    }
    addBreadcrumb(e2, t2) {
      const n2 = "number" == typeof t2 ? t2 : 100;
      if (n2 <= 0) return this;
      const r2 = { timestamp: $e(), ...e2 };
      return this._breadcrumbs.push(r2), this._breadcrumbs.length > n2 && (this._breadcrumbs = this._breadcrumbs.slice(-n2), this._client && this._client.recordDroppedEvent("buffer_overflow", "log_item")), this._notifyScopeListeners(), this;
    }
    getLastBreadcrumb() {
      return this._breadcrumbs[this._breadcrumbs.length - 1];
    }
    clearBreadcrumbs() {
      return this._breadcrumbs = [], this._notifyScopeListeners(), this;
    }
    addAttachment(e2) {
      return this._attachments.push(e2), this;
    }
    clearAttachments() {
      return this._attachments = [], this;
    }
    getScopeData() {
      return { breadcrumbs: this._breadcrumbs, attachments: this._attachments, contexts: this._contexts, tags: this._tags, extra: this._extra, user: this._user, level: this._level, fingerprint: this._fingerprint || [], eventProcessors: this._eventProcessors, propagationContext: this._propagationContext, sdkProcessingMetadata: this._sdkProcessingMetadata, transactionName: this._transactionName, span: ct(this) };
    }
    setSDKProcessingMetadata(e2) {
      return this._sdkProcessingMetadata = ot(this._sdkProcessingMetadata, e2, 2), this;
    }
    setPropagationContext(e2) {
      return this._propagationContext = { spanId: it(), ...e2 }, this;
    }
    getPropagationContext() {
      return this._propagationContext;
    }
    captureException(e2, t2) {
      const n2 = t2 && t2.event_id ? t2.event_id : ze();
      if (!this._client) return Q.warn("No client configured on scope - will not capture exception!"), n2;
      const r2 = new Error("Sentry syntheticException");
      return this._client.captureException(e2, { originalException: e2, syntheticException: r2, ...t2, event_id: n2 }, this), n2;
    }
    captureMessage(e2, t2, n2) {
      const r2 = n2 && n2.event_id ? n2.event_id : ze();
      if (!this._client) return Q.warn("No client configured on scope - will not capture message!"), r2;
      const i2 = new Error(e2);
      return this._client.captureMessage(e2, t2, { originalException: e2, syntheticException: i2, ...n2, event_id: r2 }, this), r2;
    }
    captureEvent(e2, t2) {
      const n2 = t2 && t2.event_id ? t2.event_id : ze();
      return this._client ? (this._client.captureEvent(e2, { ...t2, event_id: n2 }, this), n2) : (Q.warn("No client configured on scope - will not capture event!"), n2);
    }
    _notifyScopeListeners() {
      this._notifyingListeners || (this._notifyingListeners = true, this._scopeListeners.forEach(((e2) => {
        e2(this);
      })), this._notifyingListeners = false);
    }
  };
  var ut = lt;
  var dt = class {
    constructor(e2, t2) {
      let n2, r2;
      n2 = e2 || new ut(), r2 = t2 || new ut(), this._stack = [{ scope: n2 }], this._isolationScope = r2;
    }
    withScope(e2) {
      const t2 = this._pushScope();
      let n2;
      try {
        n2 = e2(t2);
      } catch (e3) {
        throw this._popScope(), e3;
      }
      return Me(n2) ? n2.then(((e3) => (this._popScope(), e3)), ((e3) => {
        throw this._popScope(), e3;
      })) : (this._popScope(), n2);
    }
    getClient() {
      return this.getStackTop().client;
    }
    getScope() {
      return this.getStackTop().scope;
    }
    getIsolationScope() {
      return this._isolationScope;
    }
    getStackTop() {
      return this._stack[this._stack.length - 1];
    }
    _pushScope() {
      const e2 = this.getScope().clone();
      return this._stack.push({ client: this.getClient(), scope: e2 }), e2;
    }
    _popScope() {
      return !(this._stack.length <= 1) && !!this._stack.pop();
    }
  };
  function pt() {
    const e2 = he(pe());
    return e2.stack = e2.stack || new dt(q("defaultCurrentScope", (() => new ut())), q("defaultIsolationScope", (() => new ut())));
  }
  function ht(e2) {
    return pt().withScope(e2);
  }
  function ft(e2, t2) {
    const n2 = pt();
    return n2.withScope((() => (n2.getStackTop().scope = e2, t2(e2))));
  }
  function vt(e2) {
    return pt().withScope((() => e2(pt().getIsolationScope())));
  }
  function gt(e2) {
    const t2 = he(e2);
    return t2.acs ? t2.acs : { withIsolationScope: vt, withScope: ht, withSetScope: ft, withSetIsolationScope: (e3, t3) => vt(t3), getCurrentScope: () => pt().getScope(), getIsolationScope: () => pt().getIsolationScope() };
  }
  function mt() {
    return gt(pe()).getCurrentScope();
  }
  function yt() {
    return gt(pe()).getIsolationScope();
  }
  function bt() {
    return mt().getClient();
  }
  function _t(e2) {
    const t2 = e2.getPropagationContext(), { traceId: n2, spanId: r2, parentSpanId: i2 } = t2;
    return Ve({ trace_id: n2, span_id: r2, parent_span_id: i2 });
  }
  function wt(e2) {
    const t2 = e2._sentryMetrics;
    if (!t2) return;
    const n2 = {};
    for (const [, [e3, r2]] of t2) {
      (n2[e3] || (n2[e3] = [])).push(Ve(r2));
    }
    return n2;
  }
  var St = /^sentry-/;
  function kt(e2) {
    const t2 = (function(e3) {
      if (!e3 || !be(e3) && !Array.isArray(e3)) return;
      if (Array.isArray(e3)) return e3.reduce(((e4, t3) => {
        const n3 = Mt(t3);
        return Object.entries(n3).forEach((([t4, n4]) => {
          e4[t4] = n4;
        })), e4;
      }), {});
      return Mt(e3);
    })(e2);
    if (!t2) return;
    const n2 = Object.entries(t2).reduce(((e3, [t3, n3]) => {
      if (t3.match(St)) {
        e3[t3.slice(7)] = n3;
      }
      return e3;
    }), {});
    return Object.keys(n2).length > 0 ? n2 : void 0;
  }
  function Mt(e2) {
    return e2.split(",").map(((e3) => e3.split("=").map(((e4) => decodeURIComponent(e4.trim()))))).reduce(((e3, [t2, n2]) => (t2 && n2 && (e3[t2] = n2), e3)), {});
  }
  var Ct = false;
  function Et(e2) {
    const { spanId: t2, traceId: n2, isRemote: r2 } = e2.spanContext();
    return Ve({ parent_span_id: r2 ? t2 : Pt(e2).parent_span_id, span_id: r2 ? it() : t2, trace_id: n2 });
  }
  function Tt(e2) {
    return "number" == typeof e2 ? Ot(e2) : Array.isArray(e2) ? e2[0] + e2[1] / 1e9 : e2 instanceof Date ? Ot(e2.getTime()) : qe();
  }
  function Ot(e2) {
    return e2 > 9999999999 ? e2 / 1e3 : e2;
  }
  function Pt(e2) {
    if ((function(e3) {
      return "function" == typeof e3.getSpanJSON;
    })(e2)) return e2.getSpanJSON();
    try {
      const { spanId: t2, traceId: n2 } = e2.spanContext();
      if ((function(e3) {
        const t3 = e3;
        return !!(t3.attributes && t3.startTime && t3.name && t3.endTime && t3.status);
      })(e2)) {
        const { attributes: r2, startTime: i2, name: o2, endTime: a2, parentSpanId: s2, status: c2 } = e2;
        return Ve({ span_id: t2, trace_id: n2, data: r2, description: o2, parent_span_id: s2, start_timestamp: Tt(i2), timestamp: Tt(a2) || void 0, status: At(c2), op: r2["sentry.op"], origin: r2["sentry.origin"], _metrics_summary: wt(e2) });
      }
      return { span_id: t2, trace_id: n2 };
    } catch (e3) {
      return {};
    }
  }
  function At(e2) {
    if (e2 && 0 !== e2.code) return 1 === e2.code ? "ok" : e2.message || "unknown_error";
  }
  function jt(e2) {
    return e2._sentryRootSpan || e2;
  }
  function It() {
    Ct || (G((() => {
      console.warn("[Sentry] Deprecation warning: Returning null from `beforeSendSpan` will be disallowed from SDK version 9.0.0 onwards. The callback will only support mutating spans. To drop certain spans, configure the respective integrations directly.");
    })), Ct = true);
  }
  var xt = "production";
  function Lt(e2, t2) {
    const n2 = t2.getOptions(), { publicKey: r2 } = t2.getDsn() || {}, i2 = Ve({ environment: n2.environment || xt, release: n2.release, public_key: r2, trace_id: e2 });
    return t2.emit("createDsc", i2), i2;
  }
  function Dt(e2) {
    const t2 = bt();
    if (!t2) return {};
    const n2 = jt(e2), r2 = n2._frozenDsc;
    if (r2) return r2;
    const i2 = n2.spanContext().traceState, o2 = i2 && i2.get("sentry.dsc"), a2 = o2 && kt(o2);
    if (a2) return a2;
    const s2 = Lt(e2.spanContext().traceId, t2), c2 = Pt(n2), l2 = c2.data || {}, u2 = l2["sentry.sample_rate"];
    null != u2 && (s2.sample_rate = `${u2}`);
    const d2 = l2["sentry.source"], p2 = c2.description;
    return "url" !== d2 && p2 && (s2.transaction = p2), (function(e3) {
      if ("boolean" == typeof __SENTRY_TRACING__ && !__SENTRY_TRACING__) return false;
      const t3 = bt(), n3 = e3 || t3 && t3.getOptions();
      return !!n3 && (n3.enableTracing || "tracesSampleRate" in n3 || "tracesSampler" in n3);
    })() && (s2.sampled = String((function(e3) {
      const { traceFlags: t3 } = e3.spanContext();
      return 1 === t3;
    })(n2))), t2.emit("createDsc", s2, n2), s2;
  }
  var Nt = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;
  function Rt(e2, t2 = false) {
    const { host: n2, path: r2, pass: i2, port: o2, projectId: a2, protocol: s2, publicKey: c2 } = e2;
    return `${s2}://${c2}${t2 && i2 ? `:${i2}` : ""}@${n2}${o2 ? `:${o2}` : ""}/${r2 ? `${r2}/` : r2}${a2}`;
  }
  function Ft(e2) {
    return { protocol: e2.protocol, publicKey: e2.publicKey || "", pass: e2.pass || "", host: e2.host, port: e2.port || "", path: e2.path || "", projectId: e2.projectId };
  }
  function Bt(e2) {
    const t2 = "string" == typeof e2 ? (function(e3) {
      const t3 = Nt.exec(e3);
      if (!t3) return void G((() => {
        console.error(`Invalid Sentry Dsn: ${e3}`);
      }));
      const [n2, r2, i2 = "", o2 = "", a2 = "", s2 = ""] = t3.slice(1);
      let c2 = "", l2 = s2;
      const u2 = l2.split("/");
      if (u2.length > 1 && (c2 = u2.slice(0, -1).join("/"), l2 = u2.pop()), l2) {
        const e4 = l2.match(/^\d+/);
        e4 && (l2 = e4[0]);
      }
      return Ft({ host: o2, pass: i2, path: c2, projectId: l2, port: a2, protocol: n2, publicKey: r2 });
    })(e2) : Ft(e2);
    if (t2 && (function(e3) {
      if (!z) return true;
      const { port: t3, projectId: n2, protocol: r2 } = e3;
      return !(["protocol", "publicKey", "host", "projectId"].find(((t4) => !e3[t4] && (Q.error(`Invalid Sentry Dsn: ${t4} missing`), true))) || (n2.match(/^\d+$/) ? /* @__PURE__ */ (function(e4) {
        return "http" === e4 || "https" === e4;
      })(r2) ? t3 && isNaN(parseInt(t3, 10)) && (Q.error(`Invalid Sentry Dsn: Invalid port ${t3}`), 1) : (Q.error(`Invalid Sentry Dsn: Invalid protocol ${r2}`), 1) : (Q.error(`Invalid Sentry Dsn: Invalid projectId ${n2}`), 1)));
    })(t2)) return t2;
  }
  function Ut(e2, t2 = 100, n2 = 1 / 0) {
    try {
      return Jt("", e2, t2, n2);
    } catch (e3) {
      return { ERROR: `**non-serializable** (${e3})` };
    }
  }
  function Vt(e2, t2 = 3, n2 = 102400) {
    const r2 = Ut(e2, t2);
    return i2 = r2, (function(e3) {
      return ~-encodeURI(e3).split(/%..|./).length;
    })(JSON.stringify(i2)) > n2 ? Vt(e2, t2 - 1, n2) : r2;
    var i2;
  }
  function Jt(e2, t2, n2 = 1 / 0, r2 = 1 / 0, i2 = /* @__PURE__ */ (function() {
    const e3 = "function" == typeof WeakSet, t3 = e3 ? /* @__PURE__ */ new WeakSet() : [];
    return [function(n3) {
      if (e3) return !!t3.has(n3) || (t3.add(n3), false);
      for (let e4 = 0; e4 < t3.length; e4++) if (t3[e4] === n3) return true;
      return t3.push(n3), false;
    }, function(n3) {
      if (e3) t3.delete(n3);
      else for (let e4 = 0; e4 < t3.length; e4++) if (t3[e4] === n3) {
        t3.splice(e4, 1);
        break;
      }
    }];
  })()) {
    const [o2, a2] = i2;
    if (null == t2 || ["boolean", "string"].includes(typeof t2) || "number" == typeof t2 && Number.isFinite(t2)) return t2;
    const s2 = (function(e3, t3) {
      try {
        if ("domain" === e3 && t3 && "object" == typeof t3 && t3._events) return "[Domain]";
        if ("domainEmitter" === e3) return "[DomainEmitter]";
        if ("undefined" != typeof global && t3 === global) return "[Global]";
        if ("undefined" != typeof window && t3 === window) return "[Window]";
        if ("undefined" != typeof document && t3 === document) return "[Document]";
        if (Ee(t3)) return "[VueViewModel]";
        if (Se(n3 = t3) && "nativeEvent" in n3 && "preventDefault" in n3 && "stopPropagation" in n3) return "[SyntheticEvent]";
        if ("number" == typeof t3 && !Number.isFinite(t3)) return `[${t3}]`;
        if ("function" == typeof t3) return `[Function: ${te(t3)}]`;
        if ("symbol" == typeof t3) return `[${String(t3)}]`;
        if ("bigint" == typeof t3) return `[BigInt: ${String(t3)}]`;
        const r3 = (function(e4) {
          const t4 = Object.getPrototypeOf(e4);
          return t4 ? t4.constructor.name : "null prototype";
        })(t3);
        return /^HTML(\w*)Element$/.test(r3) ? `[HTMLElement: ${r3}]` : `[object ${r3}]`;
      } catch (e4) {
        return `**non-serializable** (${e4})`;
      }
      var n3;
    })(e2, t2);
    if (!s2.startsWith("[object ")) return s2;
    if (t2.__sentry_skip_normalization__) return t2;
    const c2 = "number" == typeof t2.__sentry_override_normalization_depth__ ? t2.__sentry_override_normalization_depth__ : n2;
    if (0 === c2) return s2.replace("object ", "");
    if (o2(t2)) return "[Circular ~]";
    const l2 = t2;
    if (l2 && "function" == typeof l2.toJSON) try {
      return Jt("", l2.toJSON(), c2 - 1, r2, i2);
    } catch (e3) {
    }
    const u2 = Array.isArray(t2) ? [] : {};
    let d2 = 0;
    const p2 = Fe(t2);
    for (const e3 in p2) {
      if (!Object.prototype.hasOwnProperty.call(p2, e3)) continue;
      if (d2 >= r2) {
        u2[e3] = "[MaxProperties ~]";
        break;
      }
      const t3 = p2[e3];
      u2[e3] = Jt(e3, t3, c2 - 1, r2, i2), d2++;
    }
    return a2(t2), u2;
  }
  function $t(e2, t2 = []) {
    return [e2, t2];
  }
  function qt(e2, t2) {
    const [n2, r2] = e2;
    return [n2, [...r2, t2]];
  }
  function zt(e2, t2) {
    const n2 = e2[1];
    for (const e3 of n2) {
      if (t2(e3, e3[0].type)) return true;
    }
    return false;
  }
  function Wt(e2) {
    return $.__SENTRY__ && $.__SENTRY__.encodePolyfill ? $.__SENTRY__.encodePolyfill(e2) : new TextEncoder().encode(e2);
  }
  function Ht(e2) {
    const [t2, n2] = e2;
    let r2 = JSON.stringify(t2);
    function i2(e3) {
      "string" == typeof r2 ? r2 = "string" == typeof e3 ? r2 + e3 : [Wt(r2), e3] : r2.push("string" == typeof e3 ? Wt(e3) : e3);
    }
    for (const e3 of n2) {
      const [t3, n3] = e3;
      if (i2(`
${JSON.stringify(t3)}
`), "string" == typeof n3 || n3 instanceof Uint8Array) i2(n3);
      else {
        let e4;
        try {
          e4 = JSON.stringify(n3);
        } catch (t4) {
          e4 = JSON.stringify(Ut(n3));
        }
        i2(e4);
      }
    }
    return "string" == typeof r2 ? r2 : (function(e3) {
      const t3 = e3.reduce(((e4, t4) => e4 + t4.length), 0), n3 = new Uint8Array(t3);
      let r3 = 0;
      for (const t4 of e3) n3.set(t4, r3), r3 += t4.length;
      return n3;
    })(r2);
  }
  function Gt(e2) {
    const t2 = "string" == typeof e2.data ? Wt(e2.data) : e2.data;
    return [Ve({ type: "attachment", length: t2.length, filename: e2.filename, content_type: e2.contentType, attachment_type: e2.attachmentType }), t2];
  }
  var Qt = { session: "session", sessions: "session", attachment: "attachment", transaction: "transaction", event: "error", client_report: "internal", user_report: "default", profile: "profile", profile_chunk: "profile", replay_event: "replay", replay_recording: "replay", check_in: "monitor", feedback: "feedback", span: "span", statsd: "metric_bucket", raw_security: "security" };
  function Kt(e2) {
    return Qt[e2];
  }
  function Yt(e2) {
    if (!e2 || !e2.sdk) return;
    const { name: t2, version: n2 } = e2.sdk;
    return { name: t2, version: n2 };
  }
  function Xt(e2, t2, n2, r2) {
    const i2 = Yt(n2), o2 = e2.type && "replay_event" !== e2.type ? e2.type : "event";
    !(function(e3, t3) {
      t3 && (e3.sdk = e3.sdk || {}, e3.sdk.name = e3.sdk.name || t3.name, e3.sdk.version = e3.sdk.version || t3.version, e3.sdk.integrations = [...e3.sdk.integrations || [], ...t3.integrations || []], e3.sdk.packages = [...e3.sdk.packages || [], ...t3.packages || []]);
    })(e2, n2 && n2.sdk);
    const a2 = (function(e3, t3, n3, r3) {
      const i3 = e3.sdkProcessingMetadata && e3.sdkProcessingMetadata.dynamicSamplingContext;
      return { event_id: e3.event_id, sent_at: (/* @__PURE__ */ new Date()).toISOString(), ...t3 && { sdk: t3 }, ...!!n3 && r3 && { dsn: Rt(r3) }, ...i3 && { trace: Ve({ ...i3 }) } };
    })(e2, i2, r2, t2);
    delete e2.sdkProcessingMetadata;
    return $t(a2, [[{ type: o2 }, e2]]);
  }
  function Zt(e2, t2, n2, r2 = 0) {
    return new et(((i2, o2) => {
      const a2 = e2[r2];
      if (null === t2 || "function" != typeof a2) i2(t2);
      else {
        const s2 = a2({ ...t2 }, n2);
        V && a2.id && null === s2 && Q.log(`Event processor "${a2.id}" dropped event`), Me(s2) ? s2.then(((t3) => Zt(e2, t3, n2, r2 + 1).then(i2))).then(null, o2) : Zt(e2, s2, n2, r2 + 1).then(i2).then(null, o2);
      }
    }));
  }
  var en;
  var tn;
  var nn;
  function rn(e2, t2) {
    const { fingerprint: n2, span: r2, breadcrumbs: i2, sdkProcessingMetadata: o2 } = t2;
    !(function(e3, t3) {
      const { extra: n3, tags: r3, user: i3, contexts: o3, level: a2, transactionName: s2 } = t3, c2 = Ve(n3);
      c2 && Object.keys(c2).length && (e3.extra = { ...c2, ...e3.extra });
      const l2 = Ve(r3);
      l2 && Object.keys(l2).length && (e3.tags = { ...l2, ...e3.tags });
      const u2 = Ve(i3);
      u2 && Object.keys(u2).length && (e3.user = { ...u2, ...e3.user });
      const d2 = Ve(o3);
      d2 && Object.keys(d2).length && (e3.contexts = { ...d2, ...e3.contexts });
      a2 && (e3.level = a2);
      s2 && "transaction" !== e3.type && (e3.transaction = s2);
    })(e2, t2), r2 && (function(e3, t3) {
      e3.contexts = { trace: Et(t3), ...e3.contexts }, e3.sdkProcessingMetadata = { dynamicSamplingContext: Dt(t3), ...e3.sdkProcessingMetadata };
      const n3 = jt(t3), r3 = Pt(n3).description;
      r3 && !e3.transaction && "transaction" === e3.type && (e3.transaction = r3);
    })(e2, r2), (function(e3, t3) {
      e3.fingerprint = e3.fingerprint ? Array.isArray(e3.fingerprint) ? e3.fingerprint : [e3.fingerprint] : [], t3 && (e3.fingerprint = e3.fingerprint.concat(t3));
      e3.fingerprint && !e3.fingerprint.length && delete e3.fingerprint;
    })(e2, n2), (function(e3, t3) {
      const n3 = [...e3.breadcrumbs || [], ...t3];
      e3.breadcrumbs = n3.length ? n3 : void 0;
    })(e2, i2), (function(e3, t3) {
      e3.sdkProcessingMetadata = { ...e3.sdkProcessingMetadata, ...t3 };
    })(e2, o2);
  }
  function on(e2, t2) {
    const { extra: n2, tags: r2, user: i2, contexts: o2, level: a2, sdkProcessingMetadata: s2, breadcrumbs: c2, fingerprint: l2, eventProcessors: u2, attachments: d2, propagationContext: p2, transactionName: h2, span: f2 } = t2;
    an(e2, "extra", n2), an(e2, "tags", r2), an(e2, "user", i2), an(e2, "contexts", o2), e2.sdkProcessingMetadata = ot(e2.sdkProcessingMetadata, s2, 2), a2 && (e2.level = a2), h2 && (e2.transactionName = h2), f2 && (e2.span = f2), c2.length && (e2.breadcrumbs = [...e2.breadcrumbs, ...c2]), l2.length && (e2.fingerprint = [...e2.fingerprint, ...l2]), u2.length && (e2.eventProcessors = [...e2.eventProcessors, ...u2]), d2.length && (e2.attachments = [...e2.attachments, ...d2]), e2.propagationContext = { ...e2.propagationContext, ...p2 };
  }
  function an(e2, t2, n2) {
    e2[t2] = ot(e2[t2], n2, 1);
  }
  function sn(e2, t2, n2, r2, i2, o2) {
    const { normalizeDepth: a2 = 3, normalizeMaxBreadth: s2 = 1e3 } = e2, c2 = { ...t2, event_id: t2.event_id || n2.event_id || ze(), timestamp: t2.timestamp || $e() }, l2 = n2.integrations || e2.integrations.map(((e3) => e3.name));
    !(function(e3, t3) {
      const { environment: n3, release: r3, dist: i3, maxValueLength: o3 = 250 } = t3;
      e3.environment = e3.environment || n3 || xt, !e3.release && r3 && (e3.release = r3);
      !e3.dist && i3 && (e3.dist = i3);
      e3.message && (e3.message = Ae(e3.message, o3));
      const a3 = e3.exception && e3.exception.values && e3.exception.values[0];
      a3 && a3.value && (a3.value = Ae(a3.value, o3));
      const s3 = e3.request;
      s3 && s3.url && (s3.url = Ae(s3.url, o3));
    })(c2, e2), (function(e3, t3) {
      t3.length > 0 && (e3.sdk = e3.sdk || {}, e3.sdk.integrations = [...e3.sdk.integrations || [], ...t3]);
    })(c2, l2), i2 && i2.emit("applyFrameMetadata", t2), void 0 === t2.type && (function(e3, t3) {
      const n3 = (function(e4) {
        const t4 = $._sentryDebugIds;
        if (!t4) return {};
        const n4 = Object.keys(t4);
        return nn && n4.length === tn || (tn = n4.length, nn = n4.reduce(((n5, r3) => {
          en || (en = {});
          const i3 = en[r3];
          if (i3) n5[i3[0]] = i3[1];
          else {
            const i4 = e4(r3);
            for (let e5 = i4.length - 1; e5 >= 0; e5--) {
              const o3 = i4[e5], a3 = o3 && o3.filename, s3 = t4[r3];
              if (a3 && s3) {
                n5[a3] = s3, en[r3] = [a3, s3];
                break;
              }
            }
          }
          return n5;
        }), {})), nn;
      })(t3);
      try {
        e3.exception.values.forEach(((e4) => {
          e4.stacktrace.frames.forEach(((e5) => {
            n3 && e5.filename && (e5.debug_id = n3[e5.filename]);
          }));
        }));
      } catch (e4) {
      }
    })(c2, e2.stackParser);
    const u2 = (function(e3, t3) {
      if (!t3) return e3;
      const n3 = e3 ? e3.clone() : new ut();
      return n3.update(t3), n3;
    })(r2, n2.captureContext);
    n2.mechanism && Qe(c2, n2.mechanism);
    const d2 = i2 ? i2.getEventProcessors() : [], p2 = q("globalScope", (() => new ut())).getScopeData();
    if (o2) {
      on(p2, o2.getScopeData());
    }
    if (u2) {
      on(p2, u2.getScopeData());
    }
    const h2 = [...n2.attachments || [], ...p2.attachments];
    h2.length && (n2.attachments = h2), rn(c2, p2);
    return Zt([...d2, ...p2.eventProcessors], c2, n2).then(((e3) => (e3 && (function(e4) {
      const t3 = {};
      try {
        e4.exception.values.forEach(((e5) => {
          e5.stacktrace.frames.forEach(((e6) => {
            e6.debug_id && (e6.abs_path ? t3[e6.abs_path] = e6.debug_id : e6.filename && (t3[e6.filename] = e6.debug_id), delete e6.debug_id);
          }));
        }));
      } catch (e5) {
      }
      if (0 === Object.keys(t3).length) return;
      e4.debug_meta = e4.debug_meta || {}, e4.debug_meta.images = e4.debug_meta.images || [];
      const n3 = e4.debug_meta.images;
      Object.entries(t3).forEach((([e5, t4]) => {
        n3.push({ type: "sourcemap", code_file: e5, debug_id: t4 });
      }));
    })(e3), "number" == typeof a2 && a2 > 0 ? (function(e4, t3, n3) {
      if (!e4) return null;
      const r3 = { ...e4, ...e4.breadcrumbs && { breadcrumbs: e4.breadcrumbs.map(((e5) => ({ ...e5, ...e5.data && { data: Ut(e5.data, t3, n3) } }))) }, ...e4.user && { user: Ut(e4.user, t3, n3) }, ...e4.contexts && { contexts: Ut(e4.contexts, t3, n3) }, ...e4.extra && { extra: Ut(e4.extra, t3, n3) } };
      e4.contexts && e4.contexts.trace && r3.contexts && (r3.contexts.trace = e4.contexts.trace, e4.contexts.trace.data && (r3.contexts.trace.data = Ut(e4.contexts.trace.data, t3, n3)));
      e4.spans && (r3.spans = e4.spans.map(((e5) => ({ ...e5, ...e5.data && { data: Ut(e5.data, t3, n3) } }))));
      e4.contexts && e4.contexts.flags && r3.contexts && (r3.contexts.flags = Ut(e4.contexts.flags, 3, n3));
      return r3;
    })(e3, a2, s2) : e3)));
  }
  function cn(e2) {
    if (e2) return (function(e3) {
      return e3 instanceof ut || "function" == typeof e3;
    })(e2) || (function(e3) {
      return Object.keys(e3).some(((e4) => ln.includes(e4)));
    })(e2) ? { captureContext: e2 } : e2;
  }
  var ln = ["user", "level", "extra", "contexts", "tags", "fingerprint", "requestSession", "propagationContext"];
  function un(e2, t2) {
    return mt().captureEvent(e2, t2);
  }
  function dn(e2) {
    const t2 = bt(), n2 = yt(), r2 = mt(), { release: i2, environment: o2 = xt } = t2 && t2.getOptions() || {}, { userAgent: a2 } = $.navigator || {}, s2 = tt({ release: i2, environment: o2, user: r2.getUser() || n2.getUser(), ...a2 && { userAgent: a2 }, ...e2 }), c2 = n2.getSession();
    return c2 && "ok" === c2.status && nt(c2, { status: "exited" }), pn(), n2.setSession(s2), r2.setSession(s2), s2;
  }
  function pn() {
    const e2 = yt(), t2 = mt(), n2 = t2.getSession() || e2.getSession();
    n2 && (function(e3, t3) {
      let n3 = {};
      t3 ? n3 = { status: t3 } : "ok" === e3.status && (n3 = { status: "exited" }), nt(e3, n3);
    })(n2), hn(), e2.setSession(), t2.setSession();
  }
  function hn() {
    const e2 = yt(), t2 = mt(), n2 = bt(), r2 = t2.getSession() || e2.getSession();
    r2 && n2 && n2.captureSession(r2);
  }
  function fn(e2 = false) {
    e2 ? pn() : hn();
  }
  function vn(e2, t2, n2) {
    return t2 || `${(function(e3) {
      return `${(function(e4) {
        const t3 = e4.protocol ? `${e4.protocol}:` : "", n3 = e4.port ? `:${e4.port}` : "";
        return `${t3}//${e4.host}${n3}${e4.path ? `/${e4.path}` : ""}/api/`;
      })(e3)}${e3.projectId}/envelope/`;
    })(e2)}?${(function(e3, t3) {
      const n3 = { sentry_version: "7" };
      return e3.publicKey && (n3.sentry_key = e3.publicKey), t3 && (n3.sentry_client = `${t3.name}/${t3.version}`), new URLSearchParams(n3).toString();
    })(e2, n2)}`;
  }
  var gn = [];
  function mn(e2, t2) {
    for (const n2 of t2) n2 && n2.afterAllSetup && n2.afterAllSetup(e2);
  }
  function yn(e2, t2, n2) {
    if (n2[t2.name]) V && Q.log(`Integration skipped because it was already installed: ${t2.name}`);
    else {
      if (n2[t2.name] = t2, -1 === gn.indexOf(t2.name) && "function" == typeof t2.setupOnce && (t2.setupOnce(), gn.push(t2.name)), t2.setup && "function" == typeof t2.setup && t2.setup(e2), "function" == typeof t2.preprocessEvent) {
        const n3 = t2.preprocessEvent.bind(t2);
        e2.on("preprocessEvent", ((t3, r2) => n3(t3, r2, e2)));
      }
      if ("function" == typeof t2.processEvent) {
        const n3 = t2.processEvent.bind(t2), r2 = Object.assign(((t3, r3) => n3(t3, r3, e2)), { id: t2.name });
        e2.addEventProcessor(r2);
      }
      V && Q.log(`Integration installed: ${t2.name}`);
    }
  }
  var bn = class extends Error {
    constructor(e2, t2 = "warn") {
      super(e2), this.message = e2, this.logLevel = t2;
    }
  };
  var _n = "Not capturing exception because it's already been captured.";
  var wn = class {
    constructor(e2) {
      if (this._options = e2, this._integrations = {}, this._numProcessing = 0, this._outcomes = {}, this._hooks = {}, this._eventProcessors = [], e2.dsn ? this._dsn = Bt(e2.dsn) : V && Q.warn("No DSN provided, client will not send events."), this._dsn) {
        const t3 = vn(this._dsn, e2.tunnel, e2._metadata ? e2._metadata.sdk : void 0);
        this._transport = e2.transport({ tunnel: this._options.tunnel, recordDroppedEvent: this.recordDroppedEvent.bind(this), ...e2.transportOptions, url: t3 });
      }
      const t2 = ["enableTracing", "tracesSampleRate", "tracesSampler"].find(((t3) => t3 in e2 && null == e2[t3]));
      t2 && G((() => {
        console.warn(`[Sentry] Deprecation warning: \`${t2}\` is set to undefined, which leads to tracing being enabled. In v9, a value of \`undefined\` will result in tracing being disabled.`);
      }));
    }
    captureException(e2, t2, n2) {
      const r2 = ze();
      if (Ke(e2)) return V && Q.log(_n), r2;
      const i2 = { event_id: r2, ...t2 };
      return this._process(this.eventFromException(e2, i2).then(((e3) => this._captureEvent(e3, i2, n2)))), i2.event_id;
    }
    captureMessage(e2, t2, n2, r2) {
      const i2 = { event_id: ze(), ...n2 }, o2 = _e(e2) ? e2 : String(e2), a2 = we(e2) ? this.eventFromMessage(o2, t2, i2) : this.eventFromException(e2, i2);
      return this._process(a2.then(((e3) => this._captureEvent(e3, i2, r2)))), i2.event_id;
    }
    captureEvent(e2, t2, n2) {
      const r2 = ze();
      if (t2 && t2.originalException && Ke(t2.originalException)) return V && Q.log(_n), r2;
      const i2 = { event_id: r2, ...t2 }, o2 = (e2.sdkProcessingMetadata || {}).capturedSpanScope;
      return this._process(this._captureEvent(e2, i2, o2 || n2)), i2.event_id;
    }
    captureSession(e2) {
      "string" != typeof e2.release ? V && Q.warn("Discarded session because of missing or non-string release") : (this.sendSession(e2), nt(e2, { init: false }));
    }
    getDsn() {
      return this._dsn;
    }
    getOptions() {
      return this._options;
    }
    getSdkMetadata() {
      return this._options._metadata;
    }
    getTransport() {
      return this._transport;
    }
    flush(e2) {
      const t2 = this._transport;
      return t2 ? (this.emit("flush"), this._isClientDoneProcessing(e2).then(((n2) => t2.flush(e2).then(((e3) => n2 && e3))))) : Xe(true);
    }
    close(e2) {
      return this.flush(e2).then(((e3) => (this.getOptions().enabled = false, this.emit("close"), e3)));
    }
    getEventProcessors() {
      return this._eventProcessors;
    }
    addEventProcessor(e2) {
      this._eventProcessors.push(e2);
    }
    init() {
      (this._isEnabled() || this._options.integrations.some((({ name: e2 }) => e2.startsWith("Spotlight")))) && this._setupIntegrations();
    }
    getIntegrationByName(e2) {
      return this._integrations[e2];
    }
    addIntegration(e2) {
      const t2 = this._integrations[e2.name];
      yn(this, e2, this._integrations), t2 || mn(this, [e2]);
    }
    sendEvent(e2, t2 = {}) {
      this.emit("beforeSendEvent", e2, t2);
      let n2 = Xt(e2, this._dsn, this._options._metadata, this._options.tunnel);
      for (const e3 of t2.attachments || []) n2 = qt(n2, Gt(e3));
      const r2 = this.sendEnvelope(n2);
      r2 && r2.then(((t3) => this.emit("afterSendEvent", e2, t3)), null);
    }
    sendSession(e2) {
      const t2 = (function(e3, t3, n2, r2) {
        const i2 = Yt(n2);
        return $t({ sent_at: (/* @__PURE__ */ new Date()).toISOString(), ...i2 && { sdk: i2 }, ...!!r2 && t3 && { dsn: Rt(t3) } }, ["aggregates" in e3 ? [{ type: "sessions" }, e3] : [{ type: "session" }, e3.toJSON()]]);
      })(e2, this._dsn, this._options._metadata, this._options.tunnel);
      this.sendEnvelope(t2);
    }
    recordDroppedEvent(e2, t2, n2) {
      if (this._options.sendClientReports) {
        const r2 = "number" == typeof n2 ? n2 : 1, i2 = `${e2}:${t2}`;
        V && Q.log(`Recording outcome: "${i2}"${r2 > 1 ? ` (${r2} times)` : ""}`), this._outcomes[i2] = (this._outcomes[i2] || 0) + r2;
      }
    }
    on(e2, t2) {
      const n2 = this._hooks[e2] = this._hooks[e2] || [];
      return n2.push(t2), () => {
        const e3 = n2.indexOf(t2);
        e3 > -1 && n2.splice(e3, 1);
      };
    }
    emit(e2, ...t2) {
      const n2 = this._hooks[e2];
      n2 && n2.forEach(((e3) => e3(...t2)));
    }
    sendEnvelope(e2) {
      return this.emit("beforeEnvelope", e2), this._isEnabled() && this._transport ? this._transport.send(e2).then(null, ((e3) => (V && Q.error("Error while sending envelope:", e3), e3))) : (V && Q.error("Transport disabled"), Xe({}));
    }
    _setupIntegrations() {
      const { integrations: e2 } = this._options;
      this._integrations = (function(e3, t2) {
        const n2 = {};
        return t2.forEach(((t3) => {
          t3 && yn(e3, t3, n2);
        })), n2;
      })(this, e2), mn(this, e2);
    }
    _updateSessionFromEvent(e2, t2) {
      let n2 = "fatal" === t2.level, r2 = false;
      const i2 = t2.exception && t2.exception.values;
      if (i2) {
        r2 = true;
        for (const e3 of i2) {
          const t3 = e3.mechanism;
          if (t3 && false === t3.handled) {
            n2 = true;
            break;
          }
        }
      }
      const o2 = "ok" === e2.status;
      (o2 && 0 === e2.errors || o2 && n2) && (nt(e2, { ...n2 && { status: "crashed" }, errors: e2.errors || Number(r2 || n2) }), this.captureSession(e2));
    }
    _isClientDoneProcessing(e2) {
      return new et(((t2) => {
        let n2 = 0;
        const r2 = setInterval((() => {
          0 == this._numProcessing ? (clearInterval(r2), t2(true)) : (n2 += 1, e2 && n2 >= e2 && (clearInterval(r2), t2(false)));
        }), 1);
      }));
    }
    _isEnabled() {
      return false !== this.getOptions().enabled && void 0 !== this._transport;
    }
    _prepareEvent(e2, t2, n2 = mt(), r2 = yt()) {
      const i2 = this.getOptions(), o2 = Object.keys(this._integrations);
      return !t2.integrations && o2.length > 0 && (t2.integrations = o2), this.emit("preprocessEvent", e2, t2), e2.type || r2.setLastEventId(e2.event_id || t2.event_id), sn(i2, e2, t2, n2, this, r2).then(((e3) => {
        if (null === e3) return e3;
        e3.contexts = { trace: _t(n2), ...e3.contexts };
        const t3 = (function(e4, t4) {
          const n3 = t4.getPropagationContext();
          return n3.dsc || Lt(n3.traceId, e4);
        })(this, n2);
        return e3.sdkProcessingMetadata = { dynamicSamplingContext: t3, ...e3.sdkProcessingMetadata }, e3;
      }));
    }
    _captureEvent(e2, t2 = {}, n2) {
      return this._processEvent(e2, t2, n2).then(((e3) => e3.event_id), ((e3) => {
        V && (e3 instanceof bn && "log" === e3.logLevel ? Q.log(e3.message) : Q.warn(e3));
      }));
    }
    _processEvent(e2, t2, n2) {
      const r2 = this.getOptions(), { sampleRate: i2 } = r2, o2 = kn(e2), a2 = Sn(e2), s2 = e2.type || "error", c2 = `before send for type \`${s2}\``, l2 = void 0 === i2 ? void 0 : (function(e3) {
        if ("boolean" == typeof e3) return Number(e3);
        const t3 = "string" == typeof e3 ? parseFloat(e3) : e3;
        if (!("number" != typeof t3 || isNaN(t3) || t3 < 0 || t3 > 1)) return t3;
        V && Q.warn(`[Tracing] Given sample rate is invalid. Sample rate must be a boolean or a number between 0 and 1. Got ${JSON.stringify(e3)} of type ${JSON.stringify(typeof e3)}.`);
      })(i2);
      if (a2 && "number" == typeof l2 && Math.random() > l2) return this.recordDroppedEvent("sample_rate", "error", e2), Ze(new bn(`Discarding event because it's not included in the random sample (sampling rate = ${i2})`, "log"));
      const u2 = "replay_event" === s2 ? "replay" : s2, d2 = (e2.sdkProcessingMetadata || {}).capturedSpanIsolationScope;
      return this._prepareEvent(e2, t2, n2, d2).then(((n3) => {
        if (null === n3) throw this.recordDroppedEvent("event_processor", u2, e2), new bn("An event processor returned `null`, will not send event.", "log");
        if (t2.data && true === t2.data.__sentry__) return n3;
        const i3 = (function(e3, t3, n4, r3) {
          const { beforeSend: i4, beforeSendTransaction: o3, beforeSendSpan: a3 } = t3;
          if (Sn(n4) && i4) return i4(n4, r3);
          if (kn(n4)) {
            if (n4.spans && a3) {
              const t4 = [];
              for (const r4 of n4.spans) {
                const n5 = a3(r4);
                n5 ? t4.push(n5) : (It(), e3.recordDroppedEvent("before_send", "span"));
              }
              n4.spans = t4;
            }
            if (o3) {
              if (n4.spans) {
                const e4 = n4.spans.length;
                n4.sdkProcessingMetadata = { ...n4.sdkProcessingMetadata, spanCountBeforeProcessing: e4 };
              }
              return o3(n4, r3);
            }
          }
          return n4;
        })(this, r2, n3, t2);
        return (function(e3, t3) {
          const n4 = `${t3} must return \`null\` or a valid event.`;
          if (Me(e3)) return e3.then(((e4) => {
            if (!Se(e4) && null !== e4) throw new bn(n4);
            return e4;
          }), ((e4) => {
            throw new bn(`${t3} rejected with ${e4}`);
          }));
          if (!Se(e3) && null !== e3) throw new bn(n4);
          return e3;
        })(i3, c2);
      })).then(((r3) => {
        if (null === r3) {
          if (this.recordDroppedEvent("before_send", u2, e2), o2) {
            const t3 = 1 + (e2.spans || []).length;
            this.recordDroppedEvent("before_send", "span", t3);
          }
          throw new bn(`${c2} returned \`null\`, will not send event.`, "log");
        }
        const i3 = n2 && n2.getSession();
        if (!o2 && i3 && this._updateSessionFromEvent(i3, r3), o2) {
          const e3 = (r3.sdkProcessingMetadata && r3.sdkProcessingMetadata.spanCountBeforeProcessing || 0) - (r3.spans ? r3.spans.length : 0);
          e3 > 0 && this.recordDroppedEvent("before_send", "span", e3);
        }
        const a3 = r3.transaction_info;
        if (o2 && a3 && r3.transaction !== e2.transaction) {
          const e3 = "custom";
          r3.transaction_info = { ...a3, source: e3 };
        }
        return this.sendEvent(r3, t2), r3;
      })).then(null, ((e3) => {
        if (e3 instanceof bn) throw e3;
        throw this.captureException(e3, { data: { __sentry__: true }, originalException: e3 }), new bn(`Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.
Reason: ${e3}`);
      }));
    }
    _process(e2) {
      this._numProcessing++, e2.then(((e3) => (this._numProcessing--, e3)), ((e3) => (this._numProcessing--, e3)));
    }
    _clearOutcomes() {
      const e2 = this._outcomes;
      return this._outcomes = {}, Object.entries(e2).map((([e3, t2]) => {
        const [n2, r2] = e3.split(":");
        return { reason: n2, category: r2, quantity: t2 };
      }));
    }
    _flushOutcomes() {
      V && Q.log("Flushing outcomes...");
      const e2 = this._clearOutcomes();
      if (0 === e2.length) return void (V && Q.log("No outcomes to send"));
      if (!this._dsn) return void (V && Q.log("No dsn provided, will not send outcomes"));
      V && Q.log("Sending outcomes:", e2);
      const t2 = (n2 = e2, $t((r2 = this._options.tunnel && Rt(this._dsn)) ? { dsn: r2 } : {}, [[{ type: "client_report" }, { timestamp: i2 || $e(), discarded_events: n2 }]]));
      var n2, r2, i2;
      this.sendEnvelope(t2);
    }
  };
  function Sn(e2) {
    return void 0 === e2.type;
  }
  function kn(e2) {
    return "transaction" === e2.type;
  }
  function Mn(e2) {
    const t2 = [];
    function n2(e3) {
      return t2.splice(t2.indexOf(e3), 1)[0] || Promise.resolve(void 0);
    }
    return { $: t2, add: function(r2) {
      if (!(void 0 === e2 || t2.length < e2)) return Ze(new bn("Not adding Promise because buffer limit was reached."));
      const i2 = r2();
      return -1 === t2.indexOf(i2) && t2.push(i2), i2.then((() => n2(i2))).then(null, (() => n2(i2).then(null, (() => {
      })))), i2;
    }, drain: function(e3) {
      return new et(((n3, r2) => {
        let i2 = t2.length;
        if (!i2) return n3(true);
        const o2 = setTimeout((() => {
          e3 && e3 > 0 && n3(false);
        }), e3);
        t2.forEach(((e4) => {
          Xe(e4).then((() => {
            --i2 || (clearTimeout(o2), n3(true));
          }), r2);
        }));
      }));
    } };
  }
  function Cn(e2, { statusCode: t2, headers: n2 }, r2 = Date.now()) {
    const i2 = { ...e2 }, o2 = n2 && n2["x-sentry-rate-limits"], a2 = n2 && n2["retry-after"];
    if (o2) for (const e3 of o2.trim().split(",")) {
      const [t3, n3, , , o3] = e3.split(":", 5), a3 = parseInt(t3, 10), s2 = 1e3 * (isNaN(a3) ? 60 : a3);
      if (n3) for (const e4 of n3.split(";")) "metric_bucket" === e4 && o3 && !o3.split(";").includes("custom") || (i2[e4] = r2 + s2);
      else i2.all = r2 + s2;
    }
    else a2 ? i2.all = r2 + (function(e3, t3 = Date.now()) {
      const n3 = parseInt(`${e3}`, 10);
      if (!isNaN(n3)) return 1e3 * n3;
      const r3 = Date.parse(`${e3}`);
      return isNaN(r3) ? 6e4 : r3 - t3;
    })(a2, r2) : 429 === t2 && (i2.all = r2 + 6e4);
    return i2;
  }
  function En(e2, t2, n2 = Mn(e2.bufferSize || 64)) {
    let r2 = {};
    return { send: function(i2) {
      const o2 = [];
      if (zt(i2, ((t3, n3) => {
        const i3 = Kt(n3);
        if ((function(e3, t4, n4 = Date.now()) {
          return (function(e4, t5) {
            return e4[t5] || e4.all || 0;
          })(e3, t4) > n4;
        })(r2, i3)) {
          const r3 = Tn(t3, n3);
          e2.recordDroppedEvent("ratelimit_backoff", i3, r3);
        } else o2.push(t3);
      })), 0 === o2.length) return Xe({});
      const a2 = $t(i2[0], o2), s2 = (t3) => {
        zt(a2, ((n3, r3) => {
          const i3 = Tn(n3, r3);
          e2.recordDroppedEvent(t3, Kt(r3), i3);
        }));
      };
      return n2.add((() => t2({ body: Ht(a2) }).then(((e3) => (void 0 !== e3.statusCode && (e3.statusCode < 200 || e3.statusCode >= 300) && V && Q.warn(`Sentry responded with status code ${e3.statusCode} to sent event.`), r2 = Cn(r2, e3), e3)), ((e3) => {
        throw s2("network_error"), e3;
      })))).then(((e3) => e3), ((e3) => {
        if (e3 instanceof bn) return V && Q.error("Skipped sending event because buffer is full."), s2("queue_overflow"), Xe({});
        throw e3;
      }));
    }, flush: (e3) => n2.drain(e3) };
  }
  function Tn(e2, t2) {
    if ("event" === t2 || "transaction" === t2) return Array.isArray(e2) ? e2[1] : void 0;
  }
  var On = 100;
  function Pn(e2, t2) {
    const n2 = bt(), r2 = yt();
    if (!n2) return;
    const { beforeBreadcrumb: i2 = null, maxBreadcrumbs: o2 = On } = n2.getOptions();
    if (o2 <= 0) return;
    const a2 = { timestamp: $e(), ...e2 }, s2 = i2 ? G((() => i2(a2, t2))) : a2;
    null !== s2 && (n2.emit && n2.emit("beforeAddBreadcrumb", s2, t2), r2.addBreadcrumb(s2, o2));
  }
  var An;
  var jn = /* @__PURE__ */ new WeakMap();
  var In = () => ({ name: "FunctionToString", setupOnce() {
    An = Function.prototype.toString;
    try {
      Function.prototype.toString = function(...e2) {
        const t2 = Re(this), n2 = jn.has(bt()) && void 0 !== t2 ? t2 : this;
        return An.apply(n2, e2);
      };
    } catch (e2) {
    }
  }, setup(e2) {
    jn.set(e2, true);
  } });
  var xn = [/^Script error\.?$/, /^Javascript error: Script error\.? on line 0$/, /^ResizeObserver loop completed with undelivered notifications.$/, /^Cannot redefine property: googletag$/, "undefined is not an object (evaluating 'a.L')", `can't redefine non-configurable property "solana"`, "vv().getRestrictions is not a function. (In 'vv().getRestrictions(1,a)', 'vv().getRestrictions' is undefined)", "Can't find variable: _AutofillCallbackHandler", /^Non-Error promise rejection captured with value: Object Not Found Matching Id:\d+, MethodName:simulateEvent, ParamCount:\d+$/];
  var Ln = (e2 = {}) => ({ name: "InboundFilters", processEvent(t2, n2, r2) {
    const i2 = r2.getOptions(), o2 = (function(e3 = {}, t3 = {}) {
      return { allowUrls: [...e3.allowUrls || [], ...t3.allowUrls || []], denyUrls: [...e3.denyUrls || [], ...t3.denyUrls || []], ignoreErrors: [...e3.ignoreErrors || [], ...t3.ignoreErrors || [], ...e3.disableErrorDefaults ? [] : xn], ignoreTransactions: [...e3.ignoreTransactions || [], ...t3.ignoreTransactions || []], ignoreInternal: void 0 === e3.ignoreInternal || e3.ignoreInternal };
    })(e2, i2);
    return (function(e3, t3) {
      if (t3.ignoreInternal && (function(e4) {
        try {
          return "SentryError" === e4.exception.values[0].type;
        } catch (e5) {
        }
        return false;
      })(e3)) return V && Q.warn(`Event dropped due to being internal Sentry Error.
Event: ${He(e3)}`), true;
      if ((function(e4, t4) {
        if (e4.type || !t4 || !t4.length) return false;
        return (function(e5) {
          const t5 = [];
          e5.message && t5.push(e5.message);
          let n3;
          try {
            n3 = e5.exception.values[e5.exception.values.length - 1];
          } catch (e6) {
          }
          n3 && n3.value && (t5.push(n3.value), n3.type && t5.push(`${n3.type}: ${n3.value}`));
          return t5;
        })(e4).some(((e5) => xe(e5, t4)));
      })(e3, t3.ignoreErrors)) return V && Q.warn(`Event dropped due to being matched by \`ignoreErrors\` option.
Event: ${He(e3)}`), true;
      if ((function(e4) {
        if (e4.type) return false;
        if (!e4.exception || !e4.exception.values || 0 === e4.exception.values.length) return false;
        return !e4.message && !e4.exception.values.some(((e5) => e5.stacktrace || e5.type && "Error" !== e5.type || e5.value));
      })(e3)) return V && Q.warn(`Event dropped due to not having an error message, error type or stacktrace.
Event: ${He(e3)}`), true;
      if ((function(e4, t4) {
        if ("transaction" !== e4.type || !t4 || !t4.length) return false;
        const n3 = e4.transaction;
        return !!n3 && xe(n3, t4);
      })(e3, t3.ignoreTransactions)) return V && Q.warn(`Event dropped due to being matched by \`ignoreTransactions\` option.
Event: ${He(e3)}`), true;
      if ((function(e4, t4) {
        if (!t4 || !t4.length) return false;
        const n3 = Dn(e4);
        return !!n3 && xe(n3, t4);
      })(e3, t3.denyUrls)) return V && Q.warn(`Event dropped due to being matched by \`denyUrls\` option.
Event: ${He(e3)}.
Url: ${Dn(e3)}`), true;
      if (!(function(e4, t4) {
        if (!t4 || !t4.length) return true;
        const n3 = Dn(e4);
        return !n3 || xe(n3, t4);
      })(e3, t3.allowUrls)) return V && Q.warn(`Event dropped due to not being matched by \`allowUrls\` option.
Event: ${He(e3)}.
Url: ${Dn(e3)}`), true;
      return false;
    })(t2, o2) ? null : t2;
  } });
  function Dn(e2) {
    try {
      let t2;
      try {
        t2 = e2.exception.values[0].stacktrace.frames;
      } catch (e3) {
      }
      return t2 ? (function(e3 = []) {
        for (let t3 = e3.length - 1; t3 >= 0; t3--) {
          const n2 = e3[t3];
          if (n2 && "<anonymous>" !== n2.filename && "[native code]" !== n2.filename) return n2.filename || null;
        }
        return null;
      })(t2) : null;
    } catch (t2) {
      return V && Q.error(`Cannot extract url for event ${He(e2)}`), null;
    }
  }
  function Nn(e2, t2, n2 = 250, r2, i2, o2, a2) {
    if (!(o2.exception && o2.exception.values && a2 && Ce(a2.originalException, Error))) return;
    const s2 = o2.exception.values.length > 0 ? o2.exception.values[o2.exception.values.length - 1] : void 0;
    var c2, l2;
    s2 && (o2.exception.values = (c2 = Rn(e2, t2, i2, a2.originalException, r2, o2.exception.values, s2, 0), l2 = n2, c2.map(((e3) => (e3.value && (e3.value = Ae(e3.value, l2)), e3)))));
  }
  function Rn(e2, t2, n2, r2, i2, o2, a2, s2) {
    if (o2.length >= n2 + 1) return o2;
    let c2 = [...o2];
    if (Ce(r2[i2], Error)) {
      Fn(a2, s2);
      const o3 = e2(t2, r2[i2]), l2 = c2.length;
      Bn(o3, i2, l2, s2), c2 = Rn(e2, t2, n2, r2[i2], i2, [o3, ...c2], o3, l2);
    }
    return Array.isArray(r2.errors) && r2.errors.forEach(((r3, o3) => {
      if (Ce(r3, Error)) {
        Fn(a2, s2);
        const l2 = e2(t2, r3), u2 = c2.length;
        Bn(l2, `errors[${o3}]`, u2, s2), c2 = Rn(e2, t2, n2, r3, i2, [l2, ...c2], l2, u2);
      }
    })), c2;
  }
  function Fn(e2, t2) {
    e2.mechanism = e2.mechanism || { type: "generic", handled: true }, e2.mechanism = { ...e2.mechanism, ..."AggregateError" === e2.type && { is_exception_group: true }, exception_id: t2 };
  }
  function Bn(e2, t2, n2, r2) {
    e2.mechanism = e2.mechanism || { type: "generic", handled: true }, e2.mechanism = { ...e2.mechanism, type: "chained", source: t2, exception_id: n2, parent_id: r2 };
  }
  function Un(e2) {
    if (!e2) return {};
    const t2 = e2.match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);
    if (!t2) return {};
    const n2 = t2[6] || "", r2 = t2[8] || "";
    return { host: t2[4], path: t2[5], protocol: t2[2], search: n2, hash: r2, relative: t2[5] + n2 + r2 };
  }
  function Vn() {
    "console" in $ && W.forEach((function(e2) {
      e2 in $.console && Le($.console, e2, (function(t2) {
        return H[e2] = t2, function(...t3) {
          se("console", { args: t3, level: e2 });
          const n2 = H[e2];
          n2 && n2.apply($.console, t3);
        };
      }));
    }));
  }
  function Jn(e2) {
    return "warn" === e2 ? "warning" : ["fatal", "error", "warning", "log", "info", "debug"].includes(e2) ? e2 : "log";
  }
  var $n = () => {
    let e2;
    return { name: "Dedupe", processEvent(t2) {
      if (t2.type) return t2;
      try {
        if ((function(e3, t3) {
          if (!t3) return false;
          if ((function(e4, t4) {
            const n2 = e4.message, r2 = t4.message;
            if (!n2 && !r2) return false;
            if (n2 && !r2 || !n2 && r2) return false;
            if (n2 !== r2) return false;
            if (!zn(e4, t4)) return false;
            if (!qn(e4, t4)) return false;
            return true;
          })(e3, t3)) return true;
          if ((function(e4, t4) {
            const n2 = Wn(t4), r2 = Wn(e4);
            if (!n2 || !r2) return false;
            if (n2.type !== r2.type || n2.value !== r2.value) return false;
            if (!zn(e4, t4)) return false;
            if (!qn(e4, t4)) return false;
            return true;
          })(e3, t3)) return true;
          return false;
        })(t2, e2)) return V && Q.warn("Event dropped due to being a duplicate of previously captured event."), null;
      } catch (e3) {
      }
      return e2 = t2;
    } };
  };
  function qn(e2, t2) {
    let n2 = ne(e2), r2 = ne(t2);
    if (!n2 && !r2) return true;
    if (n2 && !r2 || !n2 && r2) return false;
    if (r2.length !== n2.length) return false;
    for (let e3 = 0; e3 < r2.length; e3++) {
      const t3 = r2[e3], i2 = n2[e3];
      if (t3.filename !== i2.filename || t3.lineno !== i2.lineno || t3.colno !== i2.colno || t3.function !== i2.function) return false;
    }
    return true;
  }
  function zn(e2, t2) {
    let n2 = e2.fingerprint, r2 = t2.fingerprint;
    if (!n2 && !r2) return true;
    if (n2 && !r2 || !n2 && r2) return false;
    try {
      return !(n2.join("") !== r2.join(""));
    } catch (e3) {
      return false;
    }
  }
  function Wn(e2) {
    return e2.exception && e2.exception.values && e2.exception.values[0];
  }
  function Hn(e2) {
    return void 0 === e2 ? void 0 : e2 >= 400 && e2 < 500 ? "warning" : e2 >= 500 ? "error" : void 0;
  }
  var Gn = $;
  function Qn(e2) {
    return e2 && /^function\s+\w+\(\)\s+\{\s+\[native code\]\s+\}$/.test(e2.toString());
  }
  function Kn() {
    if ("string" == typeof EdgeRuntime) return true;
    if (!(function() {
      if (!("fetch" in Gn)) return false;
      try {
        return new Headers(), new Request("http://www.example.com"), new Response(), true;
      } catch (e3) {
        return false;
      }
    })()) return false;
    if (Qn(Gn.fetch)) return true;
    let e2 = false;
    const t2 = Gn.document;
    if (t2 && "function" == typeof t2.createElement) try {
      const n2 = t2.createElement("iframe");
      n2.hidden = true, t2.head.appendChild(n2), n2.contentWindow && n2.contentWindow.fetch && (e2 = Qn(n2.contentWindow.fetch)), t2.head.removeChild(n2);
    } catch (e3) {
      z && Q.warn("Could not create sandbox iframe for pure fetch check, bailing to window.fetch: ", e3);
    }
    return e2;
  }
  function Yn(e2, t2) {
    const n2 = "fetch";
    oe(n2, e2), ae(n2, (() => (function(e3, t3 = false) {
      if (t3 && !Kn()) return;
      Le($, "fetch", (function(t4) {
        return function(...n3) {
          const r2 = new Error(), { method: i2, url: o2 } = (function(e4) {
            if (0 === e4.length) return { method: "GET", url: "" };
            if (2 === e4.length) {
              const [t6, n4] = e4;
              return { url: Zn(t6), method: Xn(n4, "method") ? String(n4.method).toUpperCase() : "GET" };
            }
            const t5 = e4[0];
            return { url: Zn(t5), method: Xn(t5, "method") ? String(t5.method).toUpperCase() : "GET" };
          })(n3), a2 = { args: n3, fetchData: { method: i2, url: o2 }, startTimestamp: 1e3 * qe(), virtualError: r2 };
          return e3 || se("fetch", { ...a2 }), t4.apply($, n3).then((async (t5) => (e3 ? e3(t5) : se("fetch", { ...a2, endTimestamp: 1e3 * qe(), response: t5 }), t5)), ((e4) => {
            throw se("fetch", { ...a2, endTimestamp: 1e3 * qe(), error: e4 }), ve(e4) && void 0 === e4.stack && (e4.stack = r2.stack, De(e4, "framesToPop", 1)), e4;
          }));
        };
      }));
    })(void 0, t2)));
  }
  function Xn(e2, t2) {
    return !!e2 && "object" == typeof e2 && !!e2[t2];
  }
  function Zn(e2) {
    return "string" == typeof e2 ? e2 : e2 ? Xn(e2, "url") ? e2.url : e2.toString ? e2.toString() : "" : "";
  }
  var er = $;
  var tr = $;
  var nr = 0;
  function rr() {
    return nr > 0;
  }
  function ir(e2, t2 = {}) {
    if (!/* @__PURE__ */ (function(e3) {
      return "function" == typeof e3;
    })(e2)) return e2;
    try {
      const t3 = e2.__sentry_wrapped__;
      if (t3) return "function" == typeof t3 ? t3 : e2;
      if (Re(e2)) return e2;
    } catch (t3) {
      return e2;
    }
    const n2 = function(...n3) {
      try {
        const r2 = n3.map(((e3) => ir(e3, t2)));
        return e2.apply(this, r2);
      } catch (e3) {
        throw nr++, setTimeout((() => {
          nr--;
        })), (function(...e4) {
          const t3 = gt(pe());
          if (2 === e4.length) {
            const [n4, r2] = e4;
            return n4 ? t3.withSetScope(n4, r2) : t3.withScope(r2);
          }
          t3.withScope(e4[0]);
        })(((r2) => {
          var i2, o2;
          r2.addEventProcessor(((e4) => (t2.mechanism && (Ge(e4, void 0, void 0), Qe(e4, t2.mechanism)), e4.extra = { ...e4.extra, arguments: n3 }, e4))), i2 = e3, mt().captureException(i2, cn(o2));
        })), e3;
      }
    };
    try {
      for (const t3 in e2) Object.prototype.hasOwnProperty.call(e2, t3) && (n2[t3] = e2[t3]);
    } catch (e3) {
    }
    Ne(n2, e2), De(e2, "__sentry_wrapped__", n2);
    try {
      Object.getOwnPropertyDescriptor(n2, "name").configurable && Object.defineProperty(n2, "name", { get: () => e2.name });
    } catch (e3) {
    }
    return n2;
  }
  var or = "undefined" == typeof __SENTRY_DEBUG__ || __SENTRY_DEBUG__;
  function ar(e2, t2) {
    const n2 = lr(e2, t2), r2 = { type: pr(t2), value: hr(t2) };
    return n2.length && (r2.stacktrace = { frames: n2 }), void 0 === r2.type && "" === r2.value && (r2.value = "Unrecoverable error caught"), r2;
  }
  function sr(e2, t2, n2, r2) {
    const i2 = bt(), o2 = i2 && i2.getOptions().normalizeDepth, a2 = (function(e3) {
      for (const t3 in e3) if (Object.prototype.hasOwnProperty.call(e3, t3)) {
        const n3 = e3[t3];
        if (n3 instanceof Error) return n3;
      }
      return;
    })(t2), s2 = { __serialized__: Vt(t2, o2) };
    if (a2) return { exception: { values: [ar(e2, a2)] }, extra: s2 };
    const c2 = { exception: { values: [{ type: ke(t2) ? t2.constructor.name : r2 ? "UnhandledRejection" : "Error", value: gr(t2, { isUnhandledRejection: r2 }) }] }, extra: s2 };
    if (n2) {
      const t3 = lr(e2, n2);
      t3.length && (c2.exception.values[0].stacktrace = { frames: t3 });
    }
    return c2;
  }
  function cr(e2, t2) {
    return { exception: { values: [ar(e2, t2)] } };
  }
  function lr(e2, t2) {
    const n2 = t2.stacktrace || t2.stack || "", r2 = (function(e3) {
      if (e3 && ur.test(e3.message)) return 1;
      return 0;
    })(t2), i2 = (function(e3) {
      if ("number" == typeof e3.framesToPop) return e3.framesToPop;
      return 0;
    })(t2);
    try {
      return e2(n2, r2, i2);
    } catch (e3) {
    }
    return [];
  }
  var ur = /Minified React error #\d+;/i;
  function dr(e2) {
    return "undefined" != typeof WebAssembly && void 0 !== WebAssembly.Exception && e2 instanceof WebAssembly.Exception;
  }
  function pr(e2) {
    const t2 = e2 && e2.name;
    if (!t2 && dr(e2)) {
      return e2.message && Array.isArray(e2.message) && 2 == e2.message.length ? e2.message[0] : "WebAssembly.Exception";
    }
    return t2;
  }
  function hr(e2) {
    const t2 = e2 && e2.message;
    return t2 ? t2.error && "string" == typeof t2.error.message ? t2.error.message : dr(e2) && Array.isArray(e2.message) && 2 == e2.message.length ? e2.message[1] : t2 : "No error message";
  }
  function fr(e2, t2, n2, r2, i2) {
    let o2;
    if (me(t2) && t2.error) {
      return cr(e2, t2.error);
    }
    if (ye(t2) || ge(t2, "DOMException")) {
      const i3 = t2;
      if ("stack" in t2) o2 = cr(e2, t2);
      else {
        const t3 = i3.name || (ye(i3) ? "DOMError" : "DOMException"), a2 = i3.message ? `${t3}: ${i3.message}` : t3;
        o2 = vr(e2, a2, n2, r2), Ge(o2, a2);
      }
      return "code" in i3 && (o2.tags = { ...o2.tags, "DOMException.code": `${i3.code}` }), o2;
    }
    if (ve(t2)) return cr(e2, t2);
    if (Se(t2) || ke(t2)) {
      return o2 = sr(e2, t2, n2, i2), Qe(o2, { synthetic: true }), o2;
    }
    return o2 = vr(e2, t2, n2, r2), Ge(o2, `${t2}`, void 0), Qe(o2, { synthetic: true }), o2;
  }
  function vr(e2, t2, n2, r2) {
    const i2 = {};
    if (r2 && n2) {
      const r3 = lr(e2, n2);
      r3.length && (i2.exception = { values: [{ value: t2, stacktrace: { frames: r3 } }] }), Qe(i2, { synthetic: true });
    }
    if (_e(t2)) {
      const { __sentry_template_string__: e3, __sentry_template_values__: n3 } = t2;
      return i2.logentry = { message: e3, params: n3 }, i2;
    }
    return i2.message = t2, i2;
  }
  function gr(e2, { isUnhandledRejection: t2 }) {
    const n2 = (function(e3, t3 = 40) {
      const n3 = Object.keys(Fe(e3));
      n3.sort();
      const r3 = n3[0];
      if (!r3) return "[object has no keys]";
      if (r3.length >= t3) return Ae(r3, t3);
      for (let e4 = n3.length; e4 > 0; e4--) {
        const r4 = n3.slice(0, e4).join(", ");
        if (!(r4.length > t3)) return e4 === n3.length ? r4 : Ae(r4, t3);
      }
      return "";
    })(e2), r2 = t2 ? "promise rejection" : "exception";
    if (me(e2)) return `Event \`ErrorEvent\` captured as ${r2} with message \`${e2.message}\``;
    if (ke(e2)) {
      return `Event \`${(function(e3) {
        try {
          const t3 = Object.getPrototypeOf(e3);
          return t3 ? t3.constructor.name : void 0;
        } catch (e4) {
        }
      })(e2)}\` (type=${e2.type}) captured as ${r2}`;
    }
    return `Object captured as ${r2} with keys: ${n2}`;
  }
  var mr = class extends wn {
    constructor(e2) {
      const t2 = { parentSpanIsAlwaysRootSpan: true, ...e2 };
      !(function(e3, t3, n2 = [t3], r2 = "npm") {
        const i2 = e3._metadata || {};
        i2.sdk || (i2.sdk = { name: `sentry.javascript.${t3}`, packages: n2.map(((e4) => ({ name: `${r2}:@sentry/${e4}`, version: J }))), version: J }), e3._metadata = i2;
      })(t2, "browser", ["browser"], tr.SENTRY_SDK_SOURCE || "npm"), super(t2), t2.sendClientReports && tr.document && tr.document.addEventListener("visibilitychange", (() => {
        "hidden" === tr.document.visibilityState && this._flushOutcomes();
      }));
    }
    eventFromException(e2, t2) {
      return (function(e3, t3, n2, r2) {
        const i2 = fr(e3, t3, n2 && n2.syntheticException || void 0, r2);
        return Qe(i2), i2.level = "error", n2 && n2.event_id && (i2.event_id = n2.event_id), Xe(i2);
      })(this._options.stackParser, e2, t2, this._options.attachStacktrace);
    }
    eventFromMessage(e2, t2 = "info", n2) {
      return (function(e3, t3, n3 = "info", r2, i2) {
        const o2 = vr(e3, t3, r2 && r2.syntheticException || void 0, i2);
        return o2.level = n3, r2 && r2.event_id && (o2.event_id = r2.event_id), Xe(o2);
      })(this._options.stackParser, e2, t2, n2, this._options.attachStacktrace);
    }
    captureUserFeedback(e2) {
      if (!this._isEnabled()) return void (or && Q.warn("SDK not enabled, will not capture user feedback."));
      const t2 = (function(e3, { metadata: t3, tunnel: n2, dsn: r2 }) {
        const i2 = { event_id: e3.event_id, sent_at: (/* @__PURE__ */ new Date()).toISOString(), ...t3 && t3.sdk && { sdk: { name: t3.sdk.name, version: t3.sdk.version } }, ...!!n2 && !!r2 && { dsn: Rt(r2) } }, o2 = /* @__PURE__ */ (function(e4) {
          return [{ type: "user_report" }, e4];
        })(e3);
        return $t(i2, [o2]);
      })(e2, { metadata: this.getSdkMetadata(), dsn: this.getDsn(), tunnel: this.getOptions().tunnel });
      this.sendEnvelope(t2);
    }
    _prepareEvent(e2, t2, n2) {
      return e2.platform = e2.platform || "javascript", super._prepareEvent(e2, t2, n2);
    }
  };
  var yr = "undefined" == typeof __SENTRY_DEBUG__ || __SENTRY_DEBUG__;
  var br = $;
  var _r;
  var wr;
  var Sr;
  var kr;
  function Mr() {
    if (!br.document) return;
    const e2 = se.bind(null, "dom"), t2 = Cr(e2, true);
    br.document.addEventListener("click", t2, false), br.document.addEventListener("keypress", t2, false), ["EventTarget", "Node"].forEach(((t3) => {
      const n2 = br[t3], r2 = n2 && n2.prototype;
      r2 && r2.hasOwnProperty && r2.hasOwnProperty("addEventListener") && (Le(r2, "addEventListener", (function(t4) {
        return function(n3, r3, i2) {
          if ("click" === n3 || "keypress" == n3) try {
            const r4 = this.__sentry_instrumentation_handlers__ = this.__sentry_instrumentation_handlers__ || {}, o2 = r4[n3] = r4[n3] || { refCount: 0 };
            if (!o2.handler) {
              const r5 = Cr(e2);
              o2.handler = r5, t4.call(this, n3, r5, i2);
            }
            o2.refCount++;
          } catch (e3) {
          }
          return t4.call(this, n3, r3, i2);
        };
      })), Le(r2, "removeEventListener", (function(e3) {
        return function(t4, n3, r3) {
          if ("click" === t4 || "keypress" == t4) try {
            const n4 = this.__sentry_instrumentation_handlers__ || {}, i2 = n4[t4];
            i2 && (i2.refCount--, i2.refCount <= 0 && (e3.call(this, t4, i2.handler, r3), i2.handler = void 0, delete n4[t4]), 0 === Object.keys(n4).length && delete this.__sentry_instrumentation_handlers__);
          } catch (e4) {
          }
          return e3.call(this, t4, n3, r3);
        };
      })));
    }));
  }
  function Cr(e2, t2 = false) {
    return (n2) => {
      if (!n2 || n2._sentryCaptured) return;
      const r2 = (function(e3) {
        try {
          return e3.target;
        } catch (e4) {
          return null;
        }
      })(n2);
      if ((function(e3, t3) {
        return "keypress" === e3 && (!t3 || !t3.tagName || "INPUT" !== t3.tagName && "TEXTAREA" !== t3.tagName && !t3.isContentEditable);
      })(n2.type, r2)) return;
      De(n2, "_sentryCaptured", true), r2 && !r2._sentryId && De(r2, "_sentryId", ze());
      const i2 = "keypress" === n2.type ? "input" : n2.type;
      if (!(function(e3) {
        if (e3.type !== wr) return false;
        try {
          if (!e3.target || e3.target._sentryId !== Sr) return false;
        } catch (e4) {
        }
        return true;
      })(n2)) {
        e2({ event: n2, name: i2, global: t2 }), wr = n2.type, Sr = r2 ? r2._sentryId : void 0;
      }
      clearTimeout(_r), _r = br.setTimeout((() => {
        Sr = void 0, wr = void 0;
      }), 1e3);
    };
  }
  function Er(e2) {
    const t2 = "history";
    oe(t2, e2), ae(t2, Tr);
  }
  function Tr() {
    if (!(function() {
      const e3 = er.chrome, t3 = e3 && e3.app && e3.app.runtime, n2 = "history" in er && !!er.history.pushState && !!er.history.replaceState;
      return !t3 && n2;
    })()) return;
    const e2 = br.onpopstate;
    function t2(e3) {
      return function(...t3) {
        const n2 = t3.length > 2 ? t3[2] : void 0;
        if (n2) {
          const e4 = kr, t4 = String(n2);
          kr = t4;
          se("history", { from: e4, to: t4 });
        }
        return e3.apply(this, t3);
      };
    }
    br.onpopstate = function(...t3) {
      const n2 = br.location.href, r2 = kr;
      kr = n2;
      if (se("history", { from: r2, to: n2 }), e2) try {
        return e2.apply(this, t3);
      } catch (e3) {
      }
    }, Le(br.history, "pushState", t2), Le(br.history, "replaceState", t2);
  }
  var Or = {};
  function Pr(e2) {
    Or[e2] = void 0;
  }
  var Ar = "__sentry_xhr_v3__";
  function jr() {
    if (!br.XMLHttpRequest) return;
    const e2 = XMLHttpRequest.prototype;
    e2.open = new Proxy(e2.open, { apply(e3, t2, n2) {
      const r2 = new Error(), i2 = 1e3 * qe(), o2 = be(n2[0]) ? n2[0].toUpperCase() : void 0, a2 = (function(e4) {
        if (be(e4)) return e4;
        try {
          return e4.toString();
        } catch (e5) {
        }
        return;
      })(n2[1]);
      if (!o2 || !a2) return e3.apply(t2, n2);
      t2[Ar] = { method: o2, url: a2, request_headers: {} }, "POST" === o2 && a2.match(/sentry_key/) && (t2.__sentry_own_request__ = true);
      const s2 = () => {
        const e4 = t2[Ar];
        if (e4 && 4 === t2.readyState) {
          try {
            e4.status_code = t2.status;
          } catch (e5) {
          }
          se("xhr", { endTimestamp: 1e3 * qe(), startTimestamp: i2, xhr: t2, virtualError: r2 });
        }
      };
      return "onreadystatechange" in t2 && "function" == typeof t2.onreadystatechange ? t2.onreadystatechange = new Proxy(t2.onreadystatechange, { apply: (e4, t3, n3) => (s2(), e4.apply(t3, n3)) }) : t2.addEventListener("readystatechange", s2), t2.setRequestHeader = new Proxy(t2.setRequestHeader, { apply(e4, t3, n3) {
        const [r3, i3] = n3, o3 = t3[Ar];
        return o3 && be(r3) && be(i3) && (o3.request_headers[r3.toLowerCase()] = i3), e4.apply(t3, n3);
      } }), e3.apply(t2, n2);
    } }), e2.send = new Proxy(e2.send, { apply(e3, t2, n2) {
      const r2 = t2[Ar];
      if (!r2) return e3.apply(t2, n2);
      void 0 !== n2[0] && (r2.body = n2[0]);
      return se("xhr", { startTimestamp: 1e3 * qe(), xhr: t2 }), e3.apply(t2, n2);
    } });
  }
  function Ir(e2, t2 = (function(e3) {
    const t3 = Or[e3];
    if (t3) return t3;
    let n2 = br[e3];
    if (Qn(n2)) return Or[e3] = n2.bind(br);
    const r2 = br.document;
    if (r2 && "function" == typeof r2.createElement) try {
      const t4 = r2.createElement("iframe");
      t4.hidden = true, r2.head.appendChild(t4);
      const i2 = t4.contentWindow;
      i2 && i2[e3] && (n2 = i2[e3]), r2.head.removeChild(t4);
    } catch (t4) {
      yr && Q.warn(`Could not create sandbox iframe for ${e3} check, bailing to window.${e3}: `, t4);
    }
    return n2 ? Or[e3] = n2.bind(br) : n2;
  })("fetch")) {
    let n2 = 0, r2 = 0;
    return En(e2, (function(i2) {
      const o2 = i2.body.length;
      n2 += o2, r2++;
      const a2 = { body: i2.body, method: "POST", referrerPolicy: "origin", headers: e2.headers, keepalive: n2 <= 6e4 && r2 < 15, ...e2.fetchOptions };
      if (!t2) return Pr("fetch"), Ze("No fetch implementation available");
      try {
        return t2(e2.url, a2).then(((e3) => (n2 -= o2, r2--, { statusCode: e3.status, headers: { "x-sentry-rate-limits": e3.headers.get("X-Sentry-Rate-Limits"), "retry-after": e3.headers.get("Retry-After") } })));
      } catch (e3) {
        return Pr("fetch"), n2 -= o2, r2--, Ze(e3);
      }
    }));
  }
  function xr(e2, t2, n2, r2) {
    const i2 = { filename: e2, function: "<anonymous>" === t2 ? K : t2, in_app: true };
    return void 0 !== n2 && (i2.lineno = n2), void 0 !== r2 && (i2.colno = r2), i2;
  }
  var Lr = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i;
  var Dr = /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
  var Nr = /\((\S*)(?::(\d+))(?::(\d+))\)/;
  var Rr = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;
  var Fr = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
  var Br = (function(...e2) {
    const t2 = e2.sort(((e3, t3) => e3[0] - t3[0])).map(((e3) => e3[1]));
    return (e3, n2 = 0, r2 = 0) => {
      const i2 = [], o2 = e3.split("\n");
      for (let e4 = n2; e4 < o2.length; e4++) {
        const n3 = o2[e4];
        if (n3.length > 1024) continue;
        const a2 = Y.test(n3) ? n3.replace(Y, "$1") : n3;
        if (!a2.match(/\S*Error: /)) {
          for (const e5 of t2) {
            const t3 = e5(a2);
            if (t3) {
              i2.push(t3);
              break;
            }
          }
          if (i2.length >= 50 + r2) break;
        }
      }
      return (function(e4) {
        if (!e4.length) return [];
        const t3 = Array.from(e4);
        /sentryWrapped/.test(Z(t3).function || "") && t3.pop();
        t3.reverse(), X.test(Z(t3).function || "") && (t3.pop(), X.test(Z(t3).function || "") && t3.pop());
        return t3.slice(0, 50).map(((e5) => ({ ...e5, filename: e5.filename || Z(t3).filename, function: e5.function || K })));
      })(i2.slice(r2));
    };
  })(...[[30, (e2) => {
    const t2 = Lr.exec(e2);
    if (t2) {
      const [, e3, n3, r2] = t2;
      return xr(e3, K, +n3, +r2);
    }
    const n2 = Dr.exec(e2);
    if (n2) {
      if (n2[2] && 0 === n2[2].indexOf("eval")) {
        const e4 = Nr.exec(n2[2]);
        e4 && (n2[2] = e4[1], n2[3] = e4[2], n2[4] = e4[3]);
      }
      const [e3, t3] = Ur(n2[1] || K, n2[2]);
      return xr(t3, e3, n2[3] ? +n2[3] : void 0, n2[4] ? +n2[4] : void 0);
    }
  }], [50, (e2) => {
    const t2 = Rr.exec(e2);
    if (t2) {
      if (t2[3] && t2[3].indexOf(" > eval") > -1) {
        const e4 = Fr.exec(t2[3]);
        e4 && (t2[1] = t2[1] || "eval", t2[3] = e4[1], t2[4] = e4[2], t2[5] = "");
      }
      let e3 = t2[3], n2 = t2[1] || K;
      return [n2, e3] = Ur(n2, e3), xr(e3, n2, t2[4] ? +t2[4] : void 0, t2[5] ? +t2[5] : void 0);
    }
  }]]);
  var Ur = (e2, t2) => {
    const n2 = -1 !== e2.indexOf("safari-extension"), r2 = -1 !== e2.indexOf("safari-web-extension");
    return n2 || r2 ? [-1 !== e2.indexOf("@") ? e2.split("@")[0] : K, n2 ? `safari-extension:${t2}` : `safari-web-extension:${t2}`] : [e2, t2];
  };
  var Vr = 1024;
  var Jr = (e2 = {}) => {
    const t2 = { console: true, dom: true, fetch: true, history: true, sentry: true, xhr: true, ...e2 };
    return { name: "Breadcrumbs", setup(e3) {
      var n2;
      t2.console && (function(e4) {
        const t3 = "console";
        oe(t3, e4), ae(t3, Vn);
      })(/* @__PURE__ */ (function(e4) {
        return function(t3) {
          if (bt() !== e4) return;
          const n3 = { category: "console", data: { arguments: t3.args, logger: "console" }, level: Jn(t3.level), message: je(t3.args, " ") };
          if ("assert" === t3.level) {
            if (false !== t3.args[0]) return;
            n3.message = `Assertion failed: ${je(t3.args.slice(1), " ") || "console.assert"}`, n3.data.arguments = t3.args.slice(1);
          }
          Pn(n3, { input: t3.args, level: t3.level });
        };
      })(e3)), t2.dom && (n2 = /* @__PURE__ */ (function(e4, t3) {
        return function(n3) {
          if (bt() !== e4) return;
          let r2, i2, o2 = "object" == typeof t3 ? t3.serializeAttribute : void 0, a2 = "object" == typeof t3 && "number" == typeof t3.maxStringLength ? t3.maxStringLength : void 0;
          a2 && a2 > Vr && (or && Q.warn(`\`dom.maxStringLength\` cannot exceed 1024, but a value of ${a2} was configured. Sentry will use 1024 instead.`), a2 = Vr), "string" == typeof o2 && (o2 = [o2]);
          try {
            const e5 = n3.event, t4 = (function(e6) {
              return !!e6 && !!e6.target;
            })(e5) ? e5.target : e5;
            r2 = Oe(t4, { keyAttrs: o2, maxStringLength: a2 }), i2 = (function(e6) {
              if (!Te.HTMLElement) return null;
              let t5 = e6;
              for (let e7 = 0; e7 < 5; e7++) {
                if (!t5) return null;
                if (t5 instanceof HTMLElement) {
                  if (t5.dataset.sentryComponent) return t5.dataset.sentryComponent;
                  if (t5.dataset.sentryElement) return t5.dataset.sentryElement;
                }
                t5 = t5.parentNode;
              }
              return null;
            })(t4);
          } catch (e5) {
            r2 = "<unknown>";
          }
          if (0 === r2.length) return;
          const s2 = { category: `ui.${n3.name}`, message: r2 };
          i2 && (s2.data = { "ui.component_name": i2 }), Pn(s2, { event: n3.event, name: n3.name, global: n3.global });
        };
      })(e3, t2.dom), oe("dom", n2), ae("dom", Mr)), t2.xhr && (function(e4) {
        oe("xhr", e4), ae("xhr", jr);
      })(/* @__PURE__ */ (function(e4) {
        return function(t3) {
          if (bt() !== e4) return;
          const { startTimestamp: n3, endTimestamp: r2 } = t3, i2 = t3.xhr[Ar];
          if (!n3 || !r2 || !i2) return;
          const { method: o2, url: a2, status_code: s2, body: c2 } = i2, l2 = { method: o2, url: a2, status_code: s2 }, u2 = { xhr: t3.xhr, input: c2, startTimestamp: n3, endTimestamp: r2 };
          Pn({ category: "xhr", data: l2, type: "http", level: Hn(s2) }, u2);
        };
      })(e3)), t2.fetch && Yn(/* @__PURE__ */ (function(e4) {
        return function(t3) {
          if (bt() !== e4) return;
          const { startTimestamp: n3, endTimestamp: r2 } = t3;
          if (r2 && (!t3.fetchData.url.match(/sentry_key/) || "POST" !== t3.fetchData.method)) if (t3.error) {
            Pn({ category: "fetch", data: t3.fetchData, level: "error", type: "http" }, { data: t3.error, input: t3.args, startTimestamp: n3, endTimestamp: r2 });
          } else {
            const e5 = t3.response, i2 = { ...t3.fetchData, status_code: e5 && e5.status }, o2 = { input: t3.args, response: e5, startTimestamp: n3, endTimestamp: r2 };
            Pn({ category: "fetch", data: i2, type: "http", level: Hn(i2.status_code) }, o2);
          }
        };
      })(e3)), t2.history && Er(/* @__PURE__ */ (function(e4) {
        return function(t3) {
          if (bt() !== e4) return;
          let n3 = t3.from, r2 = t3.to;
          const i2 = Un(tr.location.href);
          let o2 = n3 ? Un(n3) : void 0;
          const a2 = Un(r2);
          o2 && o2.path || (o2 = i2), i2.protocol === a2.protocol && i2.host === a2.host && (r2 = a2.relative), i2.protocol === o2.protocol && i2.host === o2.host && (n3 = o2.relative), Pn({ category: "navigation", data: { from: n3, to: r2 } });
        };
      })(e3)), t2.sentry && e3.on("beforeSendEvent", /* @__PURE__ */ (function(e4) {
        return function(t3) {
          bt() === e4 && Pn({ category: "sentry." + ("transaction" === t3.type ? "transaction" : "event"), event_id: t3.event_id, level: t3.level, message: He(t3) }, { event: t3 });
        };
      })(e3));
    } };
  };
  var $r = ["EventTarget", "Window", "Node", "ApplicationCache", "AudioTrackList", "BroadcastChannel", "ChannelMergerNode", "CryptoOperation", "EventSource", "FileReader", "HTMLUnknownElement", "IDBDatabase", "IDBRequest", "IDBTransaction", "KeyOperation", "MediaController", "MessagePort", "ModalWindow", "Notification", "SVGElementInstance", "Screen", "SharedWorker", "TextTrack", "TextTrackCue", "TextTrackList", "WebSocket", "WebSocketWorker", "Worker", "XMLHttpRequest", "XMLHttpRequestEventTarget", "XMLHttpRequestUpload"];
  var qr = (e2 = {}) => {
    const t2 = { XMLHttpRequest: true, eventTarget: true, requestAnimationFrame: true, setInterval: true, setTimeout: true, ...e2 };
    return { name: "BrowserApiErrors", setupOnce() {
      t2.setTimeout && Le(tr, "setTimeout", zr), t2.setInterval && Le(tr, "setInterval", zr), t2.requestAnimationFrame && Le(tr, "requestAnimationFrame", Wr), t2.XMLHttpRequest && "XMLHttpRequest" in tr && Le(XMLHttpRequest.prototype, "send", Hr);
      const e3 = t2.eventTarget;
      if (e3) {
        (Array.isArray(e3) ? e3 : $r).forEach(Gr);
      }
    } };
  };
  function zr(e2) {
    return function(...t2) {
      const n2 = t2[0];
      return t2[0] = ir(n2, { mechanism: { data: { function: te(e2) }, handled: false, type: "instrument" } }), e2.apply(this, t2);
    };
  }
  function Wr(e2) {
    return function(t2) {
      return e2.apply(this, [ir(t2, { mechanism: { data: { function: "requestAnimationFrame", handler: te(e2) }, handled: false, type: "instrument" } })]);
    };
  }
  function Hr(e2) {
    return function(...t2) {
      const n2 = this;
      return ["onload", "onerror", "onprogress", "onreadystatechange"].forEach(((e3) => {
        e3 in n2 && "function" == typeof n2[e3] && Le(n2, e3, (function(t3) {
          const n3 = { mechanism: { data: { function: e3, handler: te(t3) }, handled: false, type: "instrument" } }, r2 = Re(t3);
          return r2 && (n3.mechanism.data.handler = te(r2)), ir(t3, n3);
        }));
      })), e2.apply(this, t2);
    };
  }
  function Gr(e2) {
    const t2 = tr[e2], n2 = t2 && t2.prototype;
    n2 && n2.hasOwnProperty && n2.hasOwnProperty("addEventListener") && (Le(n2, "addEventListener", (function(t3) {
      return function(n3, r2, i2) {
        try {
          "function" == typeof r2.handleEvent && (r2.handleEvent = ir(r2.handleEvent, { mechanism: { data: { function: "handleEvent", handler: te(r2), target: e2 }, handled: false, type: "instrument" } }));
        } catch (e3) {
        }
        return t3.apply(this, [n3, ir(r2, { mechanism: { data: { function: "addEventListener", handler: te(r2), target: e2 }, handled: false, type: "instrument" } }), i2]);
      };
    })), Le(n2, "removeEventListener", (function(e3) {
      return function(t3, n3, r2) {
        try {
          const i2 = n3.__sentry_wrapped__;
          i2 && e3.call(this, t3, i2, r2);
        } catch (e4) {
        }
        return e3.call(this, t3, n3, r2);
      };
    })));
  }
  var Qr = () => ({ name: "BrowserSession", setupOnce() {
    void 0 !== tr.document ? (dn({ ignoreDuration: true }), fn(), Er((({ from: e2, to: t2 }) => {
      void 0 !== e2 && e2 !== t2 && (dn({ ignoreDuration: true }), fn());
    }))) : or && Q.warn("Using the `browserSessionIntegration` in non-browser environments is not supported.");
  } });
  var Kr = (e2 = {}) => {
    const t2 = { onerror: true, onunhandledrejection: true, ...e2 };
    return { name: "GlobalHandlers", setupOnce() {
      Error.stackTraceLimit = 50;
    }, setup(e3) {
      t2.onerror && (!(function(e4) {
        !(function(e5) {
          const t3 = "error";
          oe(t3, e5), ae(t3, le);
        })(((t3) => {
          const { stackParser: n2, attachStacktrace: r2 } = Xr();
          if (bt() !== e4 || rr()) return;
          const { msg: i2, url: o2, line: a2, column: s2, error: c2 } = t3, l2 = (function(e5, t4, n3, r3) {
            const i3 = e5.exception = e5.exception || {}, o3 = i3.values = i3.values || [], a3 = o3[0] = o3[0] || {}, s3 = a3.stacktrace = a3.stacktrace || {}, c3 = s3.frames = s3.frames || [], l3 = r3, u2 = n3, d2 = be(t4) && t4.length > 0 ? t4 : (function() {
              try {
                return Te.document.location.href;
              } catch (e6) {
                return "";
              }
            })();
            0 === c3.length && c3.push({ colno: l3, filename: d2, function: K, in_app: true, lineno: u2 });
            return e5;
          })(fr(n2, c2 || i2, void 0, r2, false), o2, a2, s2);
          l2.level = "error", un(l2, { originalException: c2, mechanism: { handled: false, type: "onerror" } });
        }));
      })(e3), Yr("onerror")), t2.onunhandledrejection && (!(function(e4) {
        !(function(e5) {
          const t3 = "unhandledrejection";
          oe(t3, e5), ae(t3, de);
        })(((t3) => {
          const { stackParser: n2, attachStacktrace: r2 } = Xr();
          if (bt() !== e4 || rr()) return;
          const i2 = (function(e5) {
            if (we(e5)) return e5;
            try {
              if ("reason" in e5) return e5.reason;
              if ("detail" in e5 && "reason" in e5.detail) return e5.detail.reason;
            } catch (e6) {
            }
            return e5;
          })(t3), o2 = we(i2) ? { exception: { values: [{ type: "UnhandledRejection", value: `Non-Error promise rejection captured with value: ${String(i2)}` }] } } : fr(n2, i2, void 0, r2, true);
          o2.level = "error", un(o2, { originalException: i2, mechanism: { handled: false, type: "onunhandledrejection" } });
        }));
      })(e3), Yr("onunhandledrejection"));
    } };
  };
  function Yr(e2) {
    or && Q.log(`Global Handler attached: ${e2}`);
  }
  function Xr() {
    const e2 = bt();
    return e2 && e2.getOptions() || { stackParser: () => [], attachStacktrace: false };
  }
  var Zr = () => ({ name: "HttpContext", preprocessEvent(e2) {
    if (!tr.navigator && !tr.location && !tr.document) return;
    const t2 = e2.request && e2.request.url || tr.location && tr.location.href, { referrer: n2 } = tr.document || {}, { userAgent: r2 } = tr.navigator || {}, i2 = { ...e2.request && e2.request.headers, ...n2 && { Referer: n2 }, ...r2 && { "User-Agent": r2 } }, o2 = { ...e2.request, ...t2 && { url: t2 }, headers: i2 };
    e2.request = o2;
  } });
  var ei = (e2 = {}) => {
    const t2 = e2.limit || 5, n2 = e2.key || "cause";
    return { name: "LinkedErrors", preprocessEvent(e3, r2, i2) {
      const o2 = i2.getOptions();
      Nn(ar, o2.stackParser, o2.maxValueLength, n2, t2, e3, r2);
    } };
  };
  var ti = "new";
  var ni = "loading";
  var ri = "loaded";
  var ii = "joining-meeting";
  var oi = "joined-meeting";
  var ai = "left-meeting";
  var si = "error";
  var hi = "playable";
  var fi = "unknown";
  var vi = "full";
  var yi = "base";
  var Ci = "no-room";
  var Ti = "end-of-life";
  var Pi = "connection-error";
  var Fi = "iframe-ready-for-launch-config";
  var Bi = "iframe-launch-config";
  var Ui = "theme-updated";
  var Vi = "loading";
  var Ji = "load-attempt-failed";
  var $i = "loaded";
  var qi = "started-camera";
  var zi = "camera-error";
  var Wi = "joining-meeting";
  var Hi = "joined-meeting";
  var Gi = "left-meeting";
  var Qi = "participant-joined";
  var Ki = "participant-updated";
  var Yi = "participant-left";
  var Xi = "participant-counts-updated";
  var Zi = "access-state-updated";
  var eo = "meeting-session-summary-updated";
  var to = "meeting-session-state-updated";
  var ro = "waiting-participant-added";
  var io = "waiting-participant-updated";
  var oo = "waiting-participant-removed";
  var ao = "track-started";
  var so = "track-stopped";
  var co = "transcription-started";
  var lo = "transcription-stopped";
  var uo = "transcription-error";
  var po = "recording-started";
  var ho = "recording-stopped";
  var fo = "recording-stats";
  var vo = "recording-error";
  var go = "recording-upload-completed";
  var mo = "recording-data";
  var yo = "app-message";
  var bo = "transcription-message";
  var _o = "remote-media-player-started";
  var wo = "remote-media-player-updated";
  var So = "remote-media-player-stopped";
  var ko = "local-screen-share-started";
  var Mo = "local-screen-share-stopped";
  var Co = "local-screen-share-canceled";
  var Eo = "active-speaker-change";
  var To = "active-speaker-mode-change";
  var Oo = "network-quality-change";
  var Po = "network-connection";
  var Ao = "cpu-load-change";
  var jo = "face-counts-updated";
  var Io = "fullscreen";
  var xo = "exited-fullscreen";
  var Lo = "live-streaming-started";
  var Do = "live-streaming-updated";
  var No = "live-streaming-stopped";
  var Ro = "live-streaming-error";
  var Fo = "lang-updated";
  var Bo = "receive-settings-updated";
  var Uo = "input-settings-updated";
  var Vo = "nonfatal-error";
  var Jo = "error";
  var $o = 4096;
  var qo = 102400;
  var zo = "iframe-call-message";
  var Wo = "local-screen-start";
  var Ho = "daily-method-update-live-streaming-endpoints";
  var Go = "transmit-log";
  var Qo = "daily-custom-track";
  var Ko = { NONE: "none", BGBLUR: "background-blur", BGIMAGE: "background-image", FACE_DETECTION: "face-detection" };
  var Yo = { NONE: "none", NOISE_CANCELLATION: "noise-cancellation" };
  var Xo = { PLAY: "play", PAUSE: "pause" };
  var Zo = ["jpg", "png", "jpeg"];
  var ea = "add-endpoints";
  var ta = "remove-endpoints";
  var na = "sip-call-transfer";
  function ra() {
    return !ia() && "undefined" != typeof window && window.navigator && window.navigator.userAgent ? window.navigator.userAgent : "";
  }
  function ia() {
    return "undefined" != typeof navigator && navigator.product && "ReactNative" === navigator.product;
  }
  function oa() {
    return navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }
  function aa() {
    return !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && ((function(e2, t2) {
      if (!e2 || !t2) return true;
      switch (e2) {
        case "Chrome":
          return t2.major >= 75;
        case "Safari":
          return RTCRtpTransceiver.prototype.hasOwnProperty("currentDirection") && !(13 === t2.major && 0 === t2.minor && 0 === t2.point);
        case "Firefox":
          return t2.major >= 67;
      }
      return true;
    })(ma(), ya()) || ia());
  }
  function sa() {
    if (ia()) return false;
    if (!document) return false;
    var e2 = document.createElement("iframe");
    return !!e2.requestFullscreen || !!e2.webkitRequestFullscreen;
  }
  var ca = "none";
  var la = "software";
  var ua = "hardware";
  var da = (function() {
    try {
      var e2, t2 = document.createElement("canvas"), n2 = false;
      (e2 = t2.getContext("webgl2", { failIfMajorPerformanceCaveat: true })) || (n2 = true, e2 = t2.getContext("webgl2"));
      var r2 = null != e2;
      return t2.remove(), r2 ? n2 ? la : ua : ca;
    } catch (e3) {
      return ca;
    }
  })();
  function pa() {
    var e2 = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
    return !ia() && (da !== ca && (e2 ? (function() {
      if (ga()) return false;
      return ["Chrome", "Firefox"].includes(ma());
    })() : (function() {
      if (ga()) return false;
      var e3 = ma();
      if ("Safari" === e3) {
        var t2 = Sa();
        if (t2.major < 15 || 15 === t2.major && t2.minor < 4) return false;
      }
      if ("Chrome" === e3) {
        return ba().major >= 77;
      }
      if ("Firefox" === e3) {
        return ka().major >= 97;
      }
      return ["Chrome", "Firefox", "Safari"].includes(e3);
    })()));
  }
  function ha() {
    if (ia()) return false;
    if (va()) return false;
    if ("undefined" == typeof AudioWorkletNode) return false;
    switch (ma()) {
      case "Chrome":
      case "Firefox":
        return true;
      case "Safari":
        var e2 = ya();
        return e2.major > 17 || 17 === e2.major && e2.minor >= 4;
    }
    return false;
  }
  function fa() {
    return oa() && "undefined" != typeof MediaStreamTrack && !(function() {
      var e2, t2 = ma();
      if (!ra()) return true;
      switch (t2) {
        case "Chrome":
          return (e2 = ba()).major && e2.major > 0 && e2.major < 75;
        case "Firefox":
          return (e2 = ka()).major < 91;
        case "Safari":
          return (e2 = Sa()).major < 13 || 13 === e2.major && e2.minor < 1;
        default:
          return true;
      }
    })();
  }
  function va() {
    return ra().match(/Linux; Android/);
  }
  function ga() {
    var e2, t2 = ra(), n2 = t2.match(/Mac/) && (!ia() && "undefined" != typeof window && null !== (e2 = window) && void 0 !== e2 && null !== (e2 = e2.navigator) && void 0 !== e2 && e2.maxTouchPoints ? window.navigator.maxTouchPoints : 0) >= 5;
    return !!(t2.match(/Mobi/) || t2.match(/Android/) || n2) || (!!ra().match(/DailyAnd\//) || void 0);
  }
  function ma() {
    if ("undefined" != typeof window) {
      var e2 = ra();
      return _a() ? "Safari" : e2.indexOf("Edge") > -1 ? "Edge" : e2.match(/Chrome\//) ? "Chrome" : e2.indexOf("Safari") > -1 || wa() ? "Safari" : e2.indexOf("Firefox") > -1 ? "Firefox" : e2.indexOf("MSIE") > -1 || e2.indexOf(".NET") > -1 ? "IE" : "Unknown Browser";
    }
  }
  function ya() {
    switch (ma()) {
      case "Chrome":
        return ba();
      case "Safari":
        return Sa();
      case "Firefox":
        return ka();
      case "Edge":
        return (function() {
          var e2 = 0, t2 = 0;
          if ("undefined" != typeof window) {
            var n2 = ra().match(/Edge\/(\d+).(\d+)/);
            if (n2) try {
              e2 = parseInt(n2[1]), t2 = parseInt(n2[2]);
            } catch (e3) {
            }
          }
          return { major: e2, minor: t2 };
        })();
    }
  }
  function ba() {
    var e2 = 0, t2 = 0, n2 = 0, r2 = 0, i2 = false;
    if ("undefined" != typeof window) {
      var o2 = ra(), a2 = o2.match(/Chrome\/(\d+).(\d+).(\d+).(\d+)/);
      if (a2) try {
        e2 = parseInt(a2[1]), t2 = parseInt(a2[2]), n2 = parseInt(a2[3]), r2 = parseInt(a2[4]), i2 = o2.indexOf("OPR/") > -1;
      } catch (e3) {
      }
    }
    return { major: e2, minor: t2, build: n2, patch: r2, opera: i2 };
  }
  function _a() {
    return !!ra().match(/iPad|iPhone|iPod/i) && oa();
  }
  function wa() {
    return ra().indexOf("AppleWebKit/605.1.15") > -1;
  }
  function Sa() {
    var e2 = 0, t2 = 0, n2 = 0;
    if ("undefined" != typeof window) {
      var r2 = ra().match(/Version\/(\d+).(\d+)(.(\d+))?/);
      if (r2) try {
        e2 = parseInt(r2[1]), t2 = parseInt(r2[2]), n2 = parseInt(r2[4]);
      } catch (e3) {
      }
      else (_a() || wa()) && (e2 = 14, t2 = 0, n2 = 3);
    }
    return { major: e2, minor: t2, point: n2 };
  }
  function ka() {
    var e2 = 0, t2 = 0;
    if ("undefined" != typeof window) {
      var n2 = ra().match(/Firefox\/(\d+).(\d+)/);
      if (n2) try {
        e2 = parseInt(n2[1]), t2 = parseInt(n2[2]);
      } catch (e3) {
      }
    }
    return { major: e2, minor: t2 };
  }
  var Ma = (function() {
    return o((function e2() {
      t(this, e2);
    }), [{ key: "addListenerForMessagesFromCallMachine", value: function(e2, t2, n2) {
      R();
    } }, { key: "addListenerForMessagesFromDailyJs", value: function(e2, t2, n2) {
      R();
    } }, { key: "sendMessageToCallMachine", value: function(e2, t2, n2, r2) {
      R();
    } }, { key: "sendMessageToDailyJs", value: function(e2, t2) {
      R();
    } }, { key: "removeListener", value: function(e2) {
      R();
    } }]);
  })();
  function Ca(e2, t2) {
    var n2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var r2 = Object.getOwnPropertySymbols(e2);
      t2 && (r2 = r2.filter((function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      }))), n2.push.apply(n2, r2);
    }
    return n2;
  }
  function Ea(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = null != arguments[t2] ? arguments[t2] : {};
      t2 % 2 ? Ca(Object(n2), true).forEach((function(t3) {
        u(e2, t3, n2[t3]);
      })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : Ca(Object(n2)).forEach((function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      }));
    }
    return e2;
  }
  function Ta() {
    try {
      var e2 = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
      })));
    } catch (e3) {
    }
    return (Ta = function() {
      return !!e2;
    })();
  }
  var Oa = (function() {
    function e2() {
      var n2, r2, i2, o2;
      return t(this, e2), r2 = this, i2 = s(i2 = e2), (n2 = a(r2, Ta() ? Reflect.construct(i2, o2 || [], s(r2).constructor) : i2.apply(r2, o2)))._wrappedListeners = {}, n2._messageCallbacks = {}, n2;
    }
    return l(e2, Ma), o(e2, [{ key: "addListenerForMessagesFromCallMachine", value: function(e3, t2, n2) {
      var r2 = this, i2 = function(i3) {
        if (i3.data && "iframe-call-message" === i3.data.what && (!i3.data.callClientId || i3.data.callClientId === t2) && (!i3.data.from || "module" !== i3.data.from)) {
          var o2 = Ea({}, i3.data);
          if (delete o2.from, o2.callbackStamp && r2._messageCallbacks[o2.callbackStamp]) {
            var a2 = o2.callbackStamp;
            r2._messageCallbacks[a2].call(n2, o2), delete r2._messageCallbacks[a2];
          }
          delete o2.what, delete o2.callbackStamp, e3.call(n2, o2);
        }
      };
      this._wrappedListeners[e3] = i2, window.addEventListener("message", i2);
    } }, { key: "addListenerForMessagesFromDailyJs", value: function(e3, t2, n2) {
      var r2 = function(r3) {
        var i2;
        if (!(!r3.data || r3.data.what !== zo || !r3.data.action || r3.data.from && "module" !== r3.data.from || r3.data.callClientId && t2 && r3.data.callClientId !== t2 || null != r3 && null !== (i2 = r3.data) && void 0 !== i2 && i2.callFrameId)) {
          var o2 = r3.data;
          e3.call(n2, o2);
        }
      };
      this._wrappedListeners[e3] = r2, window.addEventListener("message", r2);
    } }, { key: "sendMessageToCallMachine", value: function(e3, t2, n2, r2) {
      if (!n2) throw new Error("undefined callClientId. Are you trying to use a DailyCall instance previously destroyed?");
      var i2 = Ea({}, e3);
      if (i2.what = zo, i2.from = "module", i2.callClientId = n2, t2) {
        var o2 = N();
        this._messageCallbacks[o2] = t2, i2.callbackStamp = o2;
      }
      var a2 = r2 ? r2.contentWindow : window, s2 = this._callMachineTargetOrigin(r2);
      s2 && a2.postMessage(i2, s2);
    } }, { key: "sendMessageToDailyJs", value: function(e3, t2) {
      e3.what = zo, e3.callClientId = t2, e3.from = "embedded", window.postMessage(e3, this._targetOriginFromWindowLocation());
    } }, { key: "removeListener", value: function(e3) {
      var t2 = this._wrappedListeners[e3];
      t2 && (window.removeEventListener("message", t2), delete this._wrappedListeners[e3]);
    } }, { key: "forwardPackagedMessageToCallMachine", value: function(e3, t2, n2) {
      var r2 = Ea({}, e3);
      r2.callClientId = n2;
      var i2 = t2 ? t2.contentWindow : window, o2 = this._callMachineTargetOrigin(t2);
      o2 && i2.postMessage(r2, o2);
    } }, { key: "addListenerForPackagedMessagesFromCallMachine", value: function(e3, t2) {
      var n2 = function(n3) {
        if (n3.data && "iframe-call-message" === n3.data.what && (!n3.data.callClientId || n3.data.callClientId === t2) && (!n3.data.from || "module" !== n3.data.from)) {
          var r2 = n3.data;
          e3(r2);
        }
      };
      return this._wrappedListeners[e3] = n2, window.addEventListener("message", n2), e3;
    } }, { key: "removeListenerForPackagedMessagesFromCallMachine", value: function(e3) {
      var t2 = this._wrappedListeners[e3];
      t2 && (window.removeEventListener("message", t2), delete this._wrappedListeners[e3]);
    } }, { key: "_callMachineTargetOrigin", value: function(e3) {
      return e3 ? e3.src ? new URL(e3.src).origin : void 0 : this._targetOriginFromWindowLocation();
    } }, { key: "_targetOriginFromWindowLocation", value: function() {
      return "file:" === window.location.protocol ? "*" : window.location.origin;
    } }]);
  })();
  function Pa(e2, t2) {
    var n2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var r2 = Object.getOwnPropertySymbols(e2);
      t2 && (r2 = r2.filter((function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      }))), n2.push.apply(n2, r2);
    }
    return n2;
  }
  function Aa() {
    try {
      var e2 = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
      })));
    } catch (e3) {
    }
    return (Aa = function() {
      return !!e2;
    })();
  }
  var ja = (function() {
    function e2() {
      var n2, r2, i2, o2;
      return t(this, e2), r2 = this, i2 = s(i2 = e2), n2 = a(r2, Aa() ? Reflect.construct(i2, o2 || [], s(r2).constructor) : i2.apply(r2, o2)), global.callMachineToDailyJsEmitter = global.callMachineToDailyJsEmitter || new y.EventEmitter(), global.dailyJsToCallMachineEmitter = global.dailyJsToCallMachineEmitter || new y.EventEmitter(), n2._wrappedListeners = {}, n2._messageCallbacks = {}, n2;
    }
    return l(e2, Ma), o(e2, [{ key: "addListenerForMessagesFromCallMachine", value: function(e3, t2, n2) {
      this._addListener(e3, global.callMachineToDailyJsEmitter, t2, n2, "received call machine message");
    } }, { key: "addListenerForMessagesFromDailyJs", value: function(e3, t2, n2) {
      this._addListener(e3, global.dailyJsToCallMachineEmitter, t2, n2, "received daily-js message");
    } }, { key: "sendMessageToCallMachine", value: function(e3, t2, n2) {
      this._sendMessage(e3, global.dailyJsToCallMachineEmitter, n2, t2, "sending message to call machine");
    } }, { key: "sendMessageToDailyJs", value: function(e3, t2) {
      this._sendMessage(e3, global.callMachineToDailyJsEmitter, t2, null, "sending message to daily-js");
    } }, { key: "removeListener", value: function(e3) {
      var t2 = this._wrappedListeners[e3];
      t2 && (global.callMachineToDailyJsEmitter.removeListener("message", t2), global.dailyJsToCallMachineEmitter.removeListener("message", t2), delete this._wrappedListeners[e3]);
    } }, { key: "_addListener", value: function(e3, t2, n2, r2, i2) {
      var o2 = this, a2 = function(t3) {
        if (t3.callClientId === n2) {
          if (t3.callbackStamp && o2._messageCallbacks[t3.callbackStamp]) {
            var i3 = t3.callbackStamp;
            o2._messageCallbacks[i3].call(r2, t3), delete o2._messageCallbacks[i3];
          }
          e3.call(r2, t3);
        }
      };
      this._wrappedListeners[e3] = a2, t2.addListener("message", a2);
    } }, { key: "_sendMessage", value: function(e3, t2, n2, r2, i2) {
      var o2 = (function(e4) {
        for (var t3 = 1; t3 < arguments.length; t3++) {
          var n3 = null != arguments[t3] ? arguments[t3] : {};
          t3 % 2 ? Pa(Object(n3), true).forEach((function(t4) {
            u(e4, t4, n3[t4]);
          })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e4, Object.getOwnPropertyDescriptors(n3)) : Pa(Object(n3)).forEach((function(t4) {
            Object.defineProperty(e4, t4, Object.getOwnPropertyDescriptor(n3, t4));
          }));
        }
        return e4;
      })({}, e3);
      if (o2.callClientId = n2, r2) {
        var a2 = N();
        this._messageCallbacks[a2] = r2, o2.callbackStamp = a2;
      }
      t2.emit("message", o2);
    } }]);
  })();
  var Ia = "replace";
  var xa = "shallow-merge";
  var La = [Ia, xa];
  var Da = (function() {
    function e2() {
      var n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, r2 = n2.data, i2 = n2.mergeStrategy, o2 = void 0 === i2 ? Ia : i2;
      t(this, e2), e2._validateMergeStrategy(o2), e2._validateData(r2, o2), this.mergeStrategy = o2, this.data = r2;
    }
    return o(e2, [{ key: "isNoOp", value: function() {
      return e2.isNoOpUpdate(this.data, this.mergeStrategy);
    } }], [{ key: "isNoOpUpdate", value: function(e3, t2) {
      return 0 === Object.keys(e3).length && t2 === xa;
    } }, { key: "_validateMergeStrategy", value: function(e3) {
      if (!La.includes(e3)) throw Error("Unrecognized mergeStrategy provided. Options are: [".concat(La, "]"));
    } }, { key: "_validateData", value: function(e3, t2) {
      if (!(function(e4) {
        if (null == e4 || "object" !== n(e4)) return false;
        var t3 = Object.getPrototypeOf(e4);
        return null == t3 || t3 === Object.prototype;
      })(e3)) throw Error("Meeting session data must be a plain (map-like) object");
      var r2;
      try {
        if (r2 = JSON.stringify(e3), t2 === Ia) {
          var i2 = JSON.parse(r2);
          S(i2, e3) || console.warn("The meeting session data provided will be modified when serialized.", i2, e3);
        } else if (t2 === xa) {
          for (var o2 in e3) if (Object.hasOwnProperty.call(e3, o2) && void 0 !== e3[o2]) {
            var a2 = JSON.parse(JSON.stringify(e3[o2]));
            S(e3[o2], a2) || console.warn("At least one key in the meeting session data provided will be modified when serialized.", a2, e3[o2]);
          }
        }
      } catch (e4) {
        throw Error("Meeting session data must be serializable to JSON: ".concat(e4));
      }
      if (r2.length > qo) throw Error("Meeting session data is too large (".concat(r2.length, " characters). Maximum size suppported is ").concat(qo, "."));
    } }]);
  })();
  function Na() {
    try {
      var e2 = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
      })));
    } catch (e3) {
    }
    return (Na = function() {
      return !!e2;
    })();
  }
  function Ra(e2) {
    var t2 = "function" == typeof Map ? /* @__PURE__ */ new Map() : void 0;
    return Ra = function(e3) {
      if (null === e3 || !(function(e4) {
        try {
          return -1 !== Function.toString.call(e4).indexOf("[native code]");
        } catch (t3) {
          return "function" == typeof e4;
        }
      })(e3)) return e3;
      if ("function" != typeof e3) throw new TypeError("Super expression must either be null or a function");
      if (void 0 !== t2) {
        if (t2.has(e3)) return t2.get(e3);
        t2.set(e3, n2);
      }
      function n2() {
        return (function(e4, t3, n3) {
          if (Na()) return Reflect.construct.apply(null, arguments);
          var r2 = [null];
          r2.push.apply(r2, t3);
          var i2 = new (e4.bind.apply(e4, r2))();
          return n3 && c(i2, n3.prototype), i2;
        })(e3, arguments, s(this).constructor);
      }
      return n2.prototype = Object.create(e3.prototype, { constructor: { value: n2, enumerable: false, writable: true, configurable: true } }), c(n2, e3);
    }, Ra(e2);
  }
  function Fa() {
    try {
      var e2 = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
      })));
    } catch (e3) {
    }
    return (Fa = function() {
      return !!e2;
    })();
  }
  function Ba(e2) {
    var t2, n2 = null === (t2 = window._daily) || void 0 === t2 ? void 0 : t2.pendings;
    if (n2) {
      var r2 = n2.indexOf(e2);
      -1 !== r2 && n2.splice(r2, 1);
    }
  }
  var Ua = (function() {
    return o((function e2(n2) {
      t(this, e2), this._currentLoad = null, this._callClientId = n2, this._publicPath = null;
    }), [{ key: "load", value: function() {
      var e2, t2 = this, n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, r2 = arguments.length > 1 ? arguments[1] : void 0, i2 = arguments.length > 2 ? arguments[2] : void 0;
      if (this.loaded) return window._daily.instances[this._callClientId].callMachine.reset(), window._daily.instances[this._callClientId].publicPath = this._publicPath, void r2(true);
      e2 = this._callClientId, window._daily.pendings.push(e2), this._currentLoad && this._currentLoad.cancel(), this._currentLoad = new Va(n2, (function(e3) {
        var n3 = e3.substring(0, e3.lastIndexOf("/"));
        n3.length && "/" !== n3.slice(-1) && (n3 += "/"), t2._publicPath = n3, window._daily.instances[t2._callClientId].publicPath = n3, r2(false);
      }), (function(e3, n3) {
        n3 || Ba(t2._callClientId), i2(e3, n3);
      })), this._currentLoad.start();
    } }, { key: "cancel", value: function() {
      this._currentLoad && this._currentLoad.cancel(), Ba(this._callClientId);
    } }, { key: "loaded", get: function() {
      return this._currentLoad && this._currentLoad.succeeded;
    } }]);
  })();
  var Va = (function() {
    return o((function e2() {
      var n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, r2 = arguments.length > 1 ? arguments[1] : void 0, i2 = arguments.length > 2 ? arguments[2] : void 0;
      t(this, e2), this._attemptsRemaining = 3, this._currentAttempt = null, this._dailyConfig = n2, this._successCallback = r2, this._failureCallback = i2;
    }), [{ key: "start", value: function() {
      var e2 = this;
      if (!this._currentAttempt) {
        var t2 = function(n2) {
          e2._currentAttempt.cancelled || (e2._attemptsRemaining--, e2._failureCallback(n2, e2._attemptsRemaining > 0), e2._attemptsRemaining <= 0 || setTimeout((function() {
            e2._currentAttempt.cancelled || (e2._currentAttempt = new qa(e2._dailyConfig, e2._successCallback, t2), e2._currentAttempt.start());
          }), 3e3));
        };
        this._currentAttempt = new qa(this._dailyConfig, this._successCallback, t2), this._currentAttempt.start();
      }
    } }, { key: "cancel", value: function() {
      this._currentAttempt && this._currentAttempt.cancel();
    } }, { key: "cancelled", get: function() {
      return this._currentAttempt && this._currentAttempt.cancelled;
    } }, { key: "succeeded", get: function() {
      return this._currentAttempt && this._currentAttempt.succeeded;
    } }]);
  })();
  var Ja = (function() {
    function e2() {
      return t(this, e2), n2 = this, i2 = arguments, r2 = s(r2 = e2), a(n2, Fa() ? Reflect.construct(r2, i2 || [], s(n2).constructor) : r2.apply(n2, i2));
      var n2, r2, i2;
    }
    return l(e2, Ra(Error)), o(e2);
  })();
  var $a = 2e4;
  var qa = (function() {
    return o((function e3(n2, r2, i2) {
      t(this, e3), this._loadAttemptImpl = ia() || !n2.avoidEval ? new za(n2, r2, i2) : new Wa(n2, r2, i2);
    }), [{ key: "start", value: (e2 = p((function* () {
      return this._loadAttemptImpl.start();
    })), function() {
      return e2.apply(this, arguments);
    }) }, { key: "cancel", value: function() {
      this._loadAttemptImpl.cancel();
    } }, { key: "cancelled", get: function() {
      return this._loadAttemptImpl.cancelled;
    } }, { key: "succeeded", get: function() {
      return this._loadAttemptImpl.succeeded;
    } }]);
    var e2;
  })();
  var za = (function() {
    return o((function e3(n3, r3, i3) {
      t(this, e3), this.cancelled = false, this.succeeded = false, this._networkTimedOut = false, this._networkTimeout = null, this._iosCache = "undefined" != typeof iOSCallObjectBundleCache && iOSCallObjectBundleCache, this._refetchHeaders = null, this._dailyConfig = n3, this._successCallback = r3, this._failureCallback = i3;
    }), [{ key: "start", value: (i2 = p((function* () {
      var e3 = B(this._dailyConfig);
      !(yield this._tryLoadFromIOSCache(e3)) && this._loadFromNetwork(e3);
    })), function() {
      return i2.apply(this, arguments);
    }) }, { key: "cancel", value: function() {
      clearTimeout(this._networkTimeout), this.cancelled = true;
    } }, { key: "_tryLoadFromIOSCache", value: (r2 = p((function* (e3) {
      if (!this._iosCache) return false;
      try {
        var t2 = yield this._iosCache.get(e3);
        return !!this.cancelled || !!t2 && (t2.code ? (Function('"use strict";' + t2.code)(), this.succeeded = true, this._successCallback(e3), true) : (this._refetchHeaders = t2.refetchHeaders, false));
      } catch (e4) {
        return false;
      }
    })), function(e3) {
      return r2.apply(this, arguments);
    }) }, { key: "_loadFromNetwork", value: (n2 = p((function* (e3) {
      var t2 = this;
      this._networkTimeout = setTimeout((function() {
        t2._networkTimedOut = true, t2._failureCallback({ msg: "Timed out (>".concat($a, " ms) when loading call object bundle ").concat(e3), type: "timeout" });
      }), $a);
      try {
        var n3 = this._refetchHeaders ? { headers: this._refetchHeaders } : {}, r3 = yield fetch(e3, n3);
        if (clearTimeout(this._networkTimeout), this.cancelled || this._networkTimedOut) throw new Ja();
        var i3 = yield this._getBundleCodeFromResponse(e3, r3);
        if (this.cancelled) throw new Ja();
        Function('"use strict";' + i3)(), this._iosCache && this._iosCache.set(e3, i3, r3.headers), this.succeeded = true, this._successCallback(e3);
      } catch (t3) {
        if (clearTimeout(this._networkTimeout), t3 instanceof Ja || this.cancelled || this._networkTimedOut) return;
        this._failureCallback({ msg: "Failed to load call object bundle ".concat(e3, ": ").concat(t3), type: t3.message });
      }
    })), function(e3) {
      return n2.apply(this, arguments);
    }) }, { key: "_getBundleCodeFromResponse", value: (e2 = p((function* (e3, t2) {
      if (t2.ok) return yield t2.text();
      if (this._iosCache && 304 === t2.status) return (yield this._iosCache.renew(e3, t2.headers)).code;
      throw new Error("Received ".concat(t2.status, " response"));
    })), function(t2, n3) {
      return e2.apply(this, arguments);
    }) }]);
    var e2, n2, r2, i2;
  })();
  var Wa = (function() {
    return o((function e2(n2, r2, i2) {
      t(this, e2), this.cancelled = false, this.succeeded = false, this._dailyConfig = n2, this._successCallback = r2, this._failureCallback = i2, this._attemptId = N(), this._networkTimeout = null, this._scriptElement = null;
    }), [{ key: "start", value: function() {
      window._dailyCallMachineLoadWaitlist || (window._dailyCallMachineLoadWaitlist = /* @__PURE__ */ new Set());
      var e2 = B(this._dailyConfig);
      "object" === ("undefined" == typeof document ? "undefined" : n(document)) ? this._startLoading(e2) : this._failureCallback({ msg: "Call object bundle must be loaded in a DOM/web context", type: "missing context" });
    } }, { key: "cancel", value: function() {
      this._stopLoading(), this.cancelled = true;
    } }, { key: "_startLoading", value: function(e2) {
      var t2 = this;
      this._signUpForCallMachineLoadWaitlist(), this._networkTimeout = setTimeout((function() {
        t2._stopLoading(), t2._failureCallback({ msg: "Timed out (>".concat($a, " ms) when loading call object bundle ").concat(e2), type: "timeout" });
      }), $a);
      var n2 = document.getElementsByTagName("head")[0], r2 = document.createElement("script");
      this._scriptElement = r2, r2.onload = function() {
        t2._stopLoading(), t2.succeeded = true, t2._successCallback(e2);
      }, r2.onerror = function(e3) {
        t2._stopLoading(), t2._failureCallback({ msg: "Failed to load call object bundle ".concat(e3.target.src), type: e3.message });
      }, r2.src = e2, n2.appendChild(r2);
    } }, { key: "_stopLoading", value: function() {
      this._withdrawFromCallMachineLoadWaitlist(), clearTimeout(this._networkTimeout), this._scriptElement && (this._scriptElement.onload = null, this._scriptElement.onerror = null);
    } }, { key: "_signUpForCallMachineLoadWaitlist", value: function() {
      window._dailyCallMachineLoadWaitlist.add(this._attemptId);
    } }, { key: "_withdrawFromCallMachineLoadWaitlist", value: function() {
      window._dailyCallMachineLoadWaitlist.delete(this._attemptId);
    } }]);
  })();
  var Ha = function(e2, t2, n2) {
    return true === Ka(e2.local, t2, n2);
  };
  var Ga = function(e2, t2, n2) {
    return e2.local.streams && e2.local.streams[t2] && e2.local.streams[t2].stream && e2.local.streams[t2].stream["get".concat("video" === n2 ? "Video" : "Audio", "Tracks")]()[0];
  };
  var Qa = function(e2, t2, n2, r2) {
    var i2 = Ya(e2, t2, n2, r2);
    return i2 && i2.pendingTrack;
  };
  var Ka = function(e2, t2, n2) {
    if (!e2) return false;
    var r2 = function(e3) {
      switch (e3) {
        case "avatar":
          return true;
        case "staged":
          return e3;
        default:
          return !!e3;
      }
    }, i2 = e2.public.subscribedTracks;
    return i2 && i2[t2] ? -1 === ["cam-audio", "cam-video", "screen-video", "screen-audio", "rmpAudio", "rmpVideo"].indexOf(n2) && i2[t2].custom ? [true, "staged"].includes(i2[t2].custom) ? r2(i2[t2].custom) : r2(i2[t2].custom[n2]) : r2(i2[t2][n2]) : !i2 || r2(i2.ALL);
  };
  var Ya = function(e2, t2, n2, r2) {
    var i2 = Object.values(e2.streams || {}).filter((function(e3) {
      return e3.participantId === t2 && e3.type === n2 && e3.pendingTrack && e3.pendingTrack.kind === r2;
    })).sort((function(e3, t3) {
      return new Date(t3.starttime) - new Date(e3.starttime);
    }));
    return i2 && i2[0];
  };
  var Xa = function(e2, t2) {
    var n2 = e2.local.public.customTracks;
    if (n2 && n2[t2]) return n2[t2].track;
  };
  function Za(e2, t2) {
    for (var n2 = t2.getState(), r2 = 0, i2 = ["cam", "screen"]; r2 < i2.length; r2++) for (var o2 = i2[r2], a2 = 0, s2 = ["video", "audio"]; a2 < s2.length; a2++) {
      var c2 = s2[a2], l2 = "cam" === o2 ? c2 : "screen".concat(c2.charAt(0).toUpperCase() + c2.slice(1)), u2 = e2.tracks[l2];
      if (u2) {
        var d2 = e2.local ? Ga(n2, o2, c2) : Qa(n2, e2.session_id, o2, c2);
        "playable" === u2.state && (u2.track = d2), u2.persistentTrack = d2;
      }
    }
  }
  function es(e2, t2) {
    try {
      var n2 = t2.getState();
      for (var r2 in e2.tracks) if (!ts(r2)) {
        var i2 = e2.tracks[r2].kind;
        if (i2) {
          var o2 = e2.tracks[r2];
          if (o2) {
            var a2 = e2.local ? Xa(n2, r2) : Qa(n2, e2.session_id, r2, i2);
            "playable" === o2.state && (e2.tracks[r2].track = a2), o2.persistentTrack = a2;
          }
        } else console.error("unknown type for custom track");
      }
    } catch (e3) {
      console.error(e3);
    }
  }
  function ts(e2) {
    return ["video", "audio", "screenVideo", "screenAudio"].includes(e2);
  }
  function ns(e2, t2, n2) {
    var r2 = n2.getState();
    if (e2.local) {
      if (e2.audio) try {
        e2.audioTrack = r2.local.streams.cam.stream.getAudioTracks()[0], e2.audioTrack || (e2.audio = false);
      } catch (e3) {
      }
      if (e2.video) try {
        e2.videoTrack = r2.local.streams.cam.stream.getVideoTracks()[0], e2.videoTrack || (e2.video = false);
      } catch (e3) {
      }
      if (e2.screen) try {
        e2.screenVideoTrack = r2.local.streams.screen.stream.getVideoTracks()[0], e2.screenAudioTrack = r2.local.streams.screen.stream.getAudioTracks()[0], e2.screenVideoTrack || e2.screenAudioTrack || (e2.screen = false);
      } catch (e3) {
      }
    } else {
      var i2 = true;
      try {
        var o2 = r2.participants[e2.session_id];
        o2 && o2.public && o2.public.rtcType && "peer-to-peer" === o2.public.rtcType.impl && o2.private && !["connected", "completed"].includes(o2.private.peeringState) && (i2 = false);
      } catch (e3) {
        console.error(e3);
      }
      if (!i2) return e2.audio = false, e2.audioTrack = false, e2.video = false, e2.videoTrack = false, e2.screen = false, void (e2.screenTrack = false);
      try {
        r2.streams;
        if (e2.audio && Ha(r2, e2.session_id, "cam-audio")) {
          var a2 = Qa(r2, e2.session_id, "cam", "audio");
          a2 && (t2 && t2.audioTrack && t2.audioTrack.id === a2.id ? e2.audioTrack = a2 : a2.muted || (e2.audioTrack = a2)), e2.audioTrack || (e2.audio = false);
        }
        if (e2.video && Ha(r2, e2.session_id, "cam-video")) {
          var s2 = Qa(r2, e2.session_id, "cam", "video");
          s2 && (t2 && t2.videoTrack && t2.videoTrack.id === s2.id ? e2.videoTrack = s2 : s2.muted || (e2.videoTrack = s2)), e2.videoTrack || (e2.video = false);
        }
        if (e2.screen && Ha(r2, e2.session_id, "screen-audio")) {
          var c2 = Qa(r2, e2.session_id, "screen", "audio");
          c2 && (t2 && t2.screenAudioTrack && t2.screenAudioTrack.id === c2.id ? e2.screenAudioTrack = c2 : c2.muted || (e2.screenAudioTrack = c2));
        }
        if (e2.screen && Ha(r2, e2.session_id, "screen-video")) {
          var l2 = Qa(r2, e2.session_id, "screen", "video");
          l2 && (t2 && t2.screenVideoTrack && t2.screenVideoTrack.id === l2.id ? e2.screenVideoTrack = l2 : l2.muted || (e2.screenVideoTrack = l2));
        }
        e2.screenVideoTrack || e2.screenAudioTrack || (e2.screen = false);
      } catch (e3) {
        console.error("unexpected error matching up tracks", e3);
      }
    }
  }
  function rs(e2, t2) {
    var n2 = "undefined" != typeof Symbol && e2[Symbol.iterator] || e2["@@iterator"];
    if (!n2) {
      if (Array.isArray(e2) || (n2 = (function(e3, t3) {
        if (e3) {
          if ("string" == typeof e3) return is(e3, t3);
          var n3 = {}.toString.call(e3).slice(8, -1);
          return "Object" === n3 && e3.constructor && (n3 = e3.constructor.name), "Map" === n3 || "Set" === n3 ? Array.from(e3) : "Arguments" === n3 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n3) ? is(e3, t3) : void 0;
        }
      })(e2)) || t2 && e2 && "number" == typeof e2.length) {
        n2 && (e2 = n2);
        var r2 = 0, i2 = function() {
        };
        return { s: i2, n: function() {
          return r2 >= e2.length ? { done: true } : { done: false, value: e2[r2++] };
        }, e: function(e3) {
          throw e3;
        }, f: i2 };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var o2, a2 = true, s2 = false;
    return { s: function() {
      n2 = n2.call(e2);
    }, n: function() {
      var e3 = n2.next();
      return a2 = e3.done, e3;
    }, e: function(e3) {
      s2 = true, o2 = e3;
    }, f: function() {
      try {
        a2 || null == n2.return || n2.return();
      } finally {
        if (s2) throw o2;
      }
    } };
  }
  function is(e2, t2) {
    (null == t2 || t2 > e2.length) && (t2 = e2.length);
    for (var n2 = 0, r2 = Array(t2); n2 < t2; n2++) r2[n2] = e2[n2];
    return r2;
  }
  var os = /* @__PURE__ */ new Map();
  var as = null;
  function ss(e2, t2) {
    var n2 = "undefined" != typeof Symbol && e2[Symbol.iterator] || e2["@@iterator"];
    if (!n2) {
      if (Array.isArray(e2) || (n2 = (function(e3, t3) {
        if (e3) {
          if ("string" == typeof e3) return cs(e3, t3);
          var n3 = {}.toString.call(e3).slice(8, -1);
          return "Object" === n3 && e3.constructor && (n3 = e3.constructor.name), "Map" === n3 || "Set" === n3 ? Array.from(e3) : "Arguments" === n3 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n3) ? cs(e3, t3) : void 0;
        }
      })(e2)) || t2 && e2 && "number" == typeof e2.length) {
        n2 && (e2 = n2);
        var r2 = 0, i2 = function() {
        };
        return { s: i2, n: function() {
          return r2 >= e2.length ? { done: true } : { done: false, value: e2[r2++] };
        }, e: function(e3) {
          throw e3;
        }, f: i2 };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var o2, a2 = true, s2 = false;
    return { s: function() {
      n2 = n2.call(e2);
    }, n: function() {
      var e3 = n2.next();
      return a2 = e3.done, e3;
    }, e: function(e3) {
      s2 = true, o2 = e3;
    }, f: function() {
      try {
        a2 || null == n2.return || n2.return();
      } finally {
        if (s2) throw o2;
      }
    } };
  }
  function cs(e2, t2) {
    (null == t2 || t2 > e2.length) && (t2 = e2.length);
    for (var n2 = 0, r2 = Array(t2); n2 < t2; n2++) r2[n2] = e2[n2];
    return r2;
  }
  var ls = /* @__PURE__ */ new Map();
  var us = null;
  function ds(e2) {
    hs() ? (function(e3) {
      os.has(e3) || (os.set(e3, {}), navigator.mediaDevices.enumerateDevices().then((function(t2) {
        os.has(e3) && (os.get(e3).lastDevicesString = JSON.stringify(t2), as || (as = (function() {
          var e4 = p((function* () {
            var e5, t3 = yield navigator.mediaDevices.enumerateDevices(), n2 = rs(os.keys());
            try {
              for (n2.s(); !(e5 = n2.n()).done; ) {
                var r2 = e5.value, i2 = JSON.stringify(t3);
                i2 !== os.get(r2).lastDevicesString && (os.get(r2).lastDevicesString = i2, r2(t3));
              }
            } catch (e6) {
              n2.e(e6);
            } finally {
              n2.f();
            }
          }));
          return function() {
            return e4.apply(this, arguments);
          };
        })(), navigator.mediaDevices.addEventListener("devicechange", as)));
      })).catch((function() {
      })));
    })(e2) : (function(e3) {
      ls.has(e3) || (ls.set(e3, {}), navigator.mediaDevices.enumerateDevices().then((function(t2) {
        ls.has(e3) && (ls.get(e3).lastDevicesString = JSON.stringify(t2), us || (us = setInterval(p((function* () {
          var e4, t3 = yield navigator.mediaDevices.enumerateDevices(), n2 = ss(ls.keys());
          try {
            for (n2.s(); !(e4 = n2.n()).done; ) {
              var r2 = e4.value, i2 = JSON.stringify(t3);
              i2 !== ls.get(r2).lastDevicesString && (ls.get(r2).lastDevicesString = i2, r2(t3));
            }
          } catch (e5) {
            n2.e(e5);
          } finally {
            n2.f();
          }
        })), 3e3)));
      })));
    })(e2);
  }
  function ps(e2) {
    hs() ? (function(e3) {
      os.has(e3) && (os.delete(e3), 0 === os.size && as && (navigator.mediaDevices.removeEventListener("devicechange", as), as = null));
    })(e2) : (function(e3) {
      ls.has(e3) && (ls.delete(e3), 0 === ls.size && us && (clearInterval(us), us = null));
    })(e2);
  }
  function hs() {
    var e2;
    return ia() || void 0 !== (null === (e2 = navigator.mediaDevices) || void 0 === e2 ? void 0 : e2.ondevicechange);
  }
  var fs = /* @__PURE__ */ new Set();
  function vs(e2, t2) {
    var n2 = t2.isLocalScreenVideo;
    return e2 && "live" === e2.readyState && !(function(e3, t3) {
      return (!t3.isLocalScreenVideo || "Chrome" !== ma()) && e3.muted && !fs.has(e3.id);
    })(e2, { isLocalScreenVideo: n2 });
  }
  function gs(e2, t2) {
    var n2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var r2 = Object.getOwnPropertySymbols(e2);
      t2 && (r2 = r2.filter((function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      }))), n2.push.apply(n2, r2);
    }
    return n2;
  }
  function ms(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = null != arguments[t2] ? arguments[t2] : {};
      t2 % 2 ? gs(Object(n2), true).forEach((function(t3) {
        u(e2, t3, n2[t3]);
      })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : gs(Object(n2)).forEach((function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      }));
    }
    return e2;
  }
  var ys = Object.freeze({ VIDEO: "video", AUDIO: "audio", SCREEN_VIDEO: "screenVideo", SCREEN_AUDIO: "screenAudio", CUSTOM_VIDEO: "customVideo", CUSTOM_AUDIO: "customAudio" });
  var bs = Object.freeze({ PARTICIPANTS: "participants", STREAMING: "streaming", TRANSCRIPTION: "transcription" });
  var _s = Object.values(ys);
  var ws = ["v", "a", "sv", "sa", "cv", "ca"];
  Object.freeze(_s.reduce((function(e2, t2, n2) {
    return e2[t2] = ws[n2], e2;
  }), {})), Object.freeze(ws.reduce((function(e2, t2, n2) {
    return e2[t2] = _s[n2], e2;
  }), {}));
  var Ss = [ys.VIDEO, ys.AUDIO, ys.SCREEN_VIDEO, ys.SCREEN_AUDIO];
  var ks = Object.values(bs);
  var Ms = ["p", "s", "t"];
  Object.freeze(ks.reduce((function(e2, t2, n2) {
    return e2[t2] = Ms[n2], e2;
  }), {})), Object.freeze(Ms.reduce((function(e2, t2, n2) {
    return e2[t2] = ks[n2], e2;
  }), {}));
  var Cs = (function() {
    function e2() {
      var n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, r2 = n2.base, i2 = n2.byUserId, o2 = n2.byParticipantId;
      t(this, e2), this.base = r2, this.byUserId = i2, this.byParticipantId = o2;
    }
    return o(e2, [{ key: "clone", value: function() {
      var t2 = new e2();
      if (this.base instanceof Es ? t2.base = this.base.clone() : t2.base = this.base, void 0 !== this.byUserId) for (var n2 in t2.byUserId = {}, this.byUserId) {
        var r2 = this.byUserId[n2];
        t2.byUserId[n2] = r2 instanceof Es ? r2.clone() : r2;
      }
      if (void 0 !== this.byParticipantId) for (var i2 in t2.byParticipantId = {}, this.byParticipantId) {
        var o2 = this.byParticipantId[i2];
        t2.byParticipantId[i2] = o2 instanceof Es ? o2.clone() : o2;
      }
      return t2;
    } }, { key: "toJSONObject", value: function() {
      var e3 = {};
      if ("boolean" == typeof this.base ? e3.base = this.base : this.base instanceof Es && (e3.base = this.base.toJSONObject()), void 0 !== this.byUserId) for (var t2 in e3.byUserId = {}, this.byUserId) {
        var n2 = this.byUserId[t2];
        e3.byUserId[t2] = n2 instanceof Es ? n2.toJSONObject() : n2;
      }
      if (void 0 !== this.byParticipantId) for (var r2 in e3.byParticipantId = {}, this.byParticipantId) {
        var i2 = this.byParticipantId[r2];
        e3.byParticipantId[r2] = i2 instanceof Es ? i2.toJSONObject() : i2;
      }
      return e3;
    } }, { key: "toMinifiedJSONObject", value: function() {
      var e3 = {};
      if (void 0 !== this.base && ("boolean" == typeof this.base ? e3.b = this.base : e3.b = this.base.toMinifiedJSONObject()), void 0 !== this.byUserId) for (var t2 in e3.u = {}, this.byUserId) {
        var n2 = this.byUserId[t2];
        e3.u[t2] = "boolean" == typeof n2 ? n2 : n2.toMinifiedJSONObject();
      }
      if (void 0 !== this.byParticipantId) for (var r2 in e3.p = {}, this.byParticipantId) {
        var i2 = this.byParticipantId[r2];
        e3.p[r2] = "boolean" == typeof i2 ? i2 : i2.toMinifiedJSONObject();
      }
      return e3;
    } }, { key: "normalize", value: function() {
      return this.base instanceof Es && (this.base = this.base.normalize()), this.byUserId && (this.byUserId = Object.fromEntries(Object.entries(this.byUserId).map((function(e3) {
        var t2 = f(e3, 2), n2 = t2[0], r2 = t2[1];
        return [n2, r2 instanceof Es ? r2.normalize() : r2];
      })))), this.byParticipantId && (this.byParticipantId = Object.fromEntries(Object.entries(this.byParticipantId).map((function(e3) {
        var t2 = f(e3, 2), n2 = t2[0], r2 = t2[1];
        return [n2, r2 instanceof Es ? r2.normalize() : r2];
      })))), this;
    } }], [{ key: "fromJSONObject", value: function(t2) {
      var n2, r2, i2;
      if (void 0 !== t2.base && (n2 = "boolean" == typeof t2.base ? t2.base : Es.fromJSONObject(t2.base)), void 0 !== t2.byUserId) for (var o2 in r2 = {}, t2.byUserId) {
        var a2 = t2.byUserId[o2];
        r2[o2] = "boolean" == typeof a2 ? a2 : Es.fromJSONObject(a2);
      }
      if (void 0 !== t2.byParticipantId) for (var s2 in i2 = {}, t2.byParticipantId) {
        var c2 = t2.byParticipantId[s2];
        i2[s2] = "boolean" == typeof c2 ? c2 : Es.fromJSONObject(c2);
      }
      return new e2({ base: n2, byUserId: r2, byParticipantId: i2 });
    } }, { key: "fromMinifiedJSONObject", value: function(t2) {
      var n2, r2, i2;
      if (void 0 !== t2.b && (n2 = "boolean" == typeof t2.b ? t2.b : Es.fromMinifiedJSONObject(t2.b)), void 0 !== t2.u) for (var o2 in r2 = {}, t2.u) {
        var a2 = t2.u[o2];
        r2[o2] = "boolean" == typeof a2 ? a2 : Es.fromMinifiedJSONObject(a2);
      }
      if (void 0 !== t2.p) for (var s2 in i2 = {}, t2.p) {
        var c2 = t2.p[s2];
        i2[s2] = "boolean" == typeof c2 ? c2 : Es.fromMinifiedJSONObject(c2);
      }
      return new e2({ base: n2, byUserId: r2, byParticipantId: i2 });
    } }, { key: "validateJSONObject", value: function(e3) {
      if ("object" !== n(e3)) return [false, "canReceive must be an object"];
      for (var t2 = ["base", "byUserId", "byParticipantId"], r2 = 0, i2 = Object.keys(e3); r2 < i2.length; r2++) {
        var o2 = i2[r2];
        if (!t2.includes(o2)) return [false, "canReceive can only contain keys (".concat(t2.join(", "), ")")];
        if ("base" === o2) {
          var a2 = f(Es.validateJSONObject(e3.base, true), 2), s2 = a2[0], c2 = a2[1];
          if (!s2) return [false, c2];
        } else {
          if ("object" !== n(e3[o2])) return [false, "invalid (non-object) value for field '".concat(o2, "' in canReceive")];
          for (var l2 = 0, u2 = Object.values(e3[o2]); l2 < u2.length; l2++) {
            var d2 = u2[l2], p2 = f(Es.validateJSONObject(d2), 2), h2 = p2[0], v2 = p2[1];
            if (!h2) return [false, v2];
          }
        }
      }
      return [true];
    } }]);
  })();
  var Es = (function() {
    function e2() {
      var n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, r2 = n2.video, i2 = n2.audio, o2 = n2.screenVideo, a2 = n2.screenAudio, s2 = n2.customVideo, c2 = n2.customAudio;
      t(this, e2), this.video = r2, this.audio = i2, this.screenVideo = o2, this.screenAudio = a2, this.customVideo = s2, this.customAudio = c2;
    }
    return o(e2, [{ key: "clone", value: function() {
      var t2 = new e2();
      return void 0 !== this.video && (t2.video = this.video), void 0 !== this.audio && (t2.audio = this.audio), void 0 !== this.screenVideo && (t2.screenVideo = this.screenVideo), void 0 !== this.screenAudio && (t2.screenAudio = this.screenAudio), void 0 !== this.customVideo && (t2.customVideo = ms({}, this.customVideo)), void 0 !== this.customAudio && (t2.customAudio = ms({}, this.customAudio)), t2;
    } }, { key: "toJSONObject", value: function() {
      var e3 = {};
      return void 0 !== this.video && (e3.video = this.video), void 0 !== this.audio && (e3.audio = this.audio), void 0 !== this.screenVideo && (e3.screenVideo = this.screenVideo), void 0 !== this.screenAudio && (e3.screenAudio = this.screenAudio), void 0 !== this.customVideo && (e3.customVideo = ms({}, this.customVideo)), void 0 !== this.customAudio && (e3.customAudio = ms({}, this.customAudio)), e3;
    } }, { key: "toMinifiedJSONObject", value: function() {
      var e3 = {};
      return void 0 !== this.video && (e3.v = this.video), void 0 !== this.audio && (e3.a = this.audio), void 0 !== this.screenVideo && (e3.sv = this.screenVideo), void 0 !== this.screenAudio && (e3.sa = this.screenAudio), void 0 !== this.customVideo && (e3.cv = ms({}, this.customVideo)), void 0 !== this.customAudio && (e3.ca = ms({}, this.customAudio)), e3;
    } }, { key: "normalize", value: function() {
      function e3(e4, t2) {
        return e4 && 1 === Object.keys(e4).length && e4["*"] === t2;
      }
      return !(true !== this.video || true !== this.audio || true !== this.screenVideo || true !== this.screenAudio || !e3(this.customVideo, true) || !e3(this.customAudio, true)) || (false !== this.video || false !== this.audio || false !== this.screenVideo || false !== this.screenAudio || !e3(this.customVideo, false) || !e3(this.customAudio, false)) && this;
    } }], [{ key: "fromBoolean", value: function(t2) {
      return new e2({ video: t2, audio: t2, screenVideo: t2, screenAudio: t2, customVideo: { "*": t2 }, customAudio: { "*": t2 } });
    } }, { key: "fromJSONObject", value: function(t2) {
      return new e2({ video: t2.video, audio: t2.audio, screenVideo: t2.screenVideo, screenAudio: t2.screenAudio, customVideo: void 0 !== t2.customVideo ? ms({}, t2.customVideo) : void 0, customAudio: void 0 !== t2.customAudio ? ms({}, t2.customAudio) : void 0 });
    } }, { key: "fromMinifiedJSONObject", value: function(t2) {
      return new e2({ video: t2.v, audio: t2.a, screenVideo: t2.sv, screenAudio: t2.sa, customVideo: t2.cv, customAudio: t2.ca });
    } }, { key: "validateJSONObject", value: function(e3, t2) {
      if ("boolean" == typeof e3) return [true];
      if ("object" !== n(e3)) return [false, "invalid (non-object, non-boolean) value in canReceive"];
      for (var r2 = Object.keys(e3), i2 = 0, o2 = r2; i2 < o2.length; i2++) {
        var a2 = o2[i2];
        if (!_s.includes(a2)) return [false, "invalid media type '".concat(a2, "' in canReceive")];
        if (Ss.includes(a2)) {
          if ("boolean" != typeof e3[a2]) return [false, "invalid (non-boolean) value for media type '".concat(a2, "' in canReceive")];
        } else {
          if ("object" !== n(e3[a2])) return [false, "invalid (non-object) value for media type '".concat(a2, "' in canReceive")];
          for (var s2 = 0, c2 = Object.values(e3[a2]); s2 < c2.length; s2++) {
            if ("boolean" != typeof c2[s2]) return [false, "invalid (non-boolean) value for entry within '".concat(a2, "' in canReceive")];
          }
          if (t2 && void 0 === e3[a2]["*"]) return [false, `canReceive "base" permission must specify "*" as an entry within '`.concat(a2, "'")];
        }
      }
      return t2 && r2.length !== _s.length ? [false, 'canReceive "base" permission must specify all media types: '.concat(_s.join(", "), " (or be set to a boolean shorthand)")] : [true];
    } }]);
  })();
  var Ts = ["result"];
  var Os = ["preserveIframe"];
  function Ps(e2, t2) {
    var n2 = Object.keys(e2);
    if (Object.getOwnPropertySymbols) {
      var r2 = Object.getOwnPropertySymbols(e2);
      t2 && (r2 = r2.filter((function(t3) {
        return Object.getOwnPropertyDescriptor(e2, t3).enumerable;
      }))), n2.push.apply(n2, r2);
    }
    return n2;
  }
  function As(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = null != arguments[t2] ? arguments[t2] : {};
      t2 % 2 ? Ps(Object(n2), true).forEach((function(t3) {
        u(e2, t3, n2[t3]);
      })) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(n2)) : Ps(Object(n2)).forEach((function(t3) {
        Object.defineProperty(e2, t3, Object.getOwnPropertyDescriptor(n2, t3));
      }));
    }
    return e2;
  }
  function js() {
    try {
      var e2 = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
      })));
    } catch (e3) {
    }
    return (js = function() {
      return !!e2;
    })();
  }
  function Is(e2, t2) {
    var n2 = "undefined" != typeof Symbol && e2[Symbol.iterator] || e2["@@iterator"];
    if (!n2) {
      if (Array.isArray(e2) || (n2 = (function(e3, t3) {
        if (e3) {
          if ("string" == typeof e3) return xs(e3, t3);
          var n3 = {}.toString.call(e3).slice(8, -1);
          return "Object" === n3 && e3.constructor && (n3 = e3.constructor.name), "Map" === n3 || "Set" === n3 ? Array.from(e3) : "Arguments" === n3 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n3) ? xs(e3, t3) : void 0;
        }
      })(e2)) || t2 && e2 && "number" == typeof e2.length) {
        n2 && (e2 = n2);
        var r2 = 0, i2 = function() {
        };
        return { s: i2, n: function() {
          return r2 >= e2.length ? { done: true } : { done: false, value: e2[r2++] };
        }, e: function(e3) {
          throw e3;
        }, f: i2 };
      }
      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    var o2, a2 = true, s2 = false;
    return { s: function() {
      n2 = n2.call(e2);
    }, n: function() {
      var e3 = n2.next();
      return a2 = e3.done, e3;
    }, e: function(e3) {
      s2 = true, o2 = e3;
    }, f: function() {
      try {
        a2 || null == n2.return || n2.return();
      } finally {
        if (s2) throw o2;
      }
    } };
  }
  function xs(e2, t2) {
    (null == t2 || t2 > e2.length) && (t2 = e2.length);
    for (var n2 = 0, r2 = Array(t2); n2 < t2; n2++) r2[n2] = e2[n2];
    return r2;
  }
  var Ls = {};
  var Ds = "video";
  var Ns = "voice";
  var Rs = ia() ? { data: {} } : { data: {}, topology: "none" };
  var Fs = { present: 0, hidden: 0 };
  var Bs = { maxBitrate: { min: 1e5, max: 25e5 }, maxFramerate: { min: 1, max: 30 }, scaleResolutionDownBy: { min: 1, max: 8 } };
  var Us = Object.keys(Bs);
  var Vs = ["state", "volume", "simulcastEncodings"];
  var Js = { androidInCallNotification: { title: "string", subtitle: "string", iconName: "string", disableForCustomOverride: "boolean" }, disableAutoDeviceManagement: { audio: "boolean", video: "boolean" } };
  var $s = { id: { iconPath: "string", iconPathDarkMode: "string", label: "string", tooltip: "string", visualState: "'default' | 'sidebar-open' | 'active'" } };
  var qs = { id: { allow: "string", controlledBy: "'*' | 'owners' | string[]", csp: "string", iconURL: "string", label: "string", loading: "'eager' | 'lazy'", location: "'main' | 'sidebar'", name: "string", referrerPolicy: "string", sandbox: "string", src: "string", srcdoc: "string", shared: "string[] | 'owners' | boolean" } };
  var zs = /^[a-zA-Z0-9_-]+$/;
  function Ws(e2) {
    if (null != e2 && "object" === n(e2) && !Array.isArray(e2)) {
      var t2, r2 = {}, i2 = Is(Object.entries(e2).slice(0, 10));
      try {
        for (i2.s(); !(t2 = i2.n()).done; ) {
          var o2 = f(t2.value, 2), a2 = o2[0], s2 = o2[1];
          "string" != typeof a2 || a2.length > 64 || zs.test(a2) && "string" == typeof s2 && (r2[a2] = s2.slice(0, 256));
        }
      } catch (e3) {
        i2.e(e3);
      } finally {
        i2.f();
      }
      return Object.keys(r2).length ? r2 : void 0;
    }
  }
  var Hs = { customIntegrations: { validate: yc, help: gc() }, customTrayButtons: { validate: mc, help: "customTrayButtons should be a dictionary of the type ".concat(JSON.stringify($s)) }, url: { validate: function(e2) {
    return "string" == typeof e2;
  }, help: "url should be a string" }, baseUrl: { validate: function(e2) {
    return console.warn("baseUrl is deprecated and has no effect"), "string" == typeof e2;
  }, help: "baseUrl should be a string" }, token: { validate: function(e2) {
    return "string" == typeof e2;
  }, help: "token should be a string", queryString: "t" }, dailyConfig: { validate: function(e2, t2) {
    try {
      return t2.validateDailyConfig(e2), true;
    } catch (e3) {
      console.error("Failed to validate dailyConfig", e3);
    }
    return false;
  }, help: "Unsupported dailyConfig. Check error logs for detailed info." }, reactNativeConfig: { validate: function(e2) {
    return bc(e2, Js);
  }, help: "reactNativeConfig should look like ".concat(JSON.stringify(Js), ", all fields optional") }, lang: { validate: function(e2) {
    return ["da", "de", "en-us", "en", "es", "fi", "fr", "it", "jp", "ka", "nl", "no", "pl", "pt", "pt-BR", "ru", "sv", "tr", "user"].includes(e2);
  }, help: "language not supported. Options are: da, de, en-us, en, es, fi, fr, it, jp, ka, nl, no, pl, pt, pt-BR, ru, sv, tr, user" }, userName: true, userData: { validate: function(e2) {
    try {
      return sc(e2), true;
    } catch (e3) {
      return console.error(e3), false;
    }
  }, help: "invalid userData type provided" }, startVideoOff: true, startAudioOff: true, allowLocalVideo: true, allowLocalAudio: true, activeSpeakerMode: true, showLeaveButton: true, showLocalVideo: true, showParticipantsBar: true, showFullscreenButton: true, showUserNameChangeUI: true, iframeStyle: true, customLayout: true, cssFile: true, cssText: true, bodyClass: true, videoSource: { validate: function(e2, t2) {
    if ("boolean" == typeof e2) return t2._preloadCache.allowLocalVideo = e2, true;
    var n2;
    if (e2 instanceof MediaStreamTrack) t2._sharedTracks.videoTrack = e2, n2 = { customTrack: Qo };
    else {
      if (delete t2._sharedTracks.videoTrack, "string" != typeof e2) return console.error("videoSource must be a MediaStreamTrack, boolean, or a string"), false;
      n2 = { deviceId: e2 };
    }
    return t2._updatePreloadCacheInputSettings({ video: { settings: n2 } }, false), true;
  } }, audioSource: { validate: function(e2, t2) {
    if ("boolean" == typeof e2) return t2._preloadCache.allowLocalAudio = e2, true;
    var n2;
    if (e2 instanceof MediaStreamTrack) t2._sharedTracks.audioTrack = e2, n2 = { customTrack: Qo };
    else {
      if (delete t2._sharedTracks.audioTrack, "string" != typeof e2) return console.error("audioSource must be a MediaStreamTrack, boolean, or a string"), false;
      n2 = { deviceId: e2 };
    }
    return t2._updatePreloadCacheInputSettings({ audio: { settings: n2 } }, false), true;
  } }, subscribeToTracksAutomatically: { validate: function(e2, t2) {
    return t2._preloadCache.subscribeToTracksAutomatically = e2, true;
  } }, theme: { validate: function(e2) {
    var t2 = ["accent", "accentText", "background", "backgroundAccent", "baseText", "border", "mainAreaBg", "mainAreaBgAccent", "mainAreaText", "supportiveText"], r2 = function(e3) {
      for (var n2 = 0, r3 = Object.keys(e3); n2 < r3.length; n2++) {
        var i2 = r3[n2];
        if (!t2.includes(i2)) return console.error('unsupported color "'.concat(i2, '". Valid colors: ').concat(t2.join(", "))), false;
        if (!e3[i2].match(/^#[0-9a-f]{6}|#[0-9a-f]{3}$/i)) return console.error("".concat(i2, ' theme color should be provided in valid hex color format. Received: "').concat(e3[i2], '"')), false;
      }
      return true;
    };
    return "object" === n(e2) && ("light" in e2 && "dark" in e2 || "colors" in e2) ? "light" in e2 && "dark" in e2 ? "colors" in e2.light ? "colors" in e2.dark ? r2(e2.light.colors) && r2(e2.dark.colors) : (console.error('Dark theme is missing "colors" property.', e2), false) : (console.error('Light theme is missing "colors" property.', e2), false) : r2(e2.colors) : (console.error('Theme must contain either both "light" and "dark" properties, or "colors".', e2), false);
  }, help: "unsupported theme configuration. Check error logs for detailed info." }, layoutConfig: { validate: function(e2) {
    if ("grid" in e2) {
      var t2 = e2.grid;
      if ("maxTilesPerPage" in t2) {
        if (!Number.isInteger(t2.maxTilesPerPage)) return console.error("grid.maxTilesPerPage should be an integer. You passed ".concat(t2.maxTilesPerPage, ".")), false;
        if (t2.maxTilesPerPage > 49) return console.error("grid.maxTilesPerPage can't be larger than 49 without sacrificing browser performance. Please contact us at https://www.daily.co/contact to talk about your use case."), false;
      }
      if ("minTilesPerPage" in t2) {
        if (!Number.isInteger(t2.minTilesPerPage)) return console.error("grid.minTilesPerPage should be an integer. You passed ".concat(t2.minTilesPerPage, ".")), false;
        if (t2.minTilesPerPage < 1) return console.error("grid.minTilesPerPage can't be lower than 1."), false;
        if ("maxTilesPerPage" in t2 && t2.minTilesPerPage > t2.maxTilesPerPage) return console.error("grid.minTilesPerPage can't be higher than grid.maxTilesPerPage."), false;
      }
    }
    return true;
  }, help: "unsupported layoutConfig. Check error logs for detailed info." }, receiveSettings: { validate: function(e2) {
    return cc(e2, { allowAllParticipantsKey: false });
  }, help: vc({ allowAllParticipantsKey: false }) }, sendSettings: { validate: function(e2, t2) {
    return !!(function(e3, t3) {
      try {
        return t3.validateUpdateSendSettings(e3), true;
      } catch (e4) {
        return console.error("Failed to validate send settings", e4), false;
      }
    })(e2, t2) && (t2._preloadCache.sendSettings = e2, true);
  }, help: "Invalid sendSettings provided. Check error logs for detailed info." }, inputSettings: { validate: function(e2, t2) {
    var n2;
    return !!lc(e2) && (t2._inputSettings || (t2._inputSettings = {}), uc(e2, null === (n2 = t2.properties) || void 0 === n2 ? void 0 : n2.dailyConfig, t2._sharedTracks), t2._updatePreloadCacheInputSettings(e2, true), true);
  }, help: fc() }, layout: { validate: function(e2) {
    return "custom-v1" === e2 || "browser" === e2 || "none" === e2;
  }, help: 'layout may only be set to "custom-v1"', queryString: "layout" }, emb: { queryString: "emb" }, embHref: { queryString: "embHref" }, dailyJsVersion: { queryString: "dailyJsVersion" }, aboutClient: { validate: function(e2) {
    if (null == e2) return true;
    if ("object" !== n(e2) || Array.isArray(e2)) return false;
    var t2 = Object.entries(e2);
    if (t2.length > 10) return false;
    for (var r2 = 0, i2 = t2; r2 < i2.length; r2++) {
      var o2 = f(i2[r2], 2), a2 = o2[0], s2 = o2[1];
      if ("string" != typeof a2 || a2.length > 64) return false;
      if (!zs.test(a2)) return false;
      if ("string" != typeof s2 || s2.length > 256) return false;
    }
    return true;
  }, help: "aboutClient must be an object with up to ".concat(10, " entries; keys must be strings made up of characters (a-z, 0-9, _, -) and a max length of ").concat(64, "; values must be strings with a max length of ").concat(256) }, proxy: { queryString: "proxy" }, strictMode: true, allowMultipleCallInstances: true };
  var Gs = { styles: { validate: function(e2) {
    for (var t2 in e2) if ("cam" !== t2 && "screen" !== t2) return false;
    if (e2.cam) {
      for (var n2 in e2.cam) if ("div" !== n2 && "video" !== n2) return false;
    }
    if (e2.screen) {
      for (var r2 in e2.screen) if ("div" !== r2 && "video" !== r2) return false;
    }
    return true;
  }, help: "styles format should be a subset of: { cam: {div: {}, video: {}}, screen: {div: {}, video: {}} }" }, setSubscribedTracks: { validate: function(e2, t2) {
    if (t2._preloadCache.subscribeToTracksAutomatically) return false;
    var n2 = [true, false, "staged"];
    if (n2.includes(e2) || !ia() && "avatar" === e2) return true;
    var r2 = ["audio", "video", "screenAudio", "screenVideo", "rmpAudio", "rmpVideo"], i2 = function(e3) {
      var t3 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
      for (var o2 in e3) if ("custom" === o2) {
        if (!n2.includes(e3[o2]) && !i2(e3[o2], true)) return false;
      } else {
        var a2 = !t3 && !r2.includes(o2), s2 = !n2.includes(e3[o2]);
        if (a2 || s2) return false;
      }
      return true;
    };
    return i2(e2);
  }, help: "setSubscribedTracks cannot be used when setSubscribeToTracksAutomatically is enabled, and should be of the form: " + "true".concat(ia() ? "" : " | 'avatar'", " | false | 'staged' | { [audio: true|false|'staged'], [video: true|false|'staged'], [screenAudio: true|false|'staged'], [screenVideo: true|false|'staged'] }") }, setAudio: true, setVideo: true, setScreenShare: { validate: function(e2) {
    return false === e2;
  }, help: "setScreenShare must be false, as it's only meant for stopping remote participants' screen shares" }, eject: true, updatePermissions: { validate: function(e2) {
    for (var t2 = 0, n2 = Object.entries(e2); t2 < n2.length; t2++) {
      var r2 = f(n2[t2], 2), i2 = r2[0], o2 = r2[1];
      switch (i2) {
        case "hasPresence":
          if ("boolean" != typeof o2) return false;
          break;
        case "canSend":
          if (o2 instanceof Set || o2 instanceof Array || Array.isArray(o2)) {
            var a2, s2 = ["video", "audio", "screenVideo", "screenAudio", "customVideo", "customAudio"], c2 = Is(o2);
            try {
              for (c2.s(); !(a2 = c2.n()).done; ) {
                var l2 = a2.value;
                if (!s2.includes(l2)) return false;
              }
            } catch (e3) {
              c2.e(e3);
            } finally {
              c2.f();
            }
          } else if ("boolean" != typeof o2) return false;
          (o2 instanceof Array || Array.isArray(o2)) && (e2.canSend = new Set(o2));
          break;
        case "canReceive":
          var u2 = f(Cs.validateJSONObject(o2), 2), d2 = u2[0], p2 = u2[1];
          if (!d2) return console.error(p2), false;
          break;
        case "canAdmin":
          if (o2 instanceof Set || o2 instanceof Array || Array.isArray(o2)) {
            var h2, v2 = ["participants", "streaming", "transcription"], g2 = Is(o2);
            try {
              for (g2.s(); !(h2 = g2.n()).done; ) {
                var m2 = h2.value;
                if (!v2.includes(m2)) return false;
              }
            } catch (e3) {
              g2.e(e3);
            } finally {
              g2.f();
            }
          } else if ("boolean" != typeof o2) return false;
          (o2 instanceof Array || Array.isArray(o2)) && (e2.canAdmin = new Set(o2));
          break;
        default:
          return false;
      }
    }
    return true;
  }, help: "updatePermissions can take hasPresence, canSend, canReceive, and canAdmin permissions. hasPresence must be a boolean. canSend can be a boolean or an Array or Set of media types (video, audio, screenVideo, screenAudio, customVideo, customAudio). canReceive must be an object specifying base, byUserId, and/or byParticipantId fields (see documentation for more details). canAdmin can be a boolean or an Array or Set of admin types (participants, streaming, transcription)." } };
  Promise.any || (Promise.any = (function() {
    var e2 = p((function* (e3) {
      return new Promise((function(t2, n2) {
        var r2 = [];
        e3.forEach((function(i2) {
          return Promise.resolve(i2).then((function(e4) {
            t2(e4);
          })).catch((function(t3) {
            r2.push(t3), r2.length === e3.length && n2(r2);
          }));
        }));
      }));
    }));
    return function(t2) {
      return e2.apply(this, arguments);
    };
  })());
  var Qs = (function() {
    function r2(e2) {
      var n2, i3, o2, c3, l2, d3, h3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
      if (t(this, r2), o2 = this, c3 = s(c3 = r2), u(i3 = a(o2, js() ? Reflect.construct(c3, l2 || [], s(o2).constructor) : c3.apply(o2, l2)), "startListeningForDeviceChanges", (function() {
        ds(i3.handleDeviceChange);
      })), u(i3, "stopListeningForDeviceChanges", (function() {
        ps(i3.handleDeviceChange);
      })), u(i3, "handleDeviceChange", (function(e3) {
        e3 = e3.map((function(e4) {
          return JSON.parse(JSON.stringify(e4));
        })), i3.emitDailyJSEvent({ action: "available-devices-updated", availableDevices: e3 });
      })), u(i3, "handleNativeAppStateChange", (function() {
        var e3 = p((function* (e4) {
          if ("destroyed" === e4) return console.warn("App has been destroyed before leaving the meeting. Cleaning up all the resources!"), void (yield i3.destroy());
          var t2 = "active" === e4;
          i3.disableReactNativeAutoDeviceManagement("video") || (t2 ? i3.camUnmutedBeforeLosingNativeActiveState && i3.setLocalVideo(true) : (i3.camUnmutedBeforeLosingNativeActiveState = i3.localVideo(), i3.camUnmutedBeforeLosingNativeActiveState && i3.setLocalVideo(false)));
        }));
        return function(t2) {
          return e3.apply(this, arguments);
        };
      })()), u(i3, "handleNativeAudioFocusChange", (function(e3) {
        i3.disableReactNativeAutoDeviceManagement("audio") || (i3._hasNativeAudioFocus = e3, i3.toggleParticipantAudioBasedOnNativeAudioFocus(), i3._hasNativeAudioFocus ? i3.micUnmutedBeforeLosingNativeAudioFocus && i3.setLocalAudio(true) : (i3.micUnmutedBeforeLosingNativeAudioFocus = i3.localAudio(), i3.setLocalAudio(false)));
      })), u(i3, "handleNativeSystemScreenCaptureStop", (function() {
        i3.stopScreenShare();
      })), !fa() && !ia()) throw new Error("WebRTC not supported or suppressed");
      if (i3.strictMode = void 0 === h3.strictMode || h3.strictMode, i3.allowMultipleCallInstances = null !== (n2 = h3.allowMultipleCallInstances) && void 0 !== n2 && n2, Object.keys(Ls).length && (i3._logDuplicateInstanceAttempt(), !i3.allowMultipleCallInstances)) {
        if (i3.strictMode) throw new Error("Duplicate DailyIframe instances are not allowed");
        console.warn("Using strictMode: false to allow multiple call instances is now deprecated. Set `allowMultipleCallInstances: true`");
      }
      if (window._daily || (window._daily = { pendings: [], instances: {} }), i3.callClientId = N(), Ls[(d3 = i3).callClientId] = d3, window._daily.instances[i3.callClientId] = {}, i3._sharedTracks = {}, window._daily.instances[i3.callClientId].tracks = i3._sharedTracks, h3.dailyJsVersion = r2.version(), void 0 !== h3.aboutClient && (h3.aboutClient = Ws(h3.aboutClient)), i3._iframe = e2, i3._callObjectMode = "none" === h3.layout && !i3._iframe, i3._preloadCache = { subscribeToTracksAutomatically: true, outputDeviceId: null, inputSettings: null, sendSettings: null, videoTrackForNetworkConnectivityTest: null, videoTrackForConnectionQualityTest: null }, void 0 !== h3.showLocalVideo ? i3._callObjectMode ? console.error("showLocalVideo is not available in call object mode") : i3._showLocalVideo = !!h3.showLocalVideo : i3._showLocalVideo = true, void 0 !== h3.showParticipantsBar ? i3._callObjectMode ? console.error("showParticipantsBar is not available in call object mode") : i3._showParticipantsBar = !!h3.showParticipantsBar : i3._showParticipantsBar = true, void 0 !== h3.customIntegrations ? i3._callObjectMode ? console.error("customIntegrations is not available in call object mode") : i3._customIntegrations = h3.customIntegrations : i3._customIntegrations = {}, void 0 !== h3.customTrayButtons ? i3._callObjectMode ? console.error("customTrayButtons is not available in call object mode") : i3._customTrayButtons = h3.customTrayButtons : i3._customTrayButtons = {}, void 0 !== h3.activeSpeakerMode ? i3._callObjectMode ? console.error("activeSpeakerMode is not available in call object mode") : i3._activeSpeakerMode = !!h3.activeSpeakerMode : i3._activeSpeakerMode = false, h3.receiveSettings ? i3._callObjectMode ? i3._receiveSettings = h3.receiveSettings : console.error("receiveSettings is only available in call object mode") : i3._receiveSettings = {}, i3.validateProperties(h3), i3.properties = As({}, h3), void 0 !== i3.properties.aboutClient && (i3.properties.aboutClient = Ws(i3.properties.aboutClient)), i3._inputSettings || (i3._inputSettings = {}), i3._callObjectLoader = i3._callObjectMode ? new Ua(i3.callClientId) : null, i3._callState = ti, i3._isPreparingToJoin = false, i3._accessState = { access: fi }, i3._meetingSessionSummary = {}, i3._finalSummaryOfPrevSession = {}, i3._meetingSessionState = kc(Rs, i3._callObjectMode), i3._nativeInCallAudioMode = Ds, i3._participants = {}, i3._isScreenSharing = false, i3._participantCounts = Fs, i3._rmpPlayerState = {}, i3._waitingParticipants = {}, i3._network = { threshold: "good", quality: 100, networkState: "unknown", stats: {} }, i3._activeSpeaker = {}, i3._localAudioLevel = 0, i3._isLocalAudioLevelObserverRunning = false, i3._remoteParticipantsAudioLevel = {}, i3._isRemoteParticipantsAudioLevelObserverRunning = false, i3._maxAppMessageSize = $o, i3._messageChannel = ia() ? new ja() : new Oa(), i3._iframe && (i3._iframe.requestFullscreen ? i3._iframe.addEventListener("fullscreenchange", (function() {
        document.fullscreenElement === i3._iframe ? (i3.emitDailyJSEvent({ action: Io }), i3.sendMessageToCallMachine({ action: Io })) : (i3.emitDailyJSEvent({ action: xo }), i3.sendMessageToCallMachine({ action: xo }));
      })) : i3._iframe.webkitRequestFullscreen && i3._iframe.addEventListener("webkitfullscreenchange", (function() {
        document.webkitFullscreenElement === i3._iframe ? (i3.emitDailyJSEvent({ action: Io }), i3.sendMessageToCallMachine({ action: Io })) : (i3.emitDailyJSEvent({ action: xo }), i3.sendMessageToCallMachine({ action: xo }));
      }))), ia()) {
        var f2 = i3.nativeUtils();
        f2.addAudioFocusChangeListener && f2.removeAudioFocusChangeListener && f2.addAppStateChangeListener && f2.removeAppStateChangeListener && f2.addSystemScreenCaptureStopListener && f2.removeSystemScreenCaptureStopListener || console.warn("expected (add|remove)(AudioFocusChange|AppActiveStateChange|SystemScreenCaptureStop)Listener to be available in React Native"), i3._hasNativeAudioFocus = true, f2.addAudioFocusChangeListener(i3.handleNativeAudioFocusChange), f2.addAppStateChangeListener(i3.handleNativeAppStateChange), f2.addSystemScreenCaptureStopListener(i3.handleNativeSystemScreenCaptureStop);
      }
      return i3._callObjectMode && i3.startListeningForDeviceChanges(), i3._messageChannel.addListenerForMessagesFromCallMachine(i3.handleMessageFromCallMachine, i3.callClientId, i3), i3;
    }
    return l(r2, b), o(r2, [{ key: "destroy", value: (ee2 = p((function* () {
      var e2;
      try {
        yield this.leave();
      } catch (e3) {
      }
      var t2 = this._iframe;
      if (t2) {
        var n2 = t2.parentElement;
        n2 && n2.removeChild(t2);
      }
      if (this._messageChannel.removeListener(this.handleMessageFromCallMachine), ia()) {
        var r3 = this.nativeUtils();
        r3.removeAudioFocusChangeListener(this.handleNativeAudioFocusChange), r3.removeAppStateChangeListener(this.handleNativeAppStateChange), r3.removeSystemScreenCaptureStopListener(this.handleNativeSystemScreenCaptureStop);
      }
      this._callObjectMode && this.stopListeningForDeviceChanges(), this.resetMeetingDependentVars(), this._destroyed = true, this.emitDailyJSEvent({ action: "call-instance-destroyed" }), delete Ls[this.callClientId], (null === (e2 = window) || void 0 === e2 || null === (e2 = e2._daily) || void 0 === e2 ? void 0 : e2.instances) && delete window._daily.instances[this.callClientId], this.strictMode && (this.callClientId = void 0);
    })), function() {
      return ee2.apply(this, arguments);
    }) }, { key: "isDestroyed", value: function() {
      return !!this._destroyed;
    } }, { key: "loadCss", value: function(e2) {
      var t2 = e2.bodyClass, n2 = e2.cssFile, r3 = e2.cssText;
      return oc(), this.sendMessageToCallMachine({ action: "load-css", cssFile: this.absoluteUrl(n2), bodyClass: t2, cssText: r3 }), this;
    } }, { key: "iframe", value: function() {
      return oc(), this._iframe;
    } }, { key: "meetingState", value: function() {
      return this._callState;
    } }, { key: "accessState", value: function() {
      return rc(this._callObjectMode, "accessState()"), this._accessState;
    } }, { key: "participants", value: function() {
      return this._participants;
    } }, { key: "participantCounts", value: function() {
      return this._participantCounts;
    } }, { key: "waitingParticipants", value: function() {
      return rc(this._callObjectMode, "waitingParticipants()"), this._waitingParticipants;
    } }, { key: "validateParticipantProperties", value: function(e2, t2) {
      for (var n2 in t2) {
        if (!Gs[n2]) throw new Error("unrecognized updateParticipant property ".concat(n2));
        if (Gs[n2].validate && !Gs[n2].validate(t2[n2], this, this._participants[e2])) throw new Error(Gs[n2].help);
      }
    } }, { key: "updateParticipant", value: function(e2, t2) {
      return this._participants.local && this._participants.local.session_id === e2 && (e2 = "local"), e2 && t2 && (this.validateParticipantProperties(e2, t2), this.sendMessageToCallMachine({ action: "update-participant", id: e2, properties: t2 })), this;
    } }, { key: "updateParticipants", value: function(e2) {
      var t2 = this._participants.local && this._participants.local.session_id;
      for (var n2 in e2) n2 === t2 && (n2 = "local"), n2 && e2[n2] && this.validateParticipantProperties(n2, e2[n2]);
      return this.sendMessageToCallMachine({ action: "update-participants", participants: e2 }), this;
    } }, { key: "updateWaitingParticipant", value: (Z2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "", r3 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
      if (rc(this._callObjectMode, "updateWaitingParticipant()"), Xs(this._callState, "updateWaitingParticipant()"), "string" != typeof t2 || "object" !== n(r3)) throw new Error("updateWaitingParticipant() must take an id string and a updates object");
      return new Promise((function(n2, i3) {
        e2.sendMessageToCallMachine({ action: "daily-method-update-waiting-participant", id: t2, updates: r3 }, (function(e3) {
          e3.error && i3(e3.error), e3.id || i3(new Error("unknown error in updateWaitingParticipant()")), n2({ id: e3.id });
        }));
      }));
    })), function() {
      return Z2.apply(this, arguments);
    }) }, { key: "updateWaitingParticipants", value: (X2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      if (rc(this._callObjectMode, "updateWaitingParticipants()"), Xs(this._callState, "updateWaitingParticipants()"), "object" !== n(t2)) throw new Error("updateWaitingParticipants() must take a mapping between ids and update objects");
      return new Promise((function(n2, r3) {
        e2.sendMessageToCallMachine({ action: "daily-method-update-waiting-participants", updatesById: t2 }, (function(e3) {
          e3.error && r3(e3.error), e3.ids || r3(new Error("unknown error in updateWaitingParticipants()")), n2({ ids: e3.ids });
        }));
      }));
    })), function() {
      return X2.apply(this, arguments);
    }) }, { key: "requestAccess", value: (Y2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, n2 = t2.access, r3 = void 0 === n2 ? { level: vi } : n2, i3 = t2.name, o2 = void 0 === i3 ? "" : i3;
      return rc(this._callObjectMode, "requestAccess()"), Xs(this._callState, "requestAccess()"), new Promise((function(t3, n3) {
        e2.sendMessageToCallMachine({ action: "daily-method-request-access", access: r3, name: o2 }, (function(e3) {
          e3.error && n3(e3.error), e3.access || n3(new Error("unknown error in requestAccess()")), t3({ access: e3.access, granted: e3.granted });
        }));
      }));
    })), function() {
      return Y2.apply(this, arguments);
    }) }, { key: "localAudio", value: function() {
      return this._participants.local ? !["blocked", "off"].includes(this._participants.local.tracks.audio.state) : null;
    } }, { key: "localVideo", value: function() {
      return this._participants.local ? !["blocked", "off"].includes(this._participants.local.tracks.video.state) : null;
    } }, { key: "setLocalAudio", value: function(e2) {
      var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
      return "forceDiscardTrack" in t2 && (ia() ? (console.warn("forceDiscardTrack option not supported in React Native; ignoring"), t2 = {}) : e2 && (console.warn("forceDiscardTrack option only supported when calling setLocalAudio(false); ignoring"), t2 = {})), this.sendMessageToCallMachine({ action: "local-audio", state: e2, options: t2 }), this;
    } }, { key: "localScreenAudio", value: function() {
      return this._participants.local ? !["blocked", "off"].includes(this._participants.local.tracks.screenAudio.state) : null;
    } }, { key: "localScreenVideo", value: function() {
      return this._participants.local ? !["blocked", "off"].includes(this._participants.local.tracks.screenVideo.state) : null;
    } }, { key: "updateScreenShare", value: function(e2) {
      if (this._isScreenSharing) return this.sendMessageToCallMachine({ action: "local-screen-update", options: e2 }), this;
      console.warn("There is no screen share in progress. Try calling startScreenShare first.");
    } }, { key: "setLocalVideo", value: function(e2) {
      return this.sendMessageToCallMachine({ action: "local-video", state: e2 }), this;
    } }, { key: "_setAllowLocalAudio", value: function(e2) {
      if (this._preloadCache.allowLocalAudio = e2, this._callMachineInitialized) return this.sendMessageToCallMachine({ action: "set-allow-local-audio", state: e2 }), this;
    } }, { key: "_setAllowLocalVideo", value: function(e2) {
      if (this._preloadCache.allowLocalVideo = e2, this._callMachineInitialized) return this.sendMessageToCallMachine({ action: "set-allow-local-video", state: e2 }), this;
    } }, { key: "getReceiveSettings", value: (K2 = p((function* (e2) {
      var t2 = this, r3 = (arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {}).showInheritedValues, i3 = void 0 !== r3 && r3;
      if (rc(this._callObjectMode, "getReceiveSettings()"), !this._callMachineInitialized) return this._receiveSettings;
      switch (n(e2)) {
        case "string":
          return new Promise((function(n2) {
            t2.sendMessageToCallMachine({ action: "get-single-participant-receive-settings", id: e2, showInheritedValues: i3 }, (function(e3) {
              n2(e3.receiveSettings);
            }));
          }));
        case "undefined":
          return this._receiveSettings;
        default:
          throw new Error('first argument to getReceiveSettings() must be a participant id (or "base"), or there should be no arguments');
      }
    })), function(e2) {
      return K2.apply(this, arguments);
    }) }, { key: "updateReceiveSettings", value: (Q2 = p((function* (e2) {
      var t2 = this;
      if (rc(this._callObjectMode, "updateReceiveSettings()"), !cc(e2, { allowAllParticipantsKey: true })) throw new Error(vc({ allowAllParticipantsKey: true }));
      return Xs(this._callState, "updateReceiveSettings()", "To specify receive settings earlier, use the receiveSettings config property."), new Promise((function(n2) {
        t2.sendMessageToCallMachine({ action: "update-receive-settings", receiveSettings: e2 }, (function(e3) {
          n2({ receiveSettings: e3.receiveSettings });
        }));
      }));
    })), function(e2) {
      return Q2.apply(this, arguments);
    }) }, { key: "_prepInputSettingsForSharing", value: function(e2, t2) {
      if (e2) {
        var n2 = {};
        if (e2.audio) {
          var r3, i3, o2;
          e2.audio.settings && (!Object.keys(e2.audio.settings).length && t2 || (n2.audio = { settings: As({}, e2.audio.settings) })), t2 && null !== (r3 = n2.audio) && void 0 !== r3 && null !== (r3 = r3.settings) && void 0 !== r3 && r3.customTrack && (n2.audio.settings = { customTrack: this._sharedTracks.audioTrack });
          var a2 = "none" === (null === (i3 = e2.audio.processor) || void 0 === i3 ? void 0 : i3.type) && (null === (o2 = e2.audio.processor) || void 0 === o2 ? void 0 : o2._isDefaultWhenNone);
          if (e2.audio.processor && !a2) {
            var s2 = As({}, e2.audio.processor);
            delete s2._isDefaultWhenNone, n2.audio = As(As({}, n2.audio), {}, { processor: s2 });
          }
        }
        if (e2.video) {
          var c3, l2, u2;
          e2.video.settings && (!Object.keys(e2.video.settings).length && t2 || (n2.video = { settings: As({}, e2.video.settings) })), t2 && null !== (c3 = n2.video) && void 0 !== c3 && null !== (c3 = c3.settings) && void 0 !== c3 && c3.customTrack && (n2.video.settings = { customTrack: this._sharedTracks.videoTrack });
          var d3 = "none" === (null === (l2 = e2.video.processor) || void 0 === l2 ? void 0 : l2.type) && (null === (u2 = e2.video.processor) || void 0 === u2 ? void 0 : u2._isDefaultWhenNone);
          if (e2.video.processor && !d3) {
            var p2 = As({}, e2.video.processor);
            delete p2._isDefaultWhenNone, n2.video = As(As({}, n2.video), {}, { processor: p2 });
          }
        }
        return n2;
      }
    } }, { key: "getInputSettings", value: function() {
      var e2 = this;
      return oc(), new Promise((function(t2) {
        t2(e2._getInputSettings());
      }));
    } }, { key: "_getInputSettings", value: function() {
      var e2, t2, n2, r3, i3, o2, a2 = { processor: { type: "none", _isDefaultWhenNone: true } };
      this._inputSettings ? (e2 = (null === (n2 = this._inputSettings) || void 0 === n2 ? void 0 : n2.video) || a2, t2 = (null === (r3 = this._inputSettings) || void 0 === r3 ? void 0 : r3.audio) || a2) : (e2 = (null === (i3 = this._preloadCache) || void 0 === i3 || null === (i3 = i3.inputSettings) || void 0 === i3 ? void 0 : i3.video) || a2, t2 = (null === (o2 = this._preloadCache) || void 0 === o2 || null === (o2 = o2.inputSettings) || void 0 === o2 ? void 0 : o2.audio) || a2);
      var s2 = { audio: t2, video: e2 };
      return this._prepInputSettingsForSharing(s2, true);
    } }, { key: "_updatePreloadCacheInputSettings", value: function(e2, t2) {
      var n2 = this._inputSettings || {}, r3 = {};
      if (e2.video) {
        var i3, o2, a2;
        if (r3.video = {}, e2.video.settings) r3.video.settings = {}, t2 || e2.video.settings.customTrack || null === (a2 = n2.video) || void 0 === a2 || !a2.settings ? r3.video.settings = e2.video.settings : r3.video.settings = As(As({}, n2.video.settings), e2.video.settings), Object.keys(r3.video.settings).length || delete r3.video.settings;
        else null !== (i3 = n2.video) && void 0 !== i3 && i3.settings && (r3.video.settings = n2.video.settings);
        e2.video.processor ? r3.video.processor = e2.video.processor : null !== (o2 = n2.video) && void 0 !== o2 && o2.processor && (r3.video.processor = n2.video.processor);
      } else n2.video && (r3.video = n2.video);
      if (e2.audio) {
        var s2, c3, l2;
        if (r3.audio = {}, e2.audio.settings) r3.audio.settings = {}, t2 || e2.audio.settings.customTrack || null === (l2 = n2.audio) || void 0 === l2 || !l2.settings ? r3.audio.settings = e2.audio.settings : r3.audio.settings = As(As({}, n2.audio.settings), e2.audio.settings), Object.keys(r3.audio.settings).length || delete r3.audio.settings;
        else null !== (s2 = n2.audio) && void 0 !== s2 && s2.settings && (r3.audio.settings = n2.audio.settings);
        e2.audio.processor ? r3.audio.processor = e2.audio.processor : null !== (c3 = n2.audio) && void 0 !== c3 && c3.processor && (r3.audio.processor = n2.audio.processor);
      } else n2.audio && (r3.audio = n2.audio);
      this._maybeUpdateInputSettings(r3);
    } }, { key: "_devicesFromInputSettings", value: function(e2) {
      var t2, n2, r3 = (null == e2 || null === (t2 = e2.video) || void 0 === t2 || null === (t2 = t2.settings) || void 0 === t2 ? void 0 : t2.deviceId) || null, i3 = (null == e2 || null === (n2 = e2.audio) || void 0 === n2 || null === (n2 = n2.settings) || void 0 === n2 ? void 0 : n2.deviceId) || null, o2 = this._preloadCache.outputDeviceId || null;
      return { camera: r3 ? { deviceId: r3 } : {}, mic: i3 ? { deviceId: i3 } : {}, speaker: o2 ? { deviceId: o2 } : {} };
    } }, { key: "updateInputSettings", value: (G2 = p((function* (e2) {
      var t2 = this;
      return oc(), lc(e2) ? e2.video || e2.audio ? (uc(e2, this.properties.dailyConfig, this._sharedTracks), this._callObjectMode && !this._callMachineInitialized ? (this._updatePreloadCacheInputSettings(e2, true), this._getInputSettings()) : new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine({ action: "update-input-settings", inputSettings: e2 }, (function(i3) {
          if (i3.error) r3(i3.error);
          else {
            if (i3.returnPreloadCache) return t2._updatePreloadCacheInputSettings(e2, true), void n2(t2._getInputSettings());
            t2._maybeUpdateInputSettings(i3.inputSettings), n2(t2._prepInputSettingsForSharing(i3.inputSettings, true));
          }
        }));
      }))) : this._getInputSettings() : (console.error(fc()), Promise.reject(fc()));
    })), function(e2) {
      return G2.apply(this, arguments);
    }) }, { key: "setBandwidth", value: function(e2) {
      var t2 = e2.kbs, n2 = e2.trackConstraints;
      if (oc(), this._callMachineInitialized) return this.sendMessageToCallMachine({ action: "set-bandwidth", kbs: t2, trackConstraints: n2 }), this;
    } }, { key: "getDailyLang", value: function() {
      var e2 = this;
      if (oc(), this._callMachineInitialized) return new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "get-daily-lang" }, (function(e3) {
          delete e3.action, delete e3.callbackStamp, t2(e3);
        }));
      }));
    } }, { key: "setDailyLang", value: function(e2) {
      return oc(), this.sendMessageToCallMachine({ action: "set-daily-lang", lang: e2 }), this;
    } }, { key: "setProxyUrl", value: function(e2) {
      return this.sendMessageToCallMachine({ action: "set-proxy-url", proxyUrl: e2 }), this;
    } }, { key: "setIceConfig", value: function(e2) {
      return this.sendMessageToCallMachine({ action: "set-ice-config", iceConfig: e2 }), this;
    } }, { key: "meetingSessionSummary", value: function() {
      return [ai, si].includes(this._callState) ? this._finalSummaryOfPrevSession : this._meetingSessionSummary;
    } }, { key: "getMeetingSession", value: (H2 = p((function* () {
      var e2 = this;
      return console.warn("getMeetingSession() is deprecated: use meetingSessionSummary(), which will return immediately"), Xs(this._callState, "getMeetingSession()"), new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "get-meeting-session" }, (function(e3) {
          delete e3.action, delete e3.callbackStamp, t2(e3);
        }));
      }));
    })), function() {
      return H2.apply(this, arguments);
    }) }, { key: "meetingSessionState", value: function() {
      return Xs(this._callState, "meetingSessionState"), this._meetingSessionState;
    } }, { key: "setMeetingSessionData", value: function(e2) {
      var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "replace";
      rc(this._callObjectMode, "setMeetingSessionData()"), Xs(this._callState, "setMeetingSessionData");
      try {
        !(function(e3, t3) {
          new Da({ data: e3, mergeStrategy: t3 });
        })(e2, t2);
      } catch (e3) {
        throw console.error(e3), e3;
      }
      try {
        this.sendMessageToCallMachine({ action: "set-session-data", data: e2, mergeStrategy: t2 });
      } catch (e3) {
        throw new Error("Error setting meeting session data: ".concat(e3));
      }
    } }, { key: "setUserName", value: function(e2, t2) {
      var n2 = this;
      return this.properties.userName = e2, new Promise((function(r3) {
        n2.sendMessageToCallMachine({ action: "set-user-name", name: null != e2 ? e2 : "", thisMeetingOnly: ia() || !!t2 && !!t2.thisMeetingOnly }, (function(e3) {
          delete e3.action, delete e3.callbackStamp, r3(e3);
        }));
      }));
    } }, { key: "setUserData", value: (W2 = p((function* (e2) {
      var t2 = this;
      try {
        sc(e2);
      } catch (e3) {
        throw console.error(e3), e3;
      }
      if (this.properties.userData = e2, this._callMachineInitialized) return new Promise((function(n2) {
        try {
          t2.sendMessageToCallMachine({ action: "set-user-data", userData: e2 }, (function(e3) {
            delete e3.action, delete e3.callbackStamp, n2(e3);
          }));
        } catch (e3) {
          throw new Error("Error setting user data: ".concat(e3));
        }
      }));
    })), function(e2) {
      return W2.apply(this, arguments);
    }) }, { key: "validateAudioLevelInterval", value: function(e2) {
      if (e2 && (e2 < 100 || "number" != typeof e2)) throw new Error("The interval must be a number greater than or equal to 100 milliseconds.");
    } }, { key: "startLocalAudioLevelObserver", value: function(e2) {
      var t2 = this;
      if ("undefined" == typeof AudioWorkletNode && !ia()) throw new Error("startLocalAudioLevelObserver() is not supported on this browser");
      if (this.validateAudioLevelInterval(e2), this._callMachineInitialized) return this._isLocalAudioLevelObserverRunning = true, new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine({ action: "start-local-audio-level-observer", interval: e2 }, (function(e3) {
          t2._isLocalAudioLevelObserverRunning = !e3.error, e3.error ? r3({ error: e3.error }) : n2();
        }));
      }));
      this._preloadCache.localAudioLevelObserver = { enabled: true, interval: e2 };
    } }, { key: "isLocalAudioLevelObserverRunning", value: function() {
      return this._isLocalAudioLevelObserverRunning;
    } }, { key: "stopLocalAudioLevelObserver", value: function() {
      this._preloadCache.localAudioLevelObserver = null, this._localAudioLevel = 0, this._isLocalAudioLevelObserverRunning = false, this.sendMessageToCallMachine({ action: "stop-local-audio-level-observer" });
    } }, { key: "startRemoteParticipantsAudioLevelObserver", value: function(e2) {
      var t2 = this;
      if (this.validateAudioLevelInterval(e2), this._callMachineInitialized) return this._isRemoteParticipantsAudioLevelObserverRunning = true, new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine({ action: "start-remote-participants-audio-level-observer", interval: e2 }, (function(e3) {
          t2._isRemoteParticipantsAudioLevelObserverRunning = !e3.error, e3.error ? r3({ error: e3.error }) : n2();
        }));
      }));
      this._preloadCache.remoteParticipantsAudioLevelObserver = { enabled: true, interval: e2 };
    } }, { key: "isRemoteParticipantsAudioLevelObserverRunning", value: function() {
      return this._isRemoteParticipantsAudioLevelObserverRunning;
    } }, { key: "stopRemoteParticipantsAudioLevelObserver", value: function() {
      this._preloadCache.remoteParticipantsAudioLevelObserver = null, this._remoteParticipantsAudioLevel = {}, this._isRemoteParticipantsAudioLevelObserverRunning = false, this.sendMessageToCallMachine({ action: "stop-remote-participants-audio-level-observer" });
    } }, { key: "startCamera", value: (z2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      if (rc(this._callObjectMode, "startCamera()"), ec(this._callState, this._isPreparingToJoin, "startCamera()", "Did you mean to use setLocalAudio() and/or setLocalVideo() instead?"), this.needsLoad()) try {
        yield this.load(t2);
      } catch (e3) {
        return Promise.reject(e3);
      }
      else {
        if (this._didPreAuth) {
          if (t2.url && t2.url !== this.properties.url) return console.error("url in startCamera() is different than the one used in preAuth()"), Promise.reject();
          if (t2.token && t2.token !== this.properties.token) return console.error("token in startCamera() is different than the one used in preAuth()"), Promise.reject();
        }
        this.validateProperties(t2), this.properties = As(As({}, this.properties), t2);
      }
      return new Promise((function(t3, n2) {
        e2._preloadCache.inputSettings = e2._prepInputSettingsForSharing(e2._inputSettings, false), e2.sendMessageToCallMachine({ action: "start-camera", properties: Ys(e2.properties, e2.callClientId), preloadCache: Ys(e2._preloadCache, e2.callClientId) }, (function(e3) {
          e3.error ? n2(e3.error) : t3({ camera: e3.camera, mic: e3.mic, speaker: e3.speaker });
        }));
      }));
    })), function() {
      return z2.apply(this, arguments);
    }) }, { key: "validateCustomTrack", value: function(e2, t2, n2) {
      if (n2 && n2.length > 50) throw new Error("Custom track `trackName` must not be more than 50 characters");
      if (t2 && "music" !== t2 && "speech" !== t2 && !(t2 instanceof Object)) throw new Error("Custom track `mode` must be either `music` | `speech` | `DailyMicAudioModeSettings` or `undefined`");
      if (!!n2 && ["cam-audio", "cam-video", "screen-video", "screen-audio", "rmpAudio", "rmpVideo", "customVideoDefaults"].includes(n2)) throw new Error("Custom track `trackName` must not match a track name already used by daily: cam-audio, cam-video, customVideoDefaults, screen-video, screen-audio, rmpAudio, rmpVideo");
      if (!(e2 instanceof MediaStreamTrack)) throw new Error("Custom tracks provided must be instances of MediaStreamTrack");
    } }, { key: "startCustomTrack", value: function() {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : { track, mode, trackName, ignoreAudioLevel };
      return oc(), Xs(this._callState, "startCustomTrack()"), this.validateCustomTrack(t2.track, t2.mode, t2.trackName), new Promise((function(n2, r3) {
        e2._sharedTracks.customTrack = t2.track, t2.track = Qo, e2.sendMessageToCallMachine({ action: "start-custom-track", properties: t2 }, (function(e3) {
          e3.error ? r3({ error: e3.error }) : n2(e3.mediaTag);
        }));
      }));
    } }, { key: "stopCustomTrack", value: function(e2) {
      var t2 = this;
      return oc(), Xs(this._callState, "stopCustomTrack()"), new Promise((function(n2) {
        t2.sendMessageToCallMachine({ action: "stop-custom-track", mediaTag: e2 }, (function(e3) {
          n2(e3.mediaTag);
        }));
      }));
    } }, { key: "setCamera", value: function(e2) {
      var t2 = this;
      return ac(), tc(this._callMachineInitialized, "setCamera()"), new Promise((function(n2) {
        t2.sendMessageToCallMachine({ action: "set-camera", cameraDeviceId: e2 }, (function(e3) {
          n2({ device: e3.device });
        }));
      }));
    } }, { key: "setAudioDevice", value: (q2 = p((function* (e2) {
      return ac(), this.nativeUtils().setAudioDevice(e2), { deviceId: yield this.nativeUtils().getAudioDevice() };
    })), function(e2) {
      return q2.apply(this, arguments);
    }) }, { key: "cycleCamera", value: function() {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      return new Promise((function(n2) {
        e2.sendMessageToCallMachine({ action: "cycle-camera", properties: t2 }, (function(e3) {
          n2({ device: e3.device });
        }));
      }));
    } }, { key: "cycleMic", value: function() {
      var e2 = this;
      return oc(), new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "cycle-mic" }, (function(e3) {
          t2({ device: e3.device });
        }));
      }));
    } }, { key: "getCameraFacingMode", value: function() {
      var e2 = this;
      return ac(), new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "get-camera-facing-mode" }, (function(e3) {
          t2(e3.facingMode);
        }));
      }));
    } }, { key: "setInputDevicesAsync", value: ($2 = p((function* (e2) {
      var t2 = this, n2 = e2.audioDeviceId, r3 = e2.videoDeviceId, i3 = e2.audioSource, o2 = e2.videoSource;
      if (oc(), void 0 !== i3 && (n2 = i3), void 0 !== o2 && (r3 = o2), "boolean" == typeof n2 && (this._setAllowLocalAudio(n2), n2 = void 0), "boolean" == typeof r3 && (this._setAllowLocalVideo(r3), r3 = void 0), !n2 && !r3) return yield this.getInputDevices();
      var a2 = {};
      return n2 && (n2 instanceof MediaStreamTrack ? (this._sharedTracks.audioTrack = n2, n2 = Qo, a2.audio = { settings: { customTrack: n2 } }) : (delete this._sharedTracks.audioTrack, a2.audio = { settings: { deviceId: n2 } })), r3 && (r3 instanceof MediaStreamTrack ? (this._sharedTracks.videoTrack = r3, r3 = Qo, a2.video = { settings: { customTrack: r3 } }) : (delete this._sharedTracks.videoTrack, a2.video = { settings: { deviceId: r3 } })), this._callObjectMode && this.needsLoad() ? (this._updatePreloadCacheInputSettings(a2, false), this._devicesFromInputSettings(this._inputSettings)) : new Promise((function(e3) {
        t2.sendMessageToCallMachine({ action: "set-input-devices", audioDeviceId: n2, videoDeviceId: r3 }, (function(n3) {
          if (delete n3.action, delete n3.callbackStamp, n3.returnPreloadCache) return t2._updatePreloadCacheInputSettings(a2, false), void e3(t2._devicesFromInputSettings(t2._inputSettings));
          e3(n3);
        }));
      }));
    })), function(e2) {
      return $2.apply(this, arguments);
    }) }, { key: "setOutputDeviceAsync", value: (J2 = p((function* (e2) {
      var t2 = this, n2 = e2.outputDeviceId;
      if (oc(), !n2 || "string" != typeof n2) throw new Error("outputDeviceId must be provided and must be a valid device id");
      return this._preloadCache.outputDeviceId = n2, this._callObjectMode && this.needsLoad() ? this._devicesFromInputSettings(this._inputSettings) : new Promise((function(e3, r3) {
        t2.sendMessageToCallMachine({ action: "set-output-device", outputDeviceId: n2 }, (function(n3) {
          if (delete n3.action, delete n3.callbackStamp, n3.error) {
            var i3 = new Error(n3.error.message);
            return i3.type = n3.error.type, void r3(i3);
          }
          n3.returnPreloadCache ? e3(t2._devicesFromInputSettings(t2._inputSettings)) : e3(n3);
        }));
      }));
    })), function(e2) {
      return J2.apply(this, arguments);
    }) }, { key: "getInputDevices", value: (V2 = p((function* () {
      var e2 = this;
      return this._callObjectMode && this.needsLoad() ? this._devicesFromInputSettings(this._inputSettings) : new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "get-input-devices" }, (function(n2) {
          n2.returnPreloadCache ? t2(e2._devicesFromInputSettings(e2._inputSettings)) : t2({ camera: n2.camera, mic: n2.mic, speaker: n2.speaker });
        }));
      }));
    })), function() {
      return V2.apply(this, arguments);
    }) }, { key: "nativeInCallAudioMode", value: function() {
      return ac(), this._nativeInCallAudioMode;
    } }, { key: "setNativeInCallAudioMode", value: function(e2) {
      if (ac(), [Ds, Ns].includes(e2)) {
        if (e2 !== this._nativeInCallAudioMode) return this._nativeInCallAudioMode = e2, !this.disableReactNativeAutoDeviceManagement("audio") && Zs(this._callState, this._isPreparingToJoin) && this.nativeUtils().setAudioMode(this._nativeInCallAudioMode), this;
      } else console.error("invalid in-call audio mode specified: ", e2);
    } }, { key: "preAuth", value: (U2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      if (rc(this._callObjectMode, "preAuth()"), ec(this._callState, this._isPreparingToJoin, "preAuth()"), this.needsLoad() && (yield this.load(t2)), !t2.url) throw new Error("preAuth() requires at least a url to be provided");
      return this.validateProperties(t2), this.properties = As(As({}, this.properties), t2), new Promise((function(t3, n2) {
        e2._preloadCache.inputSettings = e2._prepInputSettingsForSharing(e2._inputSettings, false), e2.sendMessageToCallMachine({ action: "daily-method-preauth", properties: Ys(e2.properties, e2.callClientId), preloadCache: Ys(e2._preloadCache, e2.callClientId) }, (function(r3) {
          return r3.error ? n2(r3.error) : r3.access ? (e2._didPreAuth = true, void t3({ access: r3.access })) : n2(new Error("unknown error in preAuth()"));
        }));
      }));
    })), function() {
      return U2.apply(this, arguments);
    }) }, { key: "load", value: (R2 = p((function* (e2) {
      var t2 = this;
      if (this.needsLoad()) {
        if (this._destroyed && (this._logUseAfterDestroy(), this.strictMode)) throw new Error("Use after destroy");
        if (e2 && (this.validateProperties(e2), this.properties = As(As({}, this.properties), e2)), !this._callObjectMode && !this.properties.url) throw new Error("can't load iframe meeting because url property isn't set");
        return this._updateCallState(ni), this.emitDailyJSEvent({ action: Vi }), this._callObjectMode ? new Promise((function(e3, n2) {
          t2._callObjectLoader.cancel();
          var r3 = Date.now();
          t2._callObjectLoader.load(t2.properties.dailyConfig, (function(n3) {
            t2._bundleLoadTime = n3 ? "no-op" : Date.now() - r3, t2._updateCallState(ri), n3 && t2.emitDailyJSEvent({ action: $i }), e3();
          }), (function(e4, r4) {
            if (t2.emitDailyJSEvent({ action: Ji }), !r4) {
              t2._updateCallState(si), t2.resetMeetingDependentVars();
              var i3 = { action: Jo, errorMsg: e4.msg, error: { type: "connection-error", msg: "Failed to load call object bundle.", details: { on: "load", sourceError: e4, bundleUrl: B(t2.properties.dailyConfig) } } };
              t2._maybeSendToSentry(i3), t2.emitDailyJSEvent(i3), n2(e4.msg);
            }
          }));
        })) : (this._iframe.src = F(this.assembleMeetingUrl(), this.properties.dailyConfig), new Promise((function(e3, n2) {
          t2._loadedCallback = function(r3) {
            t2._callState !== si ? (t2._updateCallState(ri), (t2.properties.cssFile || t2.properties.cssText) && t2.loadCss(t2.properties), e3()) : n2(r3);
          };
        })));
      }
    })), function(e2) {
      return R2.apply(this, arguments);
    }) }, { key: "join", value: (L2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      if (this._testCallInProgress && this.stopTestCallQuality(), !t2.url && !this.properties.url) {
        var n2 = "No room URL has been provided";
        return console.error(n2), Promise.reject(new Error(n2));
      }
      var r3 = false;
      if (this.needsLoad()) {
        this.updateIsPreparingToJoin(true);
        try {
          yield this.load(t2);
        } catch (e3) {
          return this.updateIsPreparingToJoin(false), Promise.reject(e3);
        }
      } else {
        if (r3 = !(!this.properties.cssFile && !this.properties.cssText), this._didPreAuth) {
          if (t2.url && t2.url !== this.properties.url) return console.error("url in join() is different than the one used in preAuth()"), this.updateIsPreparingToJoin(false), Promise.reject();
          if (t2.token && t2.token !== this.properties.token) return console.error("token in join() is different than the one used in preAuth()"), this.updateIsPreparingToJoin(false), Promise.reject();
        }
        if (t2.url && !this._callObjectMode && t2.url && t2.url !== this.properties.url) return console.error("url in join() is different than the one used in load() (".concat(this.properties.url, " -> ").concat(t2.url, ")")), this.updateIsPreparingToJoin(false), Promise.reject();
        this.validateProperties(t2), this.properties = As(As({}, this.properties), t2);
      }
      return void 0 !== t2.showLocalVideo && (this._callObjectMode ? console.error("showLocalVideo is not available in callObject mode") : this._showLocalVideo = !!t2.showLocalVideo), void 0 !== t2.showParticipantsBar && (this._callObjectMode ? console.error("showParticipantsBar is not available in callObject mode") : this._showParticipantsBar = !!t2.showParticipantsBar), this._callState === oi || this._callState === ii ? (console.warn("already joined meeting, call leave() before joining again"), void this.updateIsPreparingToJoin(false)) : (this._updateCallState(ii, false), this.emitDailyJSEvent({ action: Wi }), this._preloadCache.inputSettings = this._prepInputSettingsForSharing(this._inputSettings || {}, false), this.sendMessageToCallMachine({ action: "join-meeting", properties: Ys(this.properties, this.callClientId), preloadCache: Ys(this._preloadCache, this.callClientId) }, (function(t3) {
        t3.error && e2._joinedCallback && (e2._joinedCallback(null, t3.error), e2._joinedCallback = null);
      })), new Promise((function(t3, n3) {
        e2._joinedCallback = function(i3, o2) {
          if (e2._callState !== si) {
            if (o2) return e2._updateCallState(ai), void n3(o2);
            if (e2._updateCallState(oi), i3) for (var a2 in i3) {
              if (e2._callObjectMode) {
                var s2 = e2._callMachine().store;
                Za(i3[a2], s2), es(i3[a2], s2), ns(i3[a2], e2._participants[a2], s2);
              }
              e2._participants[a2] = As({}, i3[a2]), e2.toggleParticipantAudioBasedOnNativeAudioFocus();
            }
            r3 && e2.loadCss(e2.properties), t3(i3);
          } else n3(o2);
        };
      })));
    })), function() {
      return L2.apply(this, arguments);
    }) }, { key: "leave", value: (x2 = p((function* () {
      var e2 = this;
      return this._testCallInProgress && this.stopTestCallQuality(), new Promise((function(t2) {
        e2._callState === ai || e2._callState === si ? t2() : e2._callObjectLoader && !e2._callObjectLoader.loaded ? (e2._callObjectLoader.cancel(), e2._updateCallState(ai), e2.resetMeetingDependentVars(), e2.emitDailyJSEvent({ action: ai }), t2()) : (e2._resolveLeave = t2, e2.sendMessageToCallMachine({ action: "leave-meeting" }));
      }));
    })), function() {
      return x2.apply(this, arguments);
    }) }, { key: "startScreenShare", value: (I2 = p((function* () {
      var e2 = this, t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      if (tc(this._callMachineInitialized, "startScreenShare()"), t2.screenVideoSendSettings && this._validateVideoSendSettings("screenVideo", t2.screenVideoSendSettings), t2.mediaStream && (this._sharedTracks.screenMediaStream = t2.mediaStream, t2.mediaStream = Qo), "undefined" != typeof DailyNativeUtils && void 0 !== DailyNativeUtils.isIOS && DailyNativeUtils.isIOS) {
        var n2 = this.nativeUtils();
        if (yield n2.isScreenBeingCaptured()) return void this.emitDailyJSEvent({ action: Vo, type: "screen-share-error", errorMsg: "Could not start the screen sharing. The screen is already been captured!" });
        n2.setSystemScreenCaptureStartCallback((function() {
          n2.setSystemScreenCaptureStartCallback(null), e2.sendMessageToCallMachine({ action: Wo, captureOptions: t2 });
        })), n2.presentSystemScreenCapturePrompt();
      } else this.sendMessageToCallMachine({ action: Wo, captureOptions: t2 });
    })), function() {
      return I2.apply(this, arguments);
    }) }, { key: "stopScreenShare", value: function() {
      tc(this._callMachineInitialized, "stopScreenShare()"), this.sendMessageToCallMachine({ action: "local-screen-stop" });
    } }, { key: "startRecording", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, t2 = e2.type;
      if (t2 && "cloud" !== t2 && "cloud-audio-only" !== t2 && "raw-tracks" !== t2 && "local" !== t2) throw new Error("invalid type: ".concat(t2, ", allowed values 'cloud', 'cloud-audio-only', 'raw-tracks', or 'local'"));
      this.sendMessageToCallMachine(As({ action: "local-recording-start" }, e2));
    } }, { key: "updateRecording", value: function(e2) {
      var t2 = e2.layout, n2 = void 0 === t2 ? { preset: "default" } : t2, r3 = e2.instanceId;
      this.sendMessageToCallMachine({ action: "daily-method-update-recording", layout: n2, instanceId: r3 });
    } }, { key: "stopRecording", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      this.sendMessageToCallMachine(As({ action: "local-recording-stop" }, e2));
    } }, { key: "startLiveStreaming", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      this.sendMessageToCallMachine(As({ action: "daily-method-start-live-streaming" }, e2));
    } }, { key: "updateLiveStreaming", value: function(e2) {
      var t2 = e2.layout, n2 = void 0 === t2 ? { preset: "default" } : t2, r3 = e2.instanceId;
      this.sendMessageToCallMachine({ action: "daily-method-update-live-streaming", layout: n2, instanceId: r3 });
    } }, { key: "addLiveStreamingEndpoints", value: function(e2) {
      var t2 = e2.endpoints, n2 = e2.instanceId;
      this.sendMessageToCallMachine({ action: Ho, endpointsOp: ea, endpoints: t2, instanceId: n2 });
    } }, { key: "removeLiveStreamingEndpoints", value: function(e2) {
      var t2 = e2.endpoints, n2 = e2.instanceId;
      this.sendMessageToCallMachine({ action: Ho, endpointsOp: ta, endpoints: t2, instanceId: n2 });
    } }, { key: "stopLiveStreaming", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      this.sendMessageToCallMachine(As({ action: "daily-method-stop-live-streaming" }, e2));
    } }, { key: "validateDailyConfig", value: function(e2) {
      e2.camSimulcastEncodings && (console.warn("camSimulcastEncodings is deprecated. Use sendSettings, found in DailyCallOptions, to provide camera simulcast settings."), this.validateSimulcastEncodings(e2.camSimulcastEncodings)), e2.screenSimulcastEncodings && console.warn("screenSimulcastEncodings is deprecated. Use sendSettings, found in DailyCallOptions, to provide screen simulcast settings."), va() && e2.noAutoDefaultDeviceChange && console.warn("noAutoDefaultDeviceChange is not supported on Android, and will be ignored.");
    } }, { key: "validateSimulcastEncodings", value: function(e2) {
      var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
      if (e2) {
        if (!(e2 instanceof Array || Array.isArray(e2))) throw new Error("encodings must be an Array");
        if (!Sc(e2.length, 1, 3)) throw new Error("encodings must be an Array with between 1 to ".concat(3, " layers"));
        for (var r3 = 0; r3 < e2.length; r3++) {
          var i3 = e2[r3];
          for (var o2 in this._validateEncodingLayerHasValidProperties(i3), i3) if (Us.includes(o2)) {
            if ("number" != typeof i3[o2]) throw new Error("".concat(o2, " must be a number"));
            if (t2) {
              var a2 = t2[o2], s2 = a2.min, c3 = a2.max;
              if (!Sc(i3[o2], s2, c3)) throw new Error("".concat(o2, " value not in range. valid range: ").concat(s2, " to ").concat(c3));
            }
          } else if (!["active", "scalabilityMode"].includes(o2)) throw new Error("Invalid key ".concat(o2, ", valid keys are:") + Object.values(Us));
          if (n2 && !i3.hasOwnProperty("maxBitrate")) throw new Error("maxBitrate is not specified");
        }
      }
    } }, { key: "startRemoteMediaPlayer", value: (j2 = p((function* (e2) {
      var t2 = this, n2 = e2.url, r3 = e2.settings, i3 = void 0 === r3 ? { state: Xo.PLAY } : r3;
      try {
        !(function(e3) {
          if ("string" != typeof e3) throw new Error('url parameter must be "string" type');
        })(n2), wc(i3), (function(e3) {
          for (var t3 in e3) if (!Vs.includes(t3)) throw new Error("Invalid key ".concat(t3, ", valid keys are: ").concat(Vs));
          e3.simulcastEncodings && this.validateSimulcastEncodings(e3.simulcastEncodings, Bs, true);
        })(i3);
      } catch (e3) {
        throw console.error("invalid argument Error: ".concat(e3)), console.error('startRemoteMediaPlayer arguments must be of the form:\n  { url: "playback url",\n  settings?:\n  {state: "play"|"pause", simulcastEncodings?: [{}] } }'), e3;
      }
      return new Promise((function(e3, r4) {
        t2.sendMessageToCallMachine({ action: "daily-method-start-remote-media-player", url: n2, settings: i3 }, (function(t3) {
          t3.error ? r4({ error: t3.error, errorMsg: t3.errorMsg }) : e3({ session_id: t3.session_id, remoteMediaPlayerState: { state: t3.state, settings: t3.settings } });
        }));
      }));
    })), function(e2) {
      return j2.apply(this, arguments);
    }) }, { key: "stopRemoteMediaPlayer", value: (A2 = p((function* (e2) {
      var t2 = this;
      if ("string" != typeof e2) throw new Error(" remotePlayerID must be of type string");
      return new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine({ action: "daily-method-stop-remote-media-player", session_id: e2 }, (function(e3) {
          e3.error ? r3({ error: e3.error, errorMsg: e3.errorMsg }) : n2();
        }));
      }));
    })), function(e2) {
      return A2.apply(this, arguments);
    }) }, { key: "updateRemoteMediaPlayer", value: (P2 = p((function* (e2) {
      var t2 = this, n2 = e2.session_id, r3 = e2.settings;
      try {
        wc(r3);
      } catch (e3) {
        throw console.error("invalid argument Error: ".concat(e3)), console.error('updateRemoteMediaPlayer arguments must be of the form:\n  session_id: "participant session",\n  { settings?: {state: "play"|"pause"} }'), e3;
      }
      return new Promise((function(e3, i3) {
        t2.sendMessageToCallMachine({ action: "daily-method-update-remote-media-player", session_id: n2, settings: r3 }, (function(t3) {
          t3.error ? i3({ error: t3.error, errorMsg: t3.errorMsg }) : e3({ session_id: t3.session_id, remoteMediaPlayerState: { state: t3.state, settings: t3.settings } });
        }));
      }));
    })), function(e2) {
      return P2.apply(this, arguments);
    }) }, { key: "startTranscription", value: function(e2) {
      Xs(this._callState, "startTranscription()"), this.sendMessageToCallMachine(As({ action: "daily-method-start-transcription" }, e2));
    } }, { key: "updateTranscription", value: function(e2) {
      if (Xs(this._callState, "updateTranscription()"), !e2) throw new Error("updateTranscription Error: options is mandatory");
      if ("object" !== n(e2)) throw new Error("updateTranscription Error: options must be object type");
      if (e2.participants && !Array.isArray(e2.participants)) throw new Error("updateTranscription Error: participants must be an array");
      this.sendMessageToCallMachine(As({ action: "daily-method-update-transcription" }, e2));
    } }, { key: "stopTranscription", value: function(e2) {
      if (Xs(this._callState, "stopTranscription()"), e2 && "object" !== n(e2)) throw new Error("stopTranscription Error: options must be object type");
      if (e2 && !e2.instanceId) throw new Error('"instanceId" not provided');
      this.sendMessageToCallMachine(As({ action: "daily-method-stop-transcription" }, e2));
    } }, { key: "startDialOut", value: (O2 = p((function* (e2) {
      var t2 = this;
      Xs(this._callState, "startDialOut()");
      var n2 = function(e3) {
        if (e3) {
          if (!Array.isArray(e3)) throw new Error("Error starting dial out: audio codec must be an array");
          if (e3.length <= 0) throw new Error("Error starting dial out: audio codec array specified but empty");
          e3.forEach((function(e4) {
            if ("string" != typeof e4) throw new Error("Error starting dial out: audio codec must be a string");
            if ("OPUS" !== e4 && "PCMU" !== e4 && "PCMA" !== e4 && "G722" !== e4) throw new Error("Error starting dial out: audio codec must be one of OPUS, PCMU, PCMA, G722");
          }));
        }
      };
      if (!e2.sipUri && !e2.phoneNumber) throw new Error("Error starting dial out: either a sip uri or phone number must be provided");
      if (e2.sipUri && e2.phoneNumber) throw new Error("Error starting dial out: only one of sip uri or phone number must be provided");
      if (e2.sipUri) {
        if ("string" != typeof e2.sipUri) throw new Error("Error starting dial out: sipUri must be a string");
        if (!e2.sipUri.startsWith("sip:")) throw new Error("Error starting dial out: Invalid SIP URI, must start with 'sip:'");
        if (e2.video && "boolean" != typeof e2.video) throw new Error("Error starting dial out: video must be a boolean value");
        !(function(e3) {
          if (e3 && (n2(e3.audio), e3.video)) {
            if (!Array.isArray(e3.video)) throw new Error("Error starting dial out: video codec must be an array");
            if (e3.video.length <= 0) throw new Error("Error starting dial out: video codec array specified but empty");
            e3.video.forEach((function(e4) {
              if ("string" != typeof e4) throw new Error("Error starting dial out: video codec must be a string");
              if ("H264" !== e4 && "VP8" !== e4) throw new Error("Error starting dial out: video codec must be H264 or VP8");
            }));
          }
        })(e2.codecs);
      }
      if (e2.phoneNumber) {
        if ("string" != typeof e2.phoneNumber) throw new Error("Error starting dial out: phoneNumber must be a string");
        if (!/^\+\d{1,}$/.test(e2.phoneNumber)) throw new Error("Error starting dial out: Invalid phone number, must be valid phone number as per E.164");
        e2.codecs && n2(e2.codecs.audio);
      }
      if (e2.callerId) {
        if ("string" != typeof e2.callerId) throw new Error("Error starting dial out: callerId must be a string");
        if (e2.sipUri) throw new Error("Error starting dial out: callerId not allowed with sipUri");
      }
      if (e2.displayName) {
        if ("string" != typeof e2.displayName) throw new Error("Error starting dial out: displayName must be a string");
        if (e2.displayName.length >= 200) throw new Error("Error starting dial out: displayName length must be less than 200");
      }
      if (e2.userId) {
        if ("string" != typeof e2.userId) throw new Error("Error starting dial out: userId must be a string");
        if (e2.userId.length > 36) throw new Error("Error starting dial out: userId length must be less than or equal to 36");
      }
      if (Ks(e2), e2.permissions && e2.permissions.canReceive) {
        var r3 = f(Cs.validateJSONObject(e2.permissions.canReceive), 2), i3 = r3[0], o2 = r3[1];
        if (!i3) throw new Error(o2);
      }
      if (e2.provider) {
        if ("daily" !== e2.provider) throw new Error("Error: provider can be set only to 'daily', got: ".concat(e2.provider));
        if (e2.phoneNumber) throw new Error("Error starting dial out: provider valid only for sipUri, not phoneNumber");
        console.warn("(pre-beta) provider=daily is currently in pre-beta, things might break!");
      }
      return new Promise((function(n3, r4) {
        t2.sendMessageToCallMachine(As({ action: "dialout-start" }, e2), (function(e3) {
          e3.error ? r4(e3.error) : n3(e3);
        }));
      }));
    })), function(e2) {
      return O2.apply(this, arguments);
    }) }, { key: "stopDialOut", value: function(e2) {
      var t2 = this;
      return Xs(this._callState, "stopDialOut()"), new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine(As({ action: "dialout-stop" }, e2), (function(e3) {
          e3.error ? r3(e3.error) : n2(e3);
        }));
      }));
    } }, { key: "sipCallTransfer", value: (T2 = p((function* (e2) {
      var t2 = this;
      if (Xs(this._callState, "sipCallTransfer()"), !e2) throw new Error("sipCallTransfer() requires a sessionId and toEndPoint");
      return e2.useSipRefer = false, _c(e2, "sipCallTransfer"), Ks(e2), new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine(As({ action: na }, e2), (function(e3) {
          e3.error ? r3(e3.error) : n2(e3);
        }));
      }));
    })), function(e2) {
      return T2.apply(this, arguments);
    }) }, { key: "sipRefer", value: (E2 = p((function* (e2) {
      var t2 = this;
      if (Xs(this._callState, "sipRefer()"), !e2) throw new Error("sessionId and toEndPoint are mandatory parameter");
      return e2.useSipRefer = true, _c(e2, "sipRefer"), new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine(As({ action: na }, e2), (function(e3) {
          e3.error ? r3(e3.error) : n2(e3);
        }));
      }));
    })), function(e2) {
      return E2.apply(this, arguments);
    }) }, { key: "sendDTMF", value: (C2 = p((function* (e2) {
      var t2 = this;
      return Xs(this._callState, "sendDTMF()"), (function(e3) {
        var t3 = e3.sessionId, n2 = e3.tones, r3 = e3.method, i3 = e3.digitDurationMs;
        if (!t3 || !n2) throw new Error("sessionId and tones are mandatory parameter");
        if ("string" != typeof t3 || "string" != typeof n2) throw new Error("sessionId and tones should be of string type");
        if (n2.length > 20) throw new Error("tones string must be upto 20 characters");
        var o2 = /[^0-9A-D*#]/g, a2 = n2.match(o2);
        if (a2 && a2[0]) throw new Error("".concat(a2[0], " is not valid DTMF tone"));
        if (r3 && !["sip-info", "telephone-event", "auto"].includes(r3)) throw new Error("method must be one of 'sip-info', 'telephone-event', or 'auto'");
        if (void 0 !== i3) {
          if ("number" != typeof i3) throw new Error("digitDurationMs must be a number");
          if (!Number.isFinite(i3) || !Number.isInteger(i3)) throw new Error("digitDurationMs must be a finite integer number");
          if (i3 < 50 || i3 > 2e3) throw new Error("digitDurationMs must be between 50ms and 2000ms");
        }
      })(e2), e2.method = e2.method || "auto", e2.digitDurationMs = e2.digitDurationMs || 500, new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine(As({ action: "send-dtmf" }, e2), (function(e3) {
          e3.error ? r3(e3.error) : n2(e3);
        }));
      }));
    })), function(e2) {
      return C2.apply(this, arguments);
    }) }, { key: "getNetworkStats", value: function() {
      var e2 = this;
      if (this._callState !== oi) {
        return Promise.resolve(As({ stats: { latest: {} } }, this._network));
      }
      return new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "get-calc-stats" }, (function(n2) {
          t2(As(As({}, e2._network), {}, { stats: n2.stats }));
        }));
      }));
    } }, { key: "testWebsocketConnectivity", value: (M2 = p((function* () {
      var e2 = this;
      if (nc(this._testCallInProgress, "testWebsocketConnectivity()"), this.needsLoad()) try {
        yield this.load();
      } catch (e3) {
        return Promise.reject(e3);
      }
      return new Promise((function(t2, n2) {
        e2.sendMessageToCallMachine({ action: "test-websocket-connectivity" }, (function(e3) {
          e3.error ? n2(e3.error) : t2(e3.results);
        }));
      }));
    })), function() {
      return M2.apply(this, arguments);
    }) }, { key: "abortTestWebsocketConnectivity", value: function() {
      this.sendMessageToCallMachine({ action: "abort-test-websocket-connectivity" });
    } }, { key: "_validateVideoTrackForNetworkTests", value: function(e2) {
      return e2 ? e2 instanceof MediaStreamTrack ? !!vs(e2, { isLocalScreenVideo: false }) || (console.error("Video track is not playable. This test needs a live video track."), false) : (console.error("Video track needs to be of type `MediaStreamTrack`."), false) : (console.error("Missing video track. You must provide a video track in order to run this test."), false);
    } }, { key: "testCallQuality", value: (k2 = p((function* () {
      var t2 = this;
      oc(), rc(this._callObjectMode, "testCallQuality()"), tc(this._callMachineInitialized, "testCallQuality()", null, true), ec(this._callState, this._isPreparingToJoin, "testCallQuality()");
      var n2 = this._testCallAlreadyInProgress, r3 = function(e2) {
        n2 || (t2._testCallInProgress = e2);
      };
      if (r3(true), this.needsLoad()) try {
        var i3 = this._callState;
        yield this.load(), this._callState = i3;
      } catch (e2) {
        return r3(false), Promise.reject(e2);
      }
      return new Promise((function(n3) {
        t2.sendMessageToCallMachine({ action: "test-call-quality", dailyJsVersion: t2.properties.dailyJsVersion }, (function(i4) {
          var o2 = i4.results, a2 = o2.result, s2 = e(o2, Ts);
          if ("failed" === a2) {
            var c3, l2 = As({}, s2);
            null !== (c3 = s2.error) && void 0 !== c3 && c3.details ? (s2.error.details = JSON.parse(s2.error.details), l2.error = As(As({}, l2.error), {}, { details: As({}, l2.error.details) }), l2.error.details.duringTest = "testCallQuality") : (l2.error = l2.error ? As({}, l2.error) : {}, l2.error.details = { duringTest: "testCallQuality" }), t2._maybeSendToSentry(l2);
          }
          r3(false), n3(As({ result: a2 }, s2));
        }));
      }));
    })), function() {
      return k2.apply(this, arguments);
    }) }, { key: "stopTestCallQuality", value: function() {
      this.sendMessageToCallMachine({ action: "stop-test-call-quality" });
    } }, { key: "testConnectionQuality", value: (w2 = p((function* (e2) {
      var t2;
      ia() ? (console.warn("testConnectionQuality() is deprecated: use testPeerToPeerCallQuality() instead"), t2 = yield this.testPeerToPeerCallQuality(e2)) : (console.warn("testConnectionQuality() is deprecated: use testCallQuality() instead"), t2 = yield this.testCallQuality());
      var n2 = { result: t2.result, secondsElapsed: t2.secondsElapsed };
      return t2.data && (n2.data = { maxRTT: t2.data.maxRoundTripTime, packetLoss: t2.data.avgRecvPacketLoss }), n2;
    })), function(e2) {
      return w2.apply(this, arguments);
    }) }, { key: "testPeerToPeerCallQuality", value: (_2 = p((function* (e2) {
      var t2 = this;
      if (nc(this._testCallInProgress, "testPeerToPeerCallQuality()"), this.needsLoad()) try {
        yield this.load();
      } catch (e3) {
        return Promise.reject(e3);
      }
      var n2 = e2.videoTrack, r3 = e2.duration;
      if (!this._validateVideoTrackForNetworkTests(n2)) throw new Error("Video track error");
      return this._sharedTracks.videoTrackForConnectionQualityTest = n2, new Promise((function(e3, n3) {
        t2.sendMessageToCallMachine({ action: "test-p2p-call-quality", duration: r3 }, (function(t3) {
          t3.error ? n3(t3.error) : e3(t3.results);
        }));
      }));
    })), function(e2) {
      return _2.apply(this, arguments);
    }) }, { key: "stopTestConnectionQuality", value: function() {
      ia() ? (console.warn("stopTestConnectionQuality() is deprecated: use testPeerToPeerCallQuality() and stopTestPeerToPeerCallQuality() instead"), this.stopTestPeerToPeerCallQuality()) : (console.warn("stopTestConnectionQuality() is deprecated: use testCallQuality() and stopTestCallQuality() instead"), this.stopTestCallQuality());
    } }, { key: "stopTestPeerToPeerCallQuality", value: function() {
      this.sendMessageToCallMachine({ action: "stop-test-p2p-call-quality" });
    } }, { key: "testNetworkConnectivity", value: (y2 = p((function* (e2) {
      var t2 = this;
      if (nc(this._testCallInProgress, "testNetworkConnectivity()"), this.needsLoad()) try {
        yield this.load();
      } catch (e3) {
        return Promise.reject(e3);
      }
      if (!this._validateVideoTrackForNetworkTests(e2)) throw new Error("Video track error");
      return this._sharedTracks.videoTrackForNetworkConnectivityTest = e2, new Promise((function(e3, n2) {
        t2.sendMessageToCallMachine({ action: "test-network-connectivity" }, (function(t3) {
          t3.error ? n2(t3.error) : e3(t3.results);
        }));
      }));
    })), function(e2) {
      return y2.apply(this, arguments);
    }) }, { key: "abortTestNetworkConnectivity", value: function() {
      this.sendMessageToCallMachine({ action: "abort-test-network-connectivity" });
    } }, { key: "getCpuLoadStats", value: function() {
      var e2 = this;
      return new Promise((function(t2) {
        if (e2._callState === oi) {
          e2.sendMessageToCallMachine({ action: "get-cpu-load-stats" }, (function(e3) {
            t2(e3.cpuStats);
          }));
        } else t2({ cpuLoadState: void 0, cpuLoadStateReason: void 0, stats: {} });
      }));
    } }, { key: "_validateEncodingLayerHasValidProperties", value: function(e2) {
      var t2;
      if (!((null === (t2 = Object.keys(e2)) || void 0 === t2 ? void 0 : t2.length) > 0)) throw new Error("Empty encoding is not allowed. At least one of these valid keys should be specified:" + Object.values(Us));
    } }, { key: "_validateVideoSendSettings", value: function(e2, t2) {
      var r3 = "screenVideo" === e2 ? ["default-screen-video", "detail-optimized", "motion-optimized", "motion-and-detail-balanced"] : ["default-video", "bandwidth-optimized", "bandwidth-and-quality-balanced", "quality-optimized", "adaptive-2-layers", "adaptive-3-layers"], i3 = "Video send settings should be either an object or one of the supported presets: ".concat(r3.join());
      if ("string" == typeof t2) {
        if (!r3.includes(t2)) throw new Error(i3);
      } else {
        if ("object" !== n(t2)) throw new Error(i3);
        if (!t2.maxQuality && !t2.encodings && void 0 === t2.allowAdaptiveLayers) throw new Error("Video send settings must contain at least maxQuality, allowAdaptiveLayers or encodings attribute");
        if (t2.maxQuality && -1 === ["low", "medium", "high"].indexOf(t2.maxQuality)) throw new Error("maxQuality must be either low, medium or high");
        if (t2.encodings) {
          var o2 = false;
          switch (Object.keys(t2.encodings).length) {
            case 1:
              o2 = !t2.encodings.low;
              break;
            case 2:
              o2 = !t2.encodings.low || !t2.encodings.medium;
              break;
            case 3:
              o2 = !t2.encodings.low || !t2.encodings.medium || !t2.encodings.high;
              break;
            default:
              o2 = true;
          }
          if (o2) throw new Error("Encodings must be defined as: low, low and medium, or low, medium and high.");
          t2.encodings.low && this._validateEncodingLayerHasValidProperties(t2.encodings.low), t2.encodings.medium && this._validateEncodingLayerHasValidProperties(t2.encodings.medium), t2.encodings.high && this._validateEncodingLayerHasValidProperties(t2.encodings.high);
        }
      }
    } }, { key: "validateUpdateSendSettings", value: function(e2) {
      var t2 = this;
      if (!e2 || 0 === Object.keys(e2).length) throw new Error("Send settings must contain at least information for one track!");
      Object.entries(e2).forEach((function(e3) {
        var n2 = f(e3, 2), r3 = n2[0], i3 = n2[1];
        t2._validateVideoSendSettings(r3, i3);
      }));
    } }, { key: "updateSendSettings", value: function(e2) {
      var t2 = this;
      return this.validateUpdateSendSettings(e2), this.needsLoad() ? (this._preloadCache.sendSettings = e2, { sendSettings: this._preloadCache.sendSettings }) : new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine({ action: "update-send-settings", sendSettings: e2 }, (function(e3) {
          e3.error ? r3(e3.error) : n2(e3.sendSettings);
        }));
      }));
    } }, { key: "getSendSettings", value: function() {
      return this._sendSettings || this._preloadCache.sendSettings;
    } }, { key: "getLocalAudioLevel", value: function() {
      return this._localAudioLevel;
    } }, { key: "getRemoteParticipantsAudioLevel", value: function() {
      return this._remoteParticipantsAudioLevel;
    } }, { key: "getActiveSpeaker", value: function() {
      return oc(), this._activeSpeaker;
    } }, { key: "setActiveSpeakerMode", value: function(e2) {
      return oc(), this.sendMessageToCallMachine({ action: "set-active-speaker-mode", enabled: e2 }), this;
    } }, { key: "activeSpeakerMode", value: function() {
      return oc(), this._activeSpeakerMode;
    } }, { key: "subscribeToTracksAutomatically", value: function() {
      return this._preloadCache.subscribeToTracksAutomatically;
    } }, { key: "setSubscribeToTracksAutomatically", value: function(e2) {
      return Xs(this._callState, "setSubscribeToTracksAutomatically()", "Use the subscribeToTracksAutomatically configuration property."), this._preloadCache.subscribeToTracksAutomatically = e2, this.sendMessageToCallMachine({ action: "daily-method-subscribe-to-tracks-automatically", enabled: e2 }), this;
    } }, { key: "enumerateDevices", value: (m2 = p((function* () {
      var e2 = this;
      if (this._callObjectMode) {
        var t2 = yield navigator.mediaDevices.enumerateDevices();
        return "Firefox" === ma() && ya().major > 115 && ya().major < 123 && (t2 = t2.filter((function(e3) {
          return "audiooutput" !== e3.kind;
        }))), { devices: t2.map((function(e3) {
          var t3 = JSON.parse(JSON.stringify(e3));
          if (!ia() && "videoinput" === e3.kind && e3.getCapabilities) {
            var n2, r3 = e3.getCapabilities();
            t3.facing = (null == r3 || null === (n2 = r3.facingMode) || void 0 === n2 ? void 0 : n2.length) >= 1 ? r3.facingMode[0] : void 0;
          }
          return t3;
        })) };
      }
      return new Promise((function(t3) {
        e2.sendMessageToCallMachine({ action: "enumerate-devices" }, (function(e3) {
          t3({ devices: e3.devices });
        }));
      }));
    })), function() {
      return m2.apply(this, arguments);
    }) }, { key: "sendAppMessage", value: function(e2) {
      var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "*";
      if (Xs(this._callState, "sendAppMessage()"), JSON.stringify(e2).length > this._maxAppMessageSize) throw new Error("Message data too large. Max size is " + this._maxAppMessageSize);
      return this.sendMessageToCallMachine({ action: "app-msg", data: e2, to: t2 }), this;
    } }, { key: "addFakeParticipant", value: function(e2) {
      return oc(), Xs(this._callState, "addFakeParticipant()"), this.sendMessageToCallMachine(As({ action: "add-fake-participant" }, e2)), this;
    } }, { key: "setShowNamesMode", value: function(e2) {
      return ic(this._callObjectMode, "setShowNamesMode()"), oc(), e2 && "always" !== e2 && "never" !== e2 ? (console.error('setShowNamesMode argument should be "always", "never", or false'), this) : (this.sendMessageToCallMachine({ action: "set-show-names", mode: e2 }), this);
    } }, { key: "setShowLocalVideo", value: function() {
      var e2 = !(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0];
      return ic(this._callObjectMode, "setShowLocalVideo()"), oc(), Xs(this._callState, "setShowLocalVideo()"), "boolean" != typeof e2 ? (console.error("setShowLocalVideo only accepts a boolean value"), this) : (this.sendMessageToCallMachine({ action: "set-show-local-video", show: e2 }), this._showLocalVideo = e2, this);
    } }, { key: "showLocalVideo", value: function() {
      return ic(this._callObjectMode, "showLocalVideo()"), oc(), this._showLocalVideo;
    } }, { key: "setShowParticipantsBar", value: function() {
      var e2 = !(arguments.length > 0 && void 0 !== arguments[0]) || arguments[0];
      return ic(this._callObjectMode, "setShowParticipantsBar()"), oc(), Xs(this._callState, "setShowParticipantsBar()"), "boolean" != typeof e2 ? (console.error("setShowParticipantsBar only accepts a boolean value"), this) : (this.sendMessageToCallMachine({ action: "set-show-participants-bar", show: e2 }), this._showParticipantsBar = e2, this);
    } }, { key: "showParticipantsBar", value: function() {
      return ic(this._callObjectMode, "showParticipantsBar()"), oc(), this._showParticipantsBar;
    } }, { key: "customIntegrations", value: function() {
      return oc(), ic(this._callObjectMode, "customIntegrations()"), this._customIntegrations;
    } }, { key: "setCustomIntegrations", value: function(e2) {
      return oc(), ic(this._callObjectMode, "setCustomIntegrations()"), Xs(this._callState, "setCustomIntegrations()"), yc(e2) ? (this.sendMessageToCallMachine({ action: "set-custom-integrations", integrations: e2 }), this._customIntegrations = e2, this) : this;
    } }, { key: "startCustomIntegrations", value: function(e2) {
      var t2 = this;
      if (oc(), ic(this._callObjectMode, "startCustomIntegrations()"), Xs(this._callState, "startCustomIntegrations()"), Array.isArray(e2) && e2.some((function(e3) {
        return "string" != typeof e3;
      })) || !Array.isArray(e2) && "string" != typeof e2) return console.error("startCustomIntegrations() only accepts string | string[]"), this;
      var n2 = "string" == typeof e2 ? [e2] : e2, r3 = n2.filter((function(e3) {
        return !(e3 in t2._customIntegrations);
      }));
      return r3.length ? (console.error(`Can't find custom integration(s): "`.concat(r3.join(", "), '"')), this) : (this.sendMessageToCallMachine({ action: "start-custom-integrations", ids: n2 }), this);
    } }, { key: "stopCustomIntegrations", value: function(e2) {
      var t2 = this;
      if (oc(), ic(this._callObjectMode, "stopCustomIntegrations()"), Xs(this._callState, "stopCustomIntegrations()"), Array.isArray(e2) && e2.some((function(e3) {
        return "string" != typeof e3;
      })) || !Array.isArray(e2) && "string" != typeof e2) return console.error("stopCustomIntegrations() only accepts string | string[]"), this;
      var n2 = "string" == typeof e2 ? [e2] : e2, r3 = n2.filter((function(e3) {
        return !(e3 in t2._customIntegrations);
      }));
      return r3.length ? (console.error(`Can't find custom integration(s): "`.concat(r3.join(", "), '"')), this) : (this.sendMessageToCallMachine({ action: "stop-custom-integrations", ids: n2 }), this);
    } }, { key: "customTrayButtons", value: function() {
      return ic(this._callObjectMode, "customTrayButtons()"), oc(), this._customTrayButtons;
    } }, { key: "updateCustomTrayButtons", value: function(e2) {
      return ic(this._callObjectMode, "updateCustomTrayButtons()"), oc(), Xs(this._callState, "updateCustomTrayButtons()"), mc(e2) ? (this.sendMessageToCallMachine({ action: "update-custom-tray-buttons", btns: e2 }), this._customTrayButtons = e2, this) : (console.error("updateCustomTrayButtons only accepts a dictionary of the type ".concat(JSON.stringify($s))), this);
    } }, { key: "theme", value: function() {
      return ic(this._callObjectMode, "theme()"), this.properties.theme;
    } }, { key: "setTheme", value: function(e2) {
      var t2 = this;
      return ic(this._callObjectMode, "setTheme()"), new Promise((function(n2, r3) {
        try {
          t2.validateProperties({ theme: e2 }), t2.properties.theme = As({}, e2), t2.sendMessageToCallMachine({ action: "set-theme", theme: t2.properties.theme });
          try {
            t2.emitDailyJSEvent({ action: Ui, theme: t2.properties.theme });
          } catch (e3) {
            console.log("could not emit 'theme-updated'", e3);
          }
          n2(t2.properties.theme);
        } catch (e3) {
          r3(e3);
        }
      }));
    } }, { key: "requestFullscreen", value: (g2 = p((function* () {
      if (oc(), this._iframe && !document.fullscreenElement && sa()) try {
        (yield this._iframe.requestFullscreen) ? this._iframe.requestFullscreen() : this._iframe.webkitRequestFullscreen();
      } catch (e2) {
        console.log("could not make video call fullscreen", e2);
      }
    })), function() {
      return g2.apply(this, arguments);
    }) }, { key: "exitFullscreen", value: function() {
      oc(), document.fullscreenElement ? document.exitFullscreen() : document.webkitFullscreenElement && document.webkitExitFullscreen();
    } }, { key: "getSidebarView", value: (v2 = p((function* () {
      var e2 = this;
      return this._callObjectMode ? (console.error("getSidebarView is not available in callObject mode"), Promise.resolve(null)) : new Promise((function(t2) {
        e2.sendMessageToCallMachine({ action: "get-sidebar-view" }, (function(e3) {
          t2(e3.view);
        }));
      }));
    })), function() {
      return v2.apply(this, arguments);
    }) }, { key: "setSidebarView", value: function(e2) {
      return this._callObjectMode ? (console.error("setSidebarView is not available in callObject mode"), this) : (this.sendMessageToCallMachine({ action: "set-sidebar-view", view: e2 }), this);
    } }, { key: "room", value: (h2 = p((function* () {
      var e2 = this, t2 = (arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}).includeRoomConfigDefaults, n2 = void 0 === t2 || t2;
      return this._accessState.access === fi || this.needsLoad() ? this.properties.url ? { roomUrlPendingJoin: this.properties.url } : null : new Promise((function(t3) {
        e2.sendMessageToCallMachine({ action: "lib-room-info", includeRoomConfigDefaults: n2 }, (function(e3) {
          delete e3.action, delete e3.callbackStamp, t3(e3);
        }));
      }));
    })), function() {
      return h2.apply(this, arguments);
    }) }, { key: "geo", value: (d2 = p((function* () {
      try {
        var e2 = yield fetch("https://gs.daily.co/_ks_/x-swsl/:");
        return { current: (yield e2.json()).geo };
      } catch (e3) {
        return console.error("geo lookup failed", e3), { current: "" };
      }
    })), function() {
      return d2.apply(this, arguments);
    }) }, { key: "setNetworkTopology", value: (c2 = p((function* (e2) {
      var t2 = this;
      return oc(), Xs(this._callState, "setNetworkTopology()"), new Promise((function(n2, r3) {
        t2.sendMessageToCallMachine({ action: "set-network-topology", opts: e2 }, (function(e3) {
          e3.error ? r3({ error: e3.error }) : n2({ workerId: e3.workerId });
        }));
      }));
    })), function(e2) {
      return c2.apply(this, arguments);
    }) }, { key: "getNetworkTopology", value: (i2 = p((function* () {
      var e2 = this;
      return new Promise((function(t2, n2) {
        e2.needsLoad() && t2({ topology: "none" }), e2.sendMessageToCallMachine({ action: "get-network-topology" }, (function(e3) {
          e3.error ? n2({ error: e3.error }) : t2({ topology: e3.topology });
        }));
      }));
    })), function() {
      return i2.apply(this, arguments);
    }) }, { key: "setPlayNewParticipantSound", value: function(e2) {
      if (oc(), "number" != typeof e2 && true !== e2 && false !== e2) throw new Error("argument to setShouldPlayNewParticipantSound should be true, false, or a number, but is ".concat(e2));
      this.sendMessageToCallMachine({ action: "daily-method-set-play-ding", arg: e2 });
    } }, { key: "on", value: function(e2, t2) {
      return b.prototype.on.call(this, e2, t2);
    } }, { key: "once", value: function(e2, t2) {
      return b.prototype.once.call(this, e2, t2);
    } }, { key: "off", value: function(e2, t2) {
      return b.prototype.off.call(this, e2, t2);
    } }, { key: "validateProperties", value: function(e2) {
      var t2, n2;
      if (null != e2 && null !== (t2 = e2.dailyConfig) && void 0 !== t2 && t2.userMediaAudioConstraints) {
        var r3, i3;
        ia() || console.warn("userMediaAudioConstraints is deprecated. You can override constraints with inputSettings.audio.settings, found in DailyCallOptions.");
        var o2 = e2.inputSettings || {};
        o2.audio = (null === (r3 = e2.inputSettings) || void 0 === r3 ? void 0 : r3.audio) || {}, o2.audio.settings = (null === (i3 = e2.inputSettings) || void 0 === i3 || null === (i3 = i3.audio) || void 0 === i3 ? void 0 : i3.settings) || {}, o2.audio.settings = As(As({}, o2.audio.settings), e2.dailyConfig.userMediaAudioConstraints), e2.inputSettings = o2, delete e2.dailyConfig.userMediaAudioConstraints;
      }
      if (null != e2 && null !== (n2 = e2.dailyConfig) && void 0 !== n2 && n2.userMediaVideoConstraints) {
        var a2, s2;
        ia() || console.warn("userMediaVideoConstraints is deprecated. You can override constraints with inputSettings.video.settings, found in DailyCallOptions.");
        var c3 = e2.inputSettings || {};
        c3.video = (null === (a2 = e2.inputSettings) || void 0 === a2 ? void 0 : a2.video) || {}, c3.video.settings = (null === (s2 = e2.inputSettings) || void 0 === s2 || null === (s2 = s2.video) || void 0 === s2 ? void 0 : s2.settings) || {}, c3.video.settings = As(As({}, c3.video.settings), e2.dailyConfig.userMediaVideoConstraints), e2.inputSettings = c3, delete e2.dailyConfig.userMediaVideoConstraints;
      }
      for (var l2 in e2) if (Hs[l2]) {
        if (Hs[l2].validate && !Hs[l2].validate(e2[l2], this)) throw new Error("property '".concat(l2, "': ").concat(Hs[l2].help));
      } else console.warn("Ignoring unrecognized property '".concat(l2, "'")), delete e2[l2];
    } }, { key: "assembleMeetingUrl", value: function() {
      var e2, t2, n2 = As(As({}, this.properties), {}, { emb: this.callClientId, embHref: encodeURIComponent(window.location.href), proxy: null !== (e2 = this.properties.dailyConfig) && void 0 !== e2 && e2.proxyUrl ? encodeURIComponent(null === (t2 = this.properties.dailyConfig) || void 0 === t2 ? void 0 : t2.proxyUrl) : void 0 }), r3 = n2.url.match(/\?/) ? "&" : "?";
      return n2.url + r3 + Object.keys(Hs).filter((function(e3) {
        return Hs[e3].queryString && void 0 !== n2[e3];
      })).map((function(e3) {
        return "".concat(Hs[e3].queryString, "=").concat(n2[e3]);
      })).join("&");
    } }, { key: "needsLoad", value: function() {
      return [ti, ni, ai, si].includes(this._callState);
    } }, { key: "sendMessageToCallMachine", value: function(e2, t2) {
      if (this._destroyed && (this._logUseAfterDestroy(), this.strictMode)) throw new Error("Use after destroy");
      this._messageChannel.sendMessageToCallMachine(e2, t2, this.callClientId, this._iframe);
    } }, { key: "forwardPackagedMessageToCallMachine", value: function(e2) {
      this._messageChannel.forwardPackagedMessageToCallMachine(e2, this._iframe, this.callClientId);
    } }, { key: "addListenerForPackagedMessagesFromCallMachine", value: function(e2) {
      return this._messageChannel.addListenerForPackagedMessagesFromCallMachine(e2, this.callClientId);
    } }, { key: "removeListenerForPackagedMessagesFromCallMachine", value: function(e2) {
      this._messageChannel.removeListenerForPackagedMessagesFromCallMachine(e2);
    } }, { key: "handleMessageFromCallMachine", value: function(t2) {
      switch (t2.action) {
        case Fi:
          this.sendMessageToCallMachine(As({ action: Bi }, this.properties));
          break;
        case "call-machine-initialized":
          this._callMachineInitialized = true;
          var n2 = { action: Go, level: "log", code: 1011, stats: { event: "bundle load", time: "no-op" === this._bundleLoadTime ? 0 : this._bundleLoadTime, preLoaded: "no-op" === this._bundleLoadTime, url: B(this.properties.dailyConfig) } };
          this.sendMessageToCallMachine(n2), this._delayDuplicateInstanceLog && this._logDuplicateInstanceAttempt();
          break;
        case $i:
          this._loadedCallback && (this._loadedCallback(), this._loadedCallback = null), this.emitDailyJSEvent(t2);
          break;
        case Hi:
          var r3, i3 = As({}, t2);
          delete i3.internal, this._maxAppMessageSize = (null === (r3 = t2.internal) || void 0 === r3 ? void 0 : r3._maxAppMessageSize) || $o, this._joinedCallback && (this._joinedCallback(t2.participants), this._joinedCallback = null), this.emitDailyJSEvent(i3);
          break;
        case Qi:
        case Ki:
          if (this._callState === ai) return;
          if (t2.participant && t2.participant.session_id) {
            var o2 = t2.participant.local ? "local" : t2.participant.session_id;
            if (this._callObjectMode) {
              var a2 = this._callMachine().store;
              Za(t2.participant, a2), es(t2.participant, a2), ns(t2.participant, this._participants[o2], a2);
            }
            try {
              this.maybeParticipantTracksStopped(this._participants[o2], t2.participant), this.maybeParticipantTracksStarted(this._participants[o2], t2.participant), this.maybeEventRecordingStopped(this._participants[o2], t2.participant), this.maybeEventRecordingStarted(this._participants[o2], t2.participant);
            } catch (e2) {
              console.error("track events error", e2);
            }
            this.compareEqualForParticipantUpdateEvent(t2.participant, this._participants[o2]) || (this._participants[o2] = As({}, t2.participant), this.toggleParticipantAudioBasedOnNativeAudioFocus(), this.emitDailyJSEvent(t2));
          }
          break;
        case Yi:
          if (t2.participant && t2.participant.session_id) {
            var s2 = this._participants[t2.participant.session_id];
            s2 && this.maybeParticipantTracksStopped(s2, null), delete this._participants[t2.participant.session_id], this.emitDailyJSEvent(t2);
          }
          break;
        case Xi:
          S(this._participantCounts, t2.participantCounts) || (this._participantCounts = t2.participantCounts, this.emitDailyJSEvent(t2));
          break;
        case Zi:
          var c3 = { access: t2.access };
          t2.awaitingAccess && (c3.awaitingAccess = t2.awaitingAccess), S(this._accessState, c3) || (this._accessState = c3, this.emitDailyJSEvent(t2));
          break;
        case eo:
          if (t2.meetingSession) {
            this._meetingSessionSummary = t2.meetingSession, this.emitDailyJSEvent(t2);
            var l2 = As(As({}, t2), {}, { action: "meeting-session-updated" });
            this.emitDailyJSEvent(l2);
          }
          break;
        case Jo:
          var u2;
          this._iframe && !t2.preserveIframe && (this._iframe.src = ""), this._updateCallState(si), this.resetMeetingDependentVars(), this._loadedCallback && (this._loadedCallback(t2.errorMsg), this._loadedCallback = null), t2.preserveIframe;
          var d3 = e(t2, Os);
          null != d3 && null !== (u2 = d3.error) && void 0 !== u2 && u2.details && (d3.error.details = JSON.parse(d3.error.details)), this._maybeSendToSentry(t2), this._joinedCallback && (this._joinedCallback(null, d3), this._joinedCallback = null), this.emitDailyJSEvent(d3);
          break;
        case Gi:
          this._callState !== si && this._updateCallState(ai), this.resetMeetingDependentVars(), this._resolveLeave && (this._resolveLeave(), this._resolveLeave = null), this.emitDailyJSEvent(t2);
          break;
        case "selected-devices-updated":
          t2.devices && this.emitDailyJSEvent(t2);
          break;
        case Oo:
          var p2 = t2.state, h3 = t2.threshold, f2 = t2.quality, v3 = p2.state, g3 = p2.reasons;
          v3 === this._network.networkState && S(g3, this._network.networkStateReasons) && h3 === this._network.threshold && f2 === this._network.quality || (this._network.networkState = v3, this._network.networkStateReasons = g3, this._network.quality = f2, this._network.threshold = h3, t2.networkState = v3, g3.length && (t2.networkStateReasons = g3), delete t2.state, this.emitDailyJSEvent(t2));
          break;
        case Ao:
          t2 && t2.cpuLoadState && this.emitDailyJSEvent(t2);
          break;
        case jo:
          t2 && void 0 !== t2.faceCounts && this.emitDailyJSEvent(t2);
          break;
        case Eo:
          var m3 = t2.activeSpeaker;
          this._activeSpeaker.peerId !== m3.peerId && (this._activeSpeaker.peerId = m3.peerId, this.emitDailyJSEvent({ action: t2.action, activeSpeaker: this._activeSpeaker }));
          break;
        case "show-local-video-changed":
          if (this._callObjectMode) return;
          var y3 = t2.show;
          this._showLocalVideo = y3, this.emitDailyJSEvent({ action: t2.action, show: y3 });
          break;
        case To:
          var b2 = t2.enabled;
          this._activeSpeakerMode !== b2 && (this._activeSpeakerMode = b2, this.emitDailyJSEvent({ action: t2.action, enabled: this._activeSpeakerMode }));
          break;
        case ro:
        case io:
        case oo:
          this._waitingParticipants = t2.allWaitingParticipants, this.emitDailyJSEvent({ action: t2.action, participant: t2.participant });
          break;
        case Bo:
          S(this._receiveSettings, t2.receiveSettings) || (this._receiveSettings = t2.receiveSettings, this.emitDailyJSEvent({ action: t2.action, receiveSettings: t2.receiveSettings }));
          break;
        case Uo:
          this._maybeUpdateInputSettings(t2.inputSettings);
          break;
        case "send-settings-updated":
          S(this._sendSettings, t2.sendSettings) || (this._sendSettings = t2.sendSettings, this._preloadCache.sendSettings = null, this.emitDailyJSEvent({ action: t2.action, sendSettings: t2.sendSettings }));
          break;
        case "local-audio-level":
          this._localAudioLevel = t2.audioLevel, this._preloadCache.localAudioLevelObserver = null, this.emitDailyJSEvent(t2);
          break;
        case "remote-participants-audio-level":
          this._remoteParticipantsAudioLevel = t2.participantsAudioLevel, this._preloadCache.remoteParticipantsAudioLevelObserver = null, this.emitDailyJSEvent(t2);
          break;
        case _o:
          var _3 = t2.session_id;
          this._rmpPlayerState[_3] = t2.playerState, this.emitDailyJSEvent(t2);
          break;
        case So:
          delete this._rmpPlayerState[t2.session_id], this.emitDailyJSEvent(t2);
          break;
        case wo:
          var w3 = t2.session_id, k3 = this._rmpPlayerState[w3];
          k3 && this.compareEqualForRMPUpdateEvent(k3, t2.remoteMediaPlayerState) || (this._rmpPlayerState[w3] = t2.remoteMediaPlayerState, this.emitDailyJSEvent(t2));
          break;
        case "custom-button-click":
        case "sidebar-view-changed":
        case "pip-started":
        case "pip-stopped":
          this.emitDailyJSEvent(t2);
          break;
        case to:
          var M3 = this._meetingSessionState.topology !== (t2.meetingSessionState && t2.meetingSessionState.topology);
          this._meetingSessionState = kc(t2.meetingSessionState, this._callObjectMode), (this._callObjectMode || M3) && this.emitDailyJSEvent(t2);
          break;
        case ko:
          this._isScreenSharing = true, this.emitDailyJSEvent(t2);
          break;
        case Mo:
        case Co:
          this._isScreenSharing = false, this.emitDailyJSEvent(t2);
          break;
        case po:
        case ho:
        case fo:
        case vo:
        case go:
        case co:
        case lo:
        case uo:
        case qi:
        case zi:
        case yo:
        case bo:
        case "test-completed":
        case Po:
        case mo:
        case Lo:
        case Do:
        case No:
        case Ro:
        case Vo:
        case Fo:
        case "dialin-ready":
        case "dialin-connected":
        case "dialin-error":
        case "dialin-stopped":
        case "dialin-warning":
        case "dialout-connected":
        case "dtmf-event":
        case "dialout-answered":
        case "dialout-error":
        case "dialout-stopped":
        case "dialout-warning":
          this.emitDailyJSEvent(t2);
          break;
        case "request-fullscreen":
          this.requestFullscreen();
          break;
        case "request-exit-fullscreen":
          this.exitFullscreen();
      }
    } }, { key: "maybeEventRecordingStopped", value: function(e2, t2) {
      var n2 = "record";
      e2 && (t2.local || false !== t2[n2] || e2[n2] === t2[n2] || this.emitDailyJSEvent({ action: ho }));
    } }, { key: "maybeEventRecordingStarted", value: function(e2, t2) {
      var n2 = "record";
      e2 && (t2.local || true !== t2[n2] || e2[n2] === t2[n2] || this.emitDailyJSEvent({ action: po }));
    } }, { key: "_trackStatePlayable", value: function(e2) {
      return !(!e2 || e2.state !== hi);
    } }, { key: "_trackChanged", value: function(e2, t2) {
      return !((null == e2 ? void 0 : e2.id) === (null == t2 ? void 0 : t2.id));
    } }, { key: "maybeEventTrackStopped", value: function(e2, t2, n2) {
      var r3, i3, o2 = null !== (r3 = null == t2 ? void 0 : t2.tracks[e2]) && void 0 !== r3 ? r3 : null, a2 = null !== (i3 = null == n2 ? void 0 : n2.tracks[e2]) && void 0 !== i3 ? i3 : null, s2 = null == o2 ? void 0 : o2.track;
      if (s2) {
        var c3 = this._trackStatePlayable(o2), l2 = this._trackStatePlayable(a2), u2 = this._trackChanged(s2, null == a2 ? void 0 : a2.track);
        c3 && (l2 && !u2 || this.emitDailyJSEvent({ action: so, track: s2, participant: null != n2 ? n2 : t2, type: e2 }));
      }
    } }, { key: "maybeEventTrackStarted", value: function(e2, t2, n2) {
      var r3, i3, o2 = null !== (r3 = null == t2 ? void 0 : t2.tracks[e2]) && void 0 !== r3 ? r3 : null, a2 = null !== (i3 = null == n2 ? void 0 : n2.tracks[e2]) && void 0 !== i3 ? i3 : null, s2 = null == a2 ? void 0 : a2.track;
      if (s2) {
        var c3 = this._trackStatePlayable(o2), l2 = this._trackStatePlayable(a2), u2 = this._trackChanged(null == o2 ? void 0 : o2.track, s2);
        l2 && (c3 && !u2 || this.emitDailyJSEvent({ action: ao, track: s2, participant: n2, type: e2 }));
      }
    } }, { key: "maybeParticipantTracksStopped", value: function(e2, t2) {
      if (e2) for (var n2 in e2.tracks) this.maybeEventTrackStopped(n2, e2, t2);
    } }, { key: "maybeParticipantTracksStarted", value: function(e2, t2) {
      if (t2) for (var n2 in t2.tracks) this.maybeEventTrackStarted(n2, e2, t2);
    } }, { key: "compareEqualForRMPUpdateEvent", value: function(e2, t2) {
      var n2, r3;
      return e2.state === t2.state && (null === (n2 = e2.settings) || void 0 === n2 ? void 0 : n2.volume) === (null === (r3 = t2.settings) || void 0 === r3 ? void 0 : r3.volume);
    } }, { key: "emitDailyJSEvent", value: function(e2) {
      try {
        e2.callClientId = this.callClientId, this.emit(e2.action, e2);
      } catch (t2) {
        console.log("could not emit", e2, t2);
      }
    } }, { key: "compareEqualForParticipantUpdateEvent", value: function(e2, t2) {
      return !!S(e2, t2) && ((!e2.videoTrack || !t2.videoTrack || e2.videoTrack.id === t2.videoTrack.id && e2.videoTrack.muted === t2.videoTrack.muted && e2.videoTrack.enabled === t2.videoTrack.enabled) && (!e2.audioTrack || !t2.audioTrack || e2.audioTrack.id === t2.audioTrack.id && e2.audioTrack.muted === t2.audioTrack.muted && e2.audioTrack.enabled === t2.audioTrack.enabled));
    } }, { key: "nativeUtils", value: function() {
      return ia() ? "undefined" == typeof DailyNativeUtils ? (console.warn("in React Native, DailyNativeUtils is expected to be available"), null) : DailyNativeUtils : null;
    } }, { key: "updateIsPreparingToJoin", value: function(e2) {
      this._updateCallState(this._callState, e2);
    } }, { key: "_updateCallState", value: function(e2) {
      var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : this._isPreparingToJoin;
      if (e2 !== this._callState || t2 !== this._isPreparingToJoin) {
        var n2 = this._callState, r3 = this._isPreparingToJoin;
        this._callState = e2, this._isPreparingToJoin = t2;
        var i3 = this._callState === oi;
        this.updateShowAndroidOngoingMeetingNotification(i3);
        var o2 = Zs(n2, r3), a2 = Zs(this._callState, this._isPreparingToJoin);
        o2 !== a2 && (this.updateKeepDeviceAwake(a2), this.updateDeviceAudioMode(a2), this.updateNoOpRecordingEnsuringBackgroundContinuity(a2));
      }
    } }, { key: "resetMeetingDependentVars", value: function() {
      this._participants = {}, this._participantCounts = Fs, this._waitingParticipants = {}, this._activeSpeaker = {}, this._activeSpeakerMode = false, this._didPreAuth = false, this._accessState = { access: fi }, this._finalSummaryOfPrevSession = this._meetingSessionSummary, this._meetingSessionSummary = {}, this._meetingSessionState = kc(Rs, this._callObjectMode), this._isScreenSharing = false, this._receiveSettings = {}, this._inputSettings = void 0, this._sendSettings = {}, this._localAudioLevel = 0, this._isLocalAudioLevelObserverRunning = false, this._remoteParticipantsAudioLevel = {}, this._isRemoteParticipantsAudioLevelObserverRunning = false, this._maxAppMessageSize = $o, this._callMachineInitialized = false, this._bundleLoadTime = void 0, this._preloadCache;
    } }, { key: "updateKeepDeviceAwake", value: function(e2) {
      ia() && this.nativeUtils().setKeepDeviceAwake(e2, this.callClientId);
    } }, { key: "updateDeviceAudioMode", value: function(e2) {
      if (ia() && !this.disableReactNativeAutoDeviceManagement("audio")) {
        var t2 = e2 ? this._nativeInCallAudioMode : "idle";
        this.nativeUtils().setAudioMode(t2);
      }
    } }, { key: "updateShowAndroidOngoingMeetingNotification", value: function(e2) {
      if (ia() && this.nativeUtils().setShowOngoingMeetingNotification) {
        var t2, n2, r3, i3;
        if (this.properties.reactNativeConfig && this.properties.reactNativeConfig.androidInCallNotification) {
          var o2 = this.properties.reactNativeConfig.androidInCallNotification;
          t2 = o2.title, n2 = o2.subtitle, r3 = o2.iconName, i3 = o2.disableForCustomOverride;
        }
        i3 && (e2 = false), this.nativeUtils().setShowOngoingMeetingNotification(e2, t2, n2, r3, this.callClientId);
      }
    } }, { key: "updateNoOpRecordingEnsuringBackgroundContinuity", value: function(e2) {
      ia() && this.nativeUtils().enableNoOpRecordingEnsuringBackgroundContinuity && this.nativeUtils().enableNoOpRecordingEnsuringBackgroundContinuity(e2);
    } }, { key: "toggleParticipantAudioBasedOnNativeAudioFocus", value: function() {
      var e2;
      if (ia()) {
        var t2 = null === (e2 = this._callMachine()) || void 0 === e2 || null === (e2 = e2.store) || void 0 === e2 ? void 0 : e2.getState();
        for (var n2 in null == t2 ? void 0 : t2.streams) {
          var r3 = t2.streams[n2];
          r3 && r3.pendingTrack && "audio" === r3.pendingTrack.kind && (r3.pendingTrack.enabled = this._hasNativeAudioFocus);
        }
      }
    } }, { key: "disableReactNativeAutoDeviceManagement", value: function(e2) {
      return this.properties.reactNativeConfig && this.properties.reactNativeConfig.disableAutoDeviceManagement && this.properties.reactNativeConfig.disableAutoDeviceManagement[e2];
    } }, { key: "absoluteUrl", value: function(e2) {
      if (void 0 !== e2) {
        var t2 = document.createElement("a");
        return t2.href = e2, t2.href;
      }
    } }, { key: "sayHello", value: function() {
      var e2 = "hello, world.";
      return console.log(e2), e2;
    } }, { key: "_logUseAfterDestroy", value: function() {
      var e2 = Object.values(Ls)[0];
      if (this.needsLoad()) {
        if (e2 && !e2.needsLoad()) {
          var t2 = { action: Go, level: "error", code: this.strictMode ? 9995 : 9997 };
          e2.sendMessageToCallMachine(t2);
        } else if (!this.strictMode) {
          console.error("You are are attempting to use a call instance that was previously destroyed, which is unsupported. Please remove `strictMode: false` from your constructor properties to enable strict mode to track down and fix this unsupported usage.");
        }
      } else {
        var n2 = { action: Go, level: "error", code: this.strictMode ? 9995 : 9997 };
        this._messageChannel.sendMessageToCallMachine(n2, null, this.callClientId, this._iframe);
      }
    } }, { key: "_logDuplicateInstanceAttempt", value: function() {
      for (var e2 = 0, t2 = Object.values(Ls); e2 < t2.length; e2++) {
        var n2 = t2[e2];
        n2._callMachineInitialized ? (n2.sendMessageToCallMachine({ action: Go, level: "warn", code: this.allowMultipleCallInstances ? 9993 : 9992 }), n2._delayDuplicateInstanceLog = false) : n2._delayDuplicateInstanceLog = true;
      }
    } }, { key: "_maybeSendToSentry", value: function(e2) {
      var t2, n2, i3, o2, a2;
      if (null !== (t2 = e2.error) && void 0 !== t2 && t2.type) {
        if (![Pi, Ti, Ci].includes(e2.error.type)) return;
        if (e2.error.type === Ci && e2.error.msg.includes("deleted")) return;
      }
      var s2 = null !== (n2 = this.properties) && void 0 !== n2 && n2.url ? new URL(this.properties.url) : void 0, c3 = "production";
      s2 && s2.host.includes(".staging.daily") && (c3 = "staging");
      var l2, u2, d3, p2, h3, f2 = (function(e3) {
        const t3 = [Ln(), In(), qr(), Jr(), Kr(), ei(), $n(), Zr()];
        return false !== e3.autoSessionTracking && t3.push(Qr()), t3;
      })({}).filter((function(e3) {
        return !["BrowserApiErrors", "Breadcrumbs", "GlobalHandlers"].includes(e3.name);
      })), v3 = new mr({ dsn: "https://f10f1c81e5d44a4098416c0867a8b740@o77906.ingest.sentry.io/168844", transport: Ir, stackParser: Br, integrations: f2, environment: c3 }), g3 = new ut();
      if (g3.setClient(v3), v3.init(), (null === (i3 = this._participants) || void 0 === i3 || null === (i3 = i3.local) || void 0 === i3 ? void 0 : i3.session_id) && g3.setExtra("sessionId", this._participants.local.session_id), this.properties) {
        var m3 = As({}, this.properties);
        m3.userName = m3.userName ? "[Filtered]" : void 0, m3.userData = m3.userData ? "[Filtered]" : void 0, m3.token = m3.token ? "[Filtered]" : void 0, g3.setExtra("properties", m3);
      }
      if (s2) {
        var y3 = s2.searchParams.get("domain");
        if (!y3) {
          var b2 = s2.host.match(/(.*?)\./);
          y3 = b2 && b2[1] || "";
        }
        y3 && g3.setTag("domain", y3);
      }
      e2.error && (g3.setTag("fatalErrorType", e2.error.type), g3.setExtra("errorDetails", e2.error.details), (null === (l2 = e2.error.details) || void 0 === l2 ? void 0 : l2.uri) && g3.setTag("serverAddress", e2.error.details.uri), (null === (u2 = e2.error.details) || void 0 === u2 ? void 0 : u2.workerGroup) && g3.setTag("workerGroup", e2.error.details.workerGroup), (null === (d3 = e2.error.details) || void 0 === d3 ? void 0 : d3.geoGroup) && g3.setTag("geoGroup", e2.error.details.geoGroup), (null === (p2 = e2.error.details) || void 0 === p2 ? void 0 : p2.on) && g3.setTag("connectionAttempt", e2.error.details.on), null !== (h3 = e2.error.details) && void 0 !== h3 && h3.bundleUrl && (g3.setTag("bundleUrl", e2.error.details.bundleUrl), g3.setTag("bundleError", e2.error.details.sourceError.type)));
      g3.setTags({ callMode: this._callObjectMode ? ia() ? "reactNative" : null !== (o2 = this.properties) && void 0 !== o2 && null !== (o2 = o2.dailyConfig) && void 0 !== o2 && null !== (o2 = o2.callMode) && void 0 !== o2 && o2.includes("prebuilt") ? this.properties.dailyConfig.callMode : "custom" : "prebuilt-frame", version: r2.version() });
      var _3 = (null === (a2 = e2.error) || void 0 === a2 ? void 0 : a2.msg) || e2.errorMsg;
      g3.captureException(new Error(_3));
    } }, { key: "_callMachine", value: function() {
      var e2;
      return null === (e2 = window._daily) || void 0 === e2 || null === (e2 = e2.instances) || void 0 === e2 || null === (e2 = e2[this.callClientId]) || void 0 === e2 ? void 0 : e2.callMachine;
    } }, { key: "_maybeUpdateInputSettings", value: function(e2) {
      if (!S(this._inputSettings, e2)) {
        var t2 = this._getInputSettings();
        this._inputSettings = e2;
        var n2 = this._getInputSettings();
        S(t2, n2) || this.emitDailyJSEvent({ action: Uo, inputSettings: n2 });
      }
    } }], [{ key: "supportedBrowser", value: function() {
      if (ia()) return { supported: true, mobile: true, name: "React Native", version: null, supportsScreenShare: true, supportsSfu: true, supportsVideoProcessing: false, supportsAudioProcessing: false };
      var e2 = D.getParser(ra());
      return { supported: !!fa(), mobile: "mobile" === e2.getPlatformType(), name: e2.getBrowserName(), version: e2.getBrowserVersion(), supportsFullscreen: !!sa(), supportsScreenShare: !!aa(), supportsSfu: !!fa(), supportsVideoProcessing: pa(), supportsAudioProcessing: ha() };
    } }, { key: "version", value: function() {
      return "0.89.1";
    } }, { key: "createCallObject", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      return e2.layout = "none", new r2(null, e2);
    } }, { key: "wrap", value: function(e2) {
      var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
      if (oc(), !e2 || !e2.contentWindow || "string" != typeof e2.src) throw new Error("DailyIframe::Wrap needs an iframe-like first argument");
      return t2.layout || (t2.customLayout ? t2.layout = "custom-v1" : t2.layout = "browser"), new r2(e2, t2);
    } }, { key: "createFrame", value: function(e2, t2) {
      var n2, i3;
      oc(), e2 && t2 ? (n2 = e2, i3 = t2) : e2 && e2.append ? (n2 = e2, i3 = {}) : (n2 = document.body, i3 = e2 || {});
      var o2 = i3.iframeStyle;
      o2 || (o2 = n2 === document.body ? { position: "fixed", border: "1px solid black", backgroundColor: "white", width: "375px", height: "450px", right: "1em", bottom: "1em" } : { border: 0, width: "100%", height: "100%" });
      var a2 = document.createElement("iframe");
      window.navigator && window.navigator.userAgent.match(/Chrome\/61\./) ? a2.allow = "microphone, camera" : a2.allow = "microphone; camera; autoplay; display-capture; screen-wake-lock; compute-pressure;", a2.style.visibility = "hidden", n2.appendChild(a2), a2.style.visibility = null, Object.keys(o2).forEach((function(e3) {
        return a2.style[e3] = o2[e3];
      })), i3.layout || (i3.customLayout ? i3.layout = "custom-v1" : i3.layout = "browser");
      try {
        return new r2(a2, i3);
      } catch (e3) {
        throw n2.removeChild(a2), e3;
      }
    } }, { key: "createTransparentFrame", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
      oc();
      var t2 = document.createElement("iframe");
      return t2.allow = "microphone; camera; autoplay", t2.style.cssText = "\n      position: fixed;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      border: 0;\n      pointer-events: none;\n    ", document.body.appendChild(t2), e2.layout || (e2.layout = "custom-v1"), r2.wrap(t2, e2);
    } }, { key: "getCallInstance", value: function() {
      var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : void 0;
      return e2 ? Ls[e2] : Object.values(Ls)[0];
    } }]);
    var i2, c2, d2, h2, v2, g2, m2, y2, _2, w2, k2, M2, C2, E2, T2, O2, P2, A2, j2, I2, x2, L2, R2, U2, V2, J2, $2, q2, z2, W2, H2, G2, Q2, K2, Y2, X2, Z2, ee2;
  })();
  function Ks(e2) {
    if (e2.extension) {
      if ("string" != typeof e2.extension) throw new Error("Error starting dial out: extension must be a string");
      if (e2.extension.length > 20) throw new Error("Error starting dial out: extension length must be less than or equal to 20");
    }
    if (e2.waitBeforeExtensionDialSec) {
      if ("number" != typeof e2.waitBeforeExtensionDialSec) throw new Error("Error starting dial out: waitBeforeExtensionDialSec must be a number");
      if (e2.waitBeforeExtensionDialSec > 60) throw new Error("Error starting dial out: waitBeforeExtensionDialSec must be less than or equal to 60");
      if (!e2.extension) throw new Error("Error starting dial out: waitBeforeExtensionDialSec requires a phoneNumber and extension");
    }
  }
  function Ys(e2, t2) {
    var n2 = {};
    for (var r2 in e2) if (e2[r2] instanceof MediaStreamTrack) console.warn("MediaStreamTrack found in props or cache.", r2), n2[r2] = Qo;
    else if ("dailyConfig" === r2) {
      if (e2[r2].modifyLocalSdpHook) {
        var i2 = window._daily.instances[t2].customCallbacks || {};
        i2.modifyLocalSdpHook = e2[r2].modifyLocalSdpHook, window._daily.instances[t2].customCallbacks = i2, delete e2[r2].modifyLocalSdpHook;
      }
      if (e2[r2].modifyRemoteSdpHook) {
        var o2 = window._daily.instances[t2].customCallbacks || {};
        o2.modifyRemoteSdpHook = e2[r2].modifyRemoteSdpHook, window._daily.instances[t2].customCallbacks = o2, delete e2[r2].modifyRemoteSdpHook;
      }
      n2[r2] = e2[r2];
    } else n2[r2] = e2[r2];
    return n2;
  }
  function Xs(e2) {
    var t2 = arguments.length > 2 ? arguments[2] : void 0;
    if (e2 !== oi) {
      var n2 = "".concat(arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "This daily-js method", " only supported after join.");
      throw t2 && (n2 += " ".concat(t2)), console.error(n2), new Error(n2);
    }
  }
  function Zs(e2, t2) {
    return [ii, oi].includes(e2) || t2;
  }
  function ec(e2, t2) {
    var n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "This daily-js method", r2 = arguments.length > 3 ? arguments[3] : void 0;
    if (Zs(e2, t2)) {
      var i2 = "".concat(n2, " not supported after joining a meeting.");
      throw r2 && (i2 += " ".concat(r2)), console.error(i2), new Error(i2);
    }
  }
  function tc(e2) {
    var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "This daily-js method", n2 = arguments.length > 2 ? arguments[2] : void 0;
    if (!e2) {
      var r2 = "".concat(t2, arguments.length > 3 && void 0 !== arguments[3] && arguments[3] ? " requires preAuth() or startCamera() to initialize call state." : " requires preAuth(), startCamera(), or join() to initialize call state.");
      throw n2 && (r2 += " ".concat(n2)), console.error(r2), new Error(r2);
    }
  }
  function nc(e2) {
    if (e2) {
      var t2 = "A pre-call quality test is in progress. Please try ".concat(arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "This daily-js method", " again once testing has completed. Use stopTestCallQuality() to end it early.");
      throw console.error(t2), new Error(t2);
    }
  }
  function rc(e2) {
    if (!e2) {
      var t2 = "".concat(arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "This daily-js method", " is only supported on custom callObject instances");
      throw console.error(t2), new Error(t2);
    }
  }
  function ic(e2) {
    if (e2) {
      var t2 = "".concat(arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "This daily-js method", " is only supported as part of Daily's Prebuilt");
      throw console.error(t2), new Error(t2);
    }
  }
  function oc() {
    if (ia()) throw new Error("This daily-js method is not currently supported in React Native");
  }
  function ac() {
    if (!ia()) throw new Error("This daily-js method is only supported in React Native");
  }
  function sc(e2) {
    if (void 0 === e2) return true;
    var t2;
    if ("string" == typeof e2) t2 = e2;
    else try {
      t2 = JSON.stringify(e2), S(JSON.parse(t2), e2) || console.warn("The userData provided will be modified when serialized.");
    } catch (e3) {
      throw Error("userData must be serializable to JSON: ".concat(e3));
    }
    if (t2.length > 4096) throw Error("userData is too large (".concat(t2.length, " characters). Maximum size suppported is ").concat(4096, "."));
    return true;
  }
  function cc(e2, t2) {
    for (var n2 = t2.allowAllParticipantsKey, r2 = function(e3) {
      var t3 = ["local"];
      return n2 || t3.push("*"), e3 && !t3.includes(e3);
    }, i2 = function(e3) {
      return !!(void 0 === e3.layer || Number.isInteger(e3.layer) && e3.layer >= 0 || "inherit" === e3.layer);
    }, o2 = function(e3) {
      return !!e3 && (!(e3.video && !i2(e3.video)) && !(e3.screenVideo && !i2(e3.screenVideo)));
    }, a2 = 0, s2 = Object.entries(e2); a2 < s2.length; a2++) {
      var c2 = f(s2[a2], 2), l2 = c2[0], u2 = c2[1];
      if (!r2(l2) || !o2(u2)) return false;
    }
    return true;
  }
  function lc(e2) {
    if ("object" !== n(e2)) return false;
    for (var t2 = 0, r2 = Object.entries(e2); t2 < r2.length; t2++) {
      var i2 = f(r2[t2], 2), o2 = i2[0], a2 = i2[1];
      switch (o2) {
        case "video":
          if ("object" !== n(a2)) return false;
          for (var s2 = 0, c2 = Object.entries(a2); s2 < c2.length; s2++) {
            var l2 = f(c2[s2], 2), u2 = l2[0], d2 = l2[1];
            switch (u2) {
              case "processor":
                if (!pc(d2)) return false;
                break;
              case "settings":
                if (!hc(d2)) return false;
                break;
              default:
                return false;
            }
          }
          break;
        case "audio":
          if ("object" !== n(a2)) return false;
          for (var p2 = 0, h2 = Object.entries(a2); p2 < h2.length; p2++) {
            var v2 = f(h2[p2], 2), g2 = v2[0], m2 = v2[1];
            switch (g2) {
              case "processor":
                if (!dc(m2)) return false;
                break;
              case "settings":
                if (!hc(m2)) return false;
                break;
              default:
                return false;
            }
          }
          break;
        default:
          return false;
      }
    }
    return true;
  }
  function uc(e2, t2, n2) {
    var r2, i2 = [];
    e2.video && e2.video.processor && (pa(null !== (r2 = null == t2 ? void 0 : t2.useLegacyVideoProcessor) && void 0 !== r2 && r2) || (e2.video.settings ? delete e2.video.processor : delete e2.video, i2.push("video")));
    e2.audio && e2.audio.processor && (ha() || (e2.audio.settings ? delete e2.audio.processor : delete e2.audio, i2.push("audio"))), i2.length > 0 && console.error("Ignoring settings for browser- or platform-unsupported input processor(s): ".concat(i2.join(", "))), e2.audio && e2.audio.settings && (e2.audio.settings.customTrack ? (n2.audioTrack = e2.audio.settings.customTrack, e2.audio.settings = { customTrack: Qo }) : delete n2.audioTrack), e2.video && e2.video.settings && (e2.video.settings.customTrack ? (n2.videoTrack = e2.video.settings.customTrack, e2.video.settings = { customTrack: Qo }) : delete n2.videoTrack);
  }
  function dc(e2) {
    if (ia()) return console.warn("Video processing is not yet supported in React Native"), false;
    var t2 = ["type"];
    return !!e2 && ("object" === n(e2) && (Object.keys(e2).filter((function(e3) {
      return !t2.includes(e3);
    })).forEach((function(t3) {
      console.warn("invalid key inputSettings -> audio -> processor : ".concat(t3)), delete e2[t3];
    })), !!(function(e3) {
      if ("string" != typeof e3) return false;
      if (!Object.values(Yo).includes(e3)) return console.error("inputSettings audio processor type invalid"), false;
      return true;
    })(e2.type)));
  }
  function pc(e2) {
    if (ia()) return console.warn("Video processing is not yet supported in React Native"), false;
    var t2 = ["type", "config"];
    if (!e2) return false;
    if ("object" !== n(e2)) return false;
    if (!(function(e3) {
      if ("string" != typeof e3) return false;
      if (!Object.values(Ko).includes(e3)) return console.error("inputSettings video processor type invalid"), false;
      return true;
    })(e2.type)) return false;
    if (e2.config) {
      if ("object" !== n(e2.config)) return false;
      if (!(function(e3, t3) {
        var n2 = Object.keys(t3);
        if (0 === n2.length) return true;
        var r2 = "invalid object in inputSettings -> video -> processor -> config";
        switch (e3) {
          case Ko.BGBLUR:
            return n2.length > 1 || "strength" !== n2[0] ? (console.error(r2), false) : !("number" != typeof t3.strength || t3.strength <= 0 || t3.strength > 1 || isNaN(t3.strength)) || (console.error("".concat(r2, "; expected: {0 < strength <= 1}, got: ").concat(t3.strength)), false);
          case Ko.BGIMAGE:
            return !(void 0 !== t3.source && !(function(e4) {
              if ("default" === e4.source) return e4.type = "default", true;
              if (e4.source instanceof ArrayBuffer) return true;
              if (U(e4.source)) return e4.type = "url", !!(function(e5) {
                var t5 = new URL(e5), n4 = t5.pathname;
                if ("data:" === t5.protocol) try {
                  var r3 = n4.substring(n4.indexOf(":") + 1, n4.indexOf(";")).split("/")[1];
                  return Zo.includes(r3);
                } catch (e6) {
                  return console.error("failed to deduce blob content type", e6), false;
                }
                var i2 = n4.split(".").at(-1).toLowerCase().trim();
                return Zo.includes(i2);
              })(e4.source) || (console.error("invalid image type; supported types: [".concat(Zo.join(", "), "]")), false);
              return t4 = e4.source, n3 = Number(t4), isNaN(n3) || !Number.isInteger(n3) || n3 <= 0 || n3 > 10 ? (console.error("invalid image selection; must be an int, > 0, <= ".concat(10)), false) : (e4.type = "daily-preselect", true);
              var t4, n3;
            })(t3));
          default:
            return true;
        }
      })(e2.type, e2.config)) return false;
    }
    return Object.keys(e2).filter((function(e3) {
      return !t2.includes(e3);
    })).forEach((function(t3) {
      console.warn("invalid key inputSettings -> video -> processor : ".concat(t3)), delete e2[t3];
    })), true;
  }
  function hc(e2) {
    return "object" === n(e2) && (!e2.customTrack || e2.customTrack instanceof MediaStreamTrack);
  }
  function fc() {
    var e2 = Object.values(Ko).join(" | "), t2 = Object.values(Yo).join(" | ");
    return "inputSettings must be of the form: { video?: { processor?: { type: [ ".concat(e2, " ], config?: {} } }, audio?: { processor: {type: [ ").concat(t2, " ] } } }");
  }
  function vc(e2) {
    var t2 = e2.allowAllParticipantsKey;
    return "receiveSettings must be of the form { [<remote participant id> | ".concat(yi).concat(t2 ? ' | "'.concat("*", '"') : "", "]: ") + '{ [video: [{ layer: [<non-negative integer> | "inherit"] } | "inherit"]], [screenVideo: [{ layer: [<non-negative integer> | "inherit"] } | "inherit"]] }}}';
  }
  function gc() {
    return "customIntegrations should be an object of type ".concat(JSON.stringify(qs), ".");
  }
  function mc(e2) {
    if (e2 && "object" !== n(e2) || Array.isArray(e2)) return console.error("customTrayButtons should be an Object of the type ".concat(JSON.stringify($s), ".")), false;
    if (e2) for (var t2 = 0, r2 = Object.entries(e2); t2 < r2.length; t2++) for (var i2 = f(r2[t2], 1)[0], o2 = 0, a2 = Object.entries(e2[i2]); o2 < a2.length; o2++) {
      var s2 = f(a2[o2], 2), c2 = s2[0], l2 = s2[1], u2 = $s.id[c2];
      if (!u2) return console.error("customTrayButton does not support key ".concat(c2)), false;
      switch (c2) {
        case "iconPath":
        case "iconPathDarkMode":
          if (!U(l2)) return console.error("customTrayButton ".concat(c2, " should be a url.")), false;
          break;
        case "visualState":
          if (!["default", "sidebar-open", "active"].includes(l2)) return console.error("customTrayButton ".concat(c2, " should be ").concat(u2, ". Got: ").concat(l2)), false;
          break;
        default:
          if (n(l2) !== u2) return console.error("customTrayButton ".concat(c2, " should be a ").concat(u2, ".")), false;
      }
    }
    return true;
  }
  function yc(e2) {
    if (!e2 || e2 && "object" !== n(e2) || Array.isArray(e2)) return console.error(gc()), false;
    for (var t2 = function(e3) {
      return "".concat(e3, " should be ").concat(qs.id[e3]);
    }, r2 = function(e3, t3) {
      return console.error("customIntegration ".concat(e3, ": ").concat(t3));
    }, i2 = 0, o2 = Object.entries(e2); i2 < o2.length; i2++) {
      var a2 = f(o2[i2], 1)[0];
      if (!("label" in e2[a2])) return r2(a2, "label is required"), false;
      if (!("location" in e2[a2])) return r2(a2, "location is required"), false;
      if (!("src" in e2[a2]) && !("srcdoc" in e2[a2])) return r2(a2, "src or srcdoc is required"), false;
      for (var s2 = 0, c2 = Object.entries(e2[a2]); s2 < c2.length; s2++) {
        var l2 = f(c2[s2], 2), u2 = l2[0], d2 = l2[1];
        switch (u2) {
          case "allow":
          case "csp":
          case "name":
          case "referrerPolicy":
          case "sandbox":
            if ("string" != typeof d2) return r2(a2, t2(u2)), false;
            break;
          case "iconURL":
            if (!U(d2)) return r2(a2, "".concat(u2, " should be a url")), false;
            break;
          case "src":
            if ("srcdoc" in e2[a2]) return r2(a2, "cannot have both src and srcdoc"), false;
            if (!U(d2)) return r2(a2, 'src "'.concat(d2, '" is not a valid URL')), false;
            break;
          case "srcdoc":
            if ("src" in e2[a2]) return r2(a2, "cannot have both src and srcdoc"), false;
            if ("string" != typeof d2) return r2(a2, t2(u2)), false;
            break;
          case "location":
            if (!["main", "sidebar"].includes(d2)) return r2(a2, t2(u2)), false;
            break;
          case "controlledBy":
            if ("*" !== d2 && "owners" !== d2 && (!Array.isArray(d2) || d2.some((function(e3) {
              return "string" != typeof e3;
            })))) return r2(a2, t2(u2)), false;
            break;
          case "shared":
            if ((!Array.isArray(d2) || d2.some((function(e3) {
              return "string" != typeof e3;
            }))) && "owners" !== d2 && "boolean" != typeof d2) return r2(a2, t2(u2)), false;
            break;
          default:
            if (!qs.id[u2]) return console.error("customIntegration does not support key ".concat(u2)), false;
        }
      }
    }
    return true;
  }
  function bc(e2, t2) {
    if (void 0 === t2) return false;
    switch (n(t2)) {
      case "string":
        return n(e2) === t2;
      case "object":
        if ("object" !== n(e2)) return false;
        for (var r2 in e2) if (!bc(e2[r2], t2[r2])) return false;
        return true;
      default:
        return false;
    }
  }
  function _c(e2, t2) {
    var n2 = e2.sessionId, r2 = e2.toEndPoint, i2 = e2.callerId, o2 = e2.useSipRefer;
    if (!n2 || !r2) throw new Error("".concat(t2, "() requires a sessionId and toEndPoint"));
    if ("string" != typeof n2 || "string" != typeof r2) throw new Error("Invalid paramater: sessionId and toEndPoint must be of type string");
    if (o2 && !r2.startsWith("sip:")) throw new Error('"toEndPoint" must be a "sip" address');
    if (!r2.startsWith("sip:") && !r2.startsWith("+")) throw new Error("toEndPoint: ".concat(r2, ' must starts with either "sip:" or "+"'));
    if (i2 && "string" != typeof i2) throw new Error("callerId must be of type string");
    if (i2 && !r2.startsWith("+")) throw new Error("callerId is only valid when transferring to a PSTN number");
  }
  function wc(e2) {
    if ("object" !== n(e2)) throw new Error('RemoteMediaPlayerSettings: must be "object" type');
    if (e2.state && !Object.values(Xo).includes(e2.state)) throw new Error("Invalid value for RemoteMediaPlayerSettings.state, valid values are: " + JSON.stringify(Xo));
    if (e2.volume) {
      if ("number" != typeof e2.volume) throw new Error('RemoteMediaPlayerSettings.volume: must be "number" type');
      if (e2.volume < 0 || e2.volume > 2) throw new Error("RemoteMediaPlayerSettings.volume: must be between 0.0 - 2.0");
    }
  }
  function Sc(e2, t2, n2) {
    return !("number" != typeof e2 || e2 < t2 || e2 > n2);
  }
  function kc(e2, t2) {
    return e2 && !t2 && delete e2.data, e2;
  }

  // node_modules/@pipecat-ai/websocket-transport/dist/index.module.js
  var import_events2 = __toESM(require_events());

  // node_modules/@protobuf-ts/runtime/build/es2015/json-typings.js
  function typeofJsonValue(value) {
    let t2 = typeof value;
    if (t2 == "object") {
      if (Array.isArray(value))
        return "array";
      if (value === null)
        return "null";
    }
    return t2;
  }
  function isJsonObject(value) {
    return value !== null && typeof value == "object" && !Array.isArray(value);
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/base64.js
  var encTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
  var decTable = [];
  for (let i2 = 0; i2 < encTable.length; i2++)
    decTable[encTable[i2].charCodeAt(0)] = i2;
  decTable["-".charCodeAt(0)] = encTable.indexOf("+");
  decTable["_".charCodeAt(0)] = encTable.indexOf("/");
  function base64decode(base64Str) {
    let es2 = base64Str.length * 3 / 4;
    if (base64Str[base64Str.length - 2] == "=")
      es2 -= 2;
    else if (base64Str[base64Str.length - 1] == "=")
      es2 -= 1;
    let bytes = new Uint8Array(es2), bytePos = 0, groupPos = 0, b2, p2 = 0;
    for (let i2 = 0; i2 < base64Str.length; i2++) {
      b2 = decTable[base64Str.charCodeAt(i2)];
      if (b2 === void 0) {
        switch (base64Str[i2]) {
          case "=":
            groupPos = 0;
          // reset state when padding found
          case "\n":
          case "\r":
          case "	":
          case " ":
            continue;
          // skip white-space, and padding
          default:
            throw Error(`invalid base64 string.`);
        }
      }
      switch (groupPos) {
        case 0:
          p2 = b2;
          groupPos = 1;
          break;
        case 1:
          bytes[bytePos++] = p2 << 2 | (b2 & 48) >> 4;
          p2 = b2;
          groupPos = 2;
          break;
        case 2:
          bytes[bytePos++] = (p2 & 15) << 4 | (b2 & 60) >> 2;
          p2 = b2;
          groupPos = 3;
          break;
        case 3:
          bytes[bytePos++] = (p2 & 3) << 6 | b2;
          groupPos = 0;
          break;
      }
    }
    if (groupPos == 1)
      throw Error(`invalid base64 string.`);
    return bytes.subarray(0, bytePos);
  }
  function base64encode(bytes) {
    let base64 = "", groupPos = 0, b2, p2 = 0;
    for (let i2 = 0; i2 < bytes.length; i2++) {
      b2 = bytes[i2];
      switch (groupPos) {
        case 0:
          base64 += encTable[b2 >> 2];
          p2 = (b2 & 3) << 4;
          groupPos = 1;
          break;
        case 1:
          base64 += encTable[p2 | b2 >> 4];
          p2 = (b2 & 15) << 2;
          groupPos = 2;
          break;
        case 2:
          base64 += encTable[p2 | b2 >> 6];
          base64 += encTable[b2 & 63];
          groupPos = 0;
          break;
      }
    }
    if (groupPos) {
      base64 += encTable[p2];
      base64 += "=";
      if (groupPos == 1)
        base64 += "=";
    }
    return base64;
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/binary-format-contract.js
  var UnknownFieldHandler;
  (function(UnknownFieldHandler2) {
    UnknownFieldHandler2.symbol = /* @__PURE__ */ Symbol.for("protobuf-ts/unknown");
    UnknownFieldHandler2.onRead = (typeName, message, fieldNo, wireType, data) => {
      let container = is2(message) ? message[UnknownFieldHandler2.symbol] : message[UnknownFieldHandler2.symbol] = [];
      container.push({ no: fieldNo, wireType, data });
    };
    UnknownFieldHandler2.onWrite = (typeName, message, writer) => {
      for (let { no, wireType, data } of UnknownFieldHandler2.list(message))
        writer.tag(no, wireType).raw(data);
    };
    UnknownFieldHandler2.list = (message, fieldNo) => {
      if (is2(message)) {
        let all = message[UnknownFieldHandler2.symbol];
        return fieldNo ? all.filter((uf) => uf.no == fieldNo) : all;
      }
      return [];
    };
    UnknownFieldHandler2.last = (message, fieldNo) => UnknownFieldHandler2.list(message, fieldNo).slice(-1)[0];
    const is2 = (message) => message && Array.isArray(message[UnknownFieldHandler2.symbol]);
  })(UnknownFieldHandler || (UnknownFieldHandler = {}));
  var WireType;
  (function(WireType2) {
    WireType2[WireType2["Varint"] = 0] = "Varint";
    WireType2[WireType2["Bit64"] = 1] = "Bit64";
    WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
    WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
    WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
    WireType2[WireType2["Bit32"] = 5] = "Bit32";
  })(WireType || (WireType = {}));

  // node_modules/@protobuf-ts/runtime/build/es2015/goog-varint.js
  function varint64read() {
    let lowBits = 0;
    let highBits = 0;
    for (let shift = 0; shift < 28; shift += 7) {
      let b2 = this.buf[this.pos++];
      lowBits |= (b2 & 127) << shift;
      if ((b2 & 128) == 0) {
        this.assertBounds();
        return [lowBits, highBits];
      }
    }
    let middleByte = this.buf[this.pos++];
    lowBits |= (middleByte & 15) << 28;
    highBits = (middleByte & 112) >> 4;
    if ((middleByte & 128) == 0) {
      this.assertBounds();
      return [lowBits, highBits];
    }
    for (let shift = 3; shift <= 31; shift += 7) {
      let b2 = this.buf[this.pos++];
      highBits |= (b2 & 127) << shift;
      if ((b2 & 128) == 0) {
        this.assertBounds();
        return [lowBits, highBits];
      }
    }
    throw new Error("invalid varint");
  }
  function varint64write(lo2, hi2, bytes) {
    for (let i2 = 0; i2 < 28; i2 = i2 + 7) {
      const shift = lo2 >>> i2;
      const hasNext = !(shift >>> 7 == 0 && hi2 == 0);
      const byte = (hasNext ? shift | 128 : shift) & 255;
      bytes.push(byte);
      if (!hasNext) {
        return;
      }
    }
    const splitBits = lo2 >>> 28 & 15 | (hi2 & 7) << 4;
    const hasMoreBits = !(hi2 >> 3 == 0);
    bytes.push((hasMoreBits ? splitBits | 128 : splitBits) & 255);
    if (!hasMoreBits) {
      return;
    }
    for (let i2 = 3; i2 < 31; i2 = i2 + 7) {
      const shift = hi2 >>> i2;
      const hasNext = !(shift >>> 7 == 0);
      const byte = (hasNext ? shift | 128 : shift) & 255;
      bytes.push(byte);
      if (!hasNext) {
        return;
      }
    }
    bytes.push(hi2 >>> 31 & 1);
  }
  var TWO_PWR_32_DBL = (1 << 16) * (1 << 16);
  function int64fromString(dec) {
    let minus = dec[0] == "-";
    if (minus)
      dec = dec.slice(1);
    const base = 1e6;
    let lowBits = 0;
    let highBits = 0;
    function add1e6digit(begin, end) {
      const digit1e6 = Number(dec.slice(begin, end));
      highBits *= base;
      lowBits = lowBits * base + digit1e6;
      if (lowBits >= TWO_PWR_32_DBL) {
        highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
        lowBits = lowBits % TWO_PWR_32_DBL;
      }
    }
    add1e6digit(-24, -18);
    add1e6digit(-18, -12);
    add1e6digit(-12, -6);
    add1e6digit(-6);
    return [minus, lowBits, highBits];
  }
  function int64toString(bitsLow, bitsHigh) {
    if (bitsHigh >>> 0 <= 2097151) {
      return "" + (TWO_PWR_32_DBL * bitsHigh + (bitsLow >>> 0));
    }
    let low = bitsLow & 16777215;
    let mid = (bitsLow >>> 24 | bitsHigh << 8) >>> 0 & 16777215;
    let high = bitsHigh >> 16 & 65535;
    let digitA = low + mid * 6777216 + high * 6710656;
    let digitB = mid + high * 8147497;
    let digitC = high * 2;
    let base = 1e7;
    if (digitA >= base) {
      digitB += Math.floor(digitA / base);
      digitA %= base;
    }
    if (digitB >= base) {
      digitC += Math.floor(digitB / base);
      digitB %= base;
    }
    function decimalFrom1e7(digit1e7, needLeadingZeros) {
      let partial = digit1e7 ? String(digit1e7) : "";
      if (needLeadingZeros) {
        return "0000000".slice(partial.length) + partial;
      }
      return partial;
    }
    return decimalFrom1e7(
      digitC,
      /*needLeadingZeros=*/
      0
    ) + decimalFrom1e7(
      digitB,
      /*needLeadingZeros=*/
      digitC
    ) + // If the final 1e7 digit didn't need leading zeros, we would have
    // returned via the trivial code path at the top.
    decimalFrom1e7(
      digitA,
      /*needLeadingZeros=*/
      1
    );
  }
  function varint32write(value, bytes) {
    if (value >= 0) {
      while (value > 127) {
        bytes.push(value & 127 | 128);
        value = value >>> 7;
      }
      bytes.push(value);
    } else {
      for (let i2 = 0; i2 < 9; i2++) {
        bytes.push(value & 127 | 128);
        value = value >> 7;
      }
      bytes.push(1);
    }
  }
  function varint32read() {
    let b2 = this.buf[this.pos++];
    let result = b2 & 127;
    if ((b2 & 128) == 0) {
      this.assertBounds();
      return result;
    }
    b2 = this.buf[this.pos++];
    result |= (b2 & 127) << 7;
    if ((b2 & 128) == 0) {
      this.assertBounds();
      return result;
    }
    b2 = this.buf[this.pos++];
    result |= (b2 & 127) << 14;
    if ((b2 & 128) == 0) {
      this.assertBounds();
      return result;
    }
    b2 = this.buf[this.pos++];
    result |= (b2 & 127) << 21;
    if ((b2 & 128) == 0) {
      this.assertBounds();
      return result;
    }
    b2 = this.buf[this.pos++];
    result |= (b2 & 15) << 28;
    for (let readBytes = 5; (b2 & 128) !== 0 && readBytes < 10; readBytes++)
      b2 = this.buf[this.pos++];
    if ((b2 & 128) != 0)
      throw new Error("invalid varint");
    this.assertBounds();
    return result >>> 0;
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/pb-long.js
  var BI;
  function detectBi() {
    const dv = new DataView(new ArrayBuffer(8));
    const ok = globalThis.BigInt !== void 0 && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function";
    BI = ok ? {
      MIN: BigInt("-9223372036854775808"),
      MAX: BigInt("9223372036854775807"),
      UMIN: BigInt("0"),
      UMAX: BigInt("18446744073709551615"),
      C: BigInt,
      V: dv
    } : void 0;
  }
  detectBi();
  function assertBi(bi) {
    if (!bi)
      throw new Error("BigInt unavailable, see https://github.com/timostamm/protobuf-ts/blob/v1.0.8/MANUAL.md#bigint-support");
  }
  var RE_DECIMAL_STR = /^-?[0-9]+$/;
  var TWO_PWR_32_DBL2 = 4294967296;
  var HALF_2_PWR_32 = 2147483648;
  var SharedPbLong = class {
    /**
     * Create a new instance with the given bits.
     */
    constructor(lo2, hi2) {
      this.lo = lo2 | 0;
      this.hi = hi2 | 0;
    }
    /**
     * Is this instance equal to 0?
     */
    isZero() {
      return this.lo == 0 && this.hi == 0;
    }
    /**
     * Convert to a native number.
     */
    toNumber() {
      let result = this.hi * TWO_PWR_32_DBL2 + (this.lo >>> 0);
      if (!Number.isSafeInteger(result))
        throw new Error("cannot convert to safe number");
      return result;
    }
  };
  var PbULong = class _PbULong extends SharedPbLong {
    /**
     * Create instance from a `string`, `number` or `bigint`.
     */
    static from(value) {
      if (BI)
        switch (typeof value) {
          case "string":
            if (value == "0")
              return this.ZERO;
            if (value == "")
              throw new Error("string is no integer");
            value = BI.C(value);
          case "number":
            if (value === 0)
              return this.ZERO;
            value = BI.C(value);
          case "bigint":
            if (!value)
              return this.ZERO;
            if (value < BI.UMIN)
              throw new Error("signed value for ulong");
            if (value > BI.UMAX)
              throw new Error("ulong too large");
            BI.V.setBigUint64(0, value, true);
            return new _PbULong(BI.V.getInt32(0, true), BI.V.getInt32(4, true));
        }
      else
        switch (typeof value) {
          case "string":
            if (value == "0")
              return this.ZERO;
            value = value.trim();
            if (!RE_DECIMAL_STR.test(value))
              throw new Error("string is no integer");
            let [minus, lo2, hi2] = int64fromString(value);
            if (minus)
              throw new Error("signed value for ulong");
            return new _PbULong(lo2, hi2);
          case "number":
            if (value == 0)
              return this.ZERO;
            if (!Number.isSafeInteger(value))
              throw new Error("number is no integer");
            if (value < 0)
              throw new Error("signed value for ulong");
            return new _PbULong(value, value / TWO_PWR_32_DBL2);
        }
      throw new Error("unknown value " + typeof value);
    }
    /**
     * Convert to decimal string.
     */
    toString() {
      return BI ? this.toBigInt().toString() : int64toString(this.lo, this.hi);
    }
    /**
     * Convert to native bigint.
     */
    toBigInt() {
      assertBi(BI);
      BI.V.setInt32(0, this.lo, true);
      BI.V.setInt32(4, this.hi, true);
      return BI.V.getBigUint64(0, true);
    }
  };
  PbULong.ZERO = new PbULong(0, 0);
  var PbLong = class _PbLong extends SharedPbLong {
    /**
     * Create instance from a `string`, `number` or `bigint`.
     */
    static from(value) {
      if (BI)
        switch (typeof value) {
          case "string":
            if (value == "0")
              return this.ZERO;
            if (value == "")
              throw new Error("string is no integer");
            value = BI.C(value);
          case "number":
            if (value === 0)
              return this.ZERO;
            value = BI.C(value);
          case "bigint":
            if (!value)
              return this.ZERO;
            if (value < BI.MIN)
              throw new Error("signed long too small");
            if (value > BI.MAX)
              throw new Error("signed long too large");
            BI.V.setBigInt64(0, value, true);
            return new _PbLong(BI.V.getInt32(0, true), BI.V.getInt32(4, true));
        }
      else
        switch (typeof value) {
          case "string":
            if (value == "0")
              return this.ZERO;
            value = value.trim();
            if (!RE_DECIMAL_STR.test(value))
              throw new Error("string is no integer");
            let [minus, lo2, hi2] = int64fromString(value);
            if (minus) {
              if (hi2 > HALF_2_PWR_32 || hi2 == HALF_2_PWR_32 && lo2 != 0)
                throw new Error("signed long too small");
            } else if (hi2 >= HALF_2_PWR_32)
              throw new Error("signed long too large");
            let pbl = new _PbLong(lo2, hi2);
            return minus ? pbl.negate() : pbl;
          case "number":
            if (value == 0)
              return this.ZERO;
            if (!Number.isSafeInteger(value))
              throw new Error("number is no integer");
            return value > 0 ? new _PbLong(value, value / TWO_PWR_32_DBL2) : new _PbLong(-value, -value / TWO_PWR_32_DBL2).negate();
        }
      throw new Error("unknown value " + typeof value);
    }
    /**
     * Do we have a minus sign?
     */
    isNegative() {
      return (this.hi & HALF_2_PWR_32) !== 0;
    }
    /**
     * Negate two's complement.
     * Invert all the bits and add one to the result.
     */
    negate() {
      let hi2 = ~this.hi, lo2 = this.lo;
      if (lo2)
        lo2 = ~lo2 + 1;
      else
        hi2 += 1;
      return new _PbLong(lo2, hi2);
    }
    /**
     * Convert to decimal string.
     */
    toString() {
      if (BI)
        return this.toBigInt().toString();
      if (this.isNegative()) {
        let n2 = this.negate();
        return "-" + int64toString(n2.lo, n2.hi);
      }
      return int64toString(this.lo, this.hi);
    }
    /**
     * Convert to native bigint.
     */
    toBigInt() {
      assertBi(BI);
      BI.V.setInt32(0, this.lo, true);
      BI.V.setInt32(4, this.hi, true);
      return BI.V.getBigInt64(0, true);
    }
  };
  PbLong.ZERO = new PbLong(0, 0);

  // node_modules/@protobuf-ts/runtime/build/es2015/binary-reader.js
  var defaultsRead = {
    readUnknownField: true,
    readerFactory: (bytes) => new BinaryReader(bytes)
  };
  function binaryReadOptions(options) {
    return options ? Object.assign(Object.assign({}, defaultsRead), options) : defaultsRead;
  }
  var BinaryReader = class {
    constructor(buf, textDecoder) {
      this.varint64 = varint64read;
      this.uint32 = varint32read;
      this.buf = buf;
      this.len = buf.length;
      this.pos = 0;
      this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      this.textDecoder = textDecoder !== null && textDecoder !== void 0 ? textDecoder : new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true
      });
    }
    /**
     * Reads a tag - field number and wire type.
     */
    tag() {
      let tag = this.uint32(), fieldNo = tag >>> 3, wireType = tag & 7;
      if (fieldNo <= 0 || wireType < 0 || wireType > 5)
        throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
      return [fieldNo, wireType];
    }
    /**
     * Skip one element on the wire and return the skipped data.
     * Supports WireType.StartGroup since v2.0.0-alpha.23.
     */
    skip(wireType) {
      let start = this.pos;
      switch (wireType) {
        case WireType.Varint:
          while (this.buf[this.pos++] & 128) {
          }
          break;
        case WireType.Bit64:
          this.pos += 4;
        case WireType.Bit32:
          this.pos += 4;
          break;
        case WireType.LengthDelimited:
          let len = this.uint32();
          this.pos += len;
          break;
        case WireType.StartGroup:
          let t2;
          while ((t2 = this.tag()[1]) !== WireType.EndGroup) {
            this.skip(t2);
          }
          break;
        default:
          throw new Error("cant skip wire type " + wireType);
      }
      this.assertBounds();
      return this.buf.subarray(start, this.pos);
    }
    /**
     * Throws error if position in byte array is out of range.
     */
    assertBounds() {
      if (this.pos > this.len)
        throw new RangeError("premature EOF");
    }
    /**
     * Read a `int32` field, a signed 32 bit varint.
     */
    int32() {
      return this.uint32() | 0;
    }
    /**
     * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
     */
    sint32() {
      let zze = this.uint32();
      return zze >>> 1 ^ -(zze & 1);
    }
    /**
     * Read a `int64` field, a signed 64-bit varint.
     */
    int64() {
      return new PbLong(...this.varint64());
    }
    /**
     * Read a `uint64` field, an unsigned 64-bit varint.
     */
    uint64() {
      return new PbULong(...this.varint64());
    }
    /**
     * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
     */
    sint64() {
      let [lo2, hi2] = this.varint64();
      let s2 = -(lo2 & 1);
      lo2 = (lo2 >>> 1 | (hi2 & 1) << 31) ^ s2;
      hi2 = hi2 >>> 1 ^ s2;
      return new PbLong(lo2, hi2);
    }
    /**
     * Read a `bool` field, a variant.
     */
    bool() {
      let [lo2, hi2] = this.varint64();
      return lo2 !== 0 || hi2 !== 0;
    }
    /**
     * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
     */
    fixed32() {
      return this.view.getUint32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
     */
    sfixed32() {
      return this.view.getInt32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
     */
    fixed64() {
      return new PbULong(this.sfixed32(), this.sfixed32());
    }
    /**
     * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
     */
    sfixed64() {
      return new PbLong(this.sfixed32(), this.sfixed32());
    }
    /**
     * Read a `float` field, 32-bit floating point number.
     */
    float() {
      return this.view.getFloat32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `double` field, a 64-bit floating point number.
     */
    double() {
      return this.view.getFloat64((this.pos += 8) - 8, true);
    }
    /**
     * Read a `bytes` field, length-delimited arbitrary data.
     */
    bytes() {
      let len = this.uint32();
      let start = this.pos;
      this.pos += len;
      this.assertBounds();
      return this.buf.subarray(start, start + len);
    }
    /**
     * Read a `string` field, length-delimited data converted to UTF-8 text.
     */
    string() {
      return this.textDecoder.decode(this.bytes());
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/assert.js
  function assert(condition, msg) {
    if (!condition) {
      throw new Error(msg);
    }
  }
  var FLOAT32_MAX = 34028234663852886e22;
  var FLOAT32_MIN = -34028234663852886e22;
  var UINT32_MAX = 4294967295;
  var INT32_MAX = 2147483647;
  var INT32_MIN = -2147483648;
  function assertInt32(arg) {
    if (typeof arg !== "number")
      throw new Error("invalid int 32: " + typeof arg);
    if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
      throw new Error("invalid int 32: " + arg);
  }
  function assertUInt32(arg) {
    if (typeof arg !== "number")
      throw new Error("invalid uint 32: " + typeof arg);
    if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
      throw new Error("invalid uint 32: " + arg);
  }
  function assertFloat32(arg) {
    if (typeof arg !== "number")
      throw new Error("invalid float 32: " + typeof arg);
    if (!Number.isFinite(arg))
      return;
    if (arg > FLOAT32_MAX || arg < FLOAT32_MIN)
      throw new Error("invalid float 32: " + arg);
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/binary-writer.js
  var defaultsWrite = {
    writeUnknownFields: true,
    writerFactory: () => new BinaryWriter()
  };
  function binaryWriteOptions(options) {
    return options ? Object.assign(Object.assign({}, defaultsWrite), options) : defaultsWrite;
  }
  var BinaryWriter = class {
    constructor(textEncoder) {
      this.stack = [];
      this.textEncoder = textEncoder !== null && textEncoder !== void 0 ? textEncoder : new TextEncoder();
      this.chunks = [];
      this.buf = [];
    }
    /**
     * Return all bytes written and reset this writer.
     */
    finish() {
      this.chunks.push(new Uint8Array(this.buf));
      let len = 0;
      for (let i2 = 0; i2 < this.chunks.length; i2++)
        len += this.chunks[i2].length;
      let bytes = new Uint8Array(len);
      let offset = 0;
      for (let i2 = 0; i2 < this.chunks.length; i2++) {
        bytes.set(this.chunks[i2], offset);
        offset += this.chunks[i2].length;
      }
      this.chunks = [];
      return bytes;
    }
    /**
     * Start a new fork for length-delimited data like a message
     * or a packed repeated field.
     *
     * Must be joined later with `join()`.
     */
    fork() {
      this.stack.push({ chunks: this.chunks, buf: this.buf });
      this.chunks = [];
      this.buf = [];
      return this;
    }
    /**
     * Join the last fork. Write its length and bytes, then
     * return to the previous state.
     */
    join() {
      let chunk = this.finish();
      let prev = this.stack.pop();
      if (!prev)
        throw new Error("invalid state, fork stack empty");
      this.chunks = prev.chunks;
      this.buf = prev.buf;
      this.uint32(chunk.byteLength);
      return this.raw(chunk);
    }
    /**
     * Writes a tag (field number and wire type).
     *
     * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
     *
     * Generated code should compute the tag ahead of time and call `uint32()`.
     */
    tag(fieldNo, type) {
      return this.uint32((fieldNo << 3 | type) >>> 0);
    }
    /**
     * Write a chunk of raw bytes.
     */
    raw(chunk) {
      if (this.buf.length) {
        this.chunks.push(new Uint8Array(this.buf));
        this.buf = [];
      }
      this.chunks.push(chunk);
      return this;
    }
    /**
     * Write a `uint32` value, an unsigned 32 bit varint.
     */
    uint32(value) {
      assertUInt32(value);
      while (value > 127) {
        this.buf.push(value & 127 | 128);
        value = value >>> 7;
      }
      this.buf.push(value);
      return this;
    }
    /**
     * Write a `int32` value, a signed 32 bit varint.
     */
    int32(value) {
      assertInt32(value);
      varint32write(value, this.buf);
      return this;
    }
    /**
     * Write a `bool` value, a variant.
     */
    bool(value) {
      this.buf.push(value ? 1 : 0);
      return this;
    }
    /**
     * Write a `bytes` value, length-delimited arbitrary data.
     */
    bytes(value) {
      this.uint32(value.byteLength);
      return this.raw(value);
    }
    /**
     * Write a `string` value, length-delimited data converted to UTF-8 text.
     */
    string(value) {
      let chunk = this.textEncoder.encode(value);
      this.uint32(chunk.byteLength);
      return this.raw(chunk);
    }
    /**
     * Write a `float` value, 32-bit floating point number.
     */
    float(value) {
      assertFloat32(value);
      let chunk = new Uint8Array(4);
      new DataView(chunk.buffer).setFloat32(0, value, true);
      return this.raw(chunk);
    }
    /**
     * Write a `double` value, a 64-bit floating point number.
     */
    double(value) {
      let chunk = new Uint8Array(8);
      new DataView(chunk.buffer).setFloat64(0, value, true);
      return this.raw(chunk);
    }
    /**
     * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
     */
    fixed32(value) {
      assertUInt32(value);
      let chunk = new Uint8Array(4);
      new DataView(chunk.buffer).setUint32(0, value, true);
      return this.raw(chunk);
    }
    /**
     * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
     */
    sfixed32(value) {
      assertInt32(value);
      let chunk = new Uint8Array(4);
      new DataView(chunk.buffer).setInt32(0, value, true);
      return this.raw(chunk);
    }
    /**
     * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
     */
    sint32(value) {
      assertInt32(value);
      value = (value << 1 ^ value >> 31) >>> 0;
      varint32write(value, this.buf);
      return this;
    }
    /**
     * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
     */
    sfixed64(value) {
      let chunk = new Uint8Array(8);
      let view = new DataView(chunk.buffer);
      let long = PbLong.from(value);
      view.setInt32(0, long.lo, true);
      view.setInt32(4, long.hi, true);
      return this.raw(chunk);
    }
    /**
     * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
     */
    fixed64(value) {
      let chunk = new Uint8Array(8);
      let view = new DataView(chunk.buffer);
      let long = PbULong.from(value);
      view.setInt32(0, long.lo, true);
      view.setInt32(4, long.hi, true);
      return this.raw(chunk);
    }
    /**
     * Write a `int64` value, a signed 64-bit varint.
     */
    int64(value) {
      let long = PbLong.from(value);
      varint64write(long.lo, long.hi, this.buf);
      return this;
    }
    /**
     * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
     */
    sint64(value) {
      let long = PbLong.from(value), sign = long.hi >> 31, lo2 = long.lo << 1 ^ sign, hi2 = (long.hi << 1 | long.lo >>> 31) ^ sign;
      varint64write(lo2, hi2, this.buf);
      return this;
    }
    /**
     * Write a `uint64` value, an unsigned 64-bit varint.
     */
    uint64(value) {
      let long = PbULong.from(value);
      varint64write(long.lo, long.hi, this.buf);
      return this;
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/json-format-contract.js
  var defaultsWrite2 = {
    emitDefaultValues: false,
    enumAsInteger: false,
    useProtoFieldName: false,
    prettySpaces: 0
  };
  var defaultsRead2 = {
    ignoreUnknownFields: false
  };
  function jsonReadOptions(options) {
    return options ? Object.assign(Object.assign({}, defaultsRead2), options) : defaultsRead2;
  }
  function jsonWriteOptions(options) {
    return options ? Object.assign(Object.assign({}, defaultsWrite2), options) : defaultsWrite2;
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/message-type-contract.js
  var MESSAGE_TYPE = /* @__PURE__ */ Symbol.for("protobuf-ts/message-type");

  // node_modules/@protobuf-ts/runtime/build/es2015/lower-camel-case.js
  function lowerCamelCase(snakeCase) {
    let capNext = false;
    const sb = [];
    for (let i2 = 0; i2 < snakeCase.length; i2++) {
      let next = snakeCase.charAt(i2);
      if (next == "_") {
        capNext = true;
      } else if (/\d/.test(next)) {
        sb.push(next);
        capNext = true;
      } else if (capNext) {
        sb.push(next.toUpperCase());
        capNext = false;
      } else if (i2 == 0) {
        sb.push(next.toLowerCase());
      } else {
        sb.push(next);
      }
    }
    return sb.join("");
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-info.js
  var ScalarType;
  (function(ScalarType2) {
    ScalarType2[ScalarType2["DOUBLE"] = 1] = "DOUBLE";
    ScalarType2[ScalarType2["FLOAT"] = 2] = "FLOAT";
    ScalarType2[ScalarType2["INT64"] = 3] = "INT64";
    ScalarType2[ScalarType2["UINT64"] = 4] = "UINT64";
    ScalarType2[ScalarType2["INT32"] = 5] = "INT32";
    ScalarType2[ScalarType2["FIXED64"] = 6] = "FIXED64";
    ScalarType2[ScalarType2["FIXED32"] = 7] = "FIXED32";
    ScalarType2[ScalarType2["BOOL"] = 8] = "BOOL";
    ScalarType2[ScalarType2["STRING"] = 9] = "STRING";
    ScalarType2[ScalarType2["BYTES"] = 12] = "BYTES";
    ScalarType2[ScalarType2["UINT32"] = 13] = "UINT32";
    ScalarType2[ScalarType2["SFIXED32"] = 15] = "SFIXED32";
    ScalarType2[ScalarType2["SFIXED64"] = 16] = "SFIXED64";
    ScalarType2[ScalarType2["SINT32"] = 17] = "SINT32";
    ScalarType2[ScalarType2["SINT64"] = 18] = "SINT64";
  })(ScalarType || (ScalarType = {}));
  var LongType;
  (function(LongType2) {
    LongType2[LongType2["BIGINT"] = 0] = "BIGINT";
    LongType2[LongType2["STRING"] = 1] = "STRING";
    LongType2[LongType2["NUMBER"] = 2] = "NUMBER";
  })(LongType || (LongType = {}));
  var RepeatType;
  (function(RepeatType2) {
    RepeatType2[RepeatType2["NO"] = 0] = "NO";
    RepeatType2[RepeatType2["PACKED"] = 1] = "PACKED";
    RepeatType2[RepeatType2["UNPACKED"] = 2] = "UNPACKED";
  })(RepeatType || (RepeatType = {}));
  function normalizeFieldInfo(field) {
    var _a2, _b, _c2, _d;
    field.localName = (_a2 = field.localName) !== null && _a2 !== void 0 ? _a2 : lowerCamelCase(field.name);
    field.jsonName = (_b = field.jsonName) !== null && _b !== void 0 ? _b : lowerCamelCase(field.name);
    field.repeat = (_c2 = field.repeat) !== null && _c2 !== void 0 ? _c2 : RepeatType.NO;
    field.opt = (_d = field.opt) !== null && _d !== void 0 ? _d : field.repeat ? false : field.oneof ? false : field.kind == "message";
    return field;
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/oneof.js
  function isOneofGroup(any) {
    if (typeof any != "object" || any === null || !any.hasOwnProperty("oneofKind")) {
      return false;
    }
    switch (typeof any.oneofKind) {
      case "string":
        if (any[any.oneofKind] === void 0)
          return false;
        return Object.keys(any).length == 2;
      case "undefined":
        return Object.keys(any).length == 1;
      default:
        return false;
    }
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-type-check.js
  var ReflectionTypeCheck = class {
    constructor(info) {
      var _a2;
      this.fields = (_a2 = info.fields) !== null && _a2 !== void 0 ? _a2 : [];
    }
    prepare() {
      if (this.data)
        return;
      const req = [], known = [], oneofs = [];
      for (let field of this.fields) {
        if (field.oneof) {
          if (!oneofs.includes(field.oneof)) {
            oneofs.push(field.oneof);
            req.push(field.oneof);
            known.push(field.oneof);
          }
        } else {
          known.push(field.localName);
          switch (field.kind) {
            case "scalar":
            case "enum":
              if (!field.opt || field.repeat)
                req.push(field.localName);
              break;
            case "message":
              if (field.repeat)
                req.push(field.localName);
              break;
            case "map":
              req.push(field.localName);
              break;
          }
        }
      }
      this.data = { req, known, oneofs: Object.values(oneofs) };
    }
    /**
     * Is the argument a valid message as specified by the
     * reflection information?
     *
     * Checks all field types recursively. The `depth`
     * specifies how deep into the structure the check will be.
     *
     * With a depth of 0, only the presence of fields
     * is checked.
     *
     * With a depth of 1 or more, the field types are checked.
     *
     * With a depth of 2 or more, the members of map, repeated
     * and message fields are checked.
     *
     * Message fields will be checked recursively with depth - 1.
     *
     * The number of map entries / repeated values being checked
     * is < depth.
     */
    is(message, depth, allowExcessProperties = false) {
      if (depth < 0)
        return true;
      if (message === null || message === void 0 || typeof message != "object")
        return false;
      this.prepare();
      let keys = Object.keys(message), data = this.data;
      if (keys.length < data.req.length || data.req.some((n2) => !keys.includes(n2)))
        return false;
      if (!allowExcessProperties) {
        if (keys.some((k2) => !data.known.includes(k2)))
          return false;
      }
      if (depth < 1) {
        return true;
      }
      for (const name of data.oneofs) {
        const group = message[name];
        if (!isOneofGroup(group))
          return false;
        if (group.oneofKind === void 0)
          continue;
        const field = this.fields.find((f2) => f2.localName === group.oneofKind);
        if (!field)
          return false;
        if (!this.field(group[group.oneofKind], field, allowExcessProperties, depth))
          return false;
      }
      for (const field of this.fields) {
        if (field.oneof !== void 0)
          continue;
        if (!this.field(message[field.localName], field, allowExcessProperties, depth))
          return false;
      }
      return true;
    }
    field(arg, field, allowExcessProperties, depth) {
      let repeated = field.repeat;
      switch (field.kind) {
        case "scalar":
          if (arg === void 0)
            return field.opt;
          if (repeated)
            return this.scalars(arg, field.T, depth, field.L);
          return this.scalar(arg, field.T, field.L);
        case "enum":
          if (arg === void 0)
            return field.opt;
          if (repeated)
            return this.scalars(arg, ScalarType.INT32, depth);
          return this.scalar(arg, ScalarType.INT32);
        case "message":
          if (arg === void 0)
            return true;
          if (repeated)
            return this.messages(arg, field.T(), allowExcessProperties, depth);
          return this.message(arg, field.T(), allowExcessProperties, depth);
        case "map":
          if (typeof arg != "object" || arg === null)
            return false;
          if (depth < 2)
            return true;
          if (!this.mapKeys(arg, field.K, depth))
            return false;
          switch (field.V.kind) {
            case "scalar":
              return this.scalars(Object.values(arg), field.V.T, depth, field.V.L);
            case "enum":
              return this.scalars(Object.values(arg), ScalarType.INT32, depth);
            case "message":
              return this.messages(Object.values(arg), field.V.T(), allowExcessProperties, depth);
          }
          break;
      }
      return true;
    }
    message(arg, type, allowExcessProperties, depth) {
      if (allowExcessProperties) {
        return type.isAssignable(arg, depth);
      }
      return type.is(arg, depth);
    }
    messages(arg, type, allowExcessProperties, depth) {
      if (!Array.isArray(arg))
        return false;
      if (depth < 2)
        return true;
      if (allowExcessProperties) {
        for (let i2 = 0; i2 < arg.length && i2 < depth; i2++)
          if (!type.isAssignable(arg[i2], depth - 1))
            return false;
      } else {
        for (let i2 = 0; i2 < arg.length && i2 < depth; i2++)
          if (!type.is(arg[i2], depth - 1))
            return false;
      }
      return true;
    }
    scalar(arg, type, longType) {
      let argType = typeof arg;
      switch (type) {
        case ScalarType.UINT64:
        case ScalarType.FIXED64:
        case ScalarType.INT64:
        case ScalarType.SFIXED64:
        case ScalarType.SINT64:
          switch (longType) {
            case LongType.BIGINT:
              return argType == "bigint";
            case LongType.NUMBER:
              return argType == "number" && !isNaN(arg);
            default:
              return argType == "string";
          }
        case ScalarType.BOOL:
          return argType == "boolean";
        case ScalarType.STRING:
          return argType == "string";
        case ScalarType.BYTES:
          return arg instanceof Uint8Array;
        case ScalarType.DOUBLE:
        case ScalarType.FLOAT:
          return argType == "number" && !isNaN(arg);
        default:
          return argType == "number" && Number.isInteger(arg);
      }
    }
    scalars(arg, type, depth, longType) {
      if (!Array.isArray(arg))
        return false;
      if (depth < 2)
        return true;
      if (Array.isArray(arg)) {
        for (let i2 = 0; i2 < arg.length && i2 < depth; i2++)
          if (!this.scalar(arg[i2], type, longType))
            return false;
      }
      return true;
    }
    mapKeys(map, type, depth) {
      let keys = Object.keys(map);
      switch (type) {
        case ScalarType.INT32:
        case ScalarType.FIXED32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32:
        case ScalarType.UINT32:
          return this.scalars(keys.slice(0, depth).map((k2) => parseInt(k2)), type, depth);
        case ScalarType.BOOL:
          return this.scalars(keys.slice(0, depth).map((k2) => k2 == "true" ? true : k2 == "false" ? false : k2), type, depth);
        default:
          return this.scalars(keys, type, depth, LongType.STRING);
      }
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-long-convert.js
  function reflectionLongConvert(long, type) {
    switch (type) {
      case LongType.BIGINT:
        return long.toBigInt();
      case LongType.NUMBER:
        return long.toNumber();
      default:
        return long.toString();
    }
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-json-reader.js
  var ReflectionJsonReader = class {
    constructor(info) {
      this.info = info;
    }
    prepare() {
      var _a2;
      if (this.fMap === void 0) {
        this.fMap = {};
        const fieldsInput = (_a2 = this.info.fields) !== null && _a2 !== void 0 ? _a2 : [];
        for (const field of fieldsInput) {
          this.fMap[field.name] = field;
          this.fMap[field.jsonName] = field;
          this.fMap[field.localName] = field;
        }
      }
    }
    // Cannot parse JSON <type of jsonValue> for <type name>#<fieldName>.
    assert(condition, fieldName, jsonValue) {
      if (!condition) {
        let what = typeofJsonValue(jsonValue);
        if (what == "number" || what == "boolean")
          what = jsonValue.toString();
        throw new Error(`Cannot parse JSON ${what} for ${this.info.typeName}#${fieldName}`);
      }
    }
    /**
     * Reads a message from canonical JSON format into the target message.
     *
     * Repeated fields are appended. Map entries are added, overwriting
     * existing keys.
     *
     * If a message field is already present, it will be merged with the
     * new data.
     */
    read(input, message, options) {
      this.prepare();
      const oneofsHandled = [];
      for (const [jsonKey, jsonValue] of Object.entries(input)) {
        const field = this.fMap[jsonKey];
        if (!field) {
          if (!options.ignoreUnknownFields)
            throw new Error(`Found unknown field while reading ${this.info.typeName} from JSON format. JSON key: ${jsonKey}`);
          continue;
        }
        const localName = field.localName;
        let target;
        if (field.oneof) {
          if (jsonValue === null && (field.kind !== "enum" || field.T()[0] !== "google.protobuf.NullValue")) {
            continue;
          }
          if (oneofsHandled.includes(field.oneof))
            throw new Error(`Multiple members of the oneof group "${field.oneof}" of ${this.info.typeName} are present in JSON.`);
          oneofsHandled.push(field.oneof);
          target = message[field.oneof] = {
            oneofKind: localName
          };
        } else {
          target = message;
        }
        if (field.kind == "map") {
          if (jsonValue === null) {
            continue;
          }
          this.assert(isJsonObject(jsonValue), field.name, jsonValue);
          const fieldObj = target[localName];
          for (const [jsonObjKey, jsonObjValue] of Object.entries(jsonValue)) {
            this.assert(jsonObjValue !== null, field.name + " map value", null);
            let val;
            switch (field.V.kind) {
              case "message":
                val = field.V.T().internalJsonRead(jsonObjValue, options);
                break;
              case "enum":
                val = this.enum(field.V.T(), jsonObjValue, field.name, options.ignoreUnknownFields);
                if (val === false)
                  continue;
                break;
              case "scalar":
                val = this.scalar(jsonObjValue, field.V.T, field.V.L, field.name);
                break;
            }
            this.assert(val !== void 0, field.name + " map value", jsonObjValue);
            let key = jsonObjKey;
            if (field.K == ScalarType.BOOL)
              key = key == "true" ? true : key == "false" ? false : key;
            key = this.scalar(key, field.K, LongType.STRING, field.name).toString();
            fieldObj[key] = val;
          }
        } else if (field.repeat) {
          if (jsonValue === null)
            continue;
          this.assert(Array.isArray(jsonValue), field.name, jsonValue);
          const fieldArr = target[localName];
          for (const jsonItem of jsonValue) {
            this.assert(jsonItem !== null, field.name, null);
            let val;
            switch (field.kind) {
              case "message":
                val = field.T().internalJsonRead(jsonItem, options);
                break;
              case "enum":
                val = this.enum(field.T(), jsonItem, field.name, options.ignoreUnknownFields);
                if (val === false)
                  continue;
                break;
              case "scalar":
                val = this.scalar(jsonItem, field.T, field.L, field.name);
                break;
            }
            this.assert(val !== void 0, field.name, jsonValue);
            fieldArr.push(val);
          }
        } else {
          switch (field.kind) {
            case "message":
              if (jsonValue === null && field.T().typeName != "google.protobuf.Value") {
                this.assert(field.oneof === void 0, field.name + " (oneof member)", null);
                continue;
              }
              target[localName] = field.T().internalJsonRead(jsonValue, options, target[localName]);
              break;
            case "enum":
              if (jsonValue === null)
                continue;
              let val = this.enum(field.T(), jsonValue, field.name, options.ignoreUnknownFields);
              if (val === false)
                continue;
              target[localName] = val;
              break;
            case "scalar":
              if (jsonValue === null)
                continue;
              target[localName] = this.scalar(jsonValue, field.T, field.L, field.name);
              break;
          }
        }
      }
    }
    /**
     * Returns `false` for unrecognized string representations.
     *
     * google.protobuf.NullValue accepts only JSON `null` (or the old `"NULL_VALUE"`).
     */
    enum(type, json, fieldName, ignoreUnknownFields) {
      if (type[0] == "google.protobuf.NullValue")
        assert(json === null || json === "NULL_VALUE", `Unable to parse field ${this.info.typeName}#${fieldName}, enum ${type[0]} only accepts null.`);
      if (json === null)
        return 0;
      switch (typeof json) {
        case "number":
          assert(Number.isInteger(json), `Unable to parse field ${this.info.typeName}#${fieldName}, enum can only be integral number, got ${json}.`);
          return json;
        case "string":
          let localEnumName = json;
          if (type[2] && json.substring(0, type[2].length) === type[2])
            localEnumName = json.substring(type[2].length);
          let enumNumber = type[1][localEnumName];
          if (typeof enumNumber === "undefined" && ignoreUnknownFields) {
            return false;
          }
          assert(typeof enumNumber == "number", `Unable to parse field ${this.info.typeName}#${fieldName}, enum ${type[0]} has no value for "${json}".`);
          return enumNumber;
      }
      assert(false, `Unable to parse field ${this.info.typeName}#${fieldName}, cannot parse enum value from ${typeof json}".`);
    }
    scalar(json, type, longType, fieldName) {
      let e2;
      try {
        switch (type) {
          // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
          // Either numbers or strings are accepted. Exponent notation is also accepted.
          case ScalarType.DOUBLE:
          case ScalarType.FLOAT:
            if (json === null)
              return 0;
            if (json === "NaN")
              return Number.NaN;
            if (json === "Infinity")
              return Number.POSITIVE_INFINITY;
            if (json === "-Infinity")
              return Number.NEGATIVE_INFINITY;
            if (json === "") {
              e2 = "empty string";
              break;
            }
            if (typeof json == "string" && json.trim().length !== json.length) {
              e2 = "extra whitespace";
              break;
            }
            if (typeof json != "string" && typeof json != "number") {
              break;
            }
            let float = Number(json);
            if (Number.isNaN(float)) {
              e2 = "not a number";
              break;
            }
            if (!Number.isFinite(float)) {
              e2 = "too large or small";
              break;
            }
            if (type == ScalarType.FLOAT)
              assertFloat32(float);
            return float;
          // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
          case ScalarType.INT32:
          case ScalarType.FIXED32:
          case ScalarType.SFIXED32:
          case ScalarType.SINT32:
          case ScalarType.UINT32:
            if (json === null)
              return 0;
            let int32;
            if (typeof json == "number")
              int32 = json;
            else if (json === "")
              e2 = "empty string";
            else if (typeof json == "string") {
              if (json.trim().length !== json.length)
                e2 = "extra whitespace";
              else
                int32 = Number(json);
            }
            if (int32 === void 0)
              break;
            if (type == ScalarType.UINT32)
              assertUInt32(int32);
            else
              assertInt32(int32);
            return int32;
          // int64, fixed64, uint64: JSON value will be a decimal string. Either numbers or strings are accepted.
          case ScalarType.INT64:
          case ScalarType.SFIXED64:
          case ScalarType.SINT64:
            if (json === null)
              return reflectionLongConvert(PbLong.ZERO, longType);
            if (typeof json != "number" && typeof json != "string")
              break;
            return reflectionLongConvert(PbLong.from(json), longType);
          case ScalarType.FIXED64:
          case ScalarType.UINT64:
            if (json === null)
              return reflectionLongConvert(PbULong.ZERO, longType);
            if (typeof json != "number" && typeof json != "string")
              break;
            return reflectionLongConvert(PbULong.from(json), longType);
          // bool:
          case ScalarType.BOOL:
            if (json === null)
              return false;
            if (typeof json !== "boolean")
              break;
            return json;
          // string:
          case ScalarType.STRING:
            if (json === null)
              return "";
            if (typeof json !== "string") {
              e2 = "extra whitespace";
              break;
            }
            try {
              encodeURIComponent(json);
            } catch (e3) {
              e3 = "invalid UTF8";
              break;
            }
            return json;
          // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
          // Either standard or URL-safe base64 encoding with/without paddings are accepted.
          case ScalarType.BYTES:
            if (json === null || json === "")
              return new Uint8Array(0);
            if (typeof json !== "string")
              break;
            return base64decode(json);
        }
      } catch (error) {
        e2 = error.message;
      }
      this.assert(false, fieldName + (e2 ? " - " + e2 : ""), json);
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-json-writer.js
  var ReflectionJsonWriter = class {
    constructor(info) {
      var _a2;
      this.fields = (_a2 = info.fields) !== null && _a2 !== void 0 ? _a2 : [];
    }
    /**
     * Converts the message to a JSON object, based on the field descriptors.
     */
    write(message, options) {
      const json = {}, source = message;
      for (const field of this.fields) {
        if (!field.oneof) {
          let jsonValue2 = this.field(field, source[field.localName], options);
          if (jsonValue2 !== void 0)
            json[options.useProtoFieldName ? field.name : field.jsonName] = jsonValue2;
          continue;
        }
        const group = source[field.oneof];
        if (group.oneofKind !== field.localName)
          continue;
        const opt = field.kind == "scalar" || field.kind == "enum" ? Object.assign(Object.assign({}, options), { emitDefaultValues: true }) : options;
        let jsonValue = this.field(field, group[field.localName], opt);
        assert(jsonValue !== void 0);
        json[options.useProtoFieldName ? field.name : field.jsonName] = jsonValue;
      }
      return json;
    }
    field(field, value, options) {
      let jsonValue = void 0;
      if (field.kind == "map") {
        assert(typeof value == "object" && value !== null);
        const jsonObj = {};
        switch (field.V.kind) {
          case "scalar":
            for (const [entryKey, entryValue] of Object.entries(value)) {
              const val = this.scalar(field.V.T, entryValue, field.name, false, true);
              assert(val !== void 0);
              jsonObj[entryKey.toString()] = val;
            }
            break;
          case "message":
            const messageType = field.V.T();
            for (const [entryKey, entryValue] of Object.entries(value)) {
              const val = this.message(messageType, entryValue, field.name, options);
              assert(val !== void 0);
              jsonObj[entryKey.toString()] = val;
            }
            break;
          case "enum":
            const enumInfo = field.V.T();
            for (const [entryKey, entryValue] of Object.entries(value)) {
              assert(entryValue === void 0 || typeof entryValue == "number");
              const val = this.enum(enumInfo, entryValue, field.name, false, true, options.enumAsInteger);
              assert(val !== void 0);
              jsonObj[entryKey.toString()] = val;
            }
            break;
        }
        if (options.emitDefaultValues || Object.keys(jsonObj).length > 0)
          jsonValue = jsonObj;
      } else if (field.repeat) {
        assert(Array.isArray(value));
        const jsonArr = [];
        switch (field.kind) {
          case "scalar":
            for (let i2 = 0; i2 < value.length; i2++) {
              const val = this.scalar(field.T, value[i2], field.name, field.opt, true);
              assert(val !== void 0);
              jsonArr.push(val);
            }
            break;
          case "enum":
            const enumInfo = field.T();
            for (let i2 = 0; i2 < value.length; i2++) {
              assert(value[i2] === void 0 || typeof value[i2] == "number");
              const val = this.enum(enumInfo, value[i2], field.name, field.opt, true, options.enumAsInteger);
              assert(val !== void 0);
              jsonArr.push(val);
            }
            break;
          case "message":
            const messageType = field.T();
            for (let i2 = 0; i2 < value.length; i2++) {
              const val = this.message(messageType, value[i2], field.name, options);
              assert(val !== void 0);
              jsonArr.push(val);
            }
            break;
        }
        if (options.emitDefaultValues || jsonArr.length > 0 || options.emitDefaultValues)
          jsonValue = jsonArr;
      } else {
        switch (field.kind) {
          case "scalar":
            jsonValue = this.scalar(field.T, value, field.name, field.opt, options.emitDefaultValues);
            break;
          case "enum":
            jsonValue = this.enum(field.T(), value, field.name, field.opt, options.emitDefaultValues, options.enumAsInteger);
            break;
          case "message":
            jsonValue = this.message(field.T(), value, field.name, options);
            break;
        }
      }
      return jsonValue;
    }
    /**
     * Returns `null` as the default for google.protobuf.NullValue.
     */
    enum(type, value, fieldName, optional, emitDefaultValues, enumAsInteger) {
      if (type[0] == "google.protobuf.NullValue")
        return !emitDefaultValues && !optional ? void 0 : null;
      if (value === void 0) {
        assert(optional);
        return void 0;
      }
      if (value === 0 && !emitDefaultValues && !optional)
        return void 0;
      assert(typeof value == "number");
      assert(Number.isInteger(value));
      if (enumAsInteger || !type[1].hasOwnProperty(value))
        return value;
      if (type[2])
        return type[2] + type[1][value];
      return type[1][value];
    }
    message(type, value, fieldName, options) {
      if (value === void 0)
        return options.emitDefaultValues ? null : void 0;
      return type.internalJsonWrite(value, options);
    }
    scalar(type, value, fieldName, optional, emitDefaultValues) {
      if (value === void 0) {
        assert(optional);
        return void 0;
      }
      const ed = emitDefaultValues || optional;
      switch (type) {
        // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
        case ScalarType.INT32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32:
          if (value === 0)
            return ed ? 0 : void 0;
          assertInt32(value);
          return value;
        case ScalarType.FIXED32:
        case ScalarType.UINT32:
          if (value === 0)
            return ed ? 0 : void 0;
          assertUInt32(value);
          return value;
        // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
        // Either numbers or strings are accepted. Exponent notation is also accepted.
        case ScalarType.FLOAT:
          assertFloat32(value);
        case ScalarType.DOUBLE:
          if (value === 0)
            return ed ? 0 : void 0;
          assert(typeof value == "number");
          if (Number.isNaN(value))
            return "NaN";
          if (value === Number.POSITIVE_INFINITY)
            return "Infinity";
          if (value === Number.NEGATIVE_INFINITY)
            return "-Infinity";
          return value;
        // string:
        case ScalarType.STRING:
          if (value === "")
            return ed ? "" : void 0;
          assert(typeof value == "string");
          return value;
        // bool:
        case ScalarType.BOOL:
          if (value === false)
            return ed ? false : void 0;
          assert(typeof value == "boolean");
          return value;
        // JSON value will be a decimal string. Either numbers or strings are accepted.
        case ScalarType.UINT64:
        case ScalarType.FIXED64:
          assert(typeof value == "number" || typeof value == "string" || typeof value == "bigint");
          let ulong = PbULong.from(value);
          if (ulong.isZero() && !ed)
            return void 0;
          return ulong.toString();
        // JSON value will be a decimal string. Either numbers or strings are accepted.
        case ScalarType.INT64:
        case ScalarType.SFIXED64:
        case ScalarType.SINT64:
          assert(typeof value == "number" || typeof value == "string" || typeof value == "bigint");
          let long = PbLong.from(value);
          if (long.isZero() && !ed)
            return void 0;
          return long.toString();
        // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
        // Either standard or URL-safe base64 encoding with/without paddings are accepted.
        case ScalarType.BYTES:
          assert(value instanceof Uint8Array);
          if (!value.byteLength)
            return ed ? "" : void 0;
          return base64encode(value);
      }
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-scalar-default.js
  function reflectionScalarDefault(type, longType = LongType.STRING) {
    switch (type) {
      case ScalarType.BOOL:
        return false;
      case ScalarType.UINT64:
      case ScalarType.FIXED64:
        return reflectionLongConvert(PbULong.ZERO, longType);
      case ScalarType.INT64:
      case ScalarType.SFIXED64:
      case ScalarType.SINT64:
        return reflectionLongConvert(PbLong.ZERO, longType);
      case ScalarType.DOUBLE:
      case ScalarType.FLOAT:
        return 0;
      case ScalarType.BYTES:
        return new Uint8Array(0);
      case ScalarType.STRING:
        return "";
      default:
        return 0;
    }
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-binary-reader.js
  var ReflectionBinaryReader = class {
    constructor(info) {
      this.info = info;
    }
    prepare() {
      var _a2;
      if (!this.fieldNoToField) {
        const fieldsInput = (_a2 = this.info.fields) !== null && _a2 !== void 0 ? _a2 : [];
        this.fieldNoToField = new Map(fieldsInput.map((field) => [field.no, field]));
      }
    }
    /**
     * Reads a message from binary format into the target message.
     *
     * Repeated fields are appended. Map entries are added, overwriting
     * existing keys.
     *
     * If a message field is already present, it will be merged with the
     * new data.
     */
    read(reader, message, options, length) {
      this.prepare();
      const end = length === void 0 ? reader.len : reader.pos + length;
      while (reader.pos < end) {
        const [fieldNo, wireType] = reader.tag(), field = this.fieldNoToField.get(fieldNo);
        if (!field) {
          let u2 = options.readUnknownField;
          if (u2 == "throw")
            throw new Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.info.typeName}`);
          let d2 = reader.skip(wireType);
          if (u2 !== false)
            (u2 === true ? UnknownFieldHandler.onRead : u2)(this.info.typeName, message, fieldNo, wireType, d2);
          continue;
        }
        let target = message, repeated = field.repeat, localName = field.localName;
        if (field.oneof) {
          target = target[field.oneof];
          if (target.oneofKind !== localName)
            target = message[field.oneof] = {
              oneofKind: localName
            };
        }
        switch (field.kind) {
          case "scalar":
          case "enum":
            let T2 = field.kind == "enum" ? ScalarType.INT32 : field.T;
            let L2 = field.kind == "scalar" ? field.L : void 0;
            if (repeated) {
              let arr = target[localName];
              if (wireType == WireType.LengthDelimited && T2 != ScalarType.STRING && T2 != ScalarType.BYTES) {
                let e2 = reader.uint32() + reader.pos;
                while (reader.pos < e2)
                  arr.push(this.scalar(reader, T2, L2));
              } else
                arr.push(this.scalar(reader, T2, L2));
            } else
              target[localName] = this.scalar(reader, T2, L2);
            break;
          case "message":
            if (repeated) {
              let arr = target[localName];
              let msg = field.T().internalBinaryRead(reader, reader.uint32(), options);
              arr.push(msg);
            } else
              target[localName] = field.T().internalBinaryRead(reader, reader.uint32(), options, target[localName]);
            break;
          case "map":
            let [mapKey, mapVal] = this.mapEntry(field, reader, options);
            target[localName][mapKey] = mapVal;
            break;
        }
      }
    }
    /**
     * Read a map field, expecting key field = 1, value field = 2
     */
    mapEntry(field, reader, options) {
      let length = reader.uint32();
      let end = reader.pos + length;
      let key = void 0;
      let val = void 0;
      while (reader.pos < end) {
        let [fieldNo, wireType] = reader.tag();
        switch (fieldNo) {
          case 1:
            if (field.K == ScalarType.BOOL)
              key = reader.bool().toString();
            else
              key = this.scalar(reader, field.K, LongType.STRING);
            break;
          case 2:
            switch (field.V.kind) {
              case "scalar":
                val = this.scalar(reader, field.V.T, field.V.L);
                break;
              case "enum":
                val = reader.int32();
                break;
              case "message":
                val = field.V.T().internalBinaryRead(reader, reader.uint32(), options);
                break;
            }
            break;
          default:
            throw new Error(`Unknown field ${fieldNo} (wire type ${wireType}) in map entry for ${this.info.typeName}#${field.name}`);
        }
      }
      if (key === void 0) {
        let keyRaw = reflectionScalarDefault(field.K);
        key = field.K == ScalarType.BOOL ? keyRaw.toString() : keyRaw;
      }
      if (val === void 0)
        switch (field.V.kind) {
          case "scalar":
            val = reflectionScalarDefault(field.V.T, field.V.L);
            break;
          case "enum":
            val = 0;
            break;
          case "message":
            val = field.V.T().create();
            break;
        }
      return [key, val];
    }
    scalar(reader, type, longType) {
      switch (type) {
        case ScalarType.INT32:
          return reader.int32();
        case ScalarType.STRING:
          return reader.string();
        case ScalarType.BOOL:
          return reader.bool();
        case ScalarType.DOUBLE:
          return reader.double();
        case ScalarType.FLOAT:
          return reader.float();
        case ScalarType.INT64:
          return reflectionLongConvert(reader.int64(), longType);
        case ScalarType.UINT64:
          return reflectionLongConvert(reader.uint64(), longType);
        case ScalarType.FIXED64:
          return reflectionLongConvert(reader.fixed64(), longType);
        case ScalarType.FIXED32:
          return reader.fixed32();
        case ScalarType.BYTES:
          return reader.bytes();
        case ScalarType.UINT32:
          return reader.uint32();
        case ScalarType.SFIXED32:
          return reader.sfixed32();
        case ScalarType.SFIXED64:
          return reflectionLongConvert(reader.sfixed64(), longType);
        case ScalarType.SINT32:
          return reader.sint32();
        case ScalarType.SINT64:
          return reflectionLongConvert(reader.sint64(), longType);
      }
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-binary-writer.js
  var ReflectionBinaryWriter = class {
    constructor(info) {
      this.info = info;
    }
    prepare() {
      if (!this.fields) {
        const fieldsInput = this.info.fields ? this.info.fields.concat() : [];
        this.fields = fieldsInput.sort((a2, b2) => a2.no - b2.no);
      }
    }
    /**
     * Writes the message to binary format.
     */
    write(message, writer, options) {
      this.prepare();
      for (const field of this.fields) {
        let value, emitDefault, repeated = field.repeat, localName = field.localName;
        if (field.oneof) {
          const group = message[field.oneof];
          if (group.oneofKind !== localName)
            continue;
          value = group[localName];
          emitDefault = true;
        } else {
          value = message[localName];
          emitDefault = false;
        }
        switch (field.kind) {
          case "scalar":
          case "enum":
            let T2 = field.kind == "enum" ? ScalarType.INT32 : field.T;
            if (repeated) {
              assert(Array.isArray(value));
              if (repeated == RepeatType.PACKED)
                this.packed(writer, T2, field.no, value);
              else
                for (const item of value)
                  this.scalar(writer, T2, field.no, item, true);
            } else if (value === void 0)
              assert(field.opt);
            else
              this.scalar(writer, T2, field.no, value, emitDefault || field.opt);
            break;
          case "message":
            if (repeated) {
              assert(Array.isArray(value));
              for (const item of value)
                this.message(writer, options, field.T(), field.no, item);
            } else {
              this.message(writer, options, field.T(), field.no, value);
            }
            break;
          case "map":
            assert(typeof value == "object" && value !== null);
            for (const [key, val] of Object.entries(value))
              this.mapEntry(writer, options, field, key, val);
            break;
        }
      }
      let u2 = options.writeUnknownFields;
      if (u2 !== false)
        (u2 === true ? UnknownFieldHandler.onWrite : u2)(this.info.typeName, message, writer);
    }
    mapEntry(writer, options, field, key, value) {
      writer.tag(field.no, WireType.LengthDelimited);
      writer.fork();
      let keyValue = key;
      switch (field.K) {
        case ScalarType.INT32:
        case ScalarType.FIXED32:
        case ScalarType.UINT32:
        case ScalarType.SFIXED32:
        case ScalarType.SINT32:
          keyValue = Number.parseInt(key);
          break;
        case ScalarType.BOOL:
          assert(key == "true" || key == "false");
          keyValue = key == "true";
          break;
      }
      this.scalar(writer, field.K, 1, keyValue, true);
      switch (field.V.kind) {
        case "scalar":
          this.scalar(writer, field.V.T, 2, value, true);
          break;
        case "enum":
          this.scalar(writer, ScalarType.INT32, 2, value, true);
          break;
        case "message":
          this.message(writer, options, field.V.T(), 2, value);
          break;
      }
      writer.join();
    }
    message(writer, options, handler, fieldNo, value) {
      if (value === void 0)
        return;
      handler.internalBinaryWrite(value, writer.tag(fieldNo, WireType.LengthDelimited).fork(), options);
      writer.join();
    }
    /**
     * Write a single scalar value.
     */
    scalar(writer, type, fieldNo, value, emitDefault) {
      let [wireType, method, isDefault] = this.scalarInfo(type, value);
      if (!isDefault || emitDefault) {
        writer.tag(fieldNo, wireType);
        writer[method](value);
      }
    }
    /**
     * Write an array of scalar values in packed format.
     */
    packed(writer, type, fieldNo, value) {
      if (!value.length)
        return;
      assert(type !== ScalarType.BYTES && type !== ScalarType.STRING);
      writer.tag(fieldNo, WireType.LengthDelimited);
      writer.fork();
      let [, method] = this.scalarInfo(type);
      for (let i2 = 0; i2 < value.length; i2++)
        writer[method](value[i2]);
      writer.join();
    }
    /**
     * Get information for writing a scalar value.
     *
     * Returns tuple:
     * [0]: appropriate WireType
     * [1]: name of the appropriate method of IBinaryWriter
     * [2]: whether the given value is a default value
     *
     * If argument `value` is omitted, [2] is always false.
     */
    scalarInfo(type, value) {
      let t2 = WireType.Varint;
      let m2;
      let i2 = value === void 0;
      let d2 = value === 0;
      switch (type) {
        case ScalarType.INT32:
          m2 = "int32";
          break;
        case ScalarType.STRING:
          d2 = i2 || !value.length;
          t2 = WireType.LengthDelimited;
          m2 = "string";
          break;
        case ScalarType.BOOL:
          d2 = value === false;
          m2 = "bool";
          break;
        case ScalarType.UINT32:
          m2 = "uint32";
          break;
        case ScalarType.DOUBLE:
          t2 = WireType.Bit64;
          m2 = "double";
          break;
        case ScalarType.FLOAT:
          t2 = WireType.Bit32;
          m2 = "float";
          break;
        case ScalarType.INT64:
          d2 = i2 || PbLong.from(value).isZero();
          m2 = "int64";
          break;
        case ScalarType.UINT64:
          d2 = i2 || PbULong.from(value).isZero();
          m2 = "uint64";
          break;
        case ScalarType.FIXED64:
          d2 = i2 || PbULong.from(value).isZero();
          t2 = WireType.Bit64;
          m2 = "fixed64";
          break;
        case ScalarType.BYTES:
          d2 = i2 || !value.byteLength;
          t2 = WireType.LengthDelimited;
          m2 = "bytes";
          break;
        case ScalarType.FIXED32:
          t2 = WireType.Bit32;
          m2 = "fixed32";
          break;
        case ScalarType.SFIXED32:
          t2 = WireType.Bit32;
          m2 = "sfixed32";
          break;
        case ScalarType.SFIXED64:
          d2 = i2 || PbLong.from(value).isZero();
          t2 = WireType.Bit64;
          m2 = "sfixed64";
          break;
        case ScalarType.SINT32:
          m2 = "sint32";
          break;
        case ScalarType.SINT64:
          d2 = i2 || PbLong.from(value).isZero();
          m2 = "sint64";
          break;
      }
      return [t2, m2, i2 || d2];
    }
  };

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-create.js
  function reflectionCreate(type) {
    const msg = type.messagePrototype ? Object.create(type.messagePrototype) : Object.defineProperty({}, MESSAGE_TYPE, { value: type });
    for (let field of type.fields) {
      let name = field.localName;
      if (field.opt)
        continue;
      if (field.oneof)
        msg[field.oneof] = { oneofKind: void 0 };
      else if (field.repeat)
        msg[name] = [];
      else
        switch (field.kind) {
          case "scalar":
            msg[name] = reflectionScalarDefault(field.T, field.L);
            break;
          case "enum":
            msg[name] = 0;
            break;
          case "map":
            msg[name] = {};
            break;
        }
    }
    return msg;
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-merge-partial.js
  function reflectionMergePartial(info, target, source) {
    let fieldValue, input = source, output;
    for (let field of info.fields) {
      let name = field.localName;
      if (field.oneof) {
        const group = input[field.oneof];
        if ((group === null || group === void 0 ? void 0 : group.oneofKind) == void 0) {
          continue;
        }
        fieldValue = group[name];
        output = target[field.oneof];
        output.oneofKind = group.oneofKind;
        if (fieldValue == void 0) {
          delete output[name];
          continue;
        }
      } else {
        fieldValue = input[name];
        output = target;
        if (fieldValue == void 0) {
          continue;
        }
      }
      if (field.repeat)
        output[name].length = fieldValue.length;
      switch (field.kind) {
        case "scalar":
        case "enum":
          if (field.repeat)
            for (let i2 = 0; i2 < fieldValue.length; i2++)
              output[name][i2] = fieldValue[i2];
          else
            output[name] = fieldValue;
          break;
        case "message":
          let T2 = field.T();
          if (field.repeat)
            for (let i2 = 0; i2 < fieldValue.length; i2++)
              output[name][i2] = T2.create(fieldValue[i2]);
          else if (output[name] === void 0)
            output[name] = T2.create(fieldValue);
          else
            T2.mergePartial(output[name], fieldValue);
          break;
        case "map":
          switch (field.V.kind) {
            case "scalar":
            case "enum":
              Object.assign(output[name], fieldValue);
              break;
            case "message":
              let T3 = field.V.T();
              for (let k2 of Object.keys(fieldValue))
                output[name][k2] = T3.create(fieldValue[k2]);
              break;
          }
          break;
      }
    }
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/reflection-equals.js
  function reflectionEquals(info, a2, b2) {
    if (a2 === b2)
      return true;
    if (!a2 || !b2)
      return false;
    for (let field of info.fields) {
      let localName = field.localName;
      let val_a = field.oneof ? a2[field.oneof][localName] : a2[localName];
      let val_b = field.oneof ? b2[field.oneof][localName] : b2[localName];
      switch (field.kind) {
        case "enum":
        case "scalar":
          let t2 = field.kind == "enum" ? ScalarType.INT32 : field.T;
          if (!(field.repeat ? repeatedPrimitiveEq(t2, val_a, val_b) : primitiveEq(t2, val_a, val_b)))
            return false;
          break;
        case "map":
          if (!(field.V.kind == "message" ? repeatedMsgEq(field.V.T(), objectValues(val_a), objectValues(val_b)) : repeatedPrimitiveEq(field.V.kind == "enum" ? ScalarType.INT32 : field.V.T, objectValues(val_a), objectValues(val_b))))
            return false;
          break;
        case "message":
          let T2 = field.T();
          if (!(field.repeat ? repeatedMsgEq(T2, val_a, val_b) : T2.equals(val_a, val_b)))
            return false;
          break;
      }
    }
    return true;
  }
  var objectValues = Object.values;
  function primitiveEq(type, a2, b2) {
    if (a2 === b2)
      return true;
    if (type !== ScalarType.BYTES)
      return false;
    let ba2 = a2;
    let bb = b2;
    if (ba2.length !== bb.length)
      return false;
    for (let i2 = 0; i2 < ba2.length; i2++)
      if (ba2[i2] != bb[i2])
        return false;
    return true;
  }
  function repeatedPrimitiveEq(type, a2, b2) {
    if (a2.length !== b2.length)
      return false;
    for (let i2 = 0; i2 < a2.length; i2++)
      if (!primitiveEq(type, a2[i2], b2[i2]))
        return false;
    return true;
  }
  function repeatedMsgEq(type, a2, b2) {
    if (a2.length !== b2.length)
      return false;
    for (let i2 = 0; i2 < a2.length; i2++)
      if (!type.equals(a2[i2], b2[i2]))
        return false;
    return true;
  }

  // node_modules/@protobuf-ts/runtime/build/es2015/message-type.js
  var baseDescriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf({}));
  var messageTypeDescriptor = baseDescriptors[MESSAGE_TYPE] = {};
  var MessageType = class {
    constructor(name, fields, options) {
      this.defaultCheckDepth = 16;
      this.typeName = name;
      this.fields = fields.map(normalizeFieldInfo);
      this.options = options !== null && options !== void 0 ? options : {};
      messageTypeDescriptor.value = this;
      this.messagePrototype = Object.create(null, baseDescriptors);
      this.refTypeCheck = new ReflectionTypeCheck(this);
      this.refJsonReader = new ReflectionJsonReader(this);
      this.refJsonWriter = new ReflectionJsonWriter(this);
      this.refBinReader = new ReflectionBinaryReader(this);
      this.refBinWriter = new ReflectionBinaryWriter(this);
    }
    create(value) {
      let message = reflectionCreate(this);
      if (value !== void 0) {
        reflectionMergePartial(this, message, value);
      }
      return message;
    }
    /**
     * Clone the message.
     *
     * Unknown fields are discarded.
     */
    clone(message) {
      let copy = this.create();
      reflectionMergePartial(this, copy, message);
      return copy;
    }
    /**
     * Determines whether two message of the same type have the same field values.
     * Checks for deep equality, traversing repeated fields, oneof groups, maps
     * and messages recursively.
     * Will also return true if both messages are `undefined`.
     */
    equals(a2, b2) {
      return reflectionEquals(this, a2, b2);
    }
    /**
     * Is the given value assignable to our message type
     * and contains no [excess properties](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)?
     */
    is(arg, depth = this.defaultCheckDepth) {
      return this.refTypeCheck.is(arg, depth, false);
    }
    /**
     * Is the given value assignable to our message type,
     * regardless of [excess properties](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)?
     */
    isAssignable(arg, depth = this.defaultCheckDepth) {
      return this.refTypeCheck.is(arg, depth, true);
    }
    /**
     * Copy partial data into the target message.
     */
    mergePartial(target, source) {
      reflectionMergePartial(this, target, source);
    }
    /**
     * Create a new message from binary format.
     */
    fromBinary(data, options) {
      let opt = binaryReadOptions(options);
      return this.internalBinaryRead(opt.readerFactory(data), data.byteLength, opt);
    }
    /**
     * Read a new message from a JSON value.
     */
    fromJson(json, options) {
      return this.internalJsonRead(json, jsonReadOptions(options));
    }
    /**
     * Read a new message from a JSON string.
     * This is equivalent to `T.fromJson(JSON.parse(json))`.
     */
    fromJsonString(json, options) {
      let value = JSON.parse(json);
      return this.fromJson(value, options);
    }
    /**
     * Write the message to canonical JSON value.
     */
    toJson(message, options) {
      return this.internalJsonWrite(message, jsonWriteOptions(options));
    }
    /**
     * Convert the message to canonical JSON string.
     * This is equivalent to `JSON.stringify(T.toJson(t))`
     */
    toJsonString(message, options) {
      var _a2;
      let value = this.toJson(message, options);
      return JSON.stringify(value, null, (_a2 = options === null || options === void 0 ? void 0 : options.prettySpaces) !== null && _a2 !== void 0 ? _a2 : 0);
    }
    /**
     * Write the message to binary format.
     */
    toBinary(message, options) {
      let opt = binaryWriteOptions(options);
      return this.internalBinaryWrite(message, opt.writerFactory(), opt).finish();
    }
    /**
     * This is an internal method. If you just want to read a message from
     * JSON, use `fromJson()` or `fromJsonString()`.
     *
     * Reads JSON value and merges the fields into the target
     * according to protobuf rules. If the target is omitted,
     * a new instance is created first.
     */
    internalJsonRead(json, options, target) {
      if (json !== null && typeof json == "object" && !Array.isArray(json)) {
        let message = target !== null && target !== void 0 ? target : this.create();
        this.refJsonReader.read(json, message, options);
        return message;
      }
      throw new Error(`Unable to parse message ${this.typeName} from JSON ${typeofJsonValue(json)}.`);
    }
    /**
     * This is an internal method. If you just want to write a message
     * to JSON, use `toJson()` or `toJsonString().
     *
     * Writes JSON value and returns it.
     */
    internalJsonWrite(message, options) {
      return this.refJsonWriter.write(message, options);
    }
    /**
     * This is an internal method. If you just want to write a message
     * in binary format, use `toBinary()`.
     *
     * Serializes the message in binary format and appends it to the given
     * writer. Returns passed writer.
     */
    internalBinaryWrite(message, writer, options) {
      this.refBinWriter.write(message, writer, options);
      return writer;
    }
    /**
     * This is an internal method. If you just want to read a message from
     * binary data, use `fromBinary()`.
     *
     * Reads data from binary format and merges the fields into
     * the target according to protobuf rules. If the target is
     * omitted, a new instance is created first.
     */
    internalBinaryRead(reader, length, options, target) {
      let message = target !== null && target !== void 0 ? target : this.create();
      this.refBinReader.read(reader, message, options, length);
      return message;
    }
  };

  // node_modules/x-law/dist/index.js
  var __defProp2 = Object.defineProperty;
  var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
  var __export = (target, all) => {
    for (var name in all)
      __defProp2(target, name, { get: all[name], enumerable: true });
  };
  var alaw_exports = {};
  __export(alaw_exports, {
    decode: () => decode,
    decodeBuffer: () => decodeBuffer,
    decodeSample: () => decodeSample,
    encode: () => encode,
    encodeBuffer: () => encodeBuffer,
    encodeSample: () => encodeSample
  });
  var LOG_TABLE = [
    1,
    1,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7
  ];
  function encodeSample(sample) {
    let compandedValue;
    sample = sample == -32768 ? -32767 : sample;
    let sign = ~sample >> 8 & 128;
    if (!sign) {
      sample = sample * -1;
    }
    if (sample > 32635) {
      sample = 32635;
    }
    if (sample >= 256) {
      let exponent = LOG_TABLE[sample >> 8 & 127];
      let mantissa = sample >> exponent + 3 & 15;
      compandedValue = exponent << 4 | mantissa;
    } else {
      compandedValue = sample >> 4;
    }
    return compandedValue ^ (sign ^ 85);
  }
  __name(encodeSample, "encodeSample");
  function decodeSample(sample) {
    let sign = 0;
    sample ^= 85;
    if (sample & 128) {
      sample &= -129;
      sign = -1;
    }
    let position = ((sample & 240) >> 4) + 4;
    let decoded = 0;
    if (position != 4) {
      decoded = 1 << position | (sample & 15) << position - 4 | 1 << position - 5;
    } else {
      decoded = sample << 1 | 1;
    }
    decoded = sign === 0 ? decoded : -decoded;
    return decoded * 8 * -1;
  }
  __name(decodeSample, "decodeSample");
  function encode(samples) {
    let aLawSamples = new Uint8Array(samples.length);
    for (let i2 = 0; i2 < samples.length; i2++) {
      aLawSamples[i2] = encodeSample(samples[i2]);
    }
    return aLawSamples;
  }
  __name(encode, "encode");
  function decode(samples) {
    let pcmSamples = new Int16Array(samples.length);
    for (let i2 = 0; i2 < samples.length; i2++) {
      pcmSamples[i2] = decodeSample(samples[i2]);
    }
    return pcmSamples;
  }
  __name(decode, "decode");
  function encodeBuffer(buffer) {
    const numSamples = Math.floor(buffer.length / 2);
    const samples = new Int16Array(numSamples);
    for (let i2 = 0; i2 < numSamples; i2++) {
      samples[i2] = buffer.readInt16LE(i2 * 2);
    }
    return Buffer.from(encode(samples).buffer);
  }
  __name(encodeBuffer, "encodeBuffer");
  function decodeBuffer(buffer) {
    const samples = decode(new Uint8Array(buffer));
    return Buffer.from(samples.buffer);
  }
  __name(decodeBuffer, "decodeBuffer");
  var mulaw_exports = {};
  __export(mulaw_exports, {
    decode: () => decode2,
    decodeBuffer: () => decodeBuffer2,
    decodeSample: () => decodeSample2,
    encode: () => encode2,
    encodeBuffer: () => encodeBuffer2,
    encodeSample: () => encodeSample2
  });
  var BIAS = 132;
  var CLIP = 32635;
  var encodeTable = [
    0,
    0,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7,
    7
  ];
  var decodeTable = [0, 132, 396, 924, 1980, 4092, 8316, 16764];
  function encodeSample2(sample) {
    const sign = sample < 0 ? 128 : 0;
    sample = Math.abs(sample);
    sample += BIAS;
    if (sample > CLIP) sample = CLIP;
    const exponent = encodeTable[sample >> 7 & 255];
    const mantissa = sample >> exponent + 3 & 15;
    return ~(sign | exponent << 4 | mantissa) & 255;
  }
  __name(encodeSample2, "encodeSample");
  function decodeSample2(sample) {
    sample = ~sample & 255;
    const sign = sample & 128 ? -1 : 1;
    const exponent = sample >> 4 & 7;
    const mantissa = sample & 15;
    const decodedSample = decodeTable[exponent] + (mantissa << exponent + 3);
    return sign * decodedSample;
  }
  __name(decodeSample2, "decodeSample");
  function encode2(samples) {
    const muLawSamples = new Uint8Array(samples.length);
    for (let i2 = 0; i2 < samples.length; i2++) {
      muLawSamples[i2] = encodeSample2(samples[i2]);
    }
    return muLawSamples;
  }
  __name(encode2, "encode");
  function decode2(samples) {
    const pcmSamples = new Int16Array(samples.length);
    for (let i2 = 0; i2 < samples.length; i2++) {
      pcmSamples[i2] = decodeSample2(samples[i2]);
    }
    return pcmSamples;
  }
  __name(decode2, "decode");
  function encodeBuffer2(buffer) {
    const numSamples = Math.floor(buffer.length / 2);
    const samples = new Int16Array(numSamples);
    for (let i2 = 0; i2 < numSamples; i2++) {
      samples[i2] = buffer.readInt16LE(i2 * 2);
    }
    return Buffer.from(encode2(samples).buffer);
  }
  __name(encodeBuffer2, "encodeBuffer");
  function decodeBuffer2(buffer) {
    const samples = decode2(new Uint8Array(buffer));
    return Buffer.from(samples.buffer);
  }
  __name(decodeBuffer2, "decodeBuffer");
  var utils_exports = {};
  __export(utils_exports, {
    calculateLoudness: () => calculateLoudness,
    createWavHeader: () => createWavHeader,
    resample: () => resample
  });
  var BIT_DEPTHS = [8, 16, 24, 32, 48];
  function calculateLoudness(buffer, bitDepth) {
    if (!(buffer instanceof Buffer) || buffer.length === 0) {
      throw new Error("Invalid buffer, must be a non-empty Buffer.");
    }
    if (!BIT_DEPTHS.includes(bitDepth)) {
      throw new Error("Invalid bit depth, supported values are 8, 16, 24, 32, and 48.");
    }
    if (bitDepth === 48) {
      throw new Error("48-bit audio is not yet implemented.");
    }
    const bytesPerSample = Math.ceil(bitDepth / 8);
    if (buffer.length % bytesPerSample !== 0) {
      throw new Error(
        `Invalid buffer length ${buffer.length}. Must be a multiple of ${bytesPerSample} bytes for ${bitDepth}-bit audio.`
      );
    }
    const maxValue = Math.pow(2, bitDepth - 1) - 1;
    const numSamples = buffer.length / bytesPerSample;
    let sumOfSquares = 0;
    for (let i2 = 0; i2 < numSamples; i2++) {
      const offset = i2 * bytesPerSample;
      let sample;
      switch (bitDepth) {
        case 8:
          sample = buffer[offset];
          if (sample & 128) sample = sample - 256;
          break;
        case 16:
          sample = buffer[offset] | buffer[offset + 1] << 8;
          if (sample & 32768) sample = sample - 65536;
          break;
        case 24:
          sample = buffer[offset] | buffer[offset + 1] << 8 | buffer[offset + 2] << 16;
          if (sample & 8388608) sample = sample | -16777216;
          break;
        case 32:
          sample = buffer[offset] | buffer[offset + 1] << 8 | buffer[offset + 2] << 16 | buffer[offset + 3] << 24;
          break;
        default:
          throw new Error(`Unsupported bit depth: ${bitDepth}`);
      }
      const normalized = sample / maxValue;
      sumOfSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumOfSquares / numSamples);
    return rms <= 1e-10 ? -100 : 20 * Math.log10(rms);
  }
  __name(calculateLoudness, "calculateLoudness");
  function createWavHeader(dataSize, sampleRate, channels, bitDepth) {
    const headerData = [
      { value: "RIFF", type: "string" },
      { value: 36 + dataSize, type: "uint32" },
      { value: "WAVE", type: "string" },
      { value: "fmt ", type: "string" },
      { value: 16, type: "uint32" },
      { value: 1, type: "uint16" },
      { value: channels, type: "uint16" },
      { value: sampleRate, type: "uint32" },
      { value: sampleRate * channels * bitDepth / 8, type: "uint32" },
      { value: channels * bitDepth / 8, type: "uint16" },
      { value: bitDepth, type: "uint16" },
      { value: "data", type: "string" },
      { value: dataSize, type: "uint32" }
    ];
    const header = Buffer.alloc(44);
    let offset = 0;
    headerData.forEach(({ value, type }) => {
      if (type === "string") {
        header.write(value, offset);
        offset += 4;
      } else if (type === "uint32") {
        header.writeUInt32LE(value, offset);
        offset += 4;
      } else if (type === "uint16") {
        header.writeUInt16LE(value, offset);
        offset += 2;
      }
    });
    return header;
  }
  __name(createWavHeader, "createWavHeader");
  var resample = /* @__PURE__ */ __name((samples, inputSampleRate, targetSampleRate, bitDepth) => {
    if (inputSampleRate <= 0 || targetSampleRate <= 0) {
      throw new Error("Sample rates must be positive.");
    }
    if (!BIT_DEPTHS.includes(bitDepth)) {
      throw new Error(`Invalid bit depth. Allowed values are: ${BIT_DEPTHS.join(", ")}`);
    }
    const ratio = targetSampleRate / inputSampleRate;
    const outLength = Math.round(samples.length * ratio);
    const resampled = new Array(outLength);
    const maxSample = (1 << bitDepth - 1) - 1;
    const minSample = -1 << bitDepth - 1;
    for (let i2 = 0; i2 < outLength; i2++) {
      const sourcePos = i2 / ratio;
      const index1 = Math.floor(sourcePos);
      const index2 = Math.min(index1 + 1, samples.length - 1);
      const alpha = sourcePos - index1;
      const interpolated = samples[index1] * (1 - alpha) + samples[index2] * alpha;
      const intSample = Math.round(interpolated);
      resampled[i2] = Math.max(minSample, Math.min(maxSample, intSample));
    }
    return resampled;
  }, "resample");

  // node_modules/@pipecat-ai/websocket-transport/dist/index.module.js
  var $6d4b7449a1e1544a$export$13afda237b1c9846 = class {
    /**
    * Converts Float32Array of amplitude data to ArrayBuffer in Int16Array format
    * @param {Float32Array} float32Array
    * @returns {ArrayBuffer}
    */
    static floatTo16BitPCM(float32Array) {
      const buffer = new ArrayBuffer(float32Array.length * 2);
      const view = new DataView(buffer);
      let offset = 0;
      for (let i2 = 0; i2 < float32Array.length; i2++, offset += 2) {
        let s2 = Math.max(-1, Math.min(1, float32Array[i2]));
        view.setInt16(offset, s2 < 0 ? s2 * 32768 : s2 * 32767, true);
      }
      return buffer;
    }
    /**
    * Concatenates two ArrayBuffers
    * @param {ArrayBuffer} leftBuffer
    * @param {ArrayBuffer} rightBuffer
    * @returns {ArrayBuffer}
    */
    static mergeBuffers(leftBuffer, rightBuffer) {
      const tmpArray = new Uint8Array(leftBuffer.byteLength + rightBuffer.byteLength);
      tmpArray.set(new Uint8Array(leftBuffer), 0);
      tmpArray.set(new Uint8Array(rightBuffer), leftBuffer.byteLength);
      return tmpArray.buffer;
    }
    /**
    * Packs data into an Int16 format
    * @private
    * @param {number} size 0 = 1x Int16, 1 = 2x Int16
    * @param {number} arg value to pack
    * @returns
    */
    _packData(size, arg) {
      return [
        new Uint8Array([
          arg,
          arg >> 8
        ]),
        new Uint8Array([
          arg,
          arg >> 8,
          arg >> 16,
          arg >> 24
        ])
      ][size];
    }
    /**
    * Packs audio into "audio/wav" Blob
    * @param {number} sampleRate
    * @param {{bitsPerSample: number, channels: Array<Float32Array>, data: Int16Array}} audio
    * @returns {WavPackerAudioType}
    */
    pack(sampleRate, audio) {
      if (!audio?.bitsPerSample) throw new Error(`Missing "bitsPerSample"`);
      else if (!audio?.channels) throw new Error(`Missing "channels"`);
      else if (!audio?.data) throw new Error(`Missing "data"`);
      const { bitsPerSample, channels, data } = audio;
      const output = [
        // Header
        "RIFF",
        this._packData(1, 52),
        "WAVE",
        // chunk 1
        "fmt ",
        this._packData(1, 16),
        this._packData(0, 1),
        this._packData(0, channels.length),
        this._packData(1, sampleRate),
        this._packData(1, sampleRate * channels.length * bitsPerSample / 8),
        this._packData(0, channels.length * bitsPerSample / 8),
        this._packData(0, bitsPerSample),
        // chunk 2
        "data",
        this._packData(1, channels[0].length * channels.length * bitsPerSample / 8),
        data
      ];
      const blob = new Blob(output, {
        type: "audio/mpeg"
      });
      const url = URL.createObjectURL(blob);
      return {
        blob,
        url,
        channelCount: channels.length,
        sampleRate,
        duration: data.byteLength / (channels.length * sampleRate * 2)
      };
    }
  };
  globalThis.WavPacker = $6d4b7449a1e1544a$export$13afda237b1c9846;
  var $03f71ce85e00ada6$var$octave8Frequencies = [
    4186.01,
    4434.92,
    4698.63,
    4978.03,
    5274.04,
    5587.65,
    5919.91,
    6271.93,
    6644.88,
    7040,
    7458.62,
    7902.13
  ];
  var $03f71ce85e00ada6$var$octave8FrequencyLabels = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
  ];
  var $03f71ce85e00ada6$export$776c63898ae5b636 = [];
  var $03f71ce85e00ada6$export$facd167cc27ea9b0 = [];
  for (let i2 = 1; i2 <= 8; i2++) for (let f2 = 0; f2 < $03f71ce85e00ada6$var$octave8Frequencies.length; f2++) {
    const freq = $03f71ce85e00ada6$var$octave8Frequencies[f2];
    $03f71ce85e00ada6$export$776c63898ae5b636.push(freq / Math.pow(2, 8 - i2));
    $03f71ce85e00ada6$export$facd167cc27ea9b0.push($03f71ce85e00ada6$var$octave8FrequencyLabels[f2] + i2);
  }
  var $03f71ce85e00ada6$var$voiceFrequencyRange = [
    32,
    2e3
  ];
  var $03f71ce85e00ada6$export$dbc1581ed2cfa183 = $03f71ce85e00ada6$export$776c63898ae5b636.filter((_2, i2) => {
    return $03f71ce85e00ada6$export$776c63898ae5b636[i2] > $03f71ce85e00ada6$var$voiceFrequencyRange[0] && $03f71ce85e00ada6$export$776c63898ae5b636[i2] < $03f71ce85e00ada6$var$voiceFrequencyRange[1];
  });
  var $03f71ce85e00ada6$export$30a6f2881311088f = $03f71ce85e00ada6$export$facd167cc27ea9b0.filter((_2, i2) => {
    return $03f71ce85e00ada6$export$776c63898ae5b636[i2] > $03f71ce85e00ada6$var$voiceFrequencyRange[0] && $03f71ce85e00ada6$export$776c63898ae5b636[i2] < $03f71ce85e00ada6$var$voiceFrequencyRange[1];
  });
  var $f32f064564ee62f6$export$2c3136da0bf130f9 = class _$f32f064564ee62f6$export$2c3136da0bf130f9 {
    /**
    * Retrieves frequency domain data from an AnalyserNode adjusted to a decibel range
    * returns human-readable formatting and labels
    * @param {AnalyserNode} analyser
    * @param {number} sampleRate
    * @param {Float32Array} [fftResult]
    * @param {"frequency"|"music"|"voice"} [analysisType]
    * @param {number} [minDecibels] default -100
    * @param {number} [maxDecibels] default -30
    * @returns {AudioAnalysisOutputType}
    */
    static getFrequencies(analyser, sampleRate, fftResult, analysisType = "frequency", minDecibels = -100, maxDecibels = -30) {
      if (!fftResult) {
        fftResult = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(fftResult);
      }
      const nyquistFrequency = sampleRate / 2;
      const frequencyStep = 1 / fftResult.length * nyquistFrequency;
      let outputValues;
      let frequencies;
      let labels;
      if (analysisType === "music" || analysisType === "voice") {
        const useFrequencies = analysisType === "voice" ? (0, $03f71ce85e00ada6$export$dbc1581ed2cfa183) : (0, $03f71ce85e00ada6$export$776c63898ae5b636);
        const aggregateOutput = Array(useFrequencies.length).fill(minDecibels);
        for (let i2 = 0; i2 < fftResult.length; i2++) {
          const frequency = i2 * frequencyStep;
          const amplitude = fftResult[i2];
          for (let n2 = useFrequencies.length - 1; n2 >= 0; n2--) if (frequency > useFrequencies[n2]) {
            aggregateOutput[n2] = Math.max(aggregateOutput[n2], amplitude);
            break;
          }
        }
        outputValues = aggregateOutput;
        frequencies = analysisType === "voice" ? (0, $03f71ce85e00ada6$export$dbc1581ed2cfa183) : (0, $03f71ce85e00ada6$export$776c63898ae5b636);
        labels = analysisType === "voice" ? (0, $03f71ce85e00ada6$export$30a6f2881311088f) : (0, $03f71ce85e00ada6$export$facd167cc27ea9b0);
      } else {
        outputValues = Array.from(fftResult);
        frequencies = outputValues.map((_2, i2) => frequencyStep * i2);
        labels = frequencies.map((f2) => `${f2.toFixed(2)} Hz`);
      }
      const normalizedOutput = outputValues.map((v2) => {
        return Math.max(0, Math.min((v2 - minDecibels) / (maxDecibels - minDecibels), 1));
      });
      const values = new Float32Array(normalizedOutput);
      return {
        values,
        frequencies,
        labels
      };
    }
    /**
    * Creates a new AudioAnalysis instance for an HTMLAudioElement
    * @param {HTMLAudioElement} audioElement
    * @param {AudioBuffer|null} [audioBuffer] If provided, will cache all frequency domain data from the buffer
    * @returns {AudioAnalysis}
    */
    constructor(audioElement, audioBuffer = null) {
      this.fftResults = [];
      if (audioBuffer) {
        const { length, sampleRate } = audioBuffer;
        const offlineAudioContext = new OfflineAudioContext({
          length,
          sampleRate
        });
        const source = offlineAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        const analyser = offlineAudioContext.createAnalyser();
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.1;
        source.connect(analyser);
        const renderQuantumInSeconds = 1 / 60;
        const durationInSeconds = length / sampleRate;
        const analyze = (index) => {
          const suspendTime = renderQuantumInSeconds * index;
          if (suspendTime < durationInSeconds) offlineAudioContext.suspend(suspendTime).then(() => {
            const fftResult = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(fftResult);
            this.fftResults.push(fftResult);
            analyze(index + 1);
          });
          if (index === 1) offlineAudioContext.startRendering();
          else offlineAudioContext.resume();
        };
        source.start(0);
        analyze(1);
        this.audio = audioElement;
        this.context = offlineAudioContext;
        this.analyser = analyser;
        this.sampleRate = sampleRate;
        this.audioBuffer = audioBuffer;
      } else {
        const audioContext = new AudioContext();
        const track2 = audioContext.createMediaElementSource(audioElement);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.1;
        track2.connect(analyser);
        analyser.connect(audioContext.destination);
        this.audio = audioElement;
        this.context = audioContext;
        this.analyser = analyser;
        this.sampleRate = this.context.sampleRate;
        this.audioBuffer = null;
      }
    }
    /**
    * Gets the current frequency domain data from the playing audio track
    * @param {"frequency"|"music"|"voice"} [analysisType]
    * @param {number} [minDecibels] default -100
    * @param {number} [maxDecibels] default -30
    * @returns {AudioAnalysisOutputType}
    */
    getFrequencies(analysisType = "frequency", minDecibels = -100, maxDecibels = -30) {
      let fftResult = null;
      if (this.audioBuffer && this.fftResults.length) {
        const pct = this.audio.currentTime / this.audio.duration;
        const index = Math.min(pct * this.fftResults.length | 0, this.fftResults.length - 1);
        fftResult = this.fftResults[index];
      }
      return _$f32f064564ee62f6$export$2c3136da0bf130f9.getFrequencies(this.analyser, this.sampleRate, fftResult, analysisType, minDecibels, maxDecibels);
    }
    /**
    * Resume the internal AudioContext if it was suspended due to the lack of
    * user interaction when the AudioAnalysis was instantiated.
    * @returns {Promise<true>}
    */
    async resumeIfSuspended() {
      if (this.context.state === "suspended") await this.context.resume();
      return true;
    }
  };
  globalThis.AudioAnalysis = $f32f064564ee62f6$export$2c3136da0bf130f9;
  var $29a8a70a9466b14f$export$50b76700e2b15e9 = `
class StreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hasStarted = false;
    this.hasInterrupted = false;
    this.outputBuffers = [];
    this.bufferLength = 128;
    this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };
    this.writeOffset = 0;
    this.trackSampleOffsets = {};
    this.port.onmessage = (event) => {
      if (event.data) {
        const payload = event.data;
        if (payload.event === 'write') {
          const int16Array = payload.buffer;
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 0x8000; // Convert Int16 to Float32
          }
          this.writeData(float32Array, payload.trackId);
        } else if (
          payload.event === 'offset' ||
          payload.event === 'interrupt'
        ) {
          const requestId = payload.requestId;
          const trackId = this.write.trackId;
          const offset = this.trackSampleOffsets[trackId] || 0;
          this.port.postMessage({
            event: 'offset',
            requestId,
            trackId,
            offset,
          });
          if (payload.event === 'interrupt') {
            this.hasInterrupted = true;
          }
        } else {
          throw new Error(\`Unhandled event "\${payload.event}"\`);
        }
      }
    };
  }

  writeData(float32Array, trackId = null) {
    let { buffer } = this.write;
    let offset = this.writeOffset;
    for (let i = 0; i < float32Array.length; i++) {
      buffer[offset++] = float32Array[i];
      if (offset >= buffer.length) {
        this.outputBuffers.push(this.write);
        this.write = { buffer: new Float32Array(this.bufferLength), trackId };
        buffer = this.write.buffer;
        offset = 0;
      }
    }
    this.writeOffset = offset;
    return true;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannelData = output[0];
    const outputBuffers = this.outputBuffers;
    if (this.hasInterrupted) {
      this.port.postMessage({ event: 'stop' });
      return false;
    } else if (outputBuffers.length) {
      this.hasStarted = true;
      const { buffer, trackId } = outputBuffers.shift();
      for (let i = 0; i < outputChannelData.length; i++) {
        outputChannelData[i] = buffer[i] || 0;
      }
      if (trackId) {
        this.trackSampleOffsets[trackId] =
          this.trackSampleOffsets[trackId] || 0;
        this.trackSampleOffsets[trackId] += buffer.length;
      }
      return true;
    } else if (this.hasStarted) {
      this.port.postMessage({ event: 'stop' });
      return false;
    } else {
      return true;
    }
  }
}

registerProcessor('stream_processor', StreamProcessor);
`;
  var $29a8a70a9466b14f$var$script = new Blob([
    $29a8a70a9466b14f$export$50b76700e2b15e9
  ], {
    type: "application/javascript"
  });
  var $29a8a70a9466b14f$var$src = URL.createObjectURL($29a8a70a9466b14f$var$script);
  var $29a8a70a9466b14f$export$bfa8c596114d74df = $29a8a70a9466b14f$var$src;
  var $d0a969833958d9e7$export$9698d62c78b8f366 = class {
    /**
    * Creates a new WavStreamPlayer instance
    * @param {{sampleRate?: number}} options
    * @returns {WavStreamPlayer}
    */
    constructor({ sampleRate = 44100 } = {}) {
      this.scriptSrc = (0, $29a8a70a9466b14f$export$bfa8c596114d74df);
      this.sampleRate = sampleRate;
      this.context = null;
      this.stream = null;
      this.analyser = null;
      this.trackSampleOffsets = {};
      this.interruptedTrackIds = {};
    }
    /**
    * Connects the audio context and enables output to speakers
    * @returns {Promise<true>}
    */
    async connect() {
      this.context = new AudioContext({
        sampleRate: this.sampleRate
      });
      if (this._speakerID) this.context.setSinkId(this._speakerID);
      if (this.context.state === "suspended") await this.context.resume();
      try {
        await this.context.audioWorklet.addModule(this.scriptSrc);
      } catch (e2) {
        console.error(e2);
        throw new Error(`Could not add audioWorklet module: ${this.scriptSrc}`);
      }
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.1;
      this.analyser = analyser;
      return true;
    }
    /**
    * Gets the current frequency domain data from the playing track
    * @param {"frequency"|"music"|"voice"} [analysisType]
    * @param {number} [minDecibels] default -100
    * @param {number} [maxDecibels] default -30
    * @returns {import('./analysis/audio_analysis.js').AudioAnalysisOutputType}
    */
    getFrequencies(analysisType = "frequency", minDecibels = -100, maxDecibels = -30) {
      if (!this.analyser) throw new Error("Not connected, please call .connect() first");
      return (0, $f32f064564ee62f6$export$2c3136da0bf130f9).getFrequencies(this.analyser, this.sampleRate, null, analysisType, minDecibels, maxDecibels);
    }
    /**
    * @param {string} speaker deviceId
    */
    async updateSpeaker(speaker) {
      const _prevSpeaker = this._speakerID;
      this._speakerID = speaker;
      if (this.context) try {
        if (speaker === "default") await this.context.setSinkId();
        else await this.context.setSinkId(speaker);
      } catch (e2) {
        console.error(`Could not set sinkId to ${speaker}: ${e2}`);
        this._speakerID = _prevSpeaker;
      }
    }
    /**
    * Starts audio streaming
    * @private
    * @returns {Promise<true>}
    */
    _start() {
      const streamNode = new AudioWorkletNode(this.context, "stream_processor");
      streamNode.connect(this.context.destination);
      streamNode.port.onmessage = (e2) => {
        const { event } = e2.data;
        if (event === "stop") {
          streamNode.disconnect();
          this.stream = null;
        } else if (event === "offset") {
          const { requestId, trackId, offset } = e2.data;
          const currentTime = offset / this.sampleRate;
          this.trackSampleOffsets[requestId] = {
            trackId,
            offset,
            currentTime
          };
        }
      };
      this.analyser.disconnect();
      streamNode.connect(this.analyser);
      this.stream = streamNode;
      return true;
    }
    /**
    * Adds 16BitPCM data to the currently playing audio stream
    * You can add chunks beyond the current play point and they will be queued for play
    * @param {ArrayBuffer|Int16Array} arrayBuffer
    * @param {string} [trackId]
    * @returns {Int16Array}
    */
    add16BitPCM(arrayBuffer, trackId = "default") {
      if (typeof trackId !== "string") throw new Error(`trackId must be a string`);
      else if (this.interruptedTrackIds[trackId]) return;
      if (!this.stream) this._start();
      let buffer;
      if (arrayBuffer instanceof Int16Array) buffer = arrayBuffer;
      else if (arrayBuffer instanceof ArrayBuffer) buffer = new Int16Array(arrayBuffer);
      else throw new Error(`argument must be Int16Array or ArrayBuffer`);
      this.stream.port.postMessage({
        event: "write",
        buffer,
        trackId
      });
      return buffer;
    }
    /**
    * Gets the offset (sample count) of the currently playing stream
    * @param {boolean} [interrupt]
    * @returns {{trackId: string|null, offset: number, currentTime: number}}
    */
    async getTrackSampleOffset(interrupt = false) {
      if (!this.stream) return null;
      const requestId = crypto.randomUUID();
      this.stream.port.postMessage({
        event: interrupt ? "interrupt" : "offset",
        requestId
      });
      let trackSampleOffset;
      while (!trackSampleOffset) {
        trackSampleOffset = this.trackSampleOffsets[requestId];
        await new Promise((r2) => setTimeout(() => r2(), 1));
      }
      const { trackId } = trackSampleOffset;
      if (interrupt && trackId) this.interruptedTrackIds[trackId] = true;
      return trackSampleOffset;
    }
    /**
    * Strips the current stream and returns the sample offset of the audio
    * @param {boolean} [interrupt]
    * @returns {{trackId: string|null, offset: number, currentTime: number}}
    */
    async interrupt() {
      return this.getTrackSampleOffset(true);
    }
  };
  globalThis.WavStreamPlayer = $d0a969833958d9e7$export$9698d62c78b8f366;
  var $8e1d1e6ff08f6fb5$var$AudioProcessorWorklet = `
class AudioProcessor extends AudioWorkletProcessor {

  constructor() {
    super();
    this.port.onmessage = this.receive.bind(this);
    this.initialize();
  }

  initialize() {
    this.foundAudio = false;
    this.recording = false;
    this.chunks = [];
  }

  /**
   * Concatenates sampled chunks into channels
   * Format is chunk[Left[], Right[]]
   */
  readChannelData(chunks, channel = -1, maxChannels = 9) {
    let channelLimit;
    if (channel !== -1) {
      if (chunks[0] && chunks[0].length - 1 < channel) {
        throw new Error(
          \`Channel \${channel} out of range: max \${chunks[0].length}\`
        );
      }
      channelLimit = channel + 1;
    } else {
      channel = 0;
      channelLimit = Math.min(chunks[0] ? chunks[0].length : 1, maxChannels);
    }
    const channels = [];
    for (let n = channel; n < channelLimit; n++) {
      const length = chunks.reduce((sum, chunk) => {
        return sum + chunk[n].length;
      }, 0);
      const buffers = chunks.map((chunk) => chunk[n]);
      const result = new Float32Array(length);
      let offset = 0;
      for (let i = 0; i < buffers.length; i++) {
        result.set(buffers[i], offset);
        offset += buffers[i].length;
      }
      channels[n] = result;
    }
    return channels;
  }

  /**
   * Combines parallel audio data into correct format,
   * channels[Left[], Right[]] to float32Array[LRLRLRLR...]
   */
  formatAudioData(channels) {
    if (channels.length === 1) {
      // Simple case is only one channel
      const float32Array = channels[0].slice();
      const meanValues = channels[0].slice();
      return { float32Array, meanValues };
    } else {
      const float32Array = new Float32Array(
        channels[0].length * channels.length
      );
      const meanValues = new Float32Array(channels[0].length);
      for (let i = 0; i < channels[0].length; i++) {
        const offset = i * channels.length;
        let meanValue = 0;
        for (let n = 0; n < channels.length; n++) {
          float32Array[offset + n] = channels[n][i];
          meanValue += channels[n][i];
        }
        meanValues[i] = meanValue / channels.length;
      }
      return { float32Array, meanValues };
    }
  }

  /**
   * Converts 32-bit float data to 16-bit integers
   */
  floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  /**
   * Retrieves the most recent amplitude values from the audio stream
   * @param {number} channel
   */
  getValues(channel = -1) {
    const channels = this.readChannelData(this.chunks, channel);
    const { meanValues } = this.formatAudioData(channels);
    return { meanValues, channels };
  }

  /**
   * Exports chunks as an audio/wav file
   */
  export() {
    const channels = this.readChannelData(this.chunks);
    const { float32Array, meanValues } = this.formatAudioData(channels);
    const audioData = this.floatTo16BitPCM(float32Array);
    return {
      meanValues: meanValues,
      audio: {
        bitsPerSample: 16,
        channels: channels,
        data: audioData,
      },
    };
  }

  receive(e) {
    const { event, id } = e.data;
    let receiptData = {};
    switch (event) {
      case 'start':
        this.recording = true;
        break;
      case 'stop':
        this.recording = false;
        break;
      case 'clear':
        this.initialize();
        break;
      case 'export':
        receiptData = this.export();
        break;
      case 'read':
        receiptData = this.getValues();
        break;
      default:
        break;
    }
    // Always send back receipt
    this.port.postMessage({ event: 'receipt', id, data: receiptData });
  }

  sendChunk(chunk) {
    const channels = this.readChannelData([chunk]);
    const { float32Array, meanValues } = this.formatAudioData(channels);
    const rawAudioData = this.floatTo16BitPCM(float32Array);
    const monoAudioData = this.floatTo16BitPCM(meanValues);
    this.port.postMessage({
      event: 'chunk',
      data: {
        mono: monoAudioData,
        raw: rawAudioData,
      },
    });
  }

  process(inputList, outputList, parameters) {
    // Copy input to output (e.g. speakers)
    // Note that this creates choppy sounds with Mac products
    const sourceLimit = Math.min(inputList.length, outputList.length);
    for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
      const input = inputList[inputNum];
      const output = outputList[inputNum];
      const channelCount = Math.min(input.length, output.length);
      for (let channelNum = 0; channelNum < channelCount; channelNum++) {
        input[channelNum].forEach((sample, i) => {
          output[channelNum][i] = sample;
        });
      }
    }
    const inputs = inputList[0];
    // There's latency at the beginning of a stream before recording starts
    // Make sure we actually receive audio data before we start storing chunks
    let sliceIndex = 0;
    if (!this.foundAudio) {
      for (const channel of inputs) {
        sliceIndex = 0; // reset for each channel
        if (this.foundAudio) {
          break;
        }
        if (channel) {
          for (const value of channel) {
            if (value !== 0) {
              // find only one non-zero entry in any channel
              this.foundAudio = true;
              break;
            } else {
              sliceIndex++;
            }
          }
        }
      }
    }
    if (inputs && inputs[0] && this.foundAudio && this.recording) {
      // We need to copy the TypedArray, because the \`process\`
      // internals will reuse the same buffer to hold each input
      const chunk = inputs.map((input) => input.slice(sliceIndex));
      this.chunks.push(chunk);
      this.sendChunk(chunk);
    }
    return true;
  }
}

registerProcessor('audio_processor', AudioProcessor);
`;
  var $8e1d1e6ff08f6fb5$var$script = new Blob([
    $8e1d1e6ff08f6fb5$var$AudioProcessorWorklet
  ], {
    type: "application/javascript"
  });
  var $8e1d1e6ff08f6fb5$var$src = URL.createObjectURL($8e1d1e6ff08f6fb5$var$script);
  var $8e1d1e6ff08f6fb5$export$1f65f50a8cbff43c = $8e1d1e6ff08f6fb5$var$src;
  var $62bc376044a05513$export$439b217ca659a877 = class {
    /**
    * Create a new WavRecorder instance
    * @param {{sampleRate?: number, outputToSpeakers?: boolean, debug?: boolean}} [options]
    * @returns {WavRecorder}
    */
    constructor({ sampleRate = 44100, outputToSpeakers = false, debug = false } = {}) {
      this.scriptSrc = (0, $8e1d1e6ff08f6fb5$export$1f65f50a8cbff43c);
      this.sampleRate = sampleRate;
      this.outputToSpeakers = outputToSpeakers;
      this.debug = !!debug;
      this._deviceChangeCallback = null;
      this._deviceErrorCallback = null;
      this._devices = [];
      this.deviceSelection = null;
      this.stream = null;
      this.processor = null;
      this.source = null;
      this.node = null;
      this.recording = false;
      this._lastEventId = 0;
      this.eventReceipts = {};
      this.eventTimeout = 5e3;
      this._chunkProcessor = () => {
      };
      this._chunkProcessorSize = void 0;
      this._chunkProcessorBuffer = {
        raw: new ArrayBuffer(0),
        mono: new ArrayBuffer(0)
      };
    }
    /**
    * Decodes audio data from multiple formats to a Blob, url, Float32Array and AudioBuffer
    * @param {Blob|Float32Array|Int16Array|ArrayBuffer|number[]} audioData
    * @param {number} sampleRate
    * @param {number} fromSampleRate
    * @returns {Promise<DecodedAudioType>}
    */
    static async decode(audioData, sampleRate = 44100, fromSampleRate = -1) {
      const context = new AudioContext({
        sampleRate
      });
      let arrayBuffer;
      let blob;
      if (audioData instanceof Blob) {
        if (fromSampleRate !== -1) throw new Error(`Can not specify "fromSampleRate" when reading from Blob`);
        blob = audioData;
        arrayBuffer = await blob.arrayBuffer();
      } else if (audioData instanceof ArrayBuffer) {
        if (fromSampleRate !== -1) throw new Error(`Can not specify "fromSampleRate" when reading from ArrayBuffer`);
        arrayBuffer = audioData;
        blob = new Blob([
          arrayBuffer
        ], {
          type: "audio/wav"
        });
      } else {
        let float32Array;
        let data;
        if (audioData instanceof Int16Array) {
          data = audioData;
          float32Array = new Float32Array(audioData.length);
          for (let i2 = 0; i2 < audioData.length; i2++) float32Array[i2] = audioData[i2] / 32768;
        } else if (audioData instanceof Float32Array) float32Array = audioData;
        else if (audioData instanceof Array) float32Array = new Float32Array(audioData);
        else throw new Error(`"audioData" must be one of: Blob, Float32Arrray, Int16Array, ArrayBuffer, Array<number>`);
        if (fromSampleRate === -1) throw new Error(`Must specify "fromSampleRate" when reading from Float32Array, In16Array or Array`);
        else if (fromSampleRate < 3e3) throw new Error(`Minimum "fromSampleRate" is 3000 (3kHz)`);
        if (!data) data = (0, $6d4b7449a1e1544a$export$13afda237b1c9846).floatTo16BitPCM(float32Array);
        const audio = {
          bitsPerSample: 16,
          channels: [
            float32Array
          ],
          data
        };
        const packer = new (0, $6d4b7449a1e1544a$export$13afda237b1c9846)();
        const result = packer.pack(fromSampleRate, audio);
        blob = result.blob;
        arrayBuffer = await blob.arrayBuffer();
      }
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      const values = audioBuffer.getChannelData(0);
      const url = URL.createObjectURL(blob);
      return {
        blob,
        url,
        values,
        audioBuffer
      };
    }
    /**
    * Logs data in debug mode
    * @param {...any} arguments
    * @returns {true}
    */
    log() {
      if (this.debug) this.log(...arguments);
      return true;
    }
    /**
    * Retrieves the current sampleRate for the recorder
    * @returns {number}
    */
    getSampleRate() {
      return this.sampleRate;
    }
    /**
    * Retrieves the current status of the recording
    * @returns {"ended"|"paused"|"recording"}
    */
    getStatus() {
      if (!this.processor) return "ended";
      else if (!this.recording) return "paused";
      else return "recording";
    }
    /**
    * Sends an event to the AudioWorklet
    * @private
    * @param {string} name
    * @param {{[key: string]: any}} data
    * @param {AudioWorkletNode} [_processor]
    * @returns {Promise<{[key: string]: any}>}
    */
    async _event(name, data = {}, _processor = null) {
      _processor = _processor || this.processor;
      if (!_processor) throw new Error("Can not send events without recording first");
      const message = {
        event: name,
        id: this._lastEventId++,
        data
      };
      _processor.port.postMessage(message);
      const t0 = (/* @__PURE__ */ new Date()).valueOf();
      while (!this.eventReceipts[message.id]) {
        if ((/* @__PURE__ */ new Date()).valueOf() - t0 > this.eventTimeout) throw new Error(`Timeout waiting for "${name}" event`);
        await new Promise((res) => setTimeout(() => res(true), 1));
      }
      const payload = this.eventReceipts[message.id];
      delete this.eventReceipts[message.id];
      return payload;
    }
    /**
    * Sets device change callback, remove if callback provided is `null`
    * @param {(Array<MediaDeviceInfo & {default: boolean}>): void|null} callback
    * @returns {true}
    */
    listenForDeviceChange(callback) {
      if (callback === null && this._deviceChangeCallback) {
        navigator.mediaDevices.removeEventListener("devicechange", this._deviceChangeCallback);
        this._deviceChangeCallback = null;
      } else if (callback !== null) {
        let lastId = 0;
        let lastDevices = [];
        const serializeDevices = (devices) => devices.map((d2) => d2.deviceId).sort().join(",");
        const cb = async () => {
          let id = ++lastId;
          const devices = await this.listDevices();
          if (id === lastId) {
            if (serializeDevices(lastDevices) !== serializeDevices(devices)) {
              lastDevices = devices;
              callback(devices.slice());
            }
          }
        };
        navigator.mediaDevices.addEventListener("devicechange", cb);
        cb();
        this._deviceChangeCallback = cb;
      }
      return true;
    }
    /**
    * Provide a callback for if/when device errors occur
    * @param {(({devices: Array<"cam" | "mic">, type: string, error?: Error}) => void) | null} callback
    * @returns {true}
    */
    listenForDeviceErrors(callback) {
      this._deviceErrorCallback = callback;
    }
    /**
    * Manually request permission to use the microphone
    * @returns {Promise<true>}
    */
    async requestPermission() {
      const permissionStatus = await navigator.permissions.query({
        name: "microphone"
      });
      if (permissionStatus.state === "denied") {
        if (this._deviceErrorCallback) this._deviceErrorCallback({
          devices: [
            "mic"
          ],
          type: "unknown",
          error: new Error("Microphone access denied")
        });
      } else if (permissionStatus.state === "prompt") try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        const tracks = stream.getTracks();
        tracks.forEach((track2) => track2.stop());
      } catch (e2) {
        console.error("Error accessing microphone.");
        if (this._deviceErrorCallback) this._deviceErrorCallback({
          devices: [
            "mic"
          ],
          type: "unknown",
          error: e2
        });
      }
      return true;
    }
    /**
    * List all eligible devices for recording, will request permission to use microphone
    * @returns {Promise<Array<MediaDeviceInfo & {default: boolean}>>}
    */
    async listDevices() {
      if (!navigator.mediaDevices || !("enumerateDevices" in navigator.mediaDevices)) throw new Error("Could not request user devices");
      await this.requestPermission();
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter((device) => device.kind === "audioinput");
      return audioDevices;
    }
    /**
    * Begins a recording session and requests microphone permissions if not already granted
    * Microphone recording indicator will appear on browser tab but status will be "paused"
    * @param {string} [deviceId] if no device provided, default device will be used
    * @returns {Promise<true>}
    */
    async begin(deviceId) {
      if (this.processor) throw new Error(`Already connected: please call .end() to start a new session`);
      if (!navigator.mediaDevices || !("getUserMedia" in navigator.mediaDevices)) {
        if (this._deviceErrorCallback) this._deviceErrorCallback({
          devices: [
            "mic",
            "cam"
          ],
          type: "undefined-mediadevices"
        });
        throw new Error("Could not request user media");
      }
      deviceId = deviceId ?? this.deviceSelection?.deviceId;
      try {
        const config = {
          audio: true
        };
        if (deviceId) config.audio = {
          deviceId: {
            exact: deviceId
          }
        };
        this.stream = await navigator.mediaDevices.getUserMedia(config);
      } catch (err) {
        if (this._deviceErrorCallback) this._deviceErrorCallback({
          devices: [
            "mic"
          ],
          type: "unknown",
          error: err
        });
        throw new Error("Could not start media stream");
      }
      this.listDevices().then((devices) => {
        deviceId = this.stream.getAudioTracks()[0].getSettings().deviceId;
        console.log("find current device", devices, deviceId, this.stream.getAudioTracks()[0].getSettings());
        this.deviceSelection = devices.find((d2) => d2.deviceId === deviceId);
        console.log("current device", this.deviceSelection);
      });
      const context = new AudioContext({
        sampleRate: this.sampleRate
      });
      const source = context.createMediaStreamSource(this.stream);
      try {
        await context.audioWorklet.addModule(this.scriptSrc);
      } catch (e2) {
        console.error(e2);
        throw new Error(`Could not add audioWorklet module: ${this.scriptSrc}`);
      }
      const processor = new AudioWorkletNode(context, "audio_processor");
      processor.port.onmessage = (e2) => {
        const { event, id, data } = e2.data;
        if (event === "receipt") this.eventReceipts[id] = data;
        else if (event === "chunk") {
          if (this._chunkProcessorSize) {
            const buffer = this._chunkProcessorBuffer;
            this._chunkProcessorBuffer = {
              raw: (0, $6d4b7449a1e1544a$export$13afda237b1c9846).mergeBuffers(buffer.raw, data.raw),
              mono: (0, $6d4b7449a1e1544a$export$13afda237b1c9846).mergeBuffers(buffer.mono, data.mono)
            };
            if (this._chunkProcessorBuffer.mono.byteLength >= this._chunkProcessorSize) {
              this._chunkProcessor(this._chunkProcessorBuffer);
              this._chunkProcessorBuffer = {
                raw: new ArrayBuffer(0),
                mono: new ArrayBuffer(0)
              };
            }
          } else this._chunkProcessor(data);
        }
      };
      const node = source.connect(processor);
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.1;
      node.connect(analyser);
      if (this.outputToSpeakers) {
        console.warn("Warning: Output to speakers may affect sound quality,\nespecially due to system audio feedback preventative measures.\nuse only for debugging");
        analyser.connect(context.destination);
      }
      this.source = source;
      this.node = node;
      this.analyser = analyser;
      this.processor = processor;
      console.log("begin completed");
      return true;
    }
    /**
    * Gets the current frequency domain data from the recording track
    * @param {"frequency"|"music"|"voice"} [analysisType]
    * @param {number} [minDecibels] default -100
    * @param {number} [maxDecibels] default -30
    * @returns {import('./analysis/audio_analysis.js').AudioAnalysisOutputType}
    */
    getFrequencies(analysisType = "frequency", minDecibels = -100, maxDecibels = -30) {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      return (0, $f32f064564ee62f6$export$2c3136da0bf130f9).getFrequencies(this.analyser, this.sampleRate, null, analysisType, minDecibels, maxDecibels);
    }
    /**
    * Pauses the recording
    * Keeps microphone stream open but halts storage of audio
    * @returns {Promise<true>}
    */
    async pause() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      else if (!this.recording) throw new Error("Already paused: please call .record() first");
      if (this._chunkProcessorBuffer.raw.byteLength) this._chunkProcessor(this._chunkProcessorBuffer);
      this.log("Pausing ...");
      await this._event("stop");
      this.recording = false;
      return true;
    }
    /**
    * Start recording stream and storing to memory from the connected audio source
    * @param {(data: { mono: Int16Array; raw: Int16Array }) => any} [chunkProcessor]
    * @param {number} [chunkSize] chunkProcessor will not be triggered until this size threshold met in mono audio
    * @returns {Promise<true>}
    */
    async record(chunkProcessor = () => {
    }, chunkSize = 8192) {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      else if (this.recording) throw new Error("Already recording: please call .pause() first");
      else if (typeof chunkProcessor !== "function") throw new Error(`chunkProcessor must be a function`);
      this._chunkProcessor = chunkProcessor;
      this._chunkProcessorSize = chunkSize;
      this._chunkProcessorBuffer = {
        raw: new ArrayBuffer(0),
        mono: new ArrayBuffer(0)
      };
      this.log("Recording ...");
      await this._event("start");
      this.recording = true;
      return true;
    }
    /**
    * Clears the audio buffer, empties stored recording
    * @returns {Promise<true>}
    */
    async clear() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      await this._event("clear");
      return true;
    }
    /**
    * Reads the current audio stream data
    * @returns {Promise<{meanValues: Float32Array, channels: Array<Float32Array>}>}
    */
    async read() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      this.log("Reading ...");
      const result = await this._event("read");
      return result;
    }
    /**
    * Saves the current audio stream to a file
    * @param {boolean} [force] Force saving while still recording
    * @returns {Promise<import('./wav_packer.js').WavPackerAudioType>}
    */
    async save(force = false) {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      if (!force && this.recording) throw new Error("Currently recording: please call .pause() first, or call .save(true) to force");
      this.log("Exporting ...");
      const exportData = await this._event("export");
      const packer = new (0, $6d4b7449a1e1544a$export$13afda237b1c9846)();
      const result = packer.pack(this.sampleRate, exportData.audio);
      return result;
    }
    /**
    * Ends the current recording session and saves the result
    * @returns {Promise<import('./wav_packer.js').WavPackerAudioType>}
    */
    async end() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      const _processor = this.processor;
      this.log("Stopping ...");
      await this._event("stop");
      this.recording = false;
      const tracks = this.stream.getTracks();
      tracks.forEach((track2) => track2.stop());
      this.log("Exporting ...");
      const exportData = await this._event("export", {}, _processor);
      this.processor.disconnect();
      this.source.disconnect();
      this.node.disconnect();
      this.analyser.disconnect();
      this.stream = null;
      this.processor = null;
      this.source = null;
      this.node = null;
      const packer = new (0, $6d4b7449a1e1544a$export$13afda237b1c9846)();
      const result = packer.pack(this.sampleRate, exportData.audio);
      return result;
    }
    /**
    * Performs a full cleanup of WavRecorder instance
    * Stops actively listening via microphone and removes existing listeners
    * @returns {Promise<true>}
    */
    async quit() {
      this.listenForDeviceChange(null);
      this.deviceSelection = null;
      if (this.processor) await this.end();
      return true;
    }
  };
  globalThis.WavRecorder = $62bc376044a05513$export$439b217ca659a877;
  function $5fc11d7bc0d20724$var$resampleAudioBuffer(inputBuffer, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) return inputBuffer;
    const inputView = new Int16Array(inputBuffer);
    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.round(inputView.length / ratio);
    const outputBuffer = new ArrayBuffer(outputLength * 2);
    const outputView = new Int16Array(outputBuffer);
    for (let i2 = 0; i2 < outputLength; i2++) {
      const srcIndex = i2 * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputView.length - 1);
      const t2 = srcIndex - srcIndexFloor;
      outputView[i2] = Math.round(inputView[srcIndexFloor] * (1 - t2) + inputView[srcIndexCeil] * t2);
    }
    return outputBuffer;
  }
  var $5fc11d7bc0d20724$export$2934cf2d25c67a48 = class {
    /**
    * Create a new MediaStreamRecorder instance
    * @param {{sampleRate?: number, outputToSpeakers?: boolean, debug?: boolean}} [options]
    * @returns {MediaStreamRecorder}
    */
    constructor({ sampleRate = 44100, outputToSpeakers = false, debug = false } = {}) {
      this.scriptSrc = (0, $8e1d1e6ff08f6fb5$export$1f65f50a8cbff43c);
      this.sampleRate = sampleRate;
      this.outputToSpeakers = outputToSpeakers;
      this.debug = !!debug;
      this.stream = null;
      this.processor = null;
      this.source = null;
      this.node = null;
      this.recording = false;
      this._lastEventId = 0;
      this.eventReceipts = {};
      this.eventTimeout = 5e3;
      this._chunkProcessor = () => {
      };
      this._chunkProcessorSize = void 0;
      this._chunkProcessorBuffer = {
        raw: new ArrayBuffer(0),
        mono: new ArrayBuffer(0)
      };
    }
    /**
    * Logs data in debug mode
    * @param {...any} arguments
    * @returns {true}
    */
    log() {
      if (this.debug) this.log(...arguments);
      return true;
    }
    /**
    * Retrieves the current sampleRate for the recorder
    * @returns {number}
    */
    getSampleRate() {
      return this.sampleRate;
    }
    /**
    * Retrieves the current status of the recording
    * @returns {"ended"|"paused"|"recording"}
    */
    getStatus() {
      if (!this.processor) return "ended";
      else if (!this.recording) return "paused";
      else return "recording";
    }
    /**
    * Sends an event to the AudioWorklet
    * @private
    * @param {string} name
    * @param {{[key: string]: any}} data
    * @param {AudioWorkletNode} [_processor]
    * @returns {Promise<{[key: string]: any}>}
    */
    async _event(name, data = {}, _processor = null) {
      _processor = _processor || this.processor;
      if (!_processor) throw new Error("Can not send events without recording first");
      const message = {
        event: name,
        id: this._lastEventId++,
        data
      };
      _processor.port.postMessage(message);
      const t0 = (/* @__PURE__ */ new Date()).valueOf();
      while (!this.eventReceipts[message.id]) {
        if ((/* @__PURE__ */ new Date()).valueOf() - t0 > this.eventTimeout) throw new Error(`Timeout waiting for "${name}" event`);
        await new Promise((res) => setTimeout(() => res(true), 1));
      }
      const payload = this.eventReceipts[message.id];
      delete this.eventReceipts[message.id];
      return payload;
    }
    /**
    * Begins a recording session for the given audioTrack
    * Microphone recording indicator will appear on browser tab but status will be "paused"
    * @param {MediaStreamTrack} [audioTrack] if no device provided, default device will be used
    * @returns {Promise<true>}
    */
    async begin(audioTrack) {
      if (this.processor) throw new Error(`Already connected: please call .end() to start a new session`);
      if (!audioTrack || audioTrack.kind !== "audio") throw new Error("No audio track provided");
      this.stream = new MediaStream([
        audioTrack
      ]);
      const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
      let context;
      if (isFirefox)
        context = new AudioContext();
      else
        context = new AudioContext({
          sampleRate: this.sampleRate
        });
      const contextSampleRate = context.sampleRate;
      const source = context.createMediaStreamSource(this.stream);
      try {
        await context.audioWorklet.addModule(this.scriptSrc);
      } catch (e2) {
        console.error(e2);
        throw new Error(`Could not add audioWorklet module: ${this.scriptSrc}`);
      }
      const processor = new AudioWorkletNode(context, "audio_processor");
      processor.port.onmessage = (e2) => {
        const { event, id, data } = e2.data;
        if (event === "receipt") this.eventReceipts[id] = data;
        else if (event === "chunk") {
          const resampledData = {
            raw: $5fc11d7bc0d20724$var$resampleAudioBuffer(data.raw, contextSampleRate, this.sampleRate),
            mono: $5fc11d7bc0d20724$var$resampleAudioBuffer(data.mono, contextSampleRate, this.sampleRate)
          };
          if (this._chunkProcessorSize) {
            const buffer = this._chunkProcessorBuffer;
            this._chunkProcessorBuffer = {
              raw: (0, $6d4b7449a1e1544a$export$13afda237b1c9846).mergeBuffers(buffer.raw, resampledData.raw),
              mono: (0, $6d4b7449a1e1544a$export$13afda237b1c9846).mergeBuffers(buffer.mono, resampledData.mono)
            };
            if (this._chunkProcessorBuffer.mono.byteLength >= this._chunkProcessorSize) {
              this._chunkProcessor(this._chunkProcessorBuffer);
              this._chunkProcessorBuffer = {
                raw: new ArrayBuffer(0),
                mono: new ArrayBuffer(0)
              };
            }
          } else this._chunkProcessor(resampledData);
        }
      };
      const node = source.connect(processor);
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.1;
      node.connect(analyser);
      if (this.outputToSpeakers) {
        console.warn("Warning: Output to speakers may affect sound quality,\nespecially due to system audio feedback preventative measures.\nuse only for debugging");
        analyser.connect(context.destination);
      }
      this.source = source;
      this.node = node;
      this.analyser = analyser;
      this.processor = processor;
      return true;
    }
    /**
    * Gets the current frequency domain data from the recording track
    * @param {"frequency"|"music"|"voice"} [analysisType]
    * @param {number} [minDecibels] default -100
    * @param {number} [maxDecibels] default -30
    * @returns {import('./analysis/audio_analysis.js').AudioAnalysisOutputType}
    */
    getFrequencies(analysisType = "frequency", minDecibels = -100, maxDecibels = -30) {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      return (0, $f32f064564ee62f6$export$2c3136da0bf130f9).getFrequencies(this.analyser, this.sampleRate, null, analysisType, minDecibels, maxDecibels);
    }
    /**
    * Pauses the recording
    * Keeps microphone stream open but halts storage of audio
    * @returns {Promise<true>}
    */
    async pause() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      else if (!this.recording) throw new Error("Already paused: please call .record() first");
      if (this._chunkProcessorBuffer.raw.byteLength) this._chunkProcessor(this._chunkProcessorBuffer);
      this.log("Pausing ...");
      await this._event("stop");
      this.recording = false;
      return true;
    }
    /**
    * Start recording stream and storing to memory from the connected audio source
    * @param {(data: { mono: Int16Array; raw: Int16Array }) => any} [chunkProcessor]
    * @param {number} [chunkSize] chunkProcessor will not be triggered until this size threshold met in mono audio
    * @returns {Promise<true>}
    */
    async record(chunkProcessor = () => {
    }, chunkSize = 8192) {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      else if (this.recording) throw new Error("Already recording: HELLO please call .pause() first");
      else if (typeof chunkProcessor !== "function") throw new Error(`chunkProcessor must be a function`);
      this._chunkProcessor = chunkProcessor;
      this._chunkProcessorSize = chunkSize;
      this._chunkProcessorBuffer = {
        raw: new ArrayBuffer(0),
        mono: new ArrayBuffer(0)
      };
      this.log("Recording ...");
      await this._event("start");
      this.recording = true;
      return true;
    }
    /**
    * Clears the audio buffer, empties stored recording
    * @returns {Promise<true>}
    */
    async clear() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      await this._event("clear");
      return true;
    }
    /**
    * Reads the current audio stream data
    * @returns {Promise<{meanValues: Float32Array, channels: Array<Float32Array>}>}
    */
    async read() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      this.log("Reading ...");
      const result = await this._event("read");
      return result;
    }
    /**
    * Saves the current audio stream to a file
    * @param {boolean} [force] Force saving while still recording
    * @returns {Promise<import('./wav_packer.js').WavPackerAudioType>}
    */
    async save(force = false) {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      if (!force && this.recording) throw new Error("Currently recording: please call .pause() first, or call .save(true) to force");
      this.log("Exporting ...");
      const exportData = await this._event("export");
      const packer = new (0, $6d4b7449a1e1544a$export$13afda237b1c9846)();
      const result = packer.pack(this.sampleRate, exportData.audio);
      return result;
    }
    /**
    * Ends the current recording session and saves the result
    * @returns {Promise<import('./wav_packer.js').WavPackerAudioType>}
    */
    async end() {
      if (!this.processor) throw new Error("Session ended: please call .begin() first");
      const _processor = this.processor;
      this.log("Stopping ...");
      await this._event("stop");
      this.recording = false;
      this.log("Exporting ...");
      const exportData = await this._event("export", {}, _processor);
      this.processor.disconnect();
      this.source.disconnect();
      this.node.disconnect();
      this.analyser.disconnect();
      this.stream = null;
      this.processor = null;
      this.source = null;
      this.node = null;
      const packer = new (0, $6d4b7449a1e1544a$export$13afda237b1c9846)();
      const result = packer.pack(this.sampleRate, exportData.audio);
      return result;
    }
    /**
    * Performs a full cleanup of WavRecorder instance
    * Stops actively listening via microphone and removes existing listeners
    * @returns {Promise<true>}
    */
    async quit() {
      this.listenForDeviceChange(null);
      if (this.processor) await this.end();
      return true;
    }
  };
  globalThis.WavRecorder = WavRecorder;
  var $fc49a56cd8739127$var$__extends = /* @__PURE__ */ (function() {
    var extendStatics = function(d2, b2) {
      extendStatics = Object.setPrototypeOf || {
        __proto__: []
      } instanceof Array && function(d3, b3) {
        d3.__proto__ = b3;
      } || function(d3, b3) {
        for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
      };
      return extendStatics(d2, b2);
    };
    return function(d2, b2) {
      if (typeof b2 !== "function" && b2 !== null) throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
      extendStatics(d2, b2);
      function __() {
        this.constructor = d2;
      }
      d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
    };
  })();
  var $fc49a56cd8739127$var$__awaiter = function(thisArg, _arguments, P2, generator) {
    function adopt(value) {
      return value instanceof P2 ? value : new P2(function(resolve) {
        resolve(value);
      });
    }
    return new (P2 || (P2 = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e2) {
          reject(e2);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e2) {
          reject(e2);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var $fc49a56cd8739127$var$__generator = function(thisArg, body) {
    var _2 = {
      label: 0,
      sent: function() {
        if (t2[0] & 1) throw t2[1];
        return t2[1];
      },
      trys: [],
      ops: []
    }, f2, y2, t2, g2 = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g2.next = verb(0), g2["throw"] = verb(1), g2["return"] = verb(2), typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
      return this;
    }), g2;
    function verb(n2) {
      return function(v2) {
        return step([
          n2,
          v2
        ]);
      };
    }
    function step(op) {
      if (f2) throw new TypeError("Generator is already executing.");
      while (g2 && (g2 = 0, op[0] && (_2 = 0)), _2) try {
        if (f2 = 1, y2 && (t2 = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t2 = y2["return"]) && t2.call(y2), 0) : y2.next) && !(t2 = t2.call(y2, op[1])).done) return t2;
        if (y2 = 0, t2) op = [
          op[0] & 2,
          t2.value
        ];
        switch (op[0]) {
          case 0:
          case 1:
            t2 = op;
            break;
          case 4:
            _2.label++;
            return {
              value: op[1],
              done: false
            };
          case 5:
            _2.label++;
            y2 = op[1];
            op = [
              0
            ];
            continue;
          case 7:
            op = _2.ops.pop();
            _2.trys.pop();
            continue;
          default:
            if (!(t2 = _2.trys, t2 = t2.length > 0 && t2[t2.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _2 = 0;
              continue;
            }
            if (op[0] === 3 && (!t2 || op[1] > t2[0] && op[1] < t2[3])) {
              _2.label = op[1];
              break;
            }
            if (op[0] === 6 && _2.label < t2[1]) {
              _2.label = t2[1];
              t2 = op;
              break;
            }
            if (t2 && _2.label < t2[2]) {
              _2.label = t2[2];
              _2.ops.push(op);
              break;
            }
            if (t2[2]) _2.ops.pop();
            _2.trys.pop();
            continue;
        }
        op = body.call(thisArg, _2);
      } catch (e2) {
        op = [
          6,
          e2
        ];
        y2 = 0;
      } finally {
        f2 = t2 = 0;
      }
      if (op[0] & 5) throw op[1];
      return {
        value: op[0] ? op[1] : void 0,
        done: true
      };
    }
  };
  var $fc49a56cd8739127$export$4a0c46dbbe2ddb67 = (
    /** @class */
    (function() {
      function MediaManager() {
        this._callbacks = {};
        this._micEnabled = true;
        this._camEnabled = false;
        this._supportsScreenShare = false;
      }
      MediaManager.prototype.setUserAudioCallback = function(userAudioCallback) {
        this._userAudioCallback = userAudioCallback;
      };
      MediaManager.prototype.setClientOptions = function(options, override) {
        var _a2, _b, _c2;
        if (override === void 0) override = false;
        if (this._options && !override) return;
        this._options = options;
        this._callbacks = (_a2 = options.callbacks) !== null && _a2 !== void 0 ? _a2 : {};
        this._micEnabled = (_b = options.enableMic) !== null && _b !== void 0 ? _b : true;
        this._camEnabled = (_c2 = options.enableCam) !== null && _c2 !== void 0 ? _c2 : false;
      };
      Object.defineProperty(MediaManager.prototype, "supportsScreenShare", {
        get: function() {
          return this._supportsScreenShare;
        },
        enumerable: false,
        configurable: true
      });
      return MediaManager;
    })()
  );
  var $fc49a56cd8739127$export$45c5b9bfba2f6304 = (
    /** @class */
    (function(_super) {
      $fc49a56cd8739127$var$__extends(WavMediaManager, _super);
      function WavMediaManager(recorderChunkSize, recorderSampleRate) {
        if (recorderChunkSize === void 0) recorderChunkSize = void 0;
        if (recorderSampleRate === void 0) recorderSampleRate = 24e3;
        var _this = _super.call(this) || this;
        _this._initialized = false;
        _this._recorderChunkSize = void 0;
        _this._recorderChunkSize = recorderChunkSize;
        _this._wavRecorder = new (0, $62bc376044a05513$export$439b217ca659a877)({
          sampleRate: recorderSampleRate
        });
        _this._wavStreamPlayer = new (0, $d0a969833958d9e7$export$9698d62c78b8f366)({
          sampleRate: 24e3
        });
        return _this;
      }
      WavMediaManager.prototype.initialize = function() {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, Promise, function() {
          var error_1;
          return $fc49a56cd8739127$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                _a2.trys.push([
                  0,
                  2,
                  ,
                  3
                ]);
                return [
                  4,
                  this._wavRecorder.begin()
                ];
              case 1:
                _a2.sent();
                return [
                  3,
                  3
                ];
              case 2:
                error_1 = _a2.sent();
                return [
                  3,
                  3
                ];
              case 3:
                this._wavRecorder.listenForDeviceChange(null);
                this._wavRecorder.listenForDeviceChange(this._handleAvailableDevicesUpdated.bind(this));
                this._wavRecorder.listenForDeviceErrors(null);
                this._wavRecorder.listenForDeviceErrors(this._handleDeviceError.bind(this));
                return [
                  4,
                  this._wavStreamPlayer.connect()
                ];
              case 4:
                _a2.sent();
                this._initialized = true;
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      WavMediaManager.prototype.connect = function() {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, Promise, function() {
          var isAlreadyRecording;
          return $fc49a56cd8739127$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                if (!!this._initialized) return [
                  3,
                  2
                ];
                return [
                  4,
                  this.initialize()
                ];
              case 1:
                _a2.sent();
                _a2.label = 2;
              case 2:
                isAlreadyRecording = this._wavRecorder.getStatus() == "recording";
                if (!(this._micEnabled && !isAlreadyRecording)) return [
                  3,
                  4
                ];
                return [
                  4,
                  this._startRecording()
                ];
              case 3:
                _a2.sent();
                _a2.label = 4;
              case 4:
                if (this._camEnabled) console.warn("WavMediaManager does not support video input.");
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      WavMediaManager.prototype.disconnect = function() {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, Promise, function() {
          return $fc49a56cd8739127$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                if (!this._initialized) return [
                  2
                  /*return*/
                ];
                return [
                  4,
                  this._wavRecorder.end()
                ];
              case 1:
                _a2.sent();
                return [
                  4,
                  this._wavStreamPlayer.interrupt()
                ];
              case 2:
                _a2.sent();
                this._initialized = false;
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      WavMediaManager.prototype.userStartedSpeaking = function() {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, Promise, function() {
          return $fc49a56cd8739127$var$__generator(this, function(_a2) {
            return [
              2,
              this._wavStreamPlayer.interrupt()
            ];
          });
        });
      };
      WavMediaManager.prototype.bufferBotAudio = function(data, id) {
        return this._wavStreamPlayer.add16BitPCM(data, id);
      };
      WavMediaManager.prototype.getAllMics = function() {
        return this._wavRecorder.listDevices();
      };
      WavMediaManager.prototype.getAllCams = function() {
        return Promise.resolve([]);
      };
      WavMediaManager.prototype.getAllSpeakers = function() {
        return Promise.resolve([]);
      };
      WavMediaManager.prototype.updateMic = function(micId) {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, Promise, function() {
          var prevMic, curMic, error_2;
          var _a2, _b;
          return $fc49a56cd8739127$var$__generator(this, function(_c2) {
            switch (_c2.label) {
              case 0:
                prevMic = this._wavRecorder.deviceSelection;
                if (!(this._wavRecorder.getStatus() !== "ended")) return [
                  3,
                  2
                ];
                return [
                  4,
                  this._wavRecorder.end()
                ];
              case 1:
                _c2.sent();
                _c2.label = 2;
              case 2:
                _c2.trys.push([
                  2,
                  6,
                  ,
                  7
                ]);
                return [
                  4,
                  this._wavRecorder.begin(micId)
                ];
              case 3:
                _c2.sent();
                if (!this._micEnabled) return [
                  3,
                  5
                ];
                return [
                  4,
                  this._startRecording()
                ];
              case 4:
                _c2.sent();
                _c2.label = 5;
              case 5:
                curMic = this._wavRecorder.deviceSelection;
                if (curMic && prevMic && prevMic.label !== curMic.label) (_b = (_a2 = this._callbacks).onMicUpdated) === null || _b === void 0 || _b.call(_a2, curMic);
                return [
                  3,
                  7
                ];
              case 6:
                error_2 = _c2.sent();
                return [
                  3,
                  7
                ];
              case 7:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      WavMediaManager.prototype.updateCam = function(camId) {
      };
      WavMediaManager.prototype.updateSpeaker = function(speakerId) {
      };
      Object.defineProperty(WavMediaManager.prototype, "selectedMic", {
        get: function() {
          var _a2;
          return (_a2 = this._wavRecorder.deviceSelection) !== null && _a2 !== void 0 ? _a2 : {};
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(WavMediaManager.prototype, "selectedCam", {
        get: function() {
          return {};
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(WavMediaManager.prototype, "selectedSpeaker", {
        get: function() {
          return {};
        },
        enumerable: false,
        configurable: true
      });
      WavMediaManager.prototype.enableMic = function(enable) {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, Promise, function() {
          var _this = this;
          return $fc49a56cd8739127$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                this._micEnabled = enable;
                if (!this._wavRecorder.stream) return [
                  2
                  /*return*/
                ];
                this._wavRecorder.stream.getAudioTracks().forEach(function(track2) {
                  var _a3, _b;
                  track2.enabled = enable;
                  if (!enable) (_b = (_a3 = _this._callbacks).onTrackStopped) === null || _b === void 0 || _b.call(_a3, track2, $fc49a56cd8739127$var$localParticipant());
                });
                if (!enable) return [
                  3,
                  2
                ];
                return [
                  4,
                  this._startRecording()
                ];
              case 1:
                _a2.sent();
                return [
                  3,
                  4
                ];
              case 2:
                return [
                  4,
                  this._wavRecorder.pause()
                ];
              case 3:
                _a2.sent();
                _a2.label = 4;
              case 4:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      WavMediaManager.prototype.enableCam = function(enable) {
        console.warn("WavMediaManager does not support video input.");
      };
      WavMediaManager.prototype.enableScreenShare = function(enable) {
        console.warn("WavMediaManager does not support screen sharing.");
      };
      Object.defineProperty(WavMediaManager.prototype, "isCamEnabled", {
        get: function() {
          return false;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(WavMediaManager.prototype, "isMicEnabled", {
        get: function() {
          return this._micEnabled;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(WavMediaManager.prototype, "isSharingScreen", {
        get: function() {
          return false;
        },
        enumerable: false,
        configurable: true
      });
      WavMediaManager.prototype.tracks = function() {
        var _a2;
        var tracks = (_a2 = this._wavRecorder.stream) === null || _a2 === void 0 ? void 0 : _a2.getTracks()[0];
        return {
          local: tracks ? {
            audio: tracks
          } : {}
        };
      };
      WavMediaManager.prototype._startRecording = function() {
        return $fc49a56cd8739127$var$__awaiter(this, void 0, void 0, function() {
          var track2;
          var _this = this;
          var _a2, _b, _c2;
          return $fc49a56cd8739127$var$__generator(this, function(_d) {
            switch (_d.label) {
              case 0:
                return [
                  4,
                  this._wavRecorder.record(function(data) {
                    var _a3;
                    (_a3 = _this._userAudioCallback) === null || _a3 === void 0 || _a3.call(_this, data.mono);
                  }, this._recorderChunkSize)
                ];
              case 1:
                _d.sent();
                track2 = (_a2 = this._wavRecorder.stream) === null || _a2 === void 0 ? void 0 : _a2.getAudioTracks()[0];
                if (track2) (_c2 = (_b = this._callbacks).onTrackStarted) === null || _c2 === void 0 || _c2.call(_b, track2, $fc49a56cd8739127$var$localParticipant());
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      WavMediaManager.prototype._handleAvailableDevicesUpdated = function(devices) {
        var _a2, _b, _c2, _d;
        (_b = (_a2 = this._callbacks).onAvailableCamsUpdated) === null || _b === void 0 || _b.call(_a2, devices.filter(function(d2) {
          return d2.kind === "videoinput";
        }));
        (_d = (_c2 = this._callbacks).onAvailableMicsUpdated) === null || _d === void 0 || _d.call(_c2, devices.filter(function(d2) {
          return d2.kind === "audioinput";
        }));
        var defaultDevice = devices.find(function(d2) {
          return d2.deviceId === "default";
        });
        var currentDevice = this._wavRecorder.deviceSelection;
        if (currentDevice && (!devices.some(function(d2) {
          return d2.deviceId === currentDevice.deviceId;
        }) || currentDevice.deviceId === "default" && currentDevice.label !== (defaultDevice === null || defaultDevice === void 0 ? void 0 : defaultDevice.label))) this.updateMic("");
      };
      WavMediaManager.prototype._handleDeviceError = function(_a2) {
        var _b, _c2;
        var devices = _a2.devices, type = _a2.type, error = _a2.error;
        var deviceError = new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, type, error === null || error === void 0 ? void 0 : error.message, error ? {
          sourceError: error
        } : void 0);
        (_c2 = (_b = this._callbacks).onDeviceError) === null || _c2 === void 0 || _c2.call(_b, deviceError);
      };
      return WavMediaManager;
    })($fc49a56cd8739127$export$4a0c46dbbe2ddb67)
  );
  var $fc49a56cd8739127$var$localParticipant = function() {
    return {
      id: "local",
      name: "",
      local: true
    };
  };
  var $22ece045290c996a$var$__extends = /* @__PURE__ */ (function() {
    var extendStatics = function(d2, b2) {
      extendStatics = Object.setPrototypeOf || {
        __proto__: []
      } instanceof Array && function(d3, b3) {
        d3.__proto__ = b3;
      } || function(d3, b3) {
        for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
      };
      return extendStatics(d2, b2);
    };
    return function(d2, b2) {
      if (typeof b2 !== "function" && b2 !== null) throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
      extendStatics(d2, b2);
      function __() {
        this.constructor = d2;
      }
      d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
    };
  })();
  var $22ece045290c996a$var$__awaiter = function(thisArg, _arguments, P2, generator) {
    function adopt(value) {
      return value instanceof P2 ? value : new P2(function(resolve) {
        resolve(value);
      });
    }
    return new (P2 || (P2 = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e2) {
          reject(e2);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e2) {
          reject(e2);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var $22ece045290c996a$var$__generator = function(thisArg, body) {
    var _2 = {
      label: 0,
      sent: function() {
        if (t2[0] & 1) throw t2[1];
        return t2[1];
      },
      trys: [],
      ops: []
    }, f2, y2, t2, g2 = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g2.next = verb(0), g2["throw"] = verb(1), g2["return"] = verb(2), typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
      return this;
    }), g2;
    function verb(n2) {
      return function(v2) {
        return step([
          n2,
          v2
        ]);
      };
    }
    function step(op) {
      if (f2) throw new TypeError("Generator is already executing.");
      while (g2 && (g2 = 0, op[0] && (_2 = 0)), _2) try {
        if (f2 = 1, y2 && (t2 = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t2 = y2["return"]) && t2.call(y2), 0) : y2.next) && !(t2 = t2.call(y2, op[1])).done) return t2;
        if (y2 = 0, t2) op = [
          op[0] & 2,
          t2.value
        ];
        switch (op[0]) {
          case 0:
          case 1:
            t2 = op;
            break;
          case 4:
            _2.label++;
            return {
              value: op[1],
              done: false
            };
          case 5:
            _2.label++;
            y2 = op[1];
            op = [
              0
            ];
            continue;
          case 7:
            op = _2.ops.pop();
            _2.trys.pop();
            continue;
          default:
            if (!(t2 = _2.trys, t2 = t2.length > 0 && t2[t2.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _2 = 0;
              continue;
            }
            if (op[0] === 3 && (!t2 || op[1] > t2[0] && op[1] < t2[3])) {
              _2.label = op[1];
              break;
            }
            if (op[0] === 6 && _2.label < t2[1]) {
              _2.label = t2[1];
              t2 = op;
              break;
            }
            if (t2 && _2.label < t2[2]) {
              _2.label = t2[2];
              _2.ops.push(op);
              break;
            }
            if (t2[2]) _2.ops.pop();
            _2.trys.pop();
            continue;
        }
        op = body.call(thisArg, _2);
      } catch (e2) {
        op = [
          6,
          e2
        ];
        y2 = 0;
      } finally {
        f2 = t2 = 0;
      }
      if (op[0] & 5) throw op[1];
      return {
        value: op[0] ? op[1] : void 0,
        done: true
      };
    }
  };
  var $22ece045290c996a$export$c95c65abc5f47125 = (
    /** @class */
    (function(_super) {
      $22ece045290c996a$var$__extends(DailyMediaManager, _super);
      function DailyMediaManager(enablePlayer, enableRecording, onTrackStartedCallback, onTrackStoppedCallback, recorderChunkSize, recorderSampleRate, playerSampleRate) {
        if (enablePlayer === void 0) enablePlayer = true;
        if (enableRecording === void 0) enableRecording = true;
        if (recorderChunkSize === void 0) recorderChunkSize = void 0;
        if (recorderSampleRate === void 0) recorderSampleRate = 24e3;
        if (playerSampleRate === void 0) playerSampleRate = 24e3;
        var _a2;
        var _this = _super.call(this) || this;
        _this._selectedCam = {};
        _this._selectedMic = {};
        _this._selectedSpeaker = {};
        _this._remoteAudioLevelInterval = null;
        _this._recorderChunkSize = void 0;
        _this._initialized = false;
        _this._connected = false;
        _this._currentAudioTrack = null;
        _this._connectResolve = null;
        _this.onTrackStartedCallback = onTrackStartedCallback;
        _this.onTrackStoppedCallback = onTrackStoppedCallback;
        _this._recorderChunkSize = recorderChunkSize;
        _this._supportsScreenShare = true;
        _this._daily = (_a2 = (0, Qs).getCallInstance()) !== null && _a2 !== void 0 ? _a2 : (0, Qs).createCallObject();
        if (enableRecording) _this._mediaStreamRecorder = new (0, $5fc11d7bc0d20724$export$2934cf2d25c67a48)({
          sampleRate: recorderSampleRate
        });
        if (enablePlayer) _this._wavStreamPlayer = new (0, $d0a969833958d9e7$export$9698d62c78b8f366)({
          sampleRate: playerSampleRate
        });
        _this._daily.on("track-started", _this.handleTrackStarted.bind(_this));
        _this._daily.on("track-stopped", _this.handleTrackStopped.bind(_this));
        _this._daily.on("available-devices-updated", _this._handleAvailableDevicesUpdated.bind(_this));
        _this._daily.on("selected-devices-updated", _this._handleSelectedDevicesUpdated.bind(_this));
        _this._daily.on("camera-error", _this.handleDeviceError.bind(_this));
        _this._daily.on("local-audio-level", _this._handleLocalAudioLevel.bind(_this));
        return _this;
      }
      DailyMediaManager.prototype.initialize = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var infos, devices, cams, mics, speakers;
          var _this = this;
          var _a2, _b, _c2, _d, _e2, _f, _g, _h, _j, _k, _l, _m;
          return $22ece045290c996a$var$__generator(this, function(_o2) {
            switch (_o2.label) {
              case 0:
                if (this._initialized) {
                  console.warn("DailyMediaManager already initialized");
                  return [
                    2
                    /*return*/
                  ];
                }
                return [
                  4,
                  this._daily.startCamera({
                    startVideoOff: !this._camEnabled,
                    startAudioOff: !this._micEnabled,
                    dailyConfig: {
                      useDevicePreferenceCookies: true
                    }
                  })
                ];
              case 1:
                infos = _o2.sent();
                return [
                  4,
                  this._daily.enumerateDevices()
                ];
              case 2:
                devices = _o2.sent().devices;
                cams = devices.filter(function(d2) {
                  return d2.kind === "videoinput";
                });
                mics = devices.filter(function(d2) {
                  return d2.kind === "audioinput";
                });
                speakers = devices.filter(function(d2) {
                  return d2.kind === "audiooutput";
                });
                (_b = (_a2 = this._callbacks).onAvailableCamsUpdated) === null || _b === void 0 || _b.call(_a2, cams);
                (_d = (_c2 = this._callbacks).onAvailableMicsUpdated) === null || _d === void 0 || _d.call(_c2, mics);
                (_f = (_e2 = this._callbacks).onAvailableSpeakersUpdated) === null || _f === void 0 || _f.call(_e2, speakers);
                this._selectedCam = infos.camera;
                (_h = (_g = this._callbacks).onCamUpdated) === null || _h === void 0 || _h.call(_g, infos.camera);
                this._selectedMic = infos.mic;
                (_k = (_j = this._callbacks).onMicUpdated) === null || _k === void 0 || _k.call(_j, infos.mic);
                this._selectedSpeaker = infos.speaker;
                (_m = (_l = this._callbacks).onSpeakerUpdated) === null || _m === void 0 || _m.call(_l, infos.speaker);
                if (!!this._daily.isLocalAudioLevelObserverRunning()) return [
                  3,
                  4
                ];
                return [
                  4,
                  this._daily.startLocalAudioLevelObserver(100)
                ];
              case 3:
                _o2.sent();
                _o2.label = 4;
              case 4:
                if (!this._wavStreamPlayer) return [
                  3,
                  6
                ];
                return [
                  4,
                  this._wavStreamPlayer.connect()
                ];
              case 5:
                _o2.sent();
                if (!this._remoteAudioLevelInterval) this._remoteAudioLevelInterval = setInterval(function() {
                  var _a3;
                  var frequencies = _this._wavStreamPlayer.getFrequencies();
                  var aveVal = 0;
                  if ((_a3 = frequencies.values) === null || _a3 === void 0 ? void 0 : _a3.length) aveVal = frequencies.values.reduce(function(a2, c2) {
                    return a2 + c2;
                  }, 0) / frequencies.values.length;
                  _this._handleRemoteAudioLevel(aveVal);
                }, 100);
                _o2.label = 6;
              case 6:
                this._initialized = true;
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      DailyMediaManager.prototype.connect = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var _this = this;
          return $22ece045290c996a$var$__generator(this, function(_a2) {
            if (this._connected) {
              console.warn("DailyMediaManager already connected");
              return [
                2
                /*return*/
              ];
            }
            this._connected = true;
            if (!this._initialized) return [
              2,
              new Promise(function(resolve) {
                (function() {
                  return $22ece045290c996a$var$__awaiter(_this, void 0, void 0, function() {
                    return $22ece045290c996a$var$__generator(this, function(_a3) {
                      switch (_a3.label) {
                        case 0:
                          this._connectResolve = resolve;
                          return [
                            4,
                            this.initialize()
                          ];
                        case 1:
                          _a3.sent();
                          return [
                            2
                            /*return*/
                          ];
                      }
                    });
                  });
                })();
              })
            ];
            if (this._micEnabled) this._startRecording();
            return [
              2
              /*return*/
            ];
          });
        });
      };
      DailyMediaManager.prototype.disconnect = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var _a2, _b;
          return $22ece045290c996a$var$__generator(this, function(_c2) {
            switch (_c2.label) {
              case 0:
                if (this._remoteAudioLevelInterval) clearInterval(this._remoteAudioLevelInterval);
                this._remoteAudioLevelInterval = null;
                this._daily.leave();
                this._currentAudioTrack = null;
                return [
                  4,
                  (_a2 = this._mediaStreamRecorder) === null || _a2 === void 0 ? void 0 : _a2.end()
                ];
              case 1:
                _c2.sent();
                (_b = this._wavStreamPlayer) === null || _b === void 0 || _b.interrupt();
                this._initialized = false;
                this._connected = false;
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      DailyMediaManager.prototype.userStartedSpeaking = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var _a2;
          return $22ece045290c996a$var$__generator(this, function(_b) {
            return [
              2,
              (_a2 = this._wavStreamPlayer) === null || _a2 === void 0 ? void 0 : _a2.interrupt()
            ];
          });
        });
      };
      DailyMediaManager.prototype.bufferBotAudio = function(data, id) {
        var _a2;
        return (_a2 = this._wavStreamPlayer) === null || _a2 === void 0 ? void 0 : _a2.add16BitPCM(data, id);
      };
      DailyMediaManager.prototype.getAllMics = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var devices;
          return $22ece045290c996a$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [
                  4,
                  this._daily.enumerateDevices()
                ];
              case 1:
                devices = _a2.sent().devices;
                return [
                  2,
                  devices.filter(function(device) {
                    return device.kind === "audioinput";
                  })
                ];
            }
          });
        });
      };
      DailyMediaManager.prototype.getAllCams = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var devices;
          return $22ece045290c996a$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [
                  4,
                  this._daily.enumerateDevices()
                ];
              case 1:
                devices = _a2.sent().devices;
                return [
                  2,
                  devices.filter(function(device) {
                    return device.kind === "videoinput";
                  })
                ];
            }
          });
        });
      };
      DailyMediaManager.prototype.getAllSpeakers = function() {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var devices;
          return $22ece045290c996a$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [
                  4,
                  this._daily.enumerateDevices()
                ];
              case 1:
                devices = _a2.sent().devices;
                return [
                  2,
                  devices.filter(function(device) {
                    return device.kind === "audiooutput";
                  })
                ];
            }
          });
        });
      };
      DailyMediaManager.prototype.updateMic = function(micId) {
        var _this = this;
        this._daily.setInputDevicesAsync({
          audioDeviceId: micId
        }).then(function(deviceInfo) {
          _this._selectedMic = deviceInfo.mic;
        });
      };
      DailyMediaManager.prototype.updateCam = function(camId) {
        var _this = this;
        this._daily.setInputDevicesAsync({
          videoDeviceId: camId
        }).then(function(deviceInfo) {
          _this._selectedCam = deviceInfo.camera;
        });
      };
      DailyMediaManager.prototype.updateSpeaker = function(speakerId) {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var dInfo, e_1, sID, speakers, defaultSpeaker_1, defaultSpeakerCp;
          var _this = this;
          var _a2, _b, _c2, _d;
          return $22ece045290c996a$var$__generator(this, function(_e2) {
            switch (_e2.label) {
              case 0:
                if (!!this._wavStreamPlayer) return [
                  3,
                  5
                ];
                _e2.label = 1;
              case 1:
                _e2.trys.push([
                  1,
                  3,
                  ,
                  4
                ]);
                return [
                  4,
                  this._daily.setOutputDeviceAsync({
                    outputDeviceId: speakerId
                  })
                ];
              case 2:
                dInfo = _e2.sent();
                this._selectedSpeaker = dInfo.speaker;
                (_b = (_a2 = this._callbacks).onSpeakerUpdated) === null || _b === void 0 || _b.call(_a2, this._selectedSpeaker);
                return [
                  3,
                  4
                ];
              case 3:
                e_1 = _e2.sent();
                console.error("Error setting output device", e_1);
                return [
                  3,
                  4
                ];
              case 4:
                return [
                  2
                  /*return*/
                ];
              case 5:
                if (speakerId !== "default" && this._selectedSpeaker.deviceId === speakerId) return [
                  2
                  /*return*/
                ];
                sID = speakerId;
                if (!(sID === "default")) return [
                  3,
                  7
                ];
                return [
                  4,
                  this.getAllSpeakers()
                ];
              case 6:
                speakers = _e2.sent();
                defaultSpeaker_1 = speakers.find(function(s2) {
                  return s2.deviceId === "default";
                });
                if (!defaultSpeaker_1) {
                  console.warn("No default speaker found");
                  return [
                    2
                    /*return*/
                  ];
                }
                speakers.splice(speakers.indexOf(defaultSpeaker_1), 1);
                defaultSpeakerCp = speakers.find(function(s2) {
                  return defaultSpeaker_1.label.includes(s2.label);
                });
                sID = (_c2 = defaultSpeakerCp === null || defaultSpeakerCp === void 0 ? void 0 : defaultSpeakerCp.deviceId) !== null && _c2 !== void 0 ? _c2 : speakerId;
                _e2.label = 7;
              case 7:
                (_d = this._wavStreamPlayer) === null || _d === void 0 || _d.updateSpeaker(sID).then(function() {
                  var _a3, _b2;
                  _this._selectedSpeaker = {
                    deviceId: speakerId
                  };
                  (_b2 = (_a3 = _this._callbacks).onSpeakerUpdated) === null || _b2 === void 0 || _b2.call(_a3, _this._selectedSpeaker);
                });
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      Object.defineProperty(DailyMediaManager.prototype, "selectedMic", {
        get: function() {
          return this._selectedMic;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(DailyMediaManager.prototype, "selectedCam", {
        get: function() {
          return this._selectedCam;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(DailyMediaManager.prototype, "selectedSpeaker", {
        get: function() {
          return this._selectedSpeaker;
        },
        enumerable: false,
        configurable: true
      });
      DailyMediaManager.prototype.enableMic = function(enable) {
        return $22ece045290c996a$var$__awaiter(this, void 0, Promise, function() {
          var _a2;
          return $22ece045290c996a$var$__generator(this, function(_b) {
            this._micEnabled = enable;
            if (!((_a2 = this._daily.participants()) === null || _a2 === void 0 ? void 0 : _a2.local)) return [
              2
              /*return*/
            ];
            this._daily.setLocalAudio(enable);
            if (this._mediaStreamRecorder) {
              if (enable) {
                if (this._mediaStreamRecorder.getStatus() === "paused") this._startRecording();
              } else if (this._mediaStreamRecorder.getStatus() === "recording") this._mediaStreamRecorder.pause();
            }
            return [
              2
              /*return*/
            ];
          });
        });
      };
      DailyMediaManager.prototype.enableCam = function(enable) {
        this._camEnabled = enable;
        this._daily.setLocalVideo(enable);
      };
      DailyMediaManager.prototype.enableScreenShare = function(enable) {
        if (enable) this._daily.startScreenShare();
        else this._daily.stopScreenShare();
      };
      Object.defineProperty(DailyMediaManager.prototype, "isCamEnabled", {
        get: function() {
          return this._daily.localVideo();
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(DailyMediaManager.prototype, "isMicEnabled", {
        get: function() {
          return this._daily.localAudio();
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(DailyMediaManager.prototype, "isSharingScreen", {
        get: function() {
          return this._daily.localScreenAudio() || this._daily.localScreenVideo();
        },
        enumerable: false,
        configurable: true
      });
      DailyMediaManager.prototype.tracks = function() {
        var _a2, _b, _c2, _d, _e2, _f, _g, _h, _j, _k, _l, _m;
        var participants = this._daily.participants();
        return {
          local: {
            audio: (_c2 = (_b = (_a2 = participants === null || participants === void 0 ? void 0 : participants.local) === null || _a2 === void 0 ? void 0 : _a2.tracks) === null || _b === void 0 ? void 0 : _b.audio) === null || _c2 === void 0 ? void 0 : _c2.persistentTrack,
            screenAudio: (_f = (_e2 = (_d = participants === null || participants === void 0 ? void 0 : participants.local) === null || _d === void 0 ? void 0 : _d.tracks) === null || _e2 === void 0 ? void 0 : _e2.screenAudio) === null || _f === void 0 ? void 0 : _f.persistentTrack,
            screenVideo: (_j = (_h = (_g = participants === null || participants === void 0 ? void 0 : participants.local) === null || _g === void 0 ? void 0 : _g.tracks) === null || _h === void 0 ? void 0 : _h.screenVideo) === null || _j === void 0 ? void 0 : _j.persistentTrack,
            video: (_m = (_l = (_k = participants === null || participants === void 0 ? void 0 : participants.local) === null || _k === void 0 ? void 0 : _k.tracks) === null || _l === void 0 ? void 0 : _l.video) === null || _m === void 0 ? void 0 : _m.persistentTrack
          }
        };
      };
      DailyMediaManager.prototype._startRecording = function() {
        var _this = this;
        if (!this._connected || !this._mediaStreamRecorder) return;
        try {
          this._mediaStreamRecorder.record(function(data) {
            _this._userAudioCallback(data.mono);
          }, this._recorderChunkSize);
        } catch (e2) {
          var err = e2;
          if (!err.message.includes("Already recording")) console.error("Error starting recording", e2);
        }
      };
      DailyMediaManager.prototype._handleAvailableDevicesUpdated = function(event) {
        var _a2, _b, _c2, _d, _e2, _f;
        (_b = (_a2 = this._callbacks).onAvailableCamsUpdated) === null || _b === void 0 || _b.call(_a2, event.availableDevices.filter(function(d2) {
          return d2.kind === "videoinput";
        }));
        (_d = (_c2 = this._callbacks).onAvailableMicsUpdated) === null || _d === void 0 || _d.call(_c2, event.availableDevices.filter(function(d2) {
          return d2.kind === "audioinput";
        }));
        (_f = (_e2 = this._callbacks).onAvailableSpeakersUpdated) === null || _f === void 0 || _f.call(_e2, event.availableDevices.filter(function(d2) {
          return d2.kind === "audiooutput";
        }));
        if (this._selectedSpeaker.deviceId === "default") this.updateSpeaker("default");
      };
      DailyMediaManager.prototype._handleSelectedDevicesUpdated = function(event) {
        var _a2, _b, _c2, _d, _e2, _f;
        if (((_a2 = this._selectedCam) === null || _a2 === void 0 ? void 0 : _a2.deviceId) !== event.devices.camera) {
          this._selectedCam = event.devices.camera;
          (_c2 = (_b = this._callbacks).onCamUpdated) === null || _c2 === void 0 || _c2.call(_b, event.devices.camera);
        }
        if (((_d = this._selectedMic) === null || _d === void 0 ? void 0 : _d.deviceId) !== event.devices.mic) {
          this._selectedMic = event.devices.mic;
          (_f = (_e2 = this._callbacks).onMicUpdated) === null || _f === void 0 || _f.call(_e2, event.devices.mic);
        }
      };
      DailyMediaManager.prototype.handleDeviceError = function(ev) {
        var _a2, _b;
        var generateDeviceError = function(error) {
          var devices = [];
          switch (error.type) {
            case "permissions":
              error.blockedMedia.forEach(function(d2) {
                devices.push(d2 === "video" ? "cam" : "mic");
              });
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, error.type, error.msg, {
                blockedBy: error.blockedBy
              });
            case "not-found":
              error.missingMedia.forEach(function(d2) {
                devices.push(d2 === "video" ? "cam" : "mic");
              });
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, error.type, error.msg);
            case "constraints":
              error.failedMedia.forEach(function(d2) {
                devices.push(d2 === "video" ? "cam" : "mic");
              });
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, error.type, error.msg, {
                reason: error.reason
              });
            case "cam-in-use":
              devices.push("cam");
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, "in-use", error.msg);
            case "mic-in-use":
              devices.push("mic");
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, "in-use", error.msg);
            case "cam-mic-in-use":
              devices.push("cam");
              devices.push("mic");
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, "in-use", error.msg);
            case "undefined-mediadevices":
            case "unknown":
            default:
              devices.push("cam");
              devices.push("mic");
              return new (0, $db6391dc7d757577$export$64c9f614187c1e59)(devices, error.type, error.msg);
          }
        };
        (_b = (_a2 = this._callbacks).onDeviceError) === null || _b === void 0 || _b.call(_a2, generateDeviceError(ev.error));
      };
      DailyMediaManager.prototype._handleLocalAudioLevel = function(ev) {
        var _a2, _b;
        (_b = (_a2 = this._callbacks).onLocalAudioLevel) === null || _b === void 0 || _b.call(_a2, ev.audioLevel);
      };
      DailyMediaManager.prototype._handleRemoteAudioLevel = function(audioLevel) {
        var _a2, _b;
        (_b = (_a2 = this._callbacks).onRemoteAudioLevel) === null || _b === void 0 || _b.call(_a2, audioLevel, $22ece045290c996a$var$botParticipant());
      };
      DailyMediaManager.prototype.handleTrackStarted = function(event) {
        return $22ece045290c996a$var$__awaiter(this, void 0, void 0, function() {
          var status, _a2, e_2, e_3;
          var _b, _c2, _d, _e2;
          return $22ece045290c996a$var$__generator(this, function(_f) {
            switch (_f.label) {
              case 0:
                if (!((_b = event.participant) === null || _b === void 0 ? void 0 : _b.local)) return [
                  2
                  /*return*/
                ];
                if (!(event.track.kind === "audio")) return [
                  3,
                  15
                ];
                if (!this._mediaStreamRecorder) return [
                  3,
                  14
                ];
                status = this._mediaStreamRecorder.getStatus();
                _a2 = status;
                switch (_a2) {
                  case "ended":
                    return [
                      3,
                      1
                    ];
                  case "paused":
                    return [
                      3,
                      5
                    ];
                  case "recording":
                    return [
                      3,
                      6
                    ];
                }
                return [
                  3,
                  6
                ];
              case 1:
                _f.trys.push([
                  1,
                  3,
                  ,
                  4
                ]);
                return [
                  4,
                  this._mediaStreamRecorder.begin(event.track)
                ];
              case 2:
                _f.sent();
                if (this._connected) {
                  this._startRecording();
                  if (this._connectResolve) {
                    this._connectResolve();
                    this._connectResolve = null;
                  }
                }
                return [
                  3,
                  4
                ];
              case 3:
                e_2 = _f.sent();
                return [
                  3,
                  4
                ];
              case 4:
                return [
                  3,
                  14
                ];
              case 5:
                this._startRecording();
                return [
                  3,
                  14
                ];
              case 6:
                if (!(this._currentAudioTrack !== event.track)) return [
                  3,
                  12
                ];
                return [
                  4,
                  this._mediaStreamRecorder.end()
                ];
              case 7:
                _f.sent();
                _f.label = 8;
              case 8:
                _f.trys.push([
                  8,
                  10,
                  ,
                  11
                ]);
                return [
                  4,
                  this._mediaStreamRecorder.begin(event.track)
                ];
              case 9:
                _f.sent();
                this._startRecording();
                return [
                  3,
                  11
                ];
              case 10:
                e_3 = _f.sent();
                return [
                  3,
                  11
                ];
              case 11:
                return [
                  3,
                  13
                ];
              case 12:
                console.warn("track-started event received for current track and already recording");
                _f.label = 13;
              case 13:
                return [
                  3,
                  14
                ];
              case 14:
                this._currentAudioTrack = event.track;
                _f.label = 15;
              case 15:
                (_d = (_c2 = this._callbacks).onTrackStarted) === null || _d === void 0 || _d.call(_c2, event.track, event.participant ? $22ece045290c996a$var$dailyParticipantToParticipant(event.participant) : void 0);
                (_e2 = this.onTrackStartedCallback) === null || _e2 === void 0 || _e2.call(this, event);
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      DailyMediaManager.prototype.handleTrackStopped = function(event) {
        var _a2, _b, _c2, _d;
        if (!((_a2 = event.participant) === null || _a2 === void 0 ? void 0 : _a2.local)) return;
        if (event.track.kind === "audio") {
          if (this._mediaStreamRecorder && this._mediaStreamRecorder.getStatus() === "recording") this._mediaStreamRecorder.pause();
        }
        (_c2 = (_b = this._callbacks).onTrackStopped) === null || _c2 === void 0 || _c2.call(_b, event.track, event.participant ? $22ece045290c996a$var$dailyParticipantToParticipant(event.participant) : void 0);
        (_d = this.onTrackStoppedCallback) === null || _d === void 0 || _d.call(this, event);
      };
      return DailyMediaManager;
    })((0, $fc49a56cd8739127$export$4a0c46dbbe2ddb67))
  );
  var $22ece045290c996a$var$dailyParticipantToParticipant = function(p2) {
    return {
      id: p2.user_id,
      local: p2.local,
      name: p2.user_name
    };
  };
  var $22ece045290c996a$var$botParticipant = function() {
    return {
      id: "bot",
      local: false,
      name: "Bot"
    };
  };
  var $032380dbcf3f4e13$var$__extends = /* @__PURE__ */ (function() {
    var extendStatics = function(d2, b2) {
      extendStatics = Object.setPrototypeOf || {
        __proto__: []
      } instanceof Array && function(d3, b3) {
        d3.__proto__ = b3;
      } || function(d3, b3) {
        for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
      };
      return extendStatics(d2, b2);
    };
    return function(d2, b2) {
      if (typeof b2 !== "function" && b2 !== null) throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
      extendStatics(d2, b2);
      function __() {
        this.constructor = d2;
      }
      d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
    };
  })();
  var $032380dbcf3f4e13$var$__awaiter = function(thisArg, _arguments, P2, generator) {
    function adopt(value) {
      return value instanceof P2 ? value : new P2(function(resolve) {
        resolve(value);
      });
    }
    return new (P2 || (P2 = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e2) {
          reject(e2);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e2) {
          reject(e2);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var $032380dbcf3f4e13$var$__generator = function(thisArg, body) {
    var _2 = {
      label: 0,
      sent: function() {
        if (t2[0] & 1) throw t2[1];
        return t2[1];
      },
      trys: [],
      ops: []
    }, f2, y2, t2, g2 = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g2.next = verb(0), g2["throw"] = verb(1), g2["return"] = verb(2), typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
      return this;
    }), g2;
    function verb(n2) {
      return function(v2) {
        return step([
          n2,
          v2
        ]);
      };
    }
    function step(op) {
      if (f2) throw new TypeError("Generator is already executing.");
      while (g2 && (g2 = 0, op[0] && (_2 = 0)), _2) try {
        if (f2 = 1, y2 && (t2 = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t2 = y2["return"]) && t2.call(y2), 0) : y2.next) && !(t2 = t2.call(y2, op[1])).done) return t2;
        if (y2 = 0, t2) op = [
          op[0] & 2,
          t2.value
        ];
        switch (op[0]) {
          case 0:
          case 1:
            t2 = op;
            break;
          case 4:
            _2.label++;
            return {
              value: op[1],
              done: false
            };
          case 5:
            _2.label++;
            y2 = op[1];
            op = [
              0
            ];
            continue;
          case 7:
            op = _2.ops.pop();
            _2.trys.pop();
            continue;
          default:
            if (!(t2 = _2.trys, t2 = t2.length > 0 && t2[t2.length - 1]) && (op[0] === 6 || op[0] === 2)) {
              _2 = 0;
              continue;
            }
            if (op[0] === 3 && (!t2 || op[1] > t2[0] && op[1] < t2[3])) {
              _2.label = op[1];
              break;
            }
            if (op[0] === 6 && _2.label < t2[1]) {
              _2.label = t2[1];
              t2 = op;
              break;
            }
            if (t2 && _2.label < t2[2]) {
              _2.label = t2[2];
              _2.ops.push(op);
              break;
            }
            if (t2[2]) _2.ops.pop();
            _2.trys.pop();
            continue;
        }
        op = body.call(thisArg, _2);
      } catch (e2) {
        op = [
          6,
          e2
        ];
        y2 = 0;
      } finally {
        f2 = t2 = 0;
      }
      if (op[0] & 5) throw op[1];
      return {
        value: op[0] ? op[1] : void 0,
        done: true
      };
    }
  };
  var $032380dbcf3f4e13$var$__spreadArray = function(to2, from, pack) {
    if (pack || arguments.length === 2) {
      for (var i2 = 0, l2 = from.length, ar2; i2 < l2; i2++) if (ar2 || !(i2 in from)) {
        if (!ar2) ar2 = Array.prototype.slice.call(from, 0, i2);
        ar2[i2] = from[i2];
      }
    }
    return to2.concat(ar2 || Array.prototype.slice.call(from));
  };
  var $032380dbcf3f4e13$var$readyStates = [
    "CONNECTING",
    "OPEN",
    "CLOSING",
    "CLOSED"
  ];
  var $032380dbcf3f4e13$var$KEEP_ALIVE_INTERVAL = 5e3;
  var $032380dbcf3f4e13$var$KEEP_ALIVE_TIMEOUT = 15e3;
  var $032380dbcf3f4e13$var$WEBSOCKET_CONNECTION_TIMEOUT = 15e4;
  var $032380dbcf3f4e13$var$DEFAULT_RECONNECT_ATTEMPTS = 2;
  var $032380dbcf3f4e13$var$MAX_RECONNECT_ATTEMPTS = 10;
  var $032380dbcf3f4e13$var$DEFAULT_RECONNECT_INTERVAL = 1e3;
  var $032380dbcf3f4e13$var$MAX_RECONNECT_INTERVAL = 3e4;
  var $032380dbcf3f4e13$var$DEFAULT_RECONNECT_DECAY = 1.5;
  var $032380dbcf3f4e13$var$WEBSOCKET_TIMEOUT_CODE = 4100;
  var $032380dbcf3f4e13$var$SIG_CONNECTION_CANCELED = "SIG_CONNECTION_CANCELED";
  var $032380dbcf3f4e13$var$WEBSOCKET_ERROR = "WEBSOCKET_ERROR";
  var $032380dbcf3f4e13$var$LOG_LEVEL;
  (function(LOG_LEVEL) {
    LOG_LEVEL[LOG_LEVEL["DEBUG"] = 0] = "DEBUG";
    LOG_LEVEL[LOG_LEVEL["ERROR"] = 1] = "ERROR";
    LOG_LEVEL[LOG_LEVEL["INFO"] = 2] = "INFO";
    LOG_LEVEL[LOG_LEVEL["WARN"] = 3] = "WARN";
  })($032380dbcf3f4e13$var$LOG_LEVEL || ($032380dbcf3f4e13$var$LOG_LEVEL = {}));
  var $032380dbcf3f4e13$var$rWebSocket = (
    /** @class */
    (function() {
      function rWebSocket(url, protocols) {
        this._closedManually = false;
        this._errored = false;
        this._rejected = false;
        this._timed_out = false;
        this._initialConnectionOk = false;
        this._ws = new WebSocket(url, protocols);
      }
      rWebSocket.prototype.addEventListener = function(type, listener) {
        this._ws.addEventListener(type, listener);
      };
      rWebSocket.prototype.close = function(code, reason) {
        this._ws.close(code, reason);
      };
      rWebSocket.prototype.send = function(data) {
        this._ws.send(data);
      };
      Object.defineProperty(rWebSocket.prototype, "url", {
        // Add getters for WebSocket properties
        get: function() {
          return this._ws.url;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(rWebSocket.prototype, "readyState", {
        get: function() {
          return this._ws.readyState;
        },
        enumerable: false,
        configurable: true
      });
      return rWebSocket;
    })()
  );
  var $032380dbcf3f4e13$export$4f3d0ffd941ebefb = (
    /** @class */
    (function(_super) {
      $032380dbcf3f4e13$var$__extends(ReconnectingWebSocket, _super);
      function ReconnectingWebSocket(address, protocols, options) {
        if (options === void 0) options = {};
        var _a2;
        var _this = _super.call(this) || this;
        if (!address) throw new Error("Need a valid WebSocket URL");
        _this._ws = null;
        _this._url = address;
        _this._protocols = protocols;
        _this._parseBlobToJson = (_a2 = options === null || options === void 0 ? void 0 : options.parseBlobToJson) !== null && _a2 !== void 0 ? _a2 : true;
        _this.init();
        return _this;
      }
      ReconnectingWebSocket.prototype.init = function() {
        this._keepAliveTimeout = $032380dbcf3f4e13$var$KEEP_ALIVE_TIMEOUT;
        this._keepAliveInterval = $032380dbcf3f4e13$var$KEEP_ALIVE_INTERVAL;
        this._disconnected = false;
        this._keepIntervalID = null;
        this._shouldRetryFn = null;
        this._connectionTimeout = $032380dbcf3f4e13$var$WEBSOCKET_CONNECTION_TIMEOUT;
        this._reconnectAttempts = 0;
        this._allowedReconnectAttempts = $032380dbcf3f4e13$var$DEFAULT_RECONNECT_ATTEMPTS;
        this._reconnectInterval = $032380dbcf3f4e13$var$DEFAULT_RECONNECT_INTERVAL;
        this._maxReconnectInterval = $032380dbcf3f4e13$var$MAX_RECONNECT_INTERVAL;
        this._reconnectDecay = $032380dbcf3f4e13$var$DEFAULT_RECONNECT_DECAY;
      };
      ReconnectingWebSocket.prototype.connect = function() {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          var _this = this;
          return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
            return [
              2,
              new Promise(function(resolve, reject) {
                _this._disconnected = false;
                _this.clearReconnectTimeout();
                var ws2 = new $032380dbcf3f4e13$var$rWebSocket(_this._url, _this._protocols);
                _this.setConnectionTimeout();
                ws2.addEventListener("close", function(evt) {
                  var closeEvent = evt;
                  var code = ws2._timed_out ? $032380dbcf3f4e13$var$WEBSOCKET_TIMEOUT_CODE : closeEvent.code;
                  var reason = ws2._timed_out ? "websocket connection timed out" : closeEvent.reason;
                  ws2._timed_out = false;
                  if (!ws2._closedManually && ws2._initialConnectionOk) {
                    console.warn("signaling socket closed unexpectedly: ".concat(code).concat(reason ? " " + reason : ""));
                    _this._closeSocket();
                    _this.emit("close", code, reason);
                  } else _this.log("signaling socket closed");
                  if (!ws2._closedManually && (ws2._errored || ws2._timed_out)) {
                    console.warn("signaling socket closed on error: ".concat(code).concat(reason ? " " + reason : ""));
                    if (!ws2._rejected) {
                      ws2._rejected = true;
                      var err = new Error("WebSocket connection error (".concat(code, "): ").concat(reason));
                      err.name = $032380dbcf3f4e13$var$WEBSOCKET_ERROR;
                      reject(err);
                    }
                  }
                });
                ws2.addEventListener("open", function(evt) {
                  _this.log("wss connection opened to", $032380dbcf3f4e13$var$LOG_LEVEL.DEBUG, _this._url);
                  _this.clearConnectionTimeout();
                  if (ws2._rejected || ws2._timed_out) return;
                  if (ws2._closedManually || _this._ws && _this._ws !== ws2) {
                    ws2._rejected = true;
                    ws2.close();
                    var err = Error("wss connection interrupted by disconnect or newer connection");
                    err.name = $032380dbcf3f4e13$var$SIG_CONNECTION_CANCELED;
                    reject(err);
                    return;
                  }
                  ws2._initialConnectionOk = _this._url;
                  _this._lastMsgRecvTime = Date.now();
                  if (_this._keepAliveInterval) _this._keepIntervalID = setInterval(function() {
                    return _this.checkSocketHealthAndSendKeepAlive();
                  }, _this._keepAliveInterval);
                  _this._ws = ws2;
                  _this.emit("open");
                  resolve(ws2);
                });
                ws2.addEventListener("error", function(evt) {
                  if (!ws2._closedManually) {
                    var wsTarget = evt.currentTarget;
                    _this.log("websocket error event: ".concat(wsTarget === null || wsTarget === void 0 ? void 0 : wsTarget.url));
                  }
                  ws2._errored = true;
                });
                ws2.addEventListener("message", function(msg) {
                  _this._handleMessage(msg);
                });
              })
            ];
          });
        });
      };
      ReconnectingWebSocket.prototype.setConnectionTimeout = function() {
        var _this = this;
        this._connectionTimeoutID = setTimeout(function() {
          return $032380dbcf3f4e13$var$__awaiter(_this, void 0, void 0, function() {
            return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
              switch (_a2.label) {
                case 0:
                  this.log("Connection reconnect attempt timed out.");
                  this.emit("connection-timeout");
                  this.clearConnectionTimeout();
                  return [
                    4,
                    this._closeSocket()
                  ];
                case 1:
                  _a2.sent();
                  return [
                    2
                    /*return*/
                  ];
              }
            });
          });
        }, this._connectionTimeout);
      };
      ReconnectingWebSocket.prototype.clearConnectionTimeout = function() {
        clearTimeout(this._connectionTimeoutID);
        this._connectionTimeoutID = void 0;
      };
      ReconnectingWebSocket.prototype.clearReconnectTimeout = function() {
        clearTimeout(this._reconnectTimeoutID);
        this._reconnectTimeoutID = void 0;
      };
      ReconnectingWebSocket.prototype.clearKeepAliveInterval = function() {
        if (this._keepIntervalID) {
          clearInterval(this._keepIntervalID);
          this._keepIntervalID = null;
        }
      };
      ReconnectingWebSocket.prototype.checkSocketHealthAndSendKeepAlive = function() {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                if (!(this._ws && this._ws.readyState === WebSocket.OPEN)) return [
                  2
                  /*return*/
                ];
                if (!this._keepAliveTimeout || !this._keepAliveInterval) return [
                  2
                  /*return*/
                ];
                if (!(Date.now() - this._lastMsgRecvTime > this._keepAliveTimeout)) return [
                  3,
                  2
                ];
                this.log("Connection is stale, need to reconnect", $032380dbcf3f4e13$var$LOG_LEVEL.WARN);
                return [
                  4,
                  this._closeSocket()
                ];
              case 1:
                _a2.sent();
                return [
                  2
                  /*return*/
                ];
              case 2:
                if (Date.now() - this._lastMsgSendTime < this._keepAliveInterval) return [
                  2
                  /*return*/
                ];
                this.log("Emitting keep-alive", $032380dbcf3f4e13$var$LOG_LEVEL.DEBUG);
                this.emit("keep-alive");
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      ReconnectingWebSocket.prototype._closeSocket = function() {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          var shouldRetry, error_1;
          var _a2;
          return $032380dbcf3f4e13$var$__generator(this, function(_b) {
            switch (_b.label) {
              case 0:
                this.log("Closing");
                _b.label = 1;
              case 1:
                _b.trys.push([
                  1,
                  4,
                  ,
                  5
                ]);
                this.clearKeepAliveInterval();
                this._lastMsgRecvTime = 0;
                if (this._ws) {
                  this._ws._closedManually = true;
                  this._ws.close();
                }
                shouldRetry = ((_a2 = this._ws) === null || _a2 === void 0 ? void 0 : _a2._initialConnectionOk) && this._shouldRetryFn && this._shouldRetryFn();
                this._ws = null;
                if (!shouldRetry) return [
                  3,
                  3
                ];
                this.log("Emitting reconnect", $032380dbcf3f4e13$var$LOG_LEVEL.DEBUG);
                this.emit("reconnecting");
                return [
                  4,
                  this.retryFailedConnection()
                ];
              case 2:
                _b.sent();
                _b.label = 3;
              case 3:
                return [
                  3,
                  5
                ];
              case 4:
                error_1 = _b.sent();
                this.log("Error while closing and retrying: ".concat(error_1), $032380dbcf3f4e13$var$LOG_LEVEL.ERROR);
                return [
                  3,
                  5
                ];
              case 5:
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      ReconnectingWebSocket.prototype.retryFailedConnection = function() {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          var timeout;
          var _this = this;
          return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
            if (this._reconnectAttempts < this._allowedReconnectAttempts) {
              if (this._reconnectTimeoutID) {
                this.log("Retry already scheduled");
                return [
                  2
                  /*return*/
                ];
              }
              this.log("Retrying failed connection");
              timeout = // The timeout logic is taken from
              // https://github.com/joewalnes/reconnecting-websocket
              this._reconnectInterval * Math.pow(this._reconnectDecay, this._reconnectAttempts);
              timeout = timeout > this._maxReconnectInterval ? this._maxReconnectInterval : timeout;
              this.log("Reconnecting in ".concat(timeout / 1e3, " seconds"));
              this._reconnectAttempts += 1;
              this._reconnectTimeoutID = setTimeout(function() {
                return _this.connect();
              }, timeout);
            } else {
              this.log("Maximum connection retry attempts exceeded", $032380dbcf3f4e13$var$LOG_LEVEL.ERROR);
              this.emit("reconnect-failed");
            }
            return [
              2
              /*return*/
            ];
          });
        });
      };
      ReconnectingWebSocket.prototype.log = function(msg, log_level) {
        if (log_level === void 0) log_level = $032380dbcf3f4e13$var$LOG_LEVEL.DEBUG;
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) args[_i - 2] = arguments[_i];
        switch (log_level) {
          case $032380dbcf3f4e13$var$LOG_LEVEL.DEBUG:
            console.debug.apply(console, $032380dbcf3f4e13$var$__spreadArray([
              "websocket: ".concat(msg)
            ], args, false));
            break;
          case $032380dbcf3f4e13$var$LOG_LEVEL.ERROR:
            console.error.apply(console, $032380dbcf3f4e13$var$__spreadArray([
              "websocket: ".concat(msg)
            ], args, false));
            break;
          case $032380dbcf3f4e13$var$LOG_LEVEL.WARN:
            console.warn.apply(console, $032380dbcf3f4e13$var$__spreadArray([
              "websocket: ".concat(msg)
            ], args, false));
            break;
          case $032380dbcf3f4e13$var$LOG_LEVEL.INFO:
          default:
            console.log.apply(console, $032380dbcf3f4e13$var$__spreadArray([
              "websocket: ".concat(msg)
            ], args, false));
            break;
        }
      };
      ReconnectingWebSocket.prototype.send = function(data) {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
            try {
              if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                this._lastMsgSendTime = Date.now();
                this._ws.send(data);
              } else this.log("Failed to send data, web socket not open.", $032380dbcf3f4e13$var$LOG_LEVEL.ERROR);
            } catch (error) {
              this.log("Failed to send data. ".concat(error), $032380dbcf3f4e13$var$LOG_LEVEL.ERROR);
            }
            return [
              2
              /*return*/
            ];
          });
        });
      };
      ReconnectingWebSocket.prototype.close = function() {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
            try {
              this.log("Closing websocket");
              this._disconnected = true;
              this.clearReconnectTimeout();
              this._closeSocket();
            } catch (error) {
              this.log("Failed to close websocket. ".concat(error));
            }
            return [
              2
              /*return*/
            ];
          });
        });
      };
      Object.defineProperty(ReconnectingWebSocket.prototype, "readyState", {
        get: function() {
          var _a2, _b;
          return (_b = (_a2 = this._ws) === null || _a2 === void 0 ? void 0 : _a2.readyState) !== null && _b !== void 0 ? _b : WebSocket.CLOSED;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "url", {
        get: function() {
          return this._url;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "keepAliveTimeout", {
        get: function() {
          return this._keepAliveTimeout;
        },
        set: function(keepAliveTimeout) {
          if (typeof keepAliveTimeout === "number") {
            this.log("Setting ACK freshness timeout to ".concat(keepAliveTimeout));
            this._keepAliveTimeout = keepAliveTimeout;
          }
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "keepAliveInterval", {
        get: function() {
          return this._keepAliveInterval;
        },
        set: function(keepAliveInterval) {
          if (typeof keepAliveInterval === "number") {
            this.log("Setting keep-alive interval to ".concat(keepAliveInterval));
            this._keepAliveInterval = keepAliveInterval;
          }
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "shouldRetryFn", {
        set: function(cb) {
          if (typeof cb === "function") this._shouldRetryFn = cb;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "connectionTimeout", {
        get: function() {
          return this._connectionTimeout;
        },
        set: function(timeout) {
          if (typeof timeout === "number") this._connectionTimeout = timeout;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "maxReconnectAttempts", {
        get: function() {
          return this._allowedReconnectAttempts;
        },
        set: function(attempts) {
          if (attempts > 0 && attempts < $032380dbcf3f4e13$var$MAX_RECONNECT_ATTEMPTS) {
            this.log("Setting maximum connection retry attempts to ".concat(attempts));
            this._allowedReconnectAttempts = attempts;
          } else this._allowedReconnectAttempts = $032380dbcf3f4e13$var$DEFAULT_RECONNECT_ATTEMPTS;
        },
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(ReconnectingWebSocket.prototype, "reconnectInterval", {
        get: function() {
          return this._reconnectInterval;
        },
        set: function(interval) {
          if (typeof interval === "number") this._reconnectInterval = interval < this._maxReconnectInterval ? interval : this._maxReconnectInterval;
        },
        enumerable: false,
        configurable: true
      });
      ReconnectingWebSocket.prototype._handleMessage = function(event) {
        return $032380dbcf3f4e13$var$__awaiter(this, void 0, void 0, function() {
          var data, _parsePromise, msg;
          var _this = this;
          return $032380dbcf3f4e13$var$__generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                this._lastMsgRecvTime = Date.now();
                data = event.data;
                _parsePromise = new Promise(function(resolve, reject) {
                  if (typeof data === "string")
                    resolve(data);
                  else if (data instanceof ArrayBuffer) {
                    var arrayBuffer = data;
                    resolve(new Uint8Array(arrayBuffer));
                  } else if (data instanceof Blob) {
                    if (!_this._parseBlobToJson) {
                      resolve(data);
                      return;
                    }
                    var blob = data;
                    var reader_1 = new FileReader();
                    reader_1.onload = function() {
                      var text = reader_1.result;
                      try {
                        var json = JSON.parse(text);
                        resolve(json);
                      } catch (e2) {
                        console.error("Failed to parse JSON from Blob:", e2);
                      }
                    };
                    reader_1.readAsText(blob);
                  }
                });
                return [
                  4,
                  _parsePromise
                ];
              case 1:
                msg = _a2.sent();
                this.emit("message", msg);
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      };
      return ReconnectingWebSocket;
    })((0, import_events2.EventEmitter))
  );
  [
    "binaryType",
    "bufferedAmount",
    "extensions",
    "protocol",
    "readyState",
    "url",
    "keepAliveTimeout",
    "keepAliveInterval",
    "shouldRetryFn",
    "connectionTimeout",
    "maxReconnectAttempts",
    "reconnectInterval"
  ].forEach(function(property) {
    Object.defineProperty($032380dbcf3f4e13$export$4f3d0ffd941ebefb.prototype, property, {
      enumerable: true
    });
  });
  [
    "CONNECTING",
    "OPEN",
    "CLOSING",
    "CLOSED"
  ].forEach(function(property) {
    Object.defineProperty($032380dbcf3f4e13$export$4f3d0ffd941ebefb.prototype, property, {
      enumerable: true,
      value: $032380dbcf3f4e13$var$readyStates.indexOf(property)
    });
  });
  [
    "CONNECTING",
    "OPEN",
    "CLOSING",
    "CLOSED"
  ].forEach(function(property) {
    Object.defineProperty($032380dbcf3f4e13$export$4f3d0ffd941ebefb, property, {
      enumerable: true,
      value: $032380dbcf3f4e13$var$readyStates.indexOf(property)
    });
  });
  var $5177d56bd0c995e0$var$TextFrame$Type = class extends (0, MessageType) {
    constructor() {
      super("pipecat.TextFrame", [
        {
          no: 1,
          name: "id",
          kind: "scalar",
          T: 4,
          L: 0
          /*LongType.BIGINT*/
        },
        {
          no: 2,
          name: "name",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        },
        {
          no: 3,
          name: "text",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        }
      ]);
    }
    create(value) {
      const message = globalThis.Object.create(this.messagePrototype);
      message.id = 0n;
      message.name = "";
      message.text = "";
      if (value !== void 0) (0, reflectionMergePartial)(this, message, value);
      return message;
    }
    internalBinaryRead(reader, length, options, target) {
      let message = target ?? this.create(), end = reader.pos + length;
      while (reader.pos < end) {
        let [fieldNo, wireType] = reader.tag();
        switch (fieldNo) {
          case /* uint64 id */
          1:
            message.id = reader.uint64().toBigInt();
            break;
          case /* string name */
          2:
            message.name = reader.string();
            break;
          case /* string text */
          3:
            message.text = reader.string();
            break;
          default:
            let u2 = options.readUnknownField;
            if (u2 === "throw") throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
            let d2 = reader.skip(wireType);
            if (u2 !== false) (u2 === true ? (0, UnknownFieldHandler).onRead : u2)(this.typeName, message, fieldNo, wireType, d2);
        }
      }
      return message;
    }
    internalBinaryWrite(message, writer, options) {
      if (message.id !== 0n) writer.tag(1, (0, WireType).Varint).uint64(message.id);
      if (message.name !== "") writer.tag(2, (0, WireType).LengthDelimited).string(message.name);
      if (message.text !== "") writer.tag(3, (0, WireType).LengthDelimited).string(message.text);
      let u2 = options.writeUnknownFields;
      if (u2 !== false) (u2 == true ? (0, UnknownFieldHandler).onWrite : u2)(this.typeName, message, writer);
      return writer;
    }
  };
  var $5177d56bd0c995e0$export$78410ada03f6931b = new $5177d56bd0c995e0$var$TextFrame$Type();
  var $5177d56bd0c995e0$var$AudioRawFrame$Type = class extends (0, MessageType) {
    constructor() {
      super("pipecat.AudioRawFrame", [
        {
          no: 1,
          name: "id",
          kind: "scalar",
          T: 4,
          L: 0
          /*LongType.BIGINT*/
        },
        {
          no: 2,
          name: "name",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        },
        {
          no: 3,
          name: "audio",
          kind: "scalar",
          T: 12
          /*ScalarType.BYTES*/
        },
        {
          no: 4,
          name: "sample_rate",
          kind: "scalar",
          T: 13
          /*ScalarType.UINT32*/
        },
        {
          no: 5,
          name: "num_channels",
          kind: "scalar",
          T: 13
          /*ScalarType.UINT32*/
        },
        {
          no: 6,
          name: "pts",
          kind: "scalar",
          opt: true,
          T: 4,
          L: 0
          /*LongType.BIGINT*/
        }
      ]);
    }
    create(value) {
      const message = globalThis.Object.create(this.messagePrototype);
      message.id = 0n;
      message.name = "";
      message.audio = new Uint8Array(0);
      message.sampleRate = 0;
      message.numChannels = 0;
      if (value !== void 0) (0, reflectionMergePartial)(this, message, value);
      return message;
    }
    internalBinaryRead(reader, length, options, target) {
      let message = target ?? this.create(), end = reader.pos + length;
      while (reader.pos < end) {
        let [fieldNo, wireType] = reader.tag();
        switch (fieldNo) {
          case /* uint64 id */
          1:
            message.id = reader.uint64().toBigInt();
            break;
          case /* string name */
          2:
            message.name = reader.string();
            break;
          case /* bytes audio */
          3:
            message.audio = reader.bytes();
            break;
          case /* uint32 sample_rate */
          4:
            message.sampleRate = reader.uint32();
            break;
          case /* uint32 num_channels */
          5:
            message.numChannels = reader.uint32();
            break;
          case /* optional uint64 pts */
          6:
            message.pts = reader.uint64().toBigInt();
            break;
          default:
            let u2 = options.readUnknownField;
            if (u2 === "throw") throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
            let d2 = reader.skip(wireType);
            if (u2 !== false) (u2 === true ? (0, UnknownFieldHandler).onRead : u2)(this.typeName, message, fieldNo, wireType, d2);
        }
      }
      return message;
    }
    internalBinaryWrite(message, writer, options) {
      if (message.id !== 0n) writer.tag(1, (0, WireType).Varint).uint64(message.id);
      if (message.name !== "") writer.tag(2, (0, WireType).LengthDelimited).string(message.name);
      if (message.audio.length) writer.tag(3, (0, WireType).LengthDelimited).bytes(message.audio);
      if (message.sampleRate !== 0) writer.tag(4, (0, WireType).Varint).uint32(message.sampleRate);
      if (message.numChannels !== 0) writer.tag(5, (0, WireType).Varint).uint32(message.numChannels);
      if (message.pts !== void 0) writer.tag(6, (0, WireType).Varint).uint64(message.pts);
      let u2 = options.writeUnknownFields;
      if (u2 !== false) (u2 == true ? (0, UnknownFieldHandler).onWrite : u2)(this.typeName, message, writer);
      return writer;
    }
  };
  var $5177d56bd0c995e0$export$51d8721de3cbff8f = new $5177d56bd0c995e0$var$AudioRawFrame$Type();
  var $5177d56bd0c995e0$var$TranscriptionFrame$Type = class extends (0, MessageType) {
    constructor() {
      super("pipecat.TranscriptionFrame", [
        {
          no: 1,
          name: "id",
          kind: "scalar",
          T: 4,
          L: 0
          /*LongType.BIGINT*/
        },
        {
          no: 2,
          name: "name",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        },
        {
          no: 3,
          name: "text",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        },
        {
          no: 4,
          name: "user_id",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        },
        {
          no: 5,
          name: "timestamp",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        }
      ]);
    }
    create(value) {
      const message = globalThis.Object.create(this.messagePrototype);
      message.id = 0n;
      message.name = "";
      message.text = "";
      message.userId = "";
      message.timestamp = "";
      if (value !== void 0) (0, reflectionMergePartial)(this, message, value);
      return message;
    }
    internalBinaryRead(reader, length, options, target) {
      let message = target ?? this.create(), end = reader.pos + length;
      while (reader.pos < end) {
        let [fieldNo, wireType] = reader.tag();
        switch (fieldNo) {
          case /* uint64 id */
          1:
            message.id = reader.uint64().toBigInt();
            break;
          case /* string name */
          2:
            message.name = reader.string();
            break;
          case /* string text */
          3:
            message.text = reader.string();
            break;
          case /* string user_id */
          4:
            message.userId = reader.string();
            break;
          case /* string timestamp */
          5:
            message.timestamp = reader.string();
            break;
          default:
            let u2 = options.readUnknownField;
            if (u2 === "throw") throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
            let d2 = reader.skip(wireType);
            if (u2 !== false) (u2 === true ? (0, UnknownFieldHandler).onRead : u2)(this.typeName, message, fieldNo, wireType, d2);
        }
      }
      return message;
    }
    internalBinaryWrite(message, writer, options) {
      if (message.id !== 0n) writer.tag(1, (0, WireType).Varint).uint64(message.id);
      if (message.name !== "") writer.tag(2, (0, WireType).LengthDelimited).string(message.name);
      if (message.text !== "") writer.tag(3, (0, WireType).LengthDelimited).string(message.text);
      if (message.userId !== "") writer.tag(4, (0, WireType).LengthDelimited).string(message.userId);
      if (message.timestamp !== "") writer.tag(5, (0, WireType).LengthDelimited).string(message.timestamp);
      let u2 = options.writeUnknownFields;
      if (u2 !== false) (u2 == true ? (0, UnknownFieldHandler).onWrite : u2)(this.typeName, message, writer);
      return writer;
    }
  };
  var $5177d56bd0c995e0$export$10b388c15a5cdc8a = new $5177d56bd0c995e0$var$TranscriptionFrame$Type();
  var $5177d56bd0c995e0$var$MessageFrame$Type = class extends (0, MessageType) {
    constructor() {
      super("pipecat.MessageFrame", [
        {
          no: 1,
          name: "data",
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        }
      ]);
    }
    create(value) {
      const message = globalThis.Object.create(this.messagePrototype);
      message.data = "";
      if (value !== void 0) (0, reflectionMergePartial)(this, message, value);
      return message;
    }
    internalBinaryRead(reader, length, options, target) {
      let message = target ?? this.create(), end = reader.pos + length;
      while (reader.pos < end) {
        let [fieldNo, wireType] = reader.tag();
        switch (fieldNo) {
          case /* string data */
          1:
            message.data = reader.string();
            break;
          default:
            let u2 = options.readUnknownField;
            if (u2 === "throw") throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
            let d2 = reader.skip(wireType);
            if (u2 !== false) (u2 === true ? (0, UnknownFieldHandler).onRead : u2)(this.typeName, message, fieldNo, wireType, d2);
        }
      }
      return message;
    }
    internalBinaryWrite(message, writer, options) {
      if (message.data !== "") writer.tag(1, (0, WireType).LengthDelimited).string(message.data);
      let u2 = options.writeUnknownFields;
      if (u2 !== false) (u2 == true ? (0, UnknownFieldHandler).onWrite : u2)(this.typeName, message, writer);
      return writer;
    }
  };
  var $5177d56bd0c995e0$export$bc3f45a6d434f14a = new $5177d56bd0c995e0$var$MessageFrame$Type();
  var $5177d56bd0c995e0$var$Frame$Type = class extends (0, MessageType) {
    constructor() {
      super("pipecat.Frame", [
        {
          no: 1,
          name: "text",
          kind: "message",
          oneof: "frame",
          T: () => $5177d56bd0c995e0$export$78410ada03f6931b
        },
        {
          no: 2,
          name: "audio",
          kind: "message",
          oneof: "frame",
          T: () => $5177d56bd0c995e0$export$51d8721de3cbff8f
        },
        {
          no: 3,
          name: "transcription",
          kind: "message",
          oneof: "frame",
          T: () => $5177d56bd0c995e0$export$10b388c15a5cdc8a
        },
        {
          no: 4,
          name: "message",
          kind: "message",
          oneof: "frame",
          T: () => $5177d56bd0c995e0$export$bc3f45a6d434f14a
        }
      ]);
    }
    create(value) {
      const message = globalThis.Object.create(this.messagePrototype);
      message.frame = {
        oneofKind: void 0
      };
      if (value !== void 0) (0, reflectionMergePartial)(this, message, value);
      return message;
    }
    internalBinaryRead(reader, length, options, target) {
      let message = target ?? this.create(), end = reader.pos + length;
      while (reader.pos < end) {
        let [fieldNo, wireType] = reader.tag();
        switch (fieldNo) {
          case /* pipecat.TextFrame text */
          1:
            message.frame = {
              oneofKind: "text",
              text: $5177d56bd0c995e0$export$78410ada03f6931b.internalBinaryRead(reader, reader.uint32(), options, message.frame.text)
            };
            break;
          case /* pipecat.AudioRawFrame audio */
          2:
            message.frame = {
              oneofKind: "audio",
              audio: $5177d56bd0c995e0$export$51d8721de3cbff8f.internalBinaryRead(reader, reader.uint32(), options, message.frame.audio)
            };
            break;
          case /* pipecat.TranscriptionFrame transcription */
          3:
            message.frame = {
              oneofKind: "transcription",
              transcription: $5177d56bd0c995e0$export$10b388c15a5cdc8a.internalBinaryRead(reader, reader.uint32(), options, message.frame.transcription)
            };
            break;
          case /* pipecat.MessageFrame message */
          4:
            message.frame = {
              oneofKind: "message",
              message: $5177d56bd0c995e0$export$bc3f45a6d434f14a.internalBinaryRead(reader, reader.uint32(), options, message.frame.message)
            };
            break;
          default:
            let u2 = options.readUnknownField;
            if (u2 === "throw") throw new globalThis.Error(`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`);
            let d2 = reader.skip(wireType);
            if (u2 !== false) (u2 === true ? (0, UnknownFieldHandler).onRead : u2)(this.typeName, message, fieldNo, wireType, d2);
        }
      }
      return message;
    }
    internalBinaryWrite(message, writer, options) {
      if (message.frame.oneofKind === "text") $5177d56bd0c995e0$export$78410ada03f6931b.internalBinaryWrite(message.frame.text, writer.tag(1, (0, WireType).LengthDelimited).fork(), options).join();
      if (message.frame.oneofKind === "audio") $5177d56bd0c995e0$export$51d8721de3cbff8f.internalBinaryWrite(message.frame.audio, writer.tag(2, (0, WireType).LengthDelimited).fork(), options).join();
      if (message.frame.oneofKind === "transcription") $5177d56bd0c995e0$export$10b388c15a5cdc8a.internalBinaryWrite(message.frame.transcription, writer.tag(3, (0, WireType).LengthDelimited).fork(), options).join();
      if (message.frame.oneofKind === "message") $5177d56bd0c995e0$export$bc3f45a6d434f14a.internalBinaryWrite(message.frame.message, writer.tag(4, (0, WireType).LengthDelimited).fork(), options).join();
      let u2 = options.writeUnknownFields;
      if (u2 !== false) (u2 == true ? (0, UnknownFieldHandler).onWrite : u2)(this.typeName, message, writer);
      return writer;
    }
  };
  var $5177d56bd0c995e0$export$b89a827e9254211a = new $5177d56bd0c995e0$var$Frame$Type();
  var $a6c080dc51c9687f$export$4b2026f8e11b148a = class {
    serialize(data) {
    }
    serializeAudio(data, sampleRate, numChannels) {
      const pcmByteArray = new Uint8Array(data);
      const frame = (0, $5177d56bd0c995e0$export$b89a827e9254211a).create({
        frame: {
          oneofKind: "audio",
          audio: {
            id: 0n,
            name: "audio",
            audio: pcmByteArray,
            sampleRate,
            numChannels
          }
        }
      });
      return new Uint8Array((0, $5177d56bd0c995e0$export$b89a827e9254211a).toBinary(frame));
    }
    serializeMessage(msg) {
      const frame = (0, $5177d56bd0c995e0$export$b89a827e9254211a).create({
        frame: {
          oneofKind: "message",
          message: {
            data: JSON.stringify(msg)
          }
        }
      });
      return new Uint8Array((0, $5177d56bd0c995e0$export$b89a827e9254211a).toBinary(frame));
    }
    async deserialize(data) {
      if (!(data instanceof Blob)) throw new Error("Unknown data type");
      const arrayBuffer = await data.arrayBuffer();
      const parsed = (0, $5177d56bd0c995e0$export$b89a827e9254211a).fromBinary(new Uint8Array(arrayBuffer)).frame;
      if (parsed.oneofKind === "audio") {
        const audioVector = Array.from(parsed.audio.audio);
        const uint8Array = new Uint8Array(audioVector);
        const int16Array = new Int16Array(uint8Array.buffer);
        return {
          type: "audio",
          audio: int16Array
        };
      } else if (parsed.oneofKind === "message") {
        const msg = JSON.parse(parsed.message.data);
        return {
          type: "message",
          message: msg
        };
      } else throw new Error("Unknown frame kind");
    }
  };
  var $7f42eda74f1b1632$export$de21836fc42c6f9c = class _$7f42eda74f1b1632$export$de21836fc42c6f9c extends (0, $7ef5cee66c377f4d$export$86495b081fef8e52) {
    constructor(opts = {}) {
      super();
      this._wsUrl = null;
      this.audioQueue = [];
      this._wsUrl = opts.wsUrl ?? opts.ws_url ?? null;
      this._recorderSampleRate = opts.recorderSampleRate ?? _$7f42eda74f1b1632$export$de21836fc42c6f9c.RECORDER_SAMPLE_RATE;
      this._mediaManager = opts.mediaManager || new (0, $22ece045290c996a$export$c95c65abc5f47125)(true, true, void 0, void 0, 512, this._recorderSampleRate, opts.playerSampleRate ?? _$7f42eda74f1b1632$export$de21836fc42c6f9c.PLAYER_SAMPLE_RATE);
      this._mediaManager.setUserAudioCallback(this.handleUserAudioStream.bind(this));
      this._ws = null;
      this._serializer = opts.serializer || new (0, $a6c080dc51c9687f$export$4b2026f8e11b148a)();
      this._maxMessageSize = 1048576;
    }
    initialize(options, messageHandler) {
      this._options = options;
      this._callbacks = options.callbacks ?? {};
      this._onMessage = messageHandler;
      this._mediaManager.setClientOptions(options);
      this.state = "disconnected";
    }
    async initDevices() {
      this.state = "initializing";
      await this._mediaManager.initialize();
      this.state = "initialized";
    }
    _validateConnectionParams(connectParams) {
      if (connectParams === void 0 || connectParams === null) return void 0;
      if (typeof connectParams !== "object") throw new (0, $db6391dc7d757577$export$59b4786f333aac02)("Invalid connection parameters");
      const snakeToCamel = (snakeCaseString) => {
        return snakeCaseString.replace(/_([a-z,A-Z])/g, (_2, letter) => letter.toUpperCase());
      };
      const fixedParams = {};
      for (const [key, val] of Object.entries(connectParams)) {
        const camelKey = snakeToCamel(key);
        if (camelKey === "wsUrl") {
          if (typeof val !== "string") throw new (0, $db6391dc7d757577$export$59b4786f333aac02)(`Invalid type for wsUrl: expected string, got ${typeof val}`);
        } else throw new (0, $db6391dc7d757577$export$59b4786f333aac02)(`Unrecognized connection parameter: ${key}.`);
        fixedParams[camelKey] = val;
      }
      return fixedParams;
    }
    async _connect(connectParams) {
      if (this._abortController?.signal.aborted) return;
      this.state = "connecting";
      this._wsUrl = connectParams?.wsUrl ?? connectParams?.ws_url ?? this._wsUrl;
      if (!this._wsUrl) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("No url provided for connection");
        this.state = "error";
        throw new (0, $db6391dc7d757577$export$e0624a511a2c4e9)();
      }
      try {
        this._ws = this.initializeWebsocket();
        await this._ws.connect();
        await this._mediaManager.connect();
        if (this._abortController?.signal.aborted) return;
        this.state = "connected";
        this._callbacks.onConnected?.();
      } catch (error) {
        const msg = `Failed to connect to websocket: ${error}`;
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error(msg);
        this.state = "error";
        throw new (0, $db6391dc7d757577$export$e0624a511a2c4e9)(msg);
      }
    }
    async _disconnect() {
      this.state = "disconnecting";
      await this._mediaManager.disconnect();
      await this._ws?.close();
      this.state = "disconnected";
      this._callbacks.onDisconnected?.();
    }
    getAllMics() {
      return this._mediaManager.getAllMics();
    }
    getAllCams() {
      return this._mediaManager.getAllCams();
    }
    getAllSpeakers() {
      return this._mediaManager.getAllSpeakers();
    }
    async updateMic(micId) {
      return this._mediaManager.updateMic(micId);
    }
    updateCam(camId) {
      return this._mediaManager.updateCam(camId);
    }
    updateSpeaker(speakerId) {
      return this._mediaManager.updateSpeaker(speakerId);
    }
    get selectedMic() {
      return this._mediaManager.selectedMic;
    }
    get selectedSpeaker() {
      return this._mediaManager.selectedSpeaker;
    }
    enableMic(enable) {
      this._mediaManager.enableMic(enable);
    }
    get isMicEnabled() {
      return this._mediaManager.isMicEnabled;
    }
    get state() {
      return this._state;
    }
    set state(state) {
      if (this._state === state) return;
      this._state = state;
      this._callbacks.onTransportStateChanged?.(state);
    }
    tracks() {
      return this._mediaManager.tracks();
    }
    initializeWebsocket() {
      const ws2 = new (0, $032380dbcf3f4e13$export$4f3d0ffd941ebefb)(this._wsUrl, void 0, {
        parseBlobToJson: false
      });
      ws2.keepAliveInterval = 0;
      ws2.on("open", () => {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).debug("Websocket connection opened");
      });
      ws2.on("message", async (data) => {
        try {
          const parsed = await this._serializer.deserialize(data);
          if (parsed.type === "audio") this._mediaManager.bufferBotAudio(parsed.audio);
          else if (parsed.type === "message") {
            if (parsed.message.label === "rtvi-ai") this._onMessage(parsed.message);
          }
        } catch (e2) {
          (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("Failed to deserialize incoming message", e2);
        }
      });
      ws2.on("error", (error) => {
        this.connectionError(`websocket error: ${error}`);
      });
      ws2.on("connection-timeout", () => {
        this.connectionError("websocket connection timed out");
      });
      ws2.on("close", (code) => {
        this.connectionError(`websocket connection closed. Code: ${code}`);
      });
      ws2.on("reconnect-failed", () => {
        this.connectionError(`websocket reconnect failed`);
      });
      return ws2;
    }
    sendReadyMessage() {
      this.state = "ready";
      this.sendMessage((0, $c0d10c4690969999$export$69aa9ab0334b212).clientReady());
    }
    handleUserAudioStream(data) {
      if (this.state === "ready") try {
        this.flushAudioQueue();
        this._sendAudioInput(data);
      } catch (error) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("Error sending audio stream to websocket:", error);
        this.state = "error";
      }
      else this.audioQueue.push(data);
    }
    flushAudioQueue() {
      if (this.audioQueue.length <= 0) return;
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).info("Will flush audio queue", this.audioQueue.length);
      while (this.audioQueue.length > 0) {
        const queuedData = this.audioQueue.shift();
        if (queuedData) this._sendAudioInput(queuedData);
      }
    }
    sendRawMessage(message) {
      const encoded = this._serializer.serialize(message);
      this._sendMsg(encoded);
    }
    sendMessage(message) {
      const encoded = this._serializer.serializeMessage(message);
      this._sendMsg(encoded);
    }
    async _sendAudioInput(data) {
      try {
        const encoded = this._serializer.serializeAudio(data, this._recorderSampleRate, 1);
        await this._sendMsg(encoded);
      } catch (e2) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("Error sending audio frame", e2);
      }
    }
    async _sendMsg(msg) {
      if (!this._ws) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("sendMsg called but WS is null");
        return;
      }
      if (this._ws.readyState !== WebSocket.OPEN) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("attempt to send to closed socket");
        return;
      }
      if (!msg) return;
      try {
        await this._ws.send(msg);
      } catch (e2) {
        (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("sendMsg error", e2);
      }
    }
    connectionError(errorMsg) {
      this._callbacks.onError?.((0, $c0d10c4690969999$export$69aa9ab0334b212).error(errorMsg, true));
    }
    // Not implemented
    enableScreenShare(enable) {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("enableScreenShare not implemented for WebSocketTransport");
      throw new (0, $db6391dc7d757577$export$bd0820eb8444fcd9)("enableScreenShare", "webSocketTransport", "This feature has not been implemented");
    }
    get isSharingScreen() {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("isSharingScreen not implemented for WebSocketTransport");
      return false;
    }
    enableCam(enable) {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("enableCam not implemented for WebSocketTransport");
      throw new (0, $db6391dc7d757577$export$bd0820eb8444fcd9)("enableCam", "webSocketTransport", "This feature has not been implemented");
    }
    get isCamEnabled() {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("isCamEnabled not implemented for WebSocketTransport");
      return false;
    }
    get selectedCam() {
      (0, $e0900798b6cc045b$export$af88d00dbe7f521).error("selectedCam not implemented for WebSocketTransport");
      throw new (0, $db6391dc7d757577$export$bd0820eb8444fcd9)("selectedCam", "webSocketTransport", "This feature has not been implemented");
    }
  };
  $7f42eda74f1b1632$export$de21836fc42c6f9c.RECORDER_SAMPLE_RATE = 16e3;
  $7f42eda74f1b1632$export$de21836fc42c6f9c.PLAYER_SAMPLE_RATE = 24e3;

  // warroom/client.js
  window.PipecatWarRoom = { PipecatClient: $364c127d152b1085$export$8f7f86a77535f7a3, WebSocketTransport: $7f42eda74f1b1632$export$de21836fc42c6f9c };
})();
/*! Bundled license information:

@daily-co/daily-js/dist/daily-esm.js:
  (*!
   * Bowser - a browser detector
   * https://github.com/lancedikson/bowser
   * MIT License | (c) Dustin Diaz 2012-2015
   * MIT License | (c) Denis Demchenko 2015-2019
   *)
*/
