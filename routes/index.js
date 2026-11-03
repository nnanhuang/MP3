/*
 * Connect all of your endpoints together here.
 * All route files register on the same router, which is mounted once at /api.
 */
module.exports = function (app, router) {
    require('./home.js')(router);
    require('./users.js')(router);
    require('./tasks.js')(router);
    app.use('/api', router);
};
