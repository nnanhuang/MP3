var mongoose = require('mongoose');
var User = require('../models/user');
var Task = require('../models/task');
var u = require('./utils');
var ApiError = u.ApiError;

var EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

/*
 * Validate a user body (POST or PUT). Throws ApiError in the required order:
 * field format (400), duplicate email (400), missing tasks (404), completed tasks (400).
 * Returns the cleaned values; nothing is written here.
 */
async function validateUserBody(body, userId) {
    body = body || {};
    var name = u.requireString(body, 'name', 'Name');
    var email = u.requireString(body, 'email', 'Email');
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Email must be a valid email address');

    var raw = body.pendingTasks;
    var pendingTasks;
    if (raw === undefined || raw === null) {
        pendingTasks = [];
    } else if (typeof raw === 'string') {
        pendingTasks = raw === '' ? [] : [raw];
    } else if (Array.isArray(raw)) {
        pendingTasks = raw;
    } else {
        throw new ApiError(400, 'pendingTasks must be a list of task ids');
    }
    pendingTasks.forEach(function (id) {
        if (!u.isValidId(id)) throw new ApiError(400, 'pendingTasks contains an invalid task id');
    });
    pendingTasks = Array.from(new Set(pendingTasks.map(String)));

    var emailFilter = { email: email };
    if (userId) emailFilter._id = { $ne: userId };
    if (await User.exists(emailFilter)) {
        throw new ApiError(400, 'A user with this email already exists');
    }

    if (pendingTasks.length > 0) {
        var tasks = await Task.find({ _id: { $in: pendingTasks } }).select('completed').lean();
        if (tasks.length !== pendingTasks.length) {
            throw new ApiError(404, 'One or more tasks in pendingTasks do not exist');
        }
        if (tasks.some(function (t) { return t.completed; })) {
            throw new ApiError(400, 'Completed tasks cannot be in pendingTasks');
        }
    }

    return { name: name, email: email, pendingTasks: pendingTasks };
}

/*
 * Bring the tasks in line with the user's new pendingTasks:
 * - this user's pending tasks that are no longer listed become unassigned
 * - listed tasks are taken away from any other user and assigned to this user
 * - all of this user's tasks (completed ones too) get the current name
 */
async function syncTasksForUser(userId, name, pendingTasks) {
    await Task.updateMany(
        { assignedUser: userId, completed: false, _id: { $nin: pendingTasks } },
        { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
    );
    if (pendingTasks.length > 0) {
        await User.updateMany(
            { _id: { $ne: userId }, pendingTasks: { $in: pendingTasks } },
            { $pull: { pendingTasks: { $in: pendingTasks } } }
        );
        await Task.updateMany(
            { _id: { $in: pendingTasks } },
            { $set: { assignedUser: userId, assignedUserName: name } }
        );
    }
    await Task.updateMany({ assignedUser: userId }, { $set: { assignedUserName: name } });
}

module.exports = function (router) {

    var usersRoute = router.route('/users');

    usersRoute.get(u.wrap(async function (req, res) {
        var data = await u.listCollection(User, req.query, undefined);
        u.send(res, 200, 'OK', data);
    }));

    usersRoute.post(u.wrap(async function (req, res) {
        var v = await validateUserBody(req.body, null);
        var id = new mongoose.Types.ObjectId();
        var user = new User({ _id: id, name: v.name, email: v.email, pendingTasks: v.pendingTasks });
        await user.save();
        await syncTasksForUser(String(id), v.name, v.pendingTasks);
        u.send(res, 201, 'User created', user.toObject());
    }));

    var userRoute = router.route('/users/:id');

    userRoute.get(u.wrap(async function (req, res) {
        var data = await u.findOneById(User, req.params.id, req.query, 'User');
        u.send(res, 200, 'OK', data);
    }));

    userRoute.put(u.wrap(async function (req, res) {
        var id = req.params.id;
        if (!u.isValidId(id)) throw new ApiError(404, 'User not found');
        var user = await User.findById(id);
        if (!user) throw new ApiError(404, 'User not found');

        var v = await validateUserBody(req.body, id);
        user.name = v.name;
        user.email = v.email;
        user.pendingTasks = v.pendingTasks;
        await user.save();
        await syncTasksForUser(id, v.name, v.pendingTasks);
        u.send(res, 200, 'User updated', user.toObject());
    }));

    userRoute.delete(u.wrap(async function (req, res) {
        var id = req.params.id;
        if (!u.isValidId(id)) throw new ApiError(404, 'User not found');
        var user = await User.findById(id).lean();
        if (!user) throw new ApiError(404, 'User not found');

        await Task.updateMany(
            { assignedUser: id },
            { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
        );
        await User.deleteOne({ _id: id });
        res.status(204).end();
    }));

    return router;
};
