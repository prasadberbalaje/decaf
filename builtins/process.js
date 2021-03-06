/*!
 * Created with JetBrains WebStorm.
 * User: mschwartz
 * Date: 6/8/13
 * Time: 6:06 PM
 */

/**
 * @class builtin.process
 * @singleton
 *
 * # builtin.process
 *
 * This builtin singleton provides low-level process related methods.
 *
 * Rather than using this singleton's methods directly, you will likely want to require('process') instead.  That
 * module provides a much richer set of methods.  These methods are intended for use during the bootstrap process.
 */

/*global builtin, java */
(function () {
    "use strict";
    var Runtime = java.lang.Runtime;

    builtin.process = {
        /**
         * Put current thread to sleep (block) for specified number of seconds.
         *
         * @param {Number} secs number of seconds to sleep.
         */
        sleep          : function (secs) {
            java.lang.Thread.sleep(secs * 1000);
        },
        /**
         * Put current thread to sleep (block) for specified number of milliseconds
         *
         * @param {Number} msecs number of milliseconds to sleep
         */
        usleep         : function (msecs) {
            java.lang.Thread.sleep(msecs);
        },
        /**
         * This method causes the application to terminate.
         *
         * @param {Number} code the exit code for the program.
         */
        exit           : function (code) {
            java.lang.System.exit(code || 0);
        },
        /**
         * Returns the amount of free memory in the Java Virtual Machine. Calling the gc method may result in increasing the value returned by freeMemory.
         *
         * @returns {Number} bytes - an approximation to the total amount of memory currently available for future allocated objects, in bytes.
         */
        getFreeMemory  : function () {
            return Runtime.getRuntime().freeMemory();
        },
        /**
         * Returns the maximum amount of memory that the Java virtual machine will attempt to use. If there is no inherent limit then the value Long.MAX_VALUE will be returned.
         *
         * @returns {Number} bytes - the maximum amount of memory that the virtual machine will attempt to use, measured in bytes
         */
        getMaxMemory   : function () {
            return Runtime.getRuntime().maxMemory();
        },
        /**
         * Returns the total amount of memory in the Java virtual machine. The value returned by this method may vary over time, depending on the host environment.
         *
         * Note that the amount of memory required to hold an object of any given type may be implementation-dependent.
         *
         * @returns {Number} bytes - the total amount of memory currently available for current and future objects, measured in bytes.
         */
        getTotalMemory : function () {
            return Runtime.getRuntime().totalMemory();
        },
        /**
         * Runs the garbage collector. Calling this method suggests that the Java virtual machine expend effort toward recycling unused objects in order to make the memory they currently occupy available for quick reuse. When control returns from the method call, the virtual machine has made its best effort to recycle all discarded objects.
         *
         * The name gc stands for "garbage collector". The virtual machine performs this recycling process automatically as needed, in a separate thread, even if the gc method is not invoked explicitly.
         */
        gc: function() {
            Runtime.getRuntime().gc();
        }
    }
}());
