'use strict';

const fs = use('fs').promises;
const { validate } = use('Validator');
const Env = use('Env');
const MongoClient = use('mongodb').MongoClient;
const { Octokit } = use("@octokit/rest");
const minify = use('@node-minify/core');
const babelMinify = require('@node-minify/babel-minify');
const cleanCSS = use('@node-minify/clean-css');
const htmlMinifier = use('@node-minify/html-minifier');
const octokit = new Octokit({
    auth: Env.get('GITHUB_TOKEN', '')
});

View.global('raw', function (html) {
    return this.safe(html);
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
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comic = await collection.find({
            index: +request.input('index')
        }).next();
        if (comic) {
            await mongo.close();
            await session.withErrors({ comic: 'Comic exists' });
            return response.redirect('/comic/create');
        }
        // insert
        await collection.insertOne({
            index: +request.input('index'),
            image: request.input('image'),
            alt: request.input('alt').trim(),
            thumb: request.input('thumb'),
            title: request.input('title').trim(),
            comment: request.input('comment').trim(),
            special: request.input('special'),
            top: !!request.input('top'),
            posted: Date.parse(request.input('posted')),
            keywords: request.input('keywords').trim(),
            transcript: request.input('transcript').trim()
        });
        await mongo.close();
        await session.flash({ comic: 'Comic created' });
        return response.redirect('/comic/create');
    }
    async list({ view }) {
        // get comics
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comics = await collection.find({}, {
            index: 1,
            title: 1,
            top: 1
        }).toArray();
        await mongo.close();
        return view.render('comic.list', { comics: comics });
    }
    async show({ view, params, response }) {
        // get comic
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comic = await collection.find({
            index: +params.index
        }).next();
        await mongo.close();
        if (comic) {
            comic.posted = new Date(comic.posted).toISOString().split("T")[0];
            if (!comic.special) {
                comic.special = '';
            }
            return view.render('comic.edit', { comic: comic });
        } else {
            return response.redirect('/comic/list');
        }
    }
    async edit({ request, response, auth, session }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('back');
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
            return response.redirect('back');
        }
        // update comic
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        await collection.updateOne({
            index: +request.input('index')
        }, {
            $set: {
                image: request.input('image'),
                alt: request.input('alt').trim(),
                thumb: request.input('thumb'),
                title: request.input('title').trim(),
                comment: request.input('comment').trim(),
                special: request.input('special'),
                top: !!request.input('top'),
                posted: Date.parse(request.input('posted')),
                keywords: request.input('keywords').trim(),
                transcript: request.input('transcript').trim()
            }
        });
        await mongo.close();
        await session.flash({ comic: 'Comic edited' });
        return response.redirect('back');
    }
    async publish({ request, response, auth, session, view }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('back');
        }
        // get comic
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comic = await collection.find({
            index: +request.input('index')
        }).next();
        // render comic
        if (comic) {
            comic.posted = new Date(comic.posted).toISOString().split("T")[0];
            if (!comic.special) {
                comic.special = '';
            }
            const name = 'comics/' + comic.index + '/index.html'
            const txt = view.render('comic.layout', { comic: comic });
            await fs.writeFile('_temp', txt, 'utf8');
            const min = await minify({
                compressor: htmlMinifier,
                input: '_temp',
                output: '_temp'
            });
            const buff = new Buffer(min);
            // check if update is possible
            const file = await octokit.repos.createOrUpdateFileContents({
                owner: 'supercerealoso',
                repo: 'power_of_power_front',
                path: name,
                message: 'automated',
                content: buff.toString('base64'),
                sha: comic.sha
            });
            // update sha
            await collection.updateOne({
                index: +request.input('index')
            }, {
                $set: {
                    sha: file.data.content.sha
                }
            });
        }
        await mongo.close();
        return response.redirect('back');
    }
}

module.exports = ComicController;