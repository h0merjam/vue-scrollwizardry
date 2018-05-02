/* eslint no-underscore-dangle: 0, max-len: 0, prefer-destructuring: 0, no-nested-ternary: 0 */

import TweenMax from 'gsap/TweenMax';
import TimelineMax from 'gsap/TimelineMax';
import * as ScrollWizardry from 'scrollwizardry';

const { Controller, Scene } = ScrollWizardry;

const defaultOptions = {
  addIndicators: false,
};

let sceneManager;

class SceneManager {
  constructor(options) {
    this.options = options;

    this._scenes = {};
    this._sceneObservers = {};

    if (typeof window === 'undefined') {
      return;
    }

    this.controller = new Controller(options);
  }

  static getTargetElement(element, targetElement) {
    if (targetElement) {
      if (typeof targetElement === 'string') {
        if (/^(parent)$/i.test(targetElement)) {
          return element.parentNode;
        }
        return document.querySelector(targetElement);
      }
      return targetElement;
    }
    return element;
  }

  static parseString(string, triggerElement) {
    let number;

    const vh = /([0-9]+)vh$/.exec(string);
    if (vh) {
      number = () => window.innerHeight * (parseFloat(vh[1]) / 100);
    }

    const percent = /([0-9]+)%$/.exec(string);
    if (percent) {
      number = () => triggerElement.clientHeight * (parseFloat(percent[1]) / 100);
    }

    return number;
  }

  static mounted(element) {
    return new Promise((resolve) => {
      const observer = new MutationObserver(resolve);
      observer.observe(element.parentNode, { childList: true });
    });
  }

  get addIndicators() {
    return this.options.addIndicators;
  }

  _notifySceneObservers(sceneId, ...args) {
    this._sceneObservers[sceneId].forEach((fn) => {
      fn(this.getScene(sceneId), sceneId, ...args);
    });
  }

  addSceneObserver(sceneId, observer) {
    if (this._scenes[sceneId]) {
      observer(this._scenes[sceneId], sceneId);
      return;
    }

    if (!this._sceneObservers[sceneId]) {
      this._sceneObservers[sceneId] = [];
    }

    this._sceneObservers[sceneId].push(observer);
  }

  getSceneIds(sceneId) {
    const defaultSceneId = Object.keys(this._scenes)[0] || 0;

    if (Object.prototype.toString.call(sceneId) === '[object Array]') {
      return sceneId;
    }

    return sceneId && sceneId.length ? [sceneId] : [defaultSceneId];
  }

  getSceneCount() {
    return Object.keys(this._scenes).length;
  }

  getScene(sceneId) {
    sceneId = sceneId || this.getSceneIds(sceneId)[0];

    return this._scenes[sceneId];
  }

  setScene(sceneId, scene) {
    this._scenes[sceneId] = scene;

    if (this._sceneObservers[sceneId]) {
      this._notifySceneObservers(sceneId, scene);
    }
  }

  destroyScene(sceneId) {
    const scene = this._scenes[sceneId];

    this.controller.removeScene(scene);

    scene.destroy(true);

    delete this._scenes[sceneId];
  }

  removeSceneObservers(sceneId, observers = []) {
    const observerIds = observers.map(observer => observer.id);

    if (this._sceneObservers[sceneId]) {
      this._sceneObservers[sceneId] = this._sceneObservers[sceneId].filter(({ id }) => !observerIds.includes(id));
    }
  }
}

