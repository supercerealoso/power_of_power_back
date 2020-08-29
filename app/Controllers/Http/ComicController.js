'use strict';

const fs = use('fs').promises;
const { validate } = use('Validator');
const Env = use('Env');
const View = use('View');
const MongoClient = use('mongodb').MongoClient;
const { Octokit } = use("@octokit/rest");
const minify = use('@node-minify/core');
const htmlMinifier = use('@node-minify/html-minifier');
const { SitemapStream, streamToPromise } = use('sitemap');

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
            top: 1,
            version: 1
        }).sort({ version: 1, index: -1 }).toArray();
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
            comic.posted = new Date(comic.posted);
            comic.transcript = comic.transcript.replace('\n', '<br>');
            if (!comic.special) {
                comic.special = '';
            }
            const name = 'comics/' + comic.index + '.html'
            const txt = view.render('comic.layout', { comic: comic });
            await fs.writeFile('_temp', txt, 'utf8');
            const min = await minify({
                compressor: htmlMinifier,
                input: '_temp',
                output: '_temp',
                options: {
                    decodeEntities: true,
                    collapseInlineTagWhitespace: false
                }
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
                    sha: file.data.content.sha,
                    version: 1
                }
            });
        }
        await mongo.close();
        return response.redirect('back');
    }
    async count({ response, auth, session }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('back');
        }
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        // get the count
        const comics = mongo.db('powerofpower').collection('comics');
        const count = await comics.countDocuments({});
        // update the file
        const meta = mongo.db('powerofpower').collection('meta');
        const text = JSON.stringify({ count: count });
        const buff = new Buffer(text);
        const register = await meta.find({
            name: 'count'
        }).next() || {};
        const file = await octokit.repos.createOrUpdateFileContents({
            owner: 'supercerealoso',
            repo: 'power_of_power_front',
            path: 'comics/count.json',
            message: 'automated',
            content: buff.toString('base64'),
            sha: register.sha
        });
        meta.update(
            { name: 'count' },
            { $set: { sha: file.data.content.sha } },
            { upsert: true }
        );
        await mongo.close();
        return response.redirect('back');
    }
    async archive({ view, auth, session, response }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('back');
        }
        // get comics
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comics = await collection.find({}, {
            index: 1,
            title: 1,
            thumb: 1
        }).sort({ index: -1 }).toArray();
        // update the file
        const meta = mongo.db('powerofpower').collection('meta');
        const text = view.render('comic.archive', { comics: comics });
        await fs.writeFile('_temp', text, 'utf8');
        const min = await minify({
            compressor: htmlMinifier,
            input: '_temp',
            output: '_temp',
            options: {
                decodeEntities: true,
                collapseInlineTagWhitespace: false
            }
        });
        const buff = new Buffer(min);
        const register = await meta.find({
            name: 'archive'
        }).next() || {};
        const file = await octokit.repos.createOrUpdateFileContents({
            owner: 'supercerealoso',
            repo: 'power_of_power_front',
            path: 'archive.html',
            message: 'automated',
            content: buff.toString('base64'),
            sha: register.sha
        });
        meta.update(
            { name: 'archive' },
            { $set: { sha: file.data.content.sha } },
            { upsert: true }
        );
        await mongo.close();
        return response.redirect('back');
    }
    async index({ view, auth, session, response }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('back');
        }
        // get comics
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comics = await collection.find({ top: true }, {
            index: 1,
            title: 1,
            thumb: 1
        }).sort({ index: -1 }).toArray();
        const collection2 = mongo.db('powerofpower').collection('posts');
        const posts = await collection2.find({ top: true }, {
            index: 1,
            title: 1,
            thumb: 1
        }).sort({ index: -1 }).toArray();
        // update the file
        const meta = mongo.db('powerofpower').collection('meta');
        const text = view.render('comic.index', { comics: comics, posts: posts });
        await fs.writeFile('_temp', text, 'utf8');
        const min = await minify({
            compressor: htmlMinifier,
            input: '_temp',
            output: '_temp',
            options: {
                decodeEntities: true,
                collapseInlineTagWhitespace: false
            }
        });
        const buff = new Buffer(min);
        const register = await meta.find({
            name: 'index'
        }).next() || {};
        const file = await octokit.repos.createOrUpdateFileContents({
            owner: 'supercerealoso',
            repo: 'power_of_power_front',
            path: 'index.html',
            message: 'automated',
            content: buff.toString('base64'),
            sha: register.sha
        });
        meta.update(
            { name: 'index' },
            { $set: { sha: file.data.content.sha } },
            { upsert: true }
        );
        await mongo.close();
        return response.redirect('back');
    }
    async sitemap({ auth, session, response }) {
        try {
            await auth.check();
        } catch (e) {
            await session.withErrors({ login: 'Login fail' });
            return response.redirect('back');
        }
        // get comics
        const mongo = new MongoClient(Env.get('MONGODB_URL', ''), {
            useNewUrlParser: true
        });
        await mongo.connect();
        const collection = mongo.db('powerofpower').collection('comics');
        const comics = await collection.find({}, {
            index: 1
        }).sort({ index: -1 }).toArray();
        const collection2 = mongo.db('powerofpower').collection('posts');
        const posts = await collection2.find({}, {
            index: 1
        }).sort({ index: -1 }).toArray();
        // url list
        const links = [{ url: '/' }, { url: '/blog' }, { url: '/archive' }];
        comics.forEach(function (comic) {
            links.push('/comics/' + comic.index);
        });
        posts.forEach(function (post) {
            links.push('/blogarchive/' + post.index);
        });
        const stream = new SitemapStream({ hostname: 'https://powerofpower.net' });
        links.forEach(link => stream.write(link));
        stream.end();
        const text = await streamToPromise(stream);
        // update the file
        const meta = mongo.db('powerofpower').collection('meta');
        const buff = new Buffer(text);
        const register = await meta.find({
            name: 'sitemap'
        }).next() || {};
        const file = await octokit.repos.createOrUpdateFileContents({
            owner: 'supercerealoso',
            repo: 'power_of_power_front',
            path: 'sitemap.xml',
            message: 'automated',
            content: buff.toString('base64'),
            sha: register.sha
        });
        meta.update(
            { name: 'sitemap' },
            { $set: { sha: file.data.content.sha } },
            { upsert: true }
        );
        await mongo.close();
        return response.redirect('back');
    }
}

module.exports = ComicController;