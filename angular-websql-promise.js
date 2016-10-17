(function (window, angular) {
    "use strict";

    function Database(db, $q) {
        var that = this;

        // Executes callback in transaction promise
        that.transaction = function (callback, preflight, postflight, readOnly, parentTransaction) {
            var deferred = $q.defer();

            var tId = Math.floor((Math.random() * 10000) + 1);

            db.transaction(function (tx) {
                //console.log(tId + ' transaction start');

                // Executes callback e gets return.
                // The cbResult can be a promise or value.
                $q.when(callback(new SqlTransaction(tx, $q, tId)))
                    .then(deferred.resolve)
                    .catch(deferred.reject)
                    .finally(function () {
                        //console.log(tId + ' transaction callback finally');

                        delete cbResult.promise;
                        cbResult = undefined;
                    });

                //console.log(tId + ' transaction finish');
            }, deferred.reject, null, preflight, postflight, readOnly, parentTransaction);

            return deferred.promise;
        };

        // Changes version
        that.changeVersion = function (oldVersion, newVersion, parentTransaction) {
            var deferred = $q.defer();

            db.changeVersion(oldVersion, newVersion, function (tx) {
                deferred.resolve()
            }, function (tx, e) {
                deferred.reject(e);
            }, null, parentTransaction);

            return deferred.promise;
        };

        return that;
    }

    function SqlTransaction(tx, $q, tId) {
        var that = this;
        var tx = tx;

        // Maps ResultSet for a array of items
        function map(rs) {
            var items = [];

            for (var i = 0, len = rs.rows.length; i < len; i++) {
                items.push(rs.rows.item(i));
            }

            return items;
        };

        // Resolves all promises
        function resolveAll(promises) {
            var deferred = $q.defer();
            var counter = 0;

            while (!!promises.length) {
                counter++;

                var promise = promises.shift();

                $q.when(promise)
                    .then(function () {
                        if (!(--counter)) {
                            deferred.resolve();
                        }
                    }, deferred.reject)
                    .finally(function () {
                        delete promise.promise;
                        promise = undefined;
                    });
            }

            promises = undefined;

            if (counter === 0) {
                deferred.resolve();
            }

            return deferred.promise;
        }

        // Executes sql promise
        that.executeSql = function (sql, params) {
            params = params || [];

            if (!sql) {
                throw new Error("sql can't be null or empty");
            }

            if (Object.prototype.toString.call(params) !== "[object Array]") {
                throw new Error("params must be a array");
            }

            var deferred = $q.defer();

            //console.log(tId + ' execute sql')

            tx.executeSql(sql, params,
                       function (tx, rs) {
                           //console.log(tId + ' execute sql resolve')
                           deferred.resolve(map(rs));
                       },
                       function (tx, e) {
                           //console.log(tId + ' execute sql reject')
                           console.error(e);
                           deferred.reject(e);
                       });

            return deferred.promise;
        };

        // Executes multiple sql promise
        that.executeMultipleSql = function (list, sql, paramsMap) {
            paramsMap = paramsMap || function () { return []; };

            if (Object.prototype.toString.call(list) !== "[object Array]") {
                throw new Error("list must be a array");
            }

            if (!sql) {
                throw new Error("sql can't be null or empty");
            }

            if (typeof paramsMap !== "function") {
                reject(new Error('paramsMap must be a function'));
            }

            //console.log(tId + ' execute multiple sql');

            return resolveAll(list.map(function (item) {
                // Execute sql promise for each item
                return that.executeSql(sql, paramsMap(item));
            }));
        };

        return that;
    }

    angular
        .module("angular-websql-promise", [])
        .factory("$webSql", ["$q",
            function ($q) {
                var webSql = {};

                // Open database
                webSql.open = function (name, version, displayName, estimatedSize) {
                    if (typeof (openDatabase) == "undefined")
                        throw new Error("Browser does not support web sql");

                    var db = openDatabase(name, version, displayName, estimatedSize);

                    return new Database(db, $q);
                }

                return webSql;
            }]);
})(window, window.angular);
