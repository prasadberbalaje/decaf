/**
 * Created by mschwartz on 3/22/15.
 */

/*global require, exportt */

var DECAF = java.lang.System.getProperty('decaf');
var CLASSPATH = java.lang.System.getProperty('decaf.classpath');
//console.dir({CLASSPATH : CLASSPATH})
var Platform = Java.type("javafx.application.Platform");
var ArrayList = Java.type("java.util.ArrayList");

var JDI = Packages.com.sun.jdi;
var AbsentInformationException = JDI.AbsentInformationException;
var Bootstrap = JDI.Bootstrap;
var Locatable = JDI.Locatable;

var ArrayReference = JDI.ArrayReference;
var BooleanValue = JDI.BooleanValue;
var ByteValue = JDI.ByteValue;
var CharValue = JDI.CharValue;
var ClassLoaderReference = JDI.ClassLoaderReference;
var ClassObjectReference = JDI.ClassObjectReference;
var ClassType = JDI.ClassType;
var DoubleValue = JDI.DoubleValue;
var FloatValue = JDI.FloatValue;
var IntegerValue = JDI.IntegerValue;
var LongValue = JDI.LongValue;
var ObjectReference = JDI.ObjectReference;
var PrimitiveValue = JDI.PrimitiveValue;
var ShortValue = JDI.ShortValue;
var StringReference = JDI.StringReference;
var ThreadGroupReference = JDI.ThreadGroupReference;
var ThreadReference = JDI.ThreadReference;
var VoidValue = JDI.VoidValue;

var Thread = java.lang.Thread;
var CharArray = Java.type("char[]");
var InputStreamReader = Java.type("java.io.InputStreamReader");
var NashornScriptFilter = "jdk.nashorn.internal.scripts.Script*";

var InterruptedException = Java.type("java.lang.InterruptedException");
var VMDisconnectedException = JDI.VMDisconnectedException;
var InternalError = Java.type("java.lang.InternalError");

var JDIEvent = JDI.event;
var BreakpointEvent = JDIEvent.BreakpointEvent;
var ClassPrepareEvent = JDIEvent.ClassPrepareEvent;
var ClassUnloadEvent = JDIEvent.ClassUnloadEvent;
var ExceptionEvent = JDIEvent.ExceptionEvent;
var LocatableEvent = JDIEvent.LocatableEvent;
var MethodEntryEvent = JDIEvent.MethodEntryEvent;
var MethodExitEvent = JDIEvent.MethodExitEvent;
var StepEvent = JDIEvent.StepEvent;
var ThreadDeathEvent = JDIEvent.ThreadDeathEvent;
var ThreadStartEvent = JDIEvent.ThreadStartEvent;
var VMDeathEvent = JDIEvent.VMDeathEvent;
var VMDisconnectEvent = JDIEvent.VMDisconnectEvent;
var VMStartEvent = JDIEvent.VMStartEvent;
var WatchpointEvent = JDIEvent.WatchpointEvent;

var JDIRequest = JDI.request;
var EventRequest = JDIRequest.EventRequest;
var StepRequest = JDIRequest.StepRequest;

var NashornObjectBase = "jdk.nashorn.internal.scripts.JO";
var NashornScriptBase = "jdk.nashorn.internal.scripts.JS";
var NashornScriptFilter = "jdk.nashorn.internal.scripts.Script*";
var NashornRunScript = "runScript";

var NashornSourceField = "source";
var NashornContentField = "content";


function isJavaScript(path) {
    return path.endsWith(".js");
}

