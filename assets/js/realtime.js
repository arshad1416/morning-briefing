/**
 * Real-Time Price Updates
 * Polls /data/latest.json every 60 seconds and fires a custom DOM event
 * that Dashboard and Charts pages can listen for.
 *
 * Usage:
 *   window.addEventListener('price-update', (e) => {
 *     const { data, timestamp } = e.detail;
 *     // data = parsed /data/latest.json
 *   });
 */
(function () {
  'use strict';

  const POLL_INTERVAL = 60 * 1000; // 60 seconds
  let _pollTimer = null;
  let _lastData = null;

  /**
   * Fetch latest data and dispatch a custom event.
   * Falls back gracefully if the request fails.
   */
  async function poll() {
    try {
      const url = '/data/latest.json?_t=' + Date.now();
      const resp = await fetch(url);
      if (!resp.ok) return;

      const data = await resp.json();
      if (!data) return;

      _lastData = data;

      // Dispatch a custom DOM event that pages can listen for
      const event = new CustomEvent('price-update', {
        bubbles: true,
        cancelable: false,
        detail: {
          data: data,
          timestamp: Date.now(),
          market_summary: data.market_summary || {},
        },
      });
      document.dispatchEvent(event);

      // Also fire a per-ticker event for any ticker that has a current price
      if (data.market_summary?.indices) {
        data.market_summary.indices.forEach(idx => {
          if (!idx.ticker) return;
          const tickerEvent = new CustomEvent('price-update-' + idx.ticker, {
            bubbles: true,
            detail: {
              ticker: idx.ticker,
              price: idx.price,
              change_pct: idx.change_pct,
              timestamp: Date.now(),
            },
          });
          document.dispatchEvent(tickerEvent);
        });
      }

      // Also fire for screener data (individual ticker prices)
      if (data.premarket_top_setups) {
        data.premarket_top_setups.forEach(s => {
          if (!s.ticker) return;
          const tickerEvent = new CustomEvent('price-update-' + s.ticker, {
            bubbles: true,
            detail: {
              ticker: s.ticker,
              price: s.price,
              change_pct: s.change_pct,
              timestamp: Date.now(),
            },
          });
          document.dispatchEvent(tickerEvent);
        });
      }

    } catch (err) {
      // Silently fail — don't spam console on network errors
      if (window.console && console.debug) {
        console.debug('[realtime] poll failed:', err.message);
      }
    }
  }

  /**
   * Start the polling interval.
   * Only one interval runs at a time.
   */
  function start() {
    stop();
    // Do an immediate poll, then repeat
    poll();
    _pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  /**
   * Stop the polling interval.
   */
  function stop() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  /**
   * Get the last fetched data synchronously.
   */
  function getLastData() {
    return _lastData;
  }

  // Expose public API
  window.Realtime = {
    start: start,
    stop: stop,
    poll: poll,
    getLastData: getLastData,
  };

  // Auto-start when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
