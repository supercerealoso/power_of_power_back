'use strict';

const fs = use('fs').promises;
const { validate } = use('Validator');
const Env = use('Env');
const View = use('View');
const MongoClient = use('mongodb').MongoClient;
const { Octokit } = use("@octokit/rest");
const minify = use('@node-minify/core');
const htmlMinifier = use('@node-minify/html-minifier');

const octokit = new Octokit({
    auth: Env.get('GITHUB_TOKEN', '')
});

View.global('raw', function (html) {
    return this.safe(html);
});

class PostController {
    async create({ request, response, auth, session }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('/post/create');
        }
        const rules = {
            index: 'required|integer',
            image: 'required|url',
            thumb: 'required|url',
            title: 'required|string',
            content: 'required|string',
            top: 'boolean',
            posted: 'required|date',
            keywords: 'required|string'
        };
        const validation = await validate(request.all(), rules);
        if (validation.fails()) {
            await session.withErrors(validation.messages()).flashAll();
            return response.redirect('/post/create');
        }
        // check if comic exists
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('posts');
        const post = await collection.find({
            index: +request.input('index')
        }).next();
        if (post) {
            await mongo.close();
            await session.withErrors({ post: 'Post exists' });
            return response.redirect('/post/create');
        }
        // insert
        await collection.insertOne({
            index: +request.input('index'),
            image: request.input('image'),
            thumb: request.input('thumb'),
            title: request.input('title').trim(),
            content: request.input('content').trim(),
            top: !!request.input('top'),
            posted: Date.parse(request.input('posted')),
            keywords: request.input('keywords').trim()
        });
        await mongo.close();
        await session.flash({ post: 'Post created' });
        return response.redirect('/post/create');
    }
}

module.exports = PostController;