function SourceFile(path, cls) {
    var me = this;
    me.file = new File(path);
    try {
        me.chars = this.file.readAll();
    }
    catch (e) {
        me.chars = 'SOURCE NOT AVAILABLE';
        //console.exception(e);
    }
    me.breakpoints = {};
    me.classes = [];
    me.location = [];
    if (cls) {
        me.addClass(cls);
    }
}
decaf.extend(SourceFile.prototype, {
    getMethod       : function (cls, methodName) {
        return cls.methodsByName(methodName).get(0);
    },
    addClass        : function (cls) {
        var me = this;

        me.classes.push(cls);

        //var script = me.getMethod(cls, NashornRunScript);

        var locations = [],
            scriptLocations = {};

        for each(var location in cls.allLineLocations()) {
            var lineNumber = location.lineNumber();
            scriptLocations[lineNumber] = location;
            //console.dir({
            //    location: location,
            //    lineNumber: lineNumber,
            //    scriptLocation: scriptLocations[lineNumber],
            //    scriptLocations: scriptLocations
            //});
            locations.push(location);
        }
        locations.sort(function (a, b) {
            return a.lineNumber() - b.lineNumber();
        });
        //console.dir({
        //    script: me.file.getPath(),
        //    locations: locations.length,
        //    scriptLocations: cls.allLineLocations().length
        //})
        me.locations = locations;
        me.scriptLocations = scriptLocations;
    },
    setBreakpoint   : function (line) {
        this.breakpoints[line] = 'set';
    },
    clearBreakpoint : function (line) {
        delete this.breakpoints[line];
    }
});

/**
 * ## new Target(ui, args) : Target
 *
 * Creates a "target" instance that starts up and controls a target JavaScript VM.  DCON runs in this VM and the application to be debugged runs in the target VM.
 *
 * ### Arguments:
 *
 * - {DCon} ui - DCON UI driver
 *
 * @constructor
 * @param ui
 * @param args
 * @constructor
 */
