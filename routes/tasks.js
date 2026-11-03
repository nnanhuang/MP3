var mongoose = require('mongoose');
var User = require('../models/user');
var Task = require('../models/task');
var u = require('./utils');
var ApiError = u.ApiError;

/*
 * Validate a task body (POST or PUT). Throws ApiError in the required order:
 * field format (400), missing assigned user (404), name mismatch (400).
 * Returns the cleaned task fields; nothing is written here.
 */
async function validateTaskBody(body) {
    body = body || {};
    var name = u.requireString(body, 'name', 'Name');
    var deadline = u.parseDate(body.deadline, 'Deadline');
    var description = u.optionalString(body, 'description', 'Description', '');
    var completed = u.parseBoolean(body.completed, 'Completed');
    var assignedUser = u.optionalString(body, 'assignedUser', 'assignedUser', '').trim();
    var assignedUserName = u.optionalString(body, 'assignedUserName', 'assignedUserName', undefined);
    if (assignedUserName !== undefined) assignedUserName = assignedUserName.trim();

    if (assignedUser !== '' && !u.isValidId(assignedUser)) {
        throw new ApiError(400, 'assignedUser is not a valid user id');
    }

    if (assignedUser === '') {
        if (assignedUserName !== undefined && assignedUserName !== '' && assignedUserName !== 'unassigned') {
            throw new ApiError(400, 'assignedUserName must be "unassigned" when no user is assigned');
        }
        assignedUserName = 'unassigned';
    } else {
        var user = await User.findById(assignedUser).select('name').lean();
        if (!user) throw new ApiError(404, 'The assigned user does not exist');
        if (assignedUserName !== undefined && assignedUserName !== '' && assignedUserName !== user.name) {
            throw new ApiError(400, 'assignedUserName does not match the name of the assigned user');
        }
        assignedUserName = user.name;
    }

    return {
        name: name,
        description: description,
        deadline: deadline,
        completed: completed,
        assignedUser: assignedUser,
        assignedUserName: assignedUserName
    };
}

/*
 * Make users' pendingTasks agree with the task: it is only in its assigned
 * user's pendingTasks, and only while it is not completed.
 */
async function syncUsersForTask(taskId, task) {
    var keepIn = task.assignedUser !== '' && !task.completed ? task.assignedUser : null;
    var pullFilter = { pendingTasks: taskId };
    if (keepIn) pullFilter._id = { $ne: keepIn };
    await User.updateMany(pullFilter, { $pull: { pendingTasks: taskId } });
    if (keepIn) {
        await User.updateOne({ _id: keepIn }, { $addToSet: { pendingTasks: taskId } });
    }
}

module.exports = function (router) {

    var tasksRoute = router.route('/tasks');

    tasksRoute.get(u.wrap(async function (req, res) {
        var data = await u.listCollection(Task, req.query, 100);
        u.send(res, 200, 'OK', data);
    }));

    tasksRoute.post(u.wrap(async function (req, res) {
        var v = await validateTaskBody(req.body);
        var task = new Task(Object.assign({ _id: new mongoose.Types.ObjectId() }, v));
        await task.save();
        await syncUsersForTask(String(task._id), v);
        u.send(res, 201, 'Task created', task.toObject());
    }));

    var taskRoute = router.route('/tasks/:id');

    taskRoute.get(u.wrap(async function (req, res) {
        var data = await u.findOneById(Task, req.params.id, req.query, 'Task');
        u.send(res, 200, 'OK', data);
    }));

    taskRoute.put(u.wrap(async function (req, res) {
        var id = req.params.id;
        if (!u.isValidId(id)) throw new ApiError(404, 'Task not found');
        var task = await Task.findById(id);
        if (!task) throw new ApiError(404, 'Task not found');

        var v = await validateTaskBody(req.body);
        task.set(v);
        await task.save();
        await syncUsersForTask(id, v);
        u.send(res, 200, 'Task updated', task.toObject());
    }));

    taskRoute.delete(u.wrap(async function (req, res) {
        var id = req.params.id;
        if (!u.isValidId(id)) throw new ApiError(404, 'Task not found');
        var task = await Task.findById(id).lean();
        if (!task) throw new ApiError(404, 'Task not found');

        await User.updateMany({ pendingTasks: id }, { $pull: { pendingTasks: id } });
        await Task.deleteOne({ _id: id });
        u.send(res, 200, 'Task deleted', task);
    }));

    return router;
};
