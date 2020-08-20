'use strict';

const User = use('App/Models/User');
const Env = use('Env');

class AdminController {
    async create({ response }) {
        const user = await User.findOrCreate({
            username: Env.getOrFail('ADMIN_USER')
        }, {
            username: Env.getOrFail('ADMIN_USER'),
            password: Env.getOrFail('ADMIN_PASS'),
            email: Env.getOrFail('ADMIN_EMAIL')
        });
        return response.json({
            success: true
        });
    }
    async login({ request, response, auth, session }) {
        const { email, password } = request.all();
        try {
            await auth.attempt(email, password);
        } catch (e) {
            await session
                .withErrors({ login: 'Login fail' })
                .flashAll();
        }
        return response.redirect('back');
    }
    async logout({ auth, response }) {
        try {
            await auth.logout();
        } catch (e) {
        }
        return response.redirect('back');
    }
}

module.exports = AdminController;