function Target(ui) {
    var me = this;

    me.ui = ui;
    me.sources = [];
    me.bootstrapVM = Bootstrap.virtualMachineManager();
    me.launchingConnector = me.bootstrapVM.defaultConnector();
    me.connectionArguments = me.launchingConnector.defaultArguments();

    me.setArguments({
        suspend : true,
        options : '-server -XX:+TieredCompilation -Xms2G -Xmx2G -Ddecaf=' + DECAF + ' -cp ' + CLASSPATH,
        main    : 'jdk.nashorn.tools.Shell ' + DECAF + '/builtins/all.js' + ' -- ' + global.arguments
    });

    me.remoteVM = me.launchingConnector.launch(me.connectionArguments);

    builtin.atExit(function () {
        me.remoteVM.destroy();
    });

    me.connected = true;
    me.status = 'initializing';
    me.started = false;
    me.suspended = false;

    me.process = me.remoteVM.process();

    //me.interceptConsole('stdiin', me.process.getInputStream());
    me.interceptConsole('stdout', me.process.getInputStream());
    me.interceptConsole('stderr', me.process.getErrorStream());

    me.requestManager = me.remoteVM.eventRequestManager();

    me.classPrepareRequest = me.requestManager.createClassPrepareRequest();
    me.classPrepareRequest.addClassFilter(NashornScriptFilter);
    me.classPrepareRequest.enabled = true;

    me.classUnloadRequest = me.requestManager.createClassUnloadRequest();
    me.classUnloadRequest.addClassFilter(NashornScriptFilter);
    me.classUnloadRequest.enabled = true;

    me.exceptionRequest = me.requestManager.createExceptionRequest(null, true, true);
    me.exceptionRequest.addClassFilter(NashornScriptFilter);
    me.exceptionRequest.enabled = true;


    me.spawnEventManager();
}
decaf.extend(Target.prototype, {
    setArguments         : function (o) {
        var connectionArguments = this.connectionArguments;
        decaf.each(o, function (value, key) {
            connectionArguments.get(key).setValue(value);
        })
    },
    interceptConsole     : function (what, source) {
        var me = this;

        var thread = new Thread(function () {
            console.log('reader alive');

            var buffer = new CharArray(1024);
            var inputStream = new InputStreamReader(source);

            for (var length = 0; (length = inputStream.read(buffer, 0, buffer.length)) !== -1;) {
                console.log('reader')
                var text = new java.lang.String(buffer, 0, length);

                console.log(what + ' reader: ' + text);
                me.ui.targetCommand({
                    command : 'console',
                    message : what + ': ' + text
                });
            }

            Thread.currentThread().join();
            console.log('spwanReader exiting')
        });

        thread.start();
    },
    getMethod            : function (cls, methodName) {
        return cls.methodsByName(methodName).get(0);
    },
    getClass             : function (className) {
        return this.remoteVM.classesByName(className).get(0);
    },
    invokeMethod: function (methodName, signature, receiver, args) {
        var me = this;
        args = args || [];
        var cls = receiver.referenceType();

        console.dir({ cls: cls, allMethods: cls.allMethods(), methodName: methodName, methods: cls.methodsByName(methodName), fields: cls.allFields() });
        var method = cls.methodsByName(methodName).get(0); // (signature ? cls.methodsByName(methodName, signature) : cls.methodsByName(methodName)).get(0);
        console.dir({ method: method });
        var list = new ArrayList();
        args.forEach(function(arg) {
            list.add(arg);
        });

        try {
            return receiver.invokeMethod(this.thread, method, list, ObjectReference.INVOKE_SINGLE_THREADED);
        } catch (ex) {
            console.dir(ex);
            //exit(1);
        }
    },
    valueInfo: function (name, value, all) {
        var list = new ArrayList();
        list.add(this.remoteVM.mirrorOf(name));
        list.add(value);
        list.add(this.remoteVM.mirrorOf(all));
        return this.debuggerSupportClass.invokeMethod(this.thread, this.valueInfoMethod, list, ClassType.INVOKE_SINGLE_THREADED);
    },
    evaluate             : function (str) {
        console.log('--- EVALUATE ---' + this.thread);
        //str = 'try { ' + str + '} catch (e) { console.log(e);  }';
        var frame = this.thread.frames(0, 1).get(0);
        //var mainFrame = this.mainThread.frames(0, 1).get(0);
        //console.dir({ evaluate_mainFrame: this.mainThread.frames[0] })
        //var frame = frame.frame;
        //console.dir({
        //    mainFrame        : this.mainThread.frames[0],
        //    frame            : frame,
        //    visibleVariables : frame.visibleVariables(),
        //    variables        : frame.variables,
        //    str              : str
        //});

        //var scopeVar = this.threads.main.frames[0].visibleVariableByName(":scope");

        var scopeVar = frame.visibleVariableByName(":scope");
        var thisVar = frame.visibleVariableByName(":this");
        var self = thisVar ? frame.getValue(thisVar) : null;
        var scope = scopeVar ? frame.getValue(scopeVar) : null;

        var list = new ArrayList();
        list.add(scope);
        list.add(self);
        list.add(this.remoteVM.mirrorOf(str));
        list.add(this.remoteVM.mirrorOf(false));
        //console.dir({frame : frame, scope : scope, self : self, str : str});
        var result = this.debuggerSupportClass.invokeMethod(this.thread, this.getEvalMethod, list, ClassType.INVOKE_SINGLE_THREADED);
        console.dir({
            result : result
        })
        if (!result) {
            return result;
        }
        //console.dir({
        //    result : result,
        //    str    : result.toString(),
        //    str2   : Object.prototype.toString.call(result),
        //    str3   : String(result),
        //    type   : result.type(),
        //    value  : result.intValue
        //});
        //if (result.toString().indexOf('java.lang.Integer') !== -1) {
        //    return result.value();
        //}
        //else {
        //    return result.toString();
        //}
        //result = this.getValueFromVariable(result);
        //result = result.toString();
        //console.dir({ result: result });
        //return result;
        if (result instanceof StringReference) {
            return result.value();
        }
        else if (result.value) {
            return result.value()
        }
        else {
            return "";
        }
    },
    getPropertyValue     : function (object, key) {
        return this.invokeMethod("get", "(Ljava/lang/Object;)Ljava/lang/Object;", object, [key]);
    },
    getValue: function(object, fieldName) {
        var cls = object.referenceType();
        var field = cls.fieldByName(fieldName);

        return object.getValue(field);
    },
    getValueAsString: function (desc) {
        return desc.getValue(this.descValueAsStringField).value();
    },
    getValueFromVariable : function (variable) {
        var v = Object.prototype.toString.call(variable);

        if (variable instanceof BooleanValue) {
            v = variable.value();
        }
        else if (variable instanceof ByteValue) {
            v = variable.value();
        }
        else if (variable instanceof CharValue) {
            v = variable.value();
        }
        else if (variable instanceof DoubleValue) {
            v = variable.value();
        }
        else if (variable instanceof FloatValue) {
            v = variable.value();
        }
        else if (variable instanceof IntegerValue) {
            v = variable.value();
        }
        else if (variable instanceof LongValue) {
            v = variable.value();
        }
        else if (variable instanceof ShortValue) {
            v = variable.value();
        }
        else if (variable instanceof StringReference) {
            v = variable.value();
        }
        else if (variable instanceof PrimitiveValue) {
            v = 'PRIMITIVE';
        }
        else if (variable instanceof ObjectReference) {
            v = 'OBJECT';
        }
        return v;
    },
    getVariableFromFrame : function (frame, variable) {
        var location = frame.location,
            name = variable.name(),
            v = Object.prototype.toString.call(value);
        if (!name.startsWith(":")) {
            var value = frame.values.get(variable);

            if (value instanceof BooleanValue) {
                v = value.value();
            }
            else if (value instanceof ByteValue) {
                v = value.value();
            }
            else if (value instanceof CharValue) {
                v = value.value();
            }
            else if (value instanceof DoubleValue) {
                v = value.value();
            }
            else if (value instanceof FloatValue) {
                v = value.value();
            }
            else if (value instanceof IntegerValue) {
                v = value.value();
            }
            else if (value instanceof LongValue) {
                v = value.value();
            }
            else if (value instanceof ShortValue) {
                v = value.value();
            }
            else if (value instanceof StringReference) {
                v = value.value();
            }
            else if (value instanceof PrimitiveValue) {
                v = 'PRIMITIVE';
            }
            else if (value instanceof ObjectReference) {
                v = 'OBJECT';
            }
            return {
                name  : name,
                type  : Object.prototype.toString.call(value),
                value : v
            };
        }
        else {
            return false;
        }
    },
    updateUI             : function () {
        var me = this;

        var newSources = {},
            newThreads = {};

        function getFrames(thread) {
            var frames = [];

            for each (var frame in thread.frames()) {
                var location = frame.location();

                try {
                    if (isJavaScript(location.sourceName())) {
                        var variables = frame.visibleVariables();
                        var values = frame.getValues(variables);
                        frames.push({frame : frame, location : location, variables : variables, values : values});
                    }
                }
                catch (ex if ex instanceof AbsentInformationException) {
                    // Stale frame
                }
            }

            return frames;
        }

        function getThreads() {
            var threads = [];

            for each (var thread in me.remoteVM.allThreads()) {
                var frames = getFrames(thread);

                if (frames.length != 0) {
                    threads.push({thread : thread, frames : frames});
                }
                if (me.thread.name() === thread.name()) {
                    me.frame = frames[0];
                }
            }

            return threads;
        }

        console.log('---------')
        console.log('UPDATE UI')

        try {
            me.threads = getThreads();
            //console.dir(me.thread);
            //me.frame = me.threads[0].frames[0];
        }
        catch (e) {
            me.threads = {};
            me.frame = null;
        }
        for each (var thread in me.threads) {
            //console.dir({thread_thread_name : thread.thread.name()})
            if (thread.thread.name() === 'main') {
                me.mainThread = thread;
                //console.log('set mainThread');
            }
            //console.dir({ thread: thread });
            var newFrames = [];
            for each(var frame in thread.frames) {
                var location = frame.location;
                var sourceName = location.sourceName();
                var lineNumber = location.lineNumber();
                var method = location.method();
                var source = me.sources[sourceName];

                assert(source);
                //if (!source) {
                //    console.log('NEW SOURCE')
                //    source = me.sources[sourceName] = new SourceFile(sourceName);
                //        if (!source.file) {
                //            var cls = source.classes[0];
                //            source.initSource(cls);
                //        }
                //}

                var variables = [];
                for each (var variable in frame.variables) {
                    var v = me.getVariableFromFrame(frame, variable);
                    if (v) {
                        variables.push(v);
                    }
                }

                newFrames.push({
                    //location   : location,
                    sourceName : sourceName,
                    lineNumber : lineNumber,
                    method     : method,
                    variables  : variables
                });
            }
            newThreads[thread.thread.name()] = {name : thread.thread.name(), frames : newFrames};
        }

        decaf.each(me.sources, function (source, sourceName) {
            var locations = {};
            decaf.each(source.locations, function (location) {
                locations[location.lineNumber()] = true;
            });
            newSources[sourceName] = {
                name        : sourceName,
                chars       : source.chars,
                breakpoints : source.breakpoints,
                cls         : source.cls,
                locations   : locations
            };
        });

        console.dir({
            thread: me.thread,
            frames: me.frame.variables // .visibleVariables()
        })

        me.ui.targetCommand({
            command : 'update',
            state   : {
                thread     : me.thread ? me.thread.name() : null,
                mainThread : me.mainThread,
                sources    : newSources,
                threads    : newThreads,
                suspended  : me.suspended,
                status     : me.status
            }
        });

    }
});

