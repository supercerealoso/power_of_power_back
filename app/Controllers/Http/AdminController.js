'use strict';

const User = use('App/Models/User');
const Env = use('Env');

class AdminController {
    async create() {
        const user = await User.findOrCreate({
            username: Env.getOrFail('ADMIN_USER')
        }, {
            username: Env.getOrFail('ADMIN_USER'),
            password: Env.getOrFail('ADMIN_PASS'),
            email: Env.getOrFail('ADMIN_EMAIL')
        });
        return !!user;
    }
}

module.exports = AdminController;