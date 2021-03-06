/*!
 * Created with JetBrains WebStorm.
 * User: mschwartz
 * Date: 6/7/13
 * Time: 5:05 PM
 */

/**
 * @class require
 * @singleton
 *
 * # CommonJS require 1.1 implementation.
 *
 * See the guide for require for detailed explanation of how this version of require() is implemented.
 */

/*global require, builtin */

(function () {
    var rhino = builtin.rhino,
        File = java.io.File,
        FileInputStream = java.io.FileInputStream,
        BufferedInputStream = java.io.BufferedInputStream,
        ByteArrayOutputStream = java.io.ByteArrayOutputStream;

    // thanks to ringojs for this one
    function resolveFile(path) {
        var file = path instanceof File ? path : new File(String(path));
        return file.isAbsolute() ? file : file.getAbsoluteFile();
    }

    var fs = {
        isFile : function (path) {
            var file = resolveFile(path);
            return file.isFile();
        },

        isDir : function (path) {
            var file = resolveFile(path);
            return file.isDirectory();
        },

        realpath : function (path) {
            var file = resolveFile(path);
            return file.exists() ? String(file.getCanonicalPath()) : false;
        },

        readFile : function (path) {
            var file = resolveFile(path),
                body = new ByteArrayOutputStream(),
                stream = new BufferedInputStream(new FileInputStream(file)),
                buf = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 1024),
                count;

            while ((count = stream.read(buf)) > -1) {
                body.write(buf, 0, count);
            }
            stream.close();
            return String(body.toString());
        }
    };

    function realpath(path) {
        var f = new File(path);
        return String(f.getAbsolutePath().toString());
    }

    function locateFile(module) {
        var extension,
            pkg;

        function tryFile(path) {
            var tryPath = fs.realpath(path);
            if (tryPath) {
                if (fs.isFile(tryPath)) {
                    return tryPath;
                }
                else if (fs.isDir(tryPath)) {
                    if (!tryPath.endsWith('/')) {
                        tryPath += '/';
                    }
                    tryPath += 'index.js';
                }
                if (fs.isFile(tryPath)) {
                    return tryPath;
                }
                tryPath = tryPath.replace(/index.js$/, 'bower.json');
                if (fs.isFile(tryPath)) {
                    try {
                        pkg = JSON.parse(fs.readFile(tryPath));
                        if (decaf.isString(pkg.main)) {
                            tryPath = tryPath.replace(/bower.json$/, pkg.main);
                            if (fs.isFile(tryPath)) {
                                return tryPath;
                            }
                        }
                    }
                    catch (e) {
                    }
                }
                tryPath = tryPath.replace(/bower.json$/, 'package.json');
                if (fs.isFile(tryPath)) {
                    try {
                        pkg = JSON.parse(fs.readFile(tryPath));
                        if (decaf.isString(pkg.main)) {
                            tryPath = tryPath.replace(/package.json$/, pkg.main);
                            if (fs.isFile(tryPath)) {
                                return tryPath;
                            }
                        }
                    }
                    catch (e) {
                    }
                }
            }
            tryPath = fs.realpath(require.fsPath + path);
            if (tryPath) {
                if (fs.isFile(tryPath)) {
                    return tryPath;
                }
                if (fs.isDir(tryPath)) {
                    if (!tryPath.endsWith('/')) {
                        tryPath += '/';
                    }
                    tryPath += 'index.js';
                    if (fs.isFile(tryPath)) {
                        return tryPath;
                    }
                    tryPath = tryPath.replace(/index.js$/, 'bower.json');
                    if (fs.isFile(tryPath)) {
                        try {
                            pkg = JSON.parse(fs.readFile(tryPath));
                            if (decaf.isString(pkg.main)) {
                                tryPath = tryPath.replace(/bower.json$/, pkg.main);
                                if (fs.isFile(tryPath)) {
                                    return tryPath;
                                }
                            }
                        }
                        catch (e) {
                        }
                    }
                    tryPath = tryPath.replace(/bower.json$/, 'package.json');
                    if (fs.isFile(tryPath)) {
                        try {
                            pkg = JSON.parse(fs.readFile(tryPath));
                            if (decaf.isString(pkg.main)) {
                                tryPath = tryPath.replace(/package.json$/, pkg.main);
                                if (fs.isFile(tryPath)) {
                                    return tryPath;
                                }
                            }
                        }
                        catch (e) {
                        }
                    }
                }
            }
            return false;
        }

        var found;
        if (module[0] === '/' || module.substr(0, 2) === './' || module.substr(0, 3) === '../' || module === '..') {
            var relpath = module[0] === '/' ? module : realpath(require.fsPath + module);
            found = tryFile(relpath) || tryFile(relpath + '.js');
            if (found) {
                return found;
            }
            for (extension in require.extensions) {
                found = tryFile(module + '.' + extension);
                if (found) {
                    return found;
                }
            }
        }
        else {
            var paths = require.paths;
            for (var i = 0, len = paths.length; i < len; i++) {
                var path = paths[i];
                if (path.substr(path.length - 1, 1) != '/') {
                    path += '/';
                }
                path += module;
                found = tryFile(path) || tryFile(path + '.js');
                if (found) {
                    return found;
                }
                for (extension in require.extensions) {
                    found = tryFile(path + '.' + extension);
                    if (found) {
                        return found;
                    }
                }
            }
        }
        throw new Error('Could not locate require file ' + module);
    }

    function loadFile(modulePath) {
        var contents = fs.readFile(modulePath);
        var extension = modulePath.indexOf('.') !== -1 ? modulePath.substr(modulePath.lastIndexOf('.') + 1) : '';

        if (require.extensions[extension]) {
            contents = require.extensions[extension](contents, modulePath);
        }
        return contents;
    }

    /**
     *
     * Loads a JavaScript file or program in a language that compiles into Javascript.
     *
     * - The first time a module is required, it is loaded and executed.
     * - The module is expected to modify its exports or module.exports variable.
     * - The first call to require() of a module returns its exports.
     * - Each successive call to require() of the same module returns the exports without running the code.
     *
     * @param module
     * @returns {*}
     */
    global.require = function (module) {
        if (module.substr(0, 8) === 'builtin/' || module.substr(0, 8) === 'builtin.') {
            return builtin[module.substr(8)];
        }
        var modulePath = locateFile(module);
        if (require.cache[modulePath]) {
            return require.cache[modulePath].exports;
        }
        var content = loadFile(modulePath);
        require.dirStack.push(require.fsPath);
        var fsPath = modulePath.split('/');
        fsPath.pop();
        require.fsPath = fsPath.join('/') + '/';

        // works
//        var exports = require.cache[modulePath] = {};
//        var script = [
//            '(function() {',
//            '	var exports = {}', //  module.exports;',
//            '	var module = {',
//            '		id: "' + module + '",',
//            '       fsPath: "' + require.fsPath + '",',
//            '		url: "' + modulePath + '",',
//            '       exports: null',
//            '	};',
//            content,
//            '	return module.exports || exports;',
//            '}())'
//        ].join('\n');
//        require.modulePath = modulePath;
//        require.cache[modulePath] = rhino.runScript(script, modulePath, 0);

        var exports = require.cache[modulePath] = {
            id      : module,
            url     : modulePath,
            content : content,
            exports : {}
        };


        if (false) {

            var fn = new Function('module', 'exports', content + ';\nreturn module.exports;');
            require.modulePath = modulePath;
            try {
                fn(exports, exports.exports);
            }
            catch (e) {
                console.exception(e);
            }
        }
        else {
            var script = [
                '(function() {',                                                    // line 1
                '   var module = global.require.getCached("' + modulePath + '");',  // line 2
                '   var exports = module.exports;',                                 // line 3
                content,                                                            // line 4
                '   return module.exports;',
                '}())'
            ].join('\n');
            require.modulePath = modulePath;

            rhino.runScript(script, modulePath, 1, global);                         // line 4 from script above
        }
        require.fsPath = require.dirStack.pop();
        require.modulePath = null;
        return require.cache[modulePath].exports;
    };

    /**
     * #require.getCached(path) : exports
     *
     * @private
     * @param path
     * @returns {*}
     */
    require.getCached = function (path) {
        return require.cache[path];
    };

    /**
     * See if the specified filename is a file that has been required.
     *
     * @param fn
     * @returns {boolean}
     */
    require.isRequiredFile = function (fn) {
        return require.modulePath === fn || (require.cache[fn] ? true : false);
    };

    /** @private */
    require.main = this;
    require.dirStack = [];
    require.fsPath = '';
    require.cache = {};

    /**
     * This is an array of file system paths that are searched for modules when require() is called.  These may be relative to the current directory where decaf is launched, or absolute paths.
     * @property
     *
     * @type {Array}
     */
    require.paths = [
        'bower_components',
        'bower_components/decaf/modules',
        'node_modules',
        'modules',
        '/usr/local/decaf',
        '/usr/local/decaf/modules',
        './'
    ];

    /**
     * @property
     *  An object used to extend the way [require][#require] loads modules.
     *
     *  Use a file extension as key and a function as value. The function should accept a `Resource` object as argument and return either a string to be used as JavaScript module source or an object which will be directly returned by `require`.
     *
     *  For example, the following one-liner will enable `require()` to load .hbs files as HoganJS templates:
     * ```javascript
     *     require.extensions['.hbs'] = function(r) { return Hogan.compile(new File(r).readAll()); }
     * ```
     */
    require.extensions = {};

    /**
     * getContent(module) : exports
     *
     * @private
     * @param module
     * @returns {Mixed} exports
     */
    require.getContent = function (module) {
        var modulePath = locateFile(module);
        require(modulePath);
        if (!require.cache[modulePath]) {
            throw new Error("Can't get content for " + module + ' (' + modulePath + ')');
        }
        return require.cache[modulePath];
    };
    /** @ignore */


}());