// Debugger commands
decaf.extend(Target.prototype, {
    stepOver        : function () {
        if (this.thread && this.suspended) {
            var requestManager = this.remoteVM.eventRequestManager();
            var stepRequest = requestManager.createStepRequest(this.thread, StepRequest.STEP_LINE, StepRequest.STEP_OVER);
            stepRequest.addClassFilter(NashornScriptFilter);
            stepRequest.enabled = true;
            this.remoteVM.resume();
            this.suspended = false;
            this.status = 'stepover';
        }
    },
    stepIn          : function () {
        if (this.thread && this.suspended) {
            var requestManager = this.remoteVM.eventRequestManager();
            var stepRequest = requestManager.createStepRequest(this.thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
            stepRequest.addClassFilter(NashornScriptFilter);
            stepRequest.enabled = true;
            this.remoteVM.resume();
            this.suspended = false;
            if (this.status === 'paused') {
                this.status = 'stopped';
            }
            else {
                this.status = 'stepin';
            }
        }
    },
    stepOut         : function () {
        if (this.thread && this.suspended) {
            var requestManager = this.remoteVM.eventRequestManager();
            var stepRequest = requestManager.createStepRequest(this.thread, StepRequest.STEP_LINE, StepRequest.STEP_OUT);
            stepRequest.addClassFilter(NashornScriptFilter);
            stepRequest.enabled = true;
            this.remoteVM.resume();
            this.suspended = false;
            this.status = 'stepout';
        }
    },
    resume          : function () {
        var me = this;

        if (me.remoteVM) {
            me.remoteVM.resume();
            me.suspended = false;
            me.status = 'resumed';
        }
    },
    pause           : function () {
        var me = this;

        if (me.remoteVM) {
            me.remoteVM.suspend();
            me.suspended = true;
            me.status = 'paused';
            //me.eventThread.interrupt();
        }
    },
    setBreakpoint   : function (sourceName, line) {
        var me = this,
            source = me.sources[sourceName],
            location;
        assert(source);
        location = source.scriptLocations[line];
        //console.dir({
        //    what       : 'setBreakpoint',
        //    sourceName : sourceName,
        //    line       : line,
        //    source     : source,
        //    location   : location
        //});
        if (!location) {
            return;
        }
        source.setBreakpoint(line);

        var requestManager = this.remoteVM.eventRequestManager();

        for each (var breakpoint in requestManager.breakpointRequests()) {
            if (breakpoint.location().compareTo(location) == 0) {
                breakpoint.enabled = true;
                return;
            }
        }

        try {
            var breakpoint = requestManager.createBreakpointRequest(location);
            breakpoint.enabled = true;
        }
        catch (ex if ex instanceof AbsentInformationException) {
        }
    },
    clearBreakpoint : function (sourceName, line) {
        //console.dir({
        //    what       : 'setBreakpoint',
        //    sourceName : sourceName,
        //    line       : line
        //})
        var me = this,
            source = me.sources[sourceName];
        assert(source);

        var location = source.scriptLocations[line];
        if (!location) {
            return;
        }
        source.clearBreakpoint(line);
        var requestManager = this.remoteVM.eventRequestManager();

        for each (var breakpoint in requestManager.breakpointRequests()) {
            if (breakpoint.location().compareTo(location) == 0) {
                breakpoint.enabled = false;
                return;
            }
        }
    }
});

// Event Manager
decaf.extend(Target.prototype, {
    spawnEventManager : function () {
        var me = this;

        function handleEvent(event) {
            if (event instanceof Locatable) {
                me.thread = event.thread();
            }

            if (event instanceof ExceptionEvent) {
                return me.handleExceptionEvent(event);
            }
            else if (event instanceof BreakpointEvent) {
                return me.handleBreakpointEvent(event);
            }
            else if (event instanceof WatchpointEvent) {
                return me.handleFieldWatchEvent(event);
            }
            else if (event instanceof StepEvent) {
                return me.handleStepEvent(event);
            }
            else if (event instanceof MethodEntryEvent) {
                return me.handleMethodEntryEvent(event);
            }
            else if (event instanceof MethodExitEvent) {
                return me.handleMethodExitEvent(event);
            }
            else if (event instanceof ClassPrepareEvent) {
                return me.handleClassPrepareEvent(event);
            }
            else if (event instanceof ClassUnloadEvent) {
                return me.handleClassUnloadEvent(event);
            }
            else if (event instanceof ThreadStartEvent) {
                return me.handleThreadStartEvent(event);
            }
            else if (event instanceof ThreadDeathEvent) {
                return me.handleThreadDeathEvent(event);
            }
            else if (event instanceof VMStartEvent) {
                return me.handleVMStartEvent(event);
            }
            else if (event instanceof VMDeathEvent) {
                me.vmDied = true;
                return me.handleVMDeathEvent(event);
            }
            else if (event instanceof VMDisconnectEvent) {
                me.connected = false;
                if (!me.vmDied) {
                    me.handleVMDisconnectEvent(event);
                }

                return false;
            }

            throw new Error("Unexpected event type: " + event.getClass());
        }

        me.eventThread = new Thread(function () {
            while (me.connected) {
                var queue = me.remoteVM.eventQueue();

                try {
                    var eventSet = queue.remove();
                    var resumeStoppedApp = false;
                    var it = eventSet.eventIterator();

                    while (it.hasNext()) {
                        var evt = it.nextEvent();
                        resumeStoppedApp |= !handleEvent(evt);
                        console.dir({
                            evt              : evt,
                            resumeStoppedApp : resumeStoppedApp
                        });
                    }

                    if (resumeStoppedApp) {
                        eventSet.resume();
                        me.suspended = false;
                        me.status = 'running';
                    }
                    else {
                        if (eventSet.suspendPolicy() === EventRequest.SUSPEND_ALL) {
                            me.interrupted = true;
                            me.suspended = true;
                            //me.status = 'interrupted';
                        }

                        Platform.runLater(function () {
                            me.updateUI();
                        });

                        //me.updateUI({
                        //    sources   : me.sources,
                        //    threads   : me.threads,
                        //    suspended : me.suspended
                        //});
                        //Platform.runLater(function() {
                        //    scene.refresh(session);
                        //});
                    }
                }
                catch (ex if ex instanceof InterruptedException) {
                    console.log("INTERRUPTED")
                    //Platform.runLater(function () {
                    //    me.updateUI();
                    //});
                }
                catch (ex if ex instanceof VMDisconnectedException) {
                    me.handleDisconnectedException(ex);
                    break;
                }
            }

            Thread.currentThread().join();
        });

        me.eventThread.start();
    }
});
// Event Handlers
decaf.extend(Target.prototype, {
    handleExitEvent             : function (event) {
        console.dir({
            exitEvent : event
        });
        this.status = 'exited';
        return true;
    },
    handleDisconnectedException : function (ex) {
        var me = this,
            queue = me.remoteVM.eventQueue();

        while (me.connected) {
            try {
                var eventSet = queue.remove();
                var iter = eventSet.eventIterator();
                while (iter.hasNext()) {
                    me.handleExitEvent(iter.next());
                }
            }
            catch (ex if ex instanceof InterruptedException) {
            }
            catch (ex if ex instanceof InternalError) {
            }
        }
    },
    handleExceptionEvent        : function (event) {
        var exception = event.exception();
        console.log('exception event')
        console.dir({exception : exception});
        //console.dir({ valueInfo: this.valueInfo('stack', exception, false)})
        //console.dir({ toString: this.invokeMethod('toString', '', exception, [])})
        console.dir({ detailMessage: this.getValue(exception, 'detailMessage') })
        console.dir({ cause: this.getValue(exception, 'cause') })
        console.dir({ stackTrace: this.getValue(exception, 'stackTrace')})
        //console.dir({ stack: this.invokeMethod('getScriptStackString', '', exception, [exception])})
        //console.dir({ stack: this.getValue(exception, 'stack')});
        //console.dir({exceptionNae : exception.type().name()});
        //console.dir({catchLocation : event.catchLocation()});
        this.status = 'exception hit';
        return false;
    },
    handleBreakpointEvent       : function (event) {
        this.status = 'breakpoint hit';
        return true;
    },
    handleFieldWatchEvent       : function (event) {
        this.status = 'field watch hit';
        return true;
    },
    handleStepEvent             : function (event) {
        var requestManager = this.remoteVM.eventRequestManager();
        var request = requestManager.stepRequests().get(0);
        requestManager.deleteEventRequest(request);
        return true;
    },
    handleMethodEntryEvent      : function (event) {
        this.status = 'method entry';
        return false;
    },
    handleMethodExitEvent       : function (event) {
        this.status = 'method exit';
        return false;
    },
    handleClassPrepareEvent     : function (event) {
        var me = this;
        if (!me.scriptObjectClass) {
            me.scriptObjectClass = me.getClass("jdk.nashorn.internal.runtime.ScriptObject");
            me.scriptFunctionClass = me.getClass("jdk.nashorn.internal.runtime.ScriptFunction");
            //objectBaseClass        = me.getClass(NashornObjectBase);
            //scriptBaseClass        = me.getClass(NashornScriptBase);
            me.nativeObjectClass = me.getClass("jdk.nashorn.internal.objects.NativeObject");
            me.undefinedClass = me.getClass("jdk.nashorn.internal.runtime.Undefined");
            me.debuggerSupportClass = me.getClass("jdk.nashorn.internal.runtime.DebuggerSupport");
            me.DebuggerValueDescClass = me.getClass("jdk.nashorn.internal.runtime.DebuggerSupport$DebuggerValueDesc");
            me.ECMAException = this.getClass('jdk.nashorn.internal.runtime.ECMAException');

            me.descKeyField = me.DebuggerValueDescClass.fieldByName("key");
            me.descExpandableField = me.DebuggerValueDescClass.fieldByName("expandable");
            me.descValueAsObjectField = me.DebuggerValueDescClass.fieldByName("valueAsObject");
            me.descValueAsStringField = me.DebuggerValueDescClass.fieldByName("valueAsString");

            me.getGlobalMethod = me.debuggerSupportClass.methodsByName("getGlobal", "()Ljava/lang/Object;").get(0);
            me.getEvalMethod = me.debuggerSupportClass.methodsByName("eval", "(Ljdk/nashorn/internal/runtime/ScriptObject;Ljava/lang/Object;Ljava/lang/String;Z)Ljava/lang/Object;").get(0);
            me.valueInfoMethod = me.debuggerSupportClass.methodsByName("valueInfo", "(Ljava/lang/String;Ljava/lang/Object;Z)Ljdk/nashorn/internal/runtime/DebuggerSupport$DebuggerValueDesc;").get(0);
            me.valueInfosMethod = me.debuggerSupportClass.methodsByName("valueInfos", "(Ljava/lang/Object;Z)[Ljdk/nashorn/internal/runtime/DebuggerSupport$DebuggerValueDesc;").get(0);


            me.classClass = me.getClass("java.lang.Class");
        }

        var cls = event.referenceType();
        console.dir({cls : cls});
        var sourceName = cls.sourceName();
        var source = me.sources[sourceName];

        if (!source) {
            //console.dir({
            //    cls: cls,
            //    locations: cls.allLineLocations()
            //});
            source = new SourceFile(sourceName, cls);
            me.sources[sourceName] = source;
        }
        source.addClass(cls);
        //console.dir({source : sourceName, chars : source.chars, allLines : cls.allLineLocations()})

        //var script = me.getMethod(cls, NashornRunScript);
        //var locations = [];
        //for each(var location in script.allLineLocations()) {
        //    locations.push(location);
        //}
        //locations.sort(function (a, b) {
        //    return a.lineNumber() - b.lineNumber();
        //});

        //console.dir({
        //    name      : sourceName,
        //    script    : script,
        //    locations : locations
        //})
        var requestManager = me.remoteVM.eventRequestManager(),
            locations = source.locations,
            lines = source.chars.split('\n'),
            line,
            ndx;

        for (line = 0; line < lines.length; line++) {
            if (lines[line].trim().substr(0, 8) === 'debugger') {
                line += 2;
                for (ndx = 0; ndx < locations.length; ndx++) {
                    //console.dir({ location: locations[ndx] })
                    if (locations[ndx].lineNumber() === line) {
                        var breakpoint = requestManager.createBreakpointRequest(locations[ndx]);
                        breakpoint.enabled = true;
                        source.breakpoints[line] = 'debugger';
                    }
                }
                break;
            }
        }
        //console.dir(index);
        //builtin.process.exit(1);
        //var runScript = me.getMethod(cls, NashornRunScript);

        //if (!me.started) {
        //    me.started = true;
        //
        //    if (runScript) {
        //try {
        //    var firstLocation = source.locations[ndx];
        //    var firstBreakpoint = requestManager.createBreakpointRequest(firstLocation);
        //    var lastLocation = source.locations[source.locations.length-1];
        //    var firstBreakpoint = requestManager.createBreakpointRequest(lastLocation);
        //firstBreakpoint.enabled = true;
        //}
        //catch (ex if ex instanceof AbsentInformationException) {
        //    console.exception(ex)
        //}
        //}
        //}
        return false;
    },
    handleClassUnloadEvent      : function (event) {
        return false;
    },
    handleThreadStartEvent      : function (event) {
        return false;
    },
    handleThreadDeathEvent      : function (event) {
        return false;
    },
    handleVMStartEvent          : function (event) {
        return false;
    },
    handleVMDeathEvent          : function (event) {
        return false;
    },
    handleVMDisconnectEvent     : function (event) {
        //for each (var source in this.sourceMap) {
        //    source.clearSession();
        //}
        this.status = 'disconnected';
        this.remoteVM = null;
        return false;
    }

});

decaf.extend(exports, {
    Target : Target
});
