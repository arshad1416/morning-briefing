/**
 * App initialization — register routes and start the router.
 */
(function() {
  'use strict';

  // Register routes
  Router.register('/', (app) => Dashboard.render(app));
  Router.register('/watchlist', (app) => Watchlist.render(app));
  Router.register('/archive', (app) => Archive.render(app));
  Router.register('/trades', (app) => PaperTrades.render(app));
  Router.register('/chat', (app) => Chat.render(app));
  Router.register('/ticker/:ticker', (app, params) => TickerDetail.render(app, params));
  Router.register('/archive/:date', (app, params) => Archive.renderDate(app, params));

  // Start
  Router.init();
})();
