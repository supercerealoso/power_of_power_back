'use strict';

const { validate } = use('Validator')

class ComicController {
    async create({ request, response, auth, session }) {
        try {
            await auth.check();
        } catch (e) {
            await session
                .withErrors({ login: 'Login fail' });
            return response.redirect('/');
        }
        const rules = {
            index: 'required|integer',
            image: 'required|url',
            alt: 'required|string',
            thumb: 'required|url',
            title: 'required|string',
            comment: 'required|string',
            special: 'string',
            top: 'required|boolean',
            posted: 'required|date',
            keywords: 'required|string',
            transcript: 'required|string'
        };
        const validation = await validate(request.all(), rules);
        if (validation.fails()) {
            await session.withErrors(validation.messages()).flashAll();
            return response.redirect('/');
        }
        await session.flashMessage('comic', 'Comic created');
        return response.redirect('/');
    }
}

module.exports = ComicController;