const sceneDirective = {
  inserted(el, binding) {
    const options = binding.value;

    const sceneId = options.sceneId ? sceneManager.getSceneIds(options.sceneId)[0]
      : `_scene-${sceneManager.getSceneCount() + 1}`;

    if (sceneManager.getScene(sceneId)) {
      sceneManager.destroyScene(sceneId);
    }

    let scene;
    let offset = options.offset !== undefined ? options.offset : 0;
    let duration = options.duration !== undefined ? options.duration : 0;
    const triggerElement = options.triggerElement ? options.triggerElement : el;
    const triggerHook = options.triggerHook !== undefined ? options.triggerHook : 0.5;

    if (typeof offset === 'string') {
      offset = SceneManager.parseString(offset, triggerElement);
    }

    if (typeof offset === 'function') {
      offset = offset();
    }

    if (typeof duration === 'function') {
      duration = duration.bind({
        scene,
        triggerElement,
        offset,
        triggerHook: options.triggerHook,
      });
    }

    if (typeof duration === 'string') {
      duration = SceneManager.parseString(duration, triggerElement);
    }

    scene = new Scene({
      offset,
      duration,
      triggerElement,
      triggerHook,
    });

    if (options.on) {
      Object.keys(options.on).forEach((eventName) => {
        scene.on(eventName, (event) => {
          options.on[eventName]({
            event,
            scene,
            triggerElement,
            props: options.props,
          });
        });
      });
    }

    if (sceneManager.addIndicators) {
      scene.addIndicators({
        name: sceneId,
      });
    }

    scene.addTo(sceneManager.controller);

    sceneManager.setScene(sceneId, scene);

    if (options.on && options.on.init) {
      options.on.init({
        scene,
        triggerElement,
        props: options.props,
      });
    }
  },
  unbind(el, binding) {
    const options = binding.value;

    const sceneId = sceneManager.getSceneIds(options.sceneId)[0];

    sceneManager.destroyScene(sceneId);
  },
};

const pinDirective = {
  bind(el, binding) {
    const options = binding.value;

    el.$observers = [];

    sceneManager.getSceneIds(options.sceneId).forEach((sceneId) => {
      const observer = (scene) => {
        scene.setPin(SceneManager.getTargetElement(el, options.targetElement));
      };

      observer.id = +new Date();

      el.$observers.push(observer);

      sceneManager.addSceneObserver(sceneId, observer);
    });
  },
  unbind(el, binding) {
    const options = binding.value;
    sceneManager.removeSceneObservers(options.sceneId, el.$observers);
    delete el.$observers;
  },
};

const classToggleDirective = {
  bind(el, binding) {
    const options = binding.value;

    el.$observers = [];

    sceneManager.getSceneIds(options.sceneId).forEach((sceneId, i) => {
      let className = options.class || options.classes;

      if (Object.prototype.toString.call(className) === '[object Array]') {
        className = className[i];
      }

      const observer = (scene) => {
        scene.setClassToggle(SceneManager.getTargetElement(el, options.targetElement), className);
      };

      observer.id = +new Date();

      el.$observers.push(observer);

      sceneManager.addSceneObserver(sceneId, observer);
    });
  },
  unbind(el, binding) {
    const options = binding.value;
    sceneManager.removeSceneObservers(options.sceneId, el.$observers);
    delete el.$observers;
  },
};

const tweenDirective = {
  bind(el, binding) {
    const options = binding.value;

    el.$observers = [];

    sceneManager.getSceneIds(options.sceneId).forEach((sceneId) => {
      const duration = options.duration || 1;
      const fromVars = options.fromVars;
      const toVars = options.toVars || options.vars;
      const method = fromVars && toVars ? 'fromTo' : fromVars ? 'from' : 'to';

      const observer = (scene) => {
        if (!scene.timeline) {
          scene.timeline = new TimelineMax();
        }

        const tween = TweenMax[method](SceneManager.getTargetElement(el, options.targetElement), duration, fromVars || toVars, toVars);

        scene.timeline.add([tween], 0, 'normal');

        scene.setTween(scene.timeline);
      };

      observer.id = +new Date();

      el.$observers.push(observer);

      sceneManager.addSceneObserver(sceneId, observer);
    });
  },
  unbind(el, binding) {
    const options = binding.value;
    sceneManager.removeSceneObservers(options.sceneId, el.$observers);
    delete el.$observers;
  },
};

sceneManager = new SceneManager(options);

export {
  sceneManager,
  sceneDirective,
  pinDirective,
  classToggleDirective,
  tweenDirective,
};
