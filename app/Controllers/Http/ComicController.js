'use strict';

const { validate } = use('Validator');
const Env = use('Env');
const MongoClient = use('mongodb').MongoClient;

const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
    useNewUrlParser: true
});

class ComicController {
    async create({ request, response, auth, session }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('/comic/create');
        }
        const rules = {
            index: 'required|integer',
            image: 'required|url',
            alt: 'required|string',
            thumb: 'required|url',
            title: 'required|string',
            comment: 'required|string',
            special: 'string',
            top: 'boolean',
            posted: 'required|date',
            keywords: 'required|string',
            transcript: 'required|string'
        };
        const validation = await validate(request.all(), rules);
        if (validation.fails()) {
            await session.withErrors(validation.messages()).flashAll();
            return response.redirect('/comic/create');
        }
        // check if comic exists
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comic = await collection.find({
            index: request.input('index')
        }).next();
        if (comic) {
            await mongo.close();
            await session.withErrors({ comic: 'Comic exists' });
            return response.redirect('/comic/create');
        }
        // insert
        await collection.insertOne(request.all());
        await mongo.close();
        await session.flash({ comic: 'Comic created' });
        return response.redirect('/comic/create');
    }
}

module.exports = ComicController;