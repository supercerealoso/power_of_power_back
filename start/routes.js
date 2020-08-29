'use strict';

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URL's and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.1/routing
|
*/

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use('Route');

Route.on('/').render('home');

Route.get('/admin/create', 'AdminController.create');
Route.post('/admin/login', 'AdminController.login');
Route.post('/admin/logout', 'AdminController.logout');

Route.on('/comic/create').render('comic.create');
Route.post('/comic/create', 'ComicController.create');
Route.get('/comic/list', 'ComicController.list');
Route.get('/comic/edit/:index', 'ComicController.show');
Route.post('/comic/edit', 'ComicController.edit');
Route.post('/comic/publish', 'ComicController.publish');
Route.post('/comic/count', 'ComicController.count');
Route.post('/comic/archive', 'ComicController.archive');
Route.post('/comic/index', 'ComicController.index');
Route.post('/comic/sitemap', 'ComicController.sitemap');

Route.on('/post/create').render('post.create');
Route.post('/post/create', 'PostController.create');
Route.get('/post/list', 'PostController.list');
Route.post('/post/publish', 'PostController.publish');
Route.get('/post/edit/:index', 'PostController.show');
Route.post('/post/edit', 'PostController.edit');
Route.post('/post/archive', 'PostController.archive');