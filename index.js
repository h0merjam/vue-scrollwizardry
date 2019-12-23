/* eslint-env browser */

import {
  sceneManager,
  sceneDirective,
  pinDirective,
  classToggleDirective,
  tweenDirective,
} from './src';

function plugin(Vue, options) {
  if (options.addIndicators) {
    sceneManager.addIndicators = true;
  }
  Vue.prototype.$sceneManager = sceneManager;
  Vue.directive('sw-scene', sceneDirective);
  Vue.directive('sw-pin', pinDirective);
  Vue.directive('sw-class-toggle', classToggleDirective);
  Vue.directive('sw-tween', tweenDirective);
}

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin);
}

export default plugin;

// const version = '__VERSION__'

export {
  sceneManager,
  sceneDirective,
  pinDirective,
  classToggleDirective,
  tweenDirective,
  // version
};
