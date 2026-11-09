import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import htm from 'htm';

window.React = React;
window.ReactDOM = ReactDOMClient;
window.htm = htm;

import('./lib.js').then(() => import('./app.js